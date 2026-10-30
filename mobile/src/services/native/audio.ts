import { convertPcmToWav, readBase64File } from '../../utils/audioFiles';

/**
 * Voice-note waveform extraction.
 *
 * The bars drawn under a voice note are produced from the recording itself, never
 * generated. Two native layers do the work on Android - Java reads the WAV
 * container and C++ reduces the samples to bars (see `android-native/`) - and the
 * module is reached through React Native's NativeModules bridge.
 *
 * Recording on Android produces AAC in an `.m4a` container, which the Java
 * decoder deliberately refuses: decoding a lossy codec is not something this
 * module should guess at. The audio is therefore converted to 16-bit PCM WAV with
 * `ffmpeg-kit` when it is available, and the waveform is reported as unavailable
 * when it is not. Nothing is invented in either case.
 *
 * In Expo Go and on web the native module is absent, so `isNativeWaveformAvailable()`
 * returns false and the UI hides the waveform rather than showing a flat line.
 */

/** Number of bars produced for a voice note. */
export const WAVEFORM_BUCKETS = 48;

interface ConvergeAudioNativeModule {
  waveformFromWav(path: string, buckets: number): Promise<number[]>;
}

/**
 * Parse a 16-bit PCM WAV byte string into `buckets` peak values.
 *
 * Exported for tests: it is the reference implementation the native DSP is
 * checked against.
 */
export function envelopeFromWavBytes(bytes: Uint8Array, buckets: number): number[] {
  if (buckets <= 0 || bytes.length < 44) return [];

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const wave = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riff !== 'RIFF' || wave !== 'WAVE') return [];

  let channels = 0;
  let bitsPerSample = 0;
  let audioFormat = 0;
  let dataOffset = -1;
  let dataLength = 0;

  let position = 12;
  while (position + 8 <= bytes.length) {
    const chunkId = String.fromCharCode(
      bytes[position],
      bytes[position + 1],
      bytes[position + 2],
      bytes[position + 3],
    );
    const chunkSize = view.getUint32(position + 4, true);
    if (chunkId === 'fmt ') {
      if (chunkSize < 16) return [];
      audioFormat = view.getUint16(position + 8, true);
      channels = view.getUint16(position + 10, true);
      bitsPerSample = view.getUint16(position + 22, true);
    } else if (chunkId === 'data') {
      dataOffset = position + 8;
      dataLength = chunkSize;
      break;
    }
    position += 8 + chunkSize + (chunkSize % 2);
  }

  if (audioFormat !== 1 || bitsPerSample !== 16 || channels < 1) return [];
  if (dataOffset < 0 || dataLength <= 0) return [];

  const usableBytes = Math.min(dataLength, bytes.length - dataOffset);
  const frameBytes = channels * 2;
  const frames = Math.floor(usableBytes / frameBytes);
  if (frames === 0) return [];

  if (frames < buckets) {
    const short: number[] = [];
    for (let index = 0; index < frames; index += 1) {
      short.push(Math.abs(view.getInt16(dataOffset + index * frameBytes, true) / 32768));
    }
    return short;
  }

  const perBucket = frames / buckets;
  const envelope: number[] = [];
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const begin = Math.floor(bucket * perBucket);
    const end = Math.min(frames, Math.max(begin + 1, Math.floor((bucket + 1) * perBucket)));
    let peak = 0;
    for (let frame = begin; frame < end; frame += 1) {
      const magnitude = Math.abs(view.getInt16(dataOffset + frame * frameBytes, true) / 32768);
      if (magnitude > peak) peak = magnitude;
    }
    envelope.push(peak);
  }
  return envelope;
}

/**
 * Read the envelope from a WAV file in JavaScript.
 *
 * The fallback for Expo Go, where the native module cannot be loaded. It runs at
 * most once per voice note on a file already on disk, so the cost is acceptable
 * and the feature keeps working without a custom build.
 */
async function waveformFromWavInJs(path: string, buckets: number): Promise<number[]> {
  const base64 = await readBase64File(path);
  const bytes = Buffer.from(base64, 'base64');
  return envelopeFromWavBytes(new Uint8Array(bytes), buckets);
}

function nativeModule(): ConvergeAudioNativeModule | null {
  // React Native still exposes the legacy registry for TurboModules that have
  // not been migrated, which is what this module relies on.
  const registry = (
    globalThis as unknown as {
      nativeModules?: Record<string, ConvergeAudioNativeModule>;
    }
  ).nativeModules;
  const module = registry?.ConvergeAudio;
  return module && typeof module.waveformFromWav === 'function' ? module : null;
}

export interface WaveformResult {
  bars: number[];
  /** Which implementation produced the bars, reported so the UI can be honest. */
  source: 'native-java-cpp' | 'javascript' | 'unavailable';
  reason?: string;
}

/**
 * Produce a waveform for a recorded voice note.
 *
 * Never throws: a voice note that cannot be analysed is still a valid message, so
 * the caller receives `unavailable` with a reason and sends the note without
 * bars.
 */
export async function voiceNoteWaveform(
  path: string,
  mimeType: string,
  buckets: number = WAVEFORM_BUCKETS,
): Promise<WaveformResult> {
  let wavPath = path;
  try {
    if (!path.toLowerCase().endsWith('.wav')) {
      const converted = await convertPcmToWav(path);
      if (!converted) {
        return {
          bars: [],
          source: 'unavailable',
          reason:
            'The waveform needs a PCM conversion step (ffmpeg-kit), which is not installed in this build.',
        };
      }
      wavPath = converted;
    }
  } catch {
    return {
      bars: [],
      source: 'unavailable',
      reason: 'The recording could not be prepared for waveform analysis.',
    };
  }

  const module = nativeModule();
  if (module) {
    try {
      const bars = await module.waveformFromWav(wavPath, buckets);
      return { bars, source: 'native-java-cpp' };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'The native decoder failed.';
      return { bars: [], source: 'unavailable', reason };
    }
  }

  try {
    const bars = await waveformFromWavInJs(wavPath, buckets);
    if (bars.length === 0) {
      return {
        bars: [],
        source: 'unavailable',
        reason: `No 16-bit PCM audio could be read from this ${mimeType} recording.`,
      };
    }
    return { bars, source: 'javascript' };
  } catch {
    return {
      bars: [],
      source: 'unavailable',
      reason: 'The recording could not be read for waveform analysis.',
    };
  }
}

/** True when the compiled Java/C++ module is present, i.e. not Expo Go. */
export function isNativeWaveformAvailable(): boolean {
  return nativeModule() !== null;
}
