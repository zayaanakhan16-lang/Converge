// Host test for the Converge waveform DSP.
//
// The DSP is deliberately free of Android and JNI dependencies, which means the
// algorithm can be verified on a build machine without an emulator. Run with:
//
//   cd android-native/cpp && ./run_tests.sh
//
// A non-zero exit status means a case failed.

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <vector>

#include "waveform.h"

namespace {

int failures = 0;

void expect(bool condition, const char* description) {
  if (!condition) {
    std::printf("FAIL %s\n", description);
    ++failures;
  } else {
    std::printf("ok   %s\n", description);
  }
}

bool nearlyEqual(float actual, float expected, float tolerance = 1e-4f) {
  return std::fabs(actual - expected) <= tolerance;
}

void testEmptyInput() {
  expect(converge::audio::WaveformEnvelope(nullptr, 0, 8).empty(),
         "a null buffer produces no bars");
  const float samples[] = {0.1f, 0.2f};
  expect(converge::audio::WaveformEnvelope(samples, 2, 0).empty(),
         "zero buckets produces no bars");
}

void testSilence() {
  const std::vector<float> silence(1000, 0.0f);
  const auto envelope = converge::audio::WaveformEnvelope(silence.data(), silence.size(), 10);
  expect(envelope.size() == 10, "silence yields the requested number of bars");
  for (float value : envelope) {
    expect(nearlyEqual(value, 0.0f), "a silent bucket is zero");
  }
}

void testConstantTone() {
  // Half amplitude throughout: every bar should be 0.5.
  const std::vector<float> tone(500, 0.5f);
  const auto envelope = converge::audio::WaveformEnvelope(tone.data(), tone.size(), 5);
  expect(envelope.size() == 5, "a constant tone yields the requested number of bars");
  for (float value : envelope) {
    expect(nearlyEqual(value, 0.5f), "a constant tone gives constant bars");
  }
}

void testPeakNotAverage() {
  // One loud sample in an otherwise quiet bucket: peak must win over average.
  std::vector<float> samples(400, 0.01f);
  samples[50] = 0.9f;
  const auto envelope = converge::audio::WaveformEnvelope(samples.data(), samples.size(), 4);
  expect(nearlyEqual(envelope[0], 0.9f), "a lone peak sets the bar height");
  expect(nearlyEqual(envelope[1], 0.01f), "a quiet bucket stays quiet");
}

void testNegativeSamplesUseMagnitude() {
  const std::vector<float> samples{-0.75f, -0.2f, -0.1f, -0.1f};
  const auto envelope = converge::audio::WaveformEnvelope(samples.data(), samples.size(), 1);
  expect(nearlyEqual(envelope[0], 0.75f), "negative samples contribute their magnitude");
}

void testFewerSamplesThanBuckets() {
  const std::vector<float> samples{0.25f, 0.5f};
  const auto envelope = converge::audio::WaveformEnvelope(samples.data(), samples.size(), 16);
  expect(envelope.size() == 2, "bars are trimmed to the sample count");
  expect(nearlyEqual(envelope[0], 0.25f), "the first sample maps to the first bar");
  expect(nearlyEqual(envelope[1], 0.5f), "the second sample maps to the second bar");
}

void testUnevenSplitCoversEverySample() {
  // 7 samples across 3 buckets: the last bucket must still contain sample 6.
  std::vector<float> samples(7, 0.0f);
  samples[6] = 1.0f;
  const auto envelope = converge::audio::WaveformEnvelope(samples.data(), samples.size(), 3);
  expect(envelope.size() == 3, "an uneven split still returns every bar");
  expect(nearlyEqual(envelope[2], 1.0f), "the final sample lands in the final bucket");
}

}  // namespace

int main() {
  testEmptyInput();
  testSilence();
  testConstantTone();
  testPeakNotAverage();
  testNegativeSamplesUseMagnitude();
  testFewerSamplesThanBuckets();
  testUnevenSplitCoversEverySample();

  if (failures == 0) {
    std::printf("\nWAVEFORM DSP TESTS PASSED\n");
    return EXIT_SUCCESS;
  }
  std::printf("\n%d waveform test(s) failed\n", failures);
  return EXIT_FAILURE;
}
