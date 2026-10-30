const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  addCmakeToAppGradle,
  applyNativeIntegration,
  copyNativeSources,
  registerPackageInMainApplication,
} = require('../withConvergeAudio');

const { CPP_FILES } = require('../withConvergeAudio');

/**
 * Tests for the Expo config plugin that carries the native audio sources into a
 * generated Android project.
 *
 * These run the real functions against a fixture tree on disk. That is the point:
 * the failure this guards against is the library not being copied or wired at all,
 * which would only surface later, at link time on a build machine.
 */

const APP_GRADLE = `android {
    compileSdkVersion 35

    defaultConfig {
        applicationId "app.converge.mobile"
    }
}
`;

function mainApplicationKotlin() {
  return `package app.converge.mobile

import android.app.Application
import com.facebook.react.PackageList

class MainApplication : Application() {
  override fun getPackages(): List<ReactPackage> {
    val packages = PackageList(this).packages
    return packages
  }
}
`;
}

function mainApplicationJava() {
  return `package app.converge.mobile;

import android.app.Application;
import com.facebook.react.PackageList;

public class MainApplication extends Application {
  protected List<ReactPackage> getPackages() {
    List<ReactPackage> packages = new PackageList(this).getPackages();
    return packages;
  }
}
`;
}

/** The real native sources, used as the source of truth for the fixture. */
const REAL_REPO = path.resolve(__dirname, '../../..');

/**
 * A temporary repository plus a generated Android project.
 *
 * The `android-native/` source tree is seeded from the real sources so the test
 * copies exactly the files prebuild would. The destination Java tree is left
 * empty: the assertion that the sources arrive there is the point.
 */
function fixture(mainApplication) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'converge-plugin-'));
  const repoRoot = path.join(root, 'Converge');
  const mobileRoot = path.join(repoRoot, 'mobile');
  const android = path.join(mobileRoot, 'android');
  const sourceAudio = path.join(repoRoot, 'android-native/java/app/converge/audio');
  const sourceCpp = path.join(repoRoot, 'android-native/cpp');
  const packageRoot = path.join(android, 'app/src/main/java/app/converge/mobile');

  fs.mkdirSync(sourceAudio, { recursive: true });
  fs.mkdirSync(sourceCpp, { recursive: true });
  fs.mkdirSync(packageRoot, { recursive: true });

  for (const name of CPP_FILES) {
    fs.copyFileSync(path.join(REAL_REPO, 'android-native/cpp', name), path.join(sourceCpp, name));
  }
  const realAudio = path.join(REAL_REPO, 'android-native/java/app/converge/audio');
  for (const name of fs.readdirSync(realAudio)) {
    fs.copyFileSync(path.join(realAudio, name), path.join(sourceAudio, name));
  }

  fs.writeFileSync(path.join(android, 'app/build.gradle'), APP_GRADLE);
  const extension = mainApplication.includes('public class') ? 'java' : 'kt';
  fs.writeFileSync(path.join(packageRoot, `MainApplication.${extension}`), mainApplication);

  return { root, repoRoot, mobileRoot, android };
}

describe('copyNativeSources', () => {
  it('copies the Java tree preserving the package layout', () => {
    const { repoRoot, mobileRoot, android } = fixture(mainApplicationKotlin());
    const result = copyNativeSources(repoRoot, mobileRoot);

    expect(result.javaFiles).toContain(
      path.join('app/src/main/java/app/converge/audio/ConvergeAudioModule.java'),
    );
    expect(
      fs.existsSync(path.join(android, 'app/src/main/java/app/converge/audio/ConvergeAudioPackage.java')),
    ).toBe(true);
  });

  it('does not copy the host tests', () => {
    const { repoRoot, mobileRoot, android } = fixture(mainApplicationKotlin());
    copyNativeSources(repoRoot, mobileRoot);
    const copied = fs.readdirSync(path.join(android, 'app/src/main/java/app/converge/audio'));
    expect(copied).not.toContain('WavDecoderTest.java');
  });

  it('copies the C++ sources without the host test or the runner script', () => {
    const { repoRoot, mobileRoot } = fixture(mainApplicationKotlin());
    const result = copyNativeSources(repoRoot, mobileRoot);

    expect(result.cppFiles).toHaveLength(4);
    expect(result.cppFiles.some((file) => file.includes('waveform_test'))).toBe(false);
    expect(result.cppFiles.some((file) => file.includes('run_tests'))).toBe(false);
  });
});

