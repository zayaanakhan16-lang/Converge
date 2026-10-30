const fs = require('fs');
const path = require('path');

const { withAppBuildGradle, withDangerousMod, withMainApplication } = require('expo/config-plugins');

/**
 * Carries the Converge native audio sources into an Expo-generated Android
 * project.
 *
 * The canonical Java and C++ sources live in `android-native/` at the repository
 * root rather than under `mobile/`: they are not JavaScript and do not belong in
 * the app bundle, but PostGIS-style native code still has to end up inside the
 * generated `android/` project to be compiled. Expo regenerates that project from
 * scratch on prebuild, so a config plugin is what carries them across.
 *
 * The text-editing functions are exported separately from the plugin so they can
 * be checked against a fixture tree in a test. That is the only way to verify the
 * wiring without the Android toolchain, and a plugin that silently fails to wire
 * the library would fail much later, at link time.
 */

/** Files copied from `android-native/cpp` into the generated project. */
const CPP_FILES = ['waveform.h', 'waveform.cpp', 'waveform_jni.cpp', 'CMakeLists.txt'];

/** Marker used to detect that the Gradle wiring is already present. */
const CMAKE_PATH = 'src/main/cpp/CMakeLists.txt';

const CMAKE_GRADLE_BLOCK = `
    externalNativeBuild {
        cmake {
            path "${CMAKE_PATH}"
            version "3.22.1"
        }
    }
`;

const PACKAGE_IMPORT = 'import app.converge.audio.ConvergeAudioPackage';
const PACKAGE_REGISTRATION = 'add(ConvergeAudioPackage())';

function nativeSourceRoot(repoRoot) {
  return path.join(repoRoot, 'android-native');
}

function androidProjectRoot(mobileRoot) {
  return path.join(mobileRoot, 'android');
}

/** Every file below `directory`, recursively. */
function walk(directory) {
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

/**
 * Copy `android-native/java/app` into `app/src/main/java/app` and the C++ sources
 * into `app/src/main/cpp`.
 *
 * The Java tree keeps its directory layout because that is what makes the
 * `app.converge.audio` package resolve. `android-native/java/test` is skipped: it
 * holds host tests, not app code.
 *
 * @returns {{ javaFiles: string[], cppFiles: string[] }} paths copied, relative to `android/`
 */
function copyNativeSources(repoRoot, mobileRoot) {
  const sources = nativeSourceRoot(repoRoot);
  const android = androidProjectRoot(mobileRoot);
  const javaSource = path.join(sources, 'java/app');
  const javaTarget = path.join(android, 'app/src/main/java/app');

  const javaFiles = [];
  if (fs.existsSync(javaSource)) {
    copyDirectory(javaSource, javaTarget);
    javaFiles.push(
      ...walk(javaTarget).map((file) => path.relative(android, file)),
    );
  }

  const cppFiles = [];
  const cppTarget = path.join(android, 'app/src/main/cpp');
  if (fs.existsSync(path.join(sources, 'cpp'))) {
    fs.mkdirSync(cppTarget, { recursive: true });
    for (const name of CPP_FILES) {
      const from = path.join(sources, 'cpp', name);
      if (!fs.existsSync(from)) continue;
      fs.copyFileSync(from, path.join(cppTarget, name));
      cppFiles.push(path.join('app/src/main/cpp', name));
    }
  }

  return { javaFiles, cppFiles };
}

function copyDirectory(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const destination = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(source, destination);
    } else {
      fs.copyFileSync(source, destination);
    }
  }
}

/**
 * Add the CMake block to the text of `app/build.gradle`.
 *
 * Anchored on the `defaultConfig` block, which every Expo-generated Android
 * project has. Returns the contents unchanged when the marker is already present,
 * so running prebuild twice does not add the block twice.
 */
