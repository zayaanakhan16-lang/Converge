import { Directory, File, Paths } from 'expo-file-system';

/**
 * File helpers for audio processing.
 *
 * These wrap expo-file-system's class API so the rest of the code never touches it
 * directly, and so the ways a file can be missing are handled in one place.
 *
 * Every function is defensive about the file not existing rather than throwing:
 * a voice note whose audio file has been cleaned up by the system is a normal
 * situation on Android, not a bug.
 */

/** Read a local file as base64. */
export async function readBase64File(path: string): Promise<string> {
  return new File(path).base64();
}

/** A path inside the app's cache directory, which needs no storage permission. */
export function temporaryPath(name: string): string {
  return new File(Paths.cache, name).uri;
}

export function fileExists(path: string): boolean {
  return new File(path).exists;
}

/** Delete a temporary file, ignoring the case where it is already gone. */
export async function removeFile(path: string): Promise<void> {
  const file = new File(path);
  if (file.exists) file.delete();
}

/** The cache directory, created on first use. */
function cacheDirectory(): Directory {
  const directory = new Directory(Paths.cache);
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

/**
 * Convert a recording to 16-bit PCM WAV for waveform analysis.
 *
 * Android records voice notes as AAC in an `.m4a` container. The Java decoder
 * reads uncompressed PCM only, on purpose: unpacking a lossy codec is a large
 * amount of native code to get subtly wrong, and a mis-decoded waveform would be
 * misleading. Transcoding is therefore delegated to `ffmpeg-kit`, which owns that
 * problem properly.
 *
 * Returns null when ffmpeg-kit is not part of the build. It is optional: it is a
 * large native library and messaging works without it, it is only needed for
 * drawing waveforms. Nothing is faked in its absence.
 *
 * To enable it: `npx expo install ffmpeg-kit-react-native` and rebuild the
 * Android app. It cannot run in Expo Go.
 */
export async function convertPcmToWav(inputPath: string): Promise<string | null> {
  const ffmpeg = loadFfmpegKit();
  if (!ffmpeg) return null;

  const base = inputPath.split('/').pop() ?? 'voice-note';
  const output = new File(cacheDirectory(), `${base.replace(/\.[^.]+$/, '')}-pcm.wav`);

  try {
    // -ac 1 downmixes to mono, which is what the waveform expects. 16 kHz is
    // plenty for a visual envelope and keeps the intermediate file small.
    const session = await ffmpeg.FFmpegKit.execute(
      `-y -i "${inputPath}" -ac 1 -ar 16000 -sample_fmt s16 -f wav "${output.uri}"`,
    );
    const returnCode = await session.getReturnCode();
    if (!returnCode.isValueSuccess()) return null;
    return output.exists ? output.uri : null;
  } catch {
    return null;
  }
}

interface FfmpegKitModule {
  FFmpegKit: {
    execute(command: string): Promise<{ getReturnCode(): Promise<{ isValueSuccess(): boolean }> }>;
  };
}

/**
 * Look for ffmpeg-kit at call time.
 *
 * It is an optional peer rather than a dependency, so the module is resolved
 * dynamically and its absence is a normal state rather than an error.
 */
function loadFfmpegKit(): FfmpegKitModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('ffmpeg-kit-react-native') as FfmpegKitModule;
    return module?.FFmpegKit ? module : null;
  } catch {
    return null;
  }
}

/** True when waveform extraction can transcode AAC recordings. */
export function isTranscodingAvailable(): boolean {
  return loadFfmpegKit() !== null;
}