describe('addCmakeToAppGradle', () => {
  it('wires the CMake path inside the android block', () => {
    const wired = addCmakeToAppGradle(APP_GRADLE);
    expect(wired).toContain('src/main/cpp/CMakeLists.txt');
    expect(wired.indexOf('externalNativeBuild')).toBeLessThan(wired.indexOf('defaultConfig'));
  });

  it('is idempotent', () => {
    const once = addCmakeToAppGradle(APP_GRADLE);
    expect(addCmakeToAppGradle(once)).toBe(once);
  });

  it('refuses to guess when defaultConfig is missing', () => {
    expect(() => addCmakeToAppGradle('android {\n}\n')).toThrow(/defaultConfig/);
  });
});

describe('registerPackageInMainApplication', () => {
  it('registers the package in a Kotlin template', () => {
    const updated = registerPackageInMainApplication(mainApplicationKotlin(), true);
    expect(updated).toContain('import app.converge.audio.ConvergeAudioPackage');
    expect(updated).toContain('add(ConvergeAudioPackage())');
    expect(updated).not.toContain('add(ConvergeAudioPackage());');
    // The registration must come before the list is returned, or it has no effect.
    expect(updated.indexOf('add(ConvergeAudioPackage())')).toBeLessThan(updated.indexOf('return packages'));
  });

  it('registers the package in a Java template with a semicolon', () => {
    const updated = registerPackageInMainApplication(mainApplicationJava(), false);
    expect(updated).toContain('add(ConvergeAudioPackage());');
  });

  it('is idempotent', () => {
    const once = registerPackageInMainApplication(mainApplicationKotlin(), true);
    expect(registerPackageInMainApplication(once, true)).toBe(once);
  });

  it('places the import after the existing ones', () => {
    const updated = registerPackageInMainApplication(mainApplicationKotlin(), true);
    expect(updated.indexOf('import com.facebook.react.PackageList')).toBeLessThan(
      updated.indexOf('import app.converge.audio.ConvergeAudioPackage'),
    );
  });

  it('refuses a file with no imports rather than inserting somewhere arbitrary', () => {
    expect(() => registerPackageInMainApplication('class MainApplication {}', true)).toThrow(/import/);
  });
});

describe('applyNativeIntegration', () => {
  it('copies, wires Gradle and registers the package in one pass', () => {
    const { repoRoot, mobileRoot, android } = fixture(mainApplicationKotlin());
    const result = applyNativeIntegration(repoRoot, mobileRoot);

    expect(result.gradleChanged).toBe(true);
    expect(result.packageRegistered).toBe(true);
    expect(fs.readFileSync(path.join(android, 'app/build.gradle'), 'utf8')).toContain(
      'src/main/cpp/CMakeLists.txt',
    );
    const mainApplication = fs.readFileSync(
      path.join(android, 'app/src/main/java/app/converge/mobile/MainApplication.kt'),
      'utf8',
    );
    expect(mainApplication).toContain('ConvergeAudioPackage');
  });

  it('is safe to run twice, as prebuild may be repeated', () => {
    const { repoRoot, mobileRoot, android } = fixture(mainApplicationKotlin());
    applyNativeIntegration(repoRoot, mobileRoot);
    const second = applyNativeIntegration(repoRoot, mobileRoot);

    expect(second.gradleChanged).toBe(false);
    expect(second.packageRegistered).toBe(false);
    const gradle = fs.readFileSync(path.join(android, 'app/build.gradle'), 'utf8');
    expect(gradle.match(/src\/main\/cpp\/CMakeLists\.txt/g)).toHaveLength(1);
  });

  it('explains that prebuild has to run first when there is no android project', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'converge-empty-'));
    expect(() => applyNativeIntegration(root, path.join(root, 'mobile'))).toThrow(/prebuild/);
  });
});