function addCmakeToAppGradle(contents) {
  if (contents.includes(CMAKE_PATH)) return contents;

  const match = /\n(\s*)defaultConfig\s*\{/.exec(contents);
  if (!match) {
    throw new Error(
      'Could not find a defaultConfig block in app/build.gradle, so the native CMake build could not be wired.',
    );
  }

  // Declared before defaultConfig, which is where Gradle expects the CMake path.
  const insertionPoint = match.index + 1;
  return contents.slice(0, insertionPoint) + CMAKE_GRADLE_BLOCK + contents.slice(insertionPoint);
}

/**
 * Add the package registration to the text of `MainApplication`.
 *
 * Autolinking only discovers packages inside `node_modules`, so a package living
 * in the app itself has to be registered explicitly. Both the Kotlin and Java
 * templates are handled, since the React Native version can be pinned either way.
 */
function registerPackageInMainApplication(contents, isKotlin) {
  if (contents.includes(PACKAGE_REGISTRATION)) return contents;

  const lastImport = contents.lastIndexOf('\nimport ');
  if (lastImport === -1) {
    throw new Error('No import statements found in MainApplication.');
  }

  const importEnd = contents.indexOf('\n', lastImport + 1);
  let updated = `${contents.slice(0, importEnd)}\n${PACKAGE_IMPORT}${contents.slice(importEnd)}`;

  const anchor = /(\n\s*)(?=return packages)/;
  if (!anchor.test(updated)) {
    throw new Error('Could not find where to register the native audio package in MainApplication.');
  }

  const statement = isKotlin ? `\n      ${PACKAGE_REGISTRATION}` : `\n      ${PACKAGE_REGISTRATION};`;
  updated = updated.replace(anchor, (match) => `${statement}${match}`);
  return updated;
}

/** Find the generated MainApplication source, which may be Kotlin or Java. */
function findMainApplication(androidRoot) {
  const roots = [
    path.join(androidRoot, 'app/src/main/java'),
    path.join(androidRoot, 'app/src/main/kotlin'),
  ].filter((directory) => fs.existsSync(directory));

  for (const root of roots) {
    const found = walk(root).find((file) => /MainApplication\.(kt|java)$/.test(file));
    if (found) return found;
  }
  return null;
}

/** Copy the sources and wire the Gradle and MainApplication changes. */
function applyNativeIntegration(repoRoot, mobileRoot) {
  if (!fs.existsSync(androidProjectRoot(mobileRoot))) {
    throw new Error(
      'No android/ project found. Run `npx expo prebuild --platform android` first.',
    );
  }

  const result = copyNativeSources(repoRoot, mobileRoot);
  const android = androidProjectRoot(mobileRoot);

  const gradlePath = path.join(android, 'app/build.gradle');
  const gradleContents = fs.readFileSync(gradlePath, 'utf8');
  const wiredGradle = addCmakeToAppGradle(gradleContents);
  const gradleChanged = wiredGradle !== gradleContents;
  if (gradleChanged) fs.writeFileSync(gradlePath, wiredGradle);

  const mainApplication = findMainApplication(android);
  if (!mainApplication) {
    throw new Error(
      'Could not find MainApplication in the generated Android project, so the native audio package could not be registered.',
    );
  }
  const appContents = fs.readFileSync(mainApplication, 'utf8');
  const registered = registerPackageInMainApplication(appContents, mainApplication.endsWith('.kt'));
  const packageRegistered = registered !== appContents;
  if (packageRegistered) fs.writeFileSync(mainApplication, registered);

  return { ...result, gradleChanged, packageRegistered };
}

/**
 * Expo config plugin.
 *
 * `repoRoot` defaults to the parent of the app directory, which is the layout of
 * this repository. It is overridable so the plugin can be exercised against a
 * fixture tree in a test.
 */
function withConvergeAudio(config, options = {}) {
  const mobileRoot = options.mobileRoot || process.cwd();
  const repoRoot = options.repoRoot || path.resolve(mobileRoot, '..');

  // Copies the sources into the generated project. The Gradle and
  // MainApplication edits are left to the mods below, which run through Expo's
  // own file handling rather than writing those files directly.
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      copyNativeSources(repoRoot, mobileRoot);
      return config;
    },
  ]);

  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error(
        'This project uses a Kotlin build script. The native CMake block in withConvergeAudio needs a Groovy app/build.gradle.',
      );
    }
    config.modResults.contents = addCmakeToAppGradle(config.modResults.contents);
    return config;
  });

  config = withMainApplication(config, (config) => {
    config.modResults.contents = registerPackageInMainApplication(
      config.modResults.contents,
      config.modResults.language === 'kt',
    );
    return config;
  });

  return config;
}

module.exports = withConvergeAudio;
module.exports.applyNativeIntegration = applyNativeIntegration;
module.exports.copyNativeSources = copyNativeSources;
module.exports.addCmakeToAppGradle = addCmakeToAppGradle;
module.exports.registerPackageInMainApplication = registerPackageInMainApplication;
module.exports.findMainApplication = findMainApplication;
module.exports.CMAKE_GRADLE_BLOCK = CMAKE_GRADLE_BLOCK;
module.exports.CPP_FILES = CPP_FILES;
