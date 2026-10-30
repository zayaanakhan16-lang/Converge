import { envelopeFromWavBytes, isNativeWaveformAvailable, WAVEFORM_BUCKETS } from '../audio';

/**
 * Tests for the JavaScript waveform reference implementation.
 *
 * The native Java/C++ path is verified separately on a host machine (see
 * android-native/cpp/run_tests.sh and android-native/java/run_tests.sh). These
 * cases use the same inputs and the same expectations, so the two
 * implementations are checked against one specification: a fallback that
 * disagreed with the native path would be a subtle bug that only appeared in
 * Expo Go.
 */

/** Build a minimal 16-bit PCM WAV file, mirroring the Java test fixture. */
function buildWav(
  samples: number[],
  options: { channels?: number; bitsPerSample?: number; leadingChunk?: boolean } = {},
): Uint8Array {
  const channels = options.channels ?? 1;
  const bitsPerSample = options.bitsPerSample ?? 16;
  const leadingChunk = options.leadingChunk ?? false;

  const frameBytes = channels * (bitsPerSample / 8);
  const dataBytes = samples.length * (bitsPerSample / 8);
  const leadingBytes = leadingChunk ? 8 + 5 + 1 : 0;

  const size = 12 + leadingBytes + 8 + 16 + 8 + dataBytes;
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);

  const ascii = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      bytes[offset + index] = text.charCodeAt(index);
    }
  };

  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes + leadingBytes - 8, true);
  ascii(8, 'WAVE');

  let cursor = 12;
  if (leadingChunk) {
    ascii(cursor, 'LIST');
    view.setUint32(cursor + 4, 5, true);
    ascii(cursor + 8, 'INFOX');
    bytes[cursor + 13] = 0; // pad byte, outside the declared chunk length
    cursor += 8 + 5 + 1;
  }

  ascii(cursor, 'fmt ');
  view.setUint32(cursor + 4, 16, true);
  view.setUint16(cursor + 8, 1, true); // PCM
  view.setUint16(cursor + 10, channels, true);
  view.setUint32(cursor + 12, 16000, true);
  view.setUint32(cursor + 16, 16000 * frameBytes, true);
  view.setUint16(cursor + 20, frameBytes, true);
  view.setUint16(cursor + 22, bitsPerSample, true);
  cursor += 24;

  ascii(cursor, 'data');
  view.setUint32(cursor + 4, dataBytes, true);
  cursor += 8;

  samples.forEach((sample, index) => {
    if (bitsPerSample === 16) {
      view.setInt16(cursor + index * 2, sample, true);
    } else {
      bytes[cursor + index] = sample & 0xff;
    }
  });

  return bytes;
}

describe('envelopeFromWavBytes', () => {
  it('decodes every mono sample in order', () => {
    const bytes = buildWav([0, 16384, -16384, 32767, -32768]);
    const bars = envelopeFromWavBytes(bytes, 5);
    expect(bars).toHaveLength(5);
    expect(bars[0]).toBeCloseTo(0, 5);
    expect(bars[1]).toBeCloseTo(0.5, 5);
    expect(bars[2]).toBeCloseTo(0.5, 5);
    expect(bars[3]).toBeCloseTo(32767 / 32768, 5);
    expect(bars[4]).toBeCloseTo(1, 5);
  });

  it('reads the first channel of a stereo file without mixing', () => {
    // Interleaved, with the right channel silent throughout.
    const bytes = buildWav([1000, 0, 2000, 0, 3000, 0], { channels: 2 });
    const bars = envelopeFromWavBytes(bytes, 3);
    expect(bars).toHaveLength(3);
    expect(bars[0]).toBeCloseTo(1000 / 32768, 5);
    expect(bars[2]).toBeCloseTo(3000 / 32768, 5);
  });

  it('uses the peak rather than the average within a bucket', () => {
    // 400 samples over 4 buckets: the loudest sample in bucket 0 must win.
    const samples = new Array(400).fill(328); // ~0.01
    samples[50] = 29491; // ~0.9
    const bars = envelopeFromWavBytes(buildWav(samples), 4);
    expect(bars[0]).toBeCloseTo(0.9, 4);
    expect(bars[1]).toBeCloseTo(328 / 32768, 5);
  });

  it('places the final sample in the final bucket for an uneven split', () => {
    const samples = new Array(7).fill(0);
    samples[6] = 32767;
    const bars = envelopeFromWavBytes(buildWav(samples), 3);
    expect(bars).toHaveLength(3);
    expect(bars[2]).toBeCloseTo(32767 / 32768, 5);
  });

  it('skips chunks before fmt and data', () => {
    const bytes = buildWav([8192, -8192], { leadingChunk: true });
    const bars = envelopeFromWavBytes(bytes, 2);
    expect(bars).toHaveLength(2);
    expect(bars[0]).toBeCloseTo(0.25, 5);
  });

  it('returns the samples available when the data chunk is truncated', () => {
    const full = buildWav([1000, 2000, 3000, 4000]);
    const truncated = full.slice(0, full.length - 4);
    const bars = envelopeFromWavBytes(truncated, 2);
    expect(bars).toHaveLength(2);
    expect(bars[0]).toBeCloseTo(1000 / 32768, 5);
  });

  it('trims the bar count to the sample count for a very short note', () => {
    const bars = envelopeFromWavBytes(buildWav([16384, 32767]), 16);
    expect(bars).toHaveLength(2);
    expect(bars[1]).toBeCloseTo(32767 / 32768, 5);
  });

  it('rejects audio that is not 16-bit PCM', () => {
    expect(envelopeFromWavBytes(buildWav([1, 2, 3, 4], { bitsPerSample: 8 }), 2)).toEqual([]);
  });

  it('rejects a file that is not RIFF/WAVE', () => {
    expect(envelopeFromWavBytes(new Uint8Array(64).fill(7), 4)).toEqual([]);
  });

  it('returns nothing for a file too short to hold a header', () => {
    expect(envelopeFromWavBytes(new Uint8Array(20), 4)).toEqual([]);
  });

  it('returns nothing when the bucket count is not positive', () => {
    expect(envelopeFromWavBytes(buildWav([1, 2, 3, 4]), 0)).toEqual([]);
  });
});

describe('waveform availability', () => {
  it('reports the native module as absent in the test environment', () => {
    // The test runner has no React Native bridge, so the JavaScript fallback is
    // the only path, which is exactly the Expo Go situation.
    expect(isNativeWaveformAvailable()).toBe(false);
  });

  it('uses a bar count that fits a chat bubble', () => {
    expect(WAVEFORM_BUCKETS).toBeGreaterThan(16);
    expect(WAVEFORM_BUCKETS).toBeLessThanOrEqual(64);
  });
});
