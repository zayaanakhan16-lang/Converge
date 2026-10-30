#include "waveform.h"

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <vector>

namespace converge {
namespace audio {
namespace {

/**
 * Peak amplitude for one bucket of samples.
 *
 * Peak rather than RMS: a voice waveform is read at a glance to find where
 * somebody spoke, and RMS flattens the quiet syllables until every bar looks
 * the same height.
 */
float bucketPeak(const float* samples, std::size_t begin, std::size_t end) {
  float peak = 0.0f;
  for (std::size_t index = begin; index < end; ++index) {
    const float magnitude = std::fabs(samples[index]);
    if (magnitude > peak) {
      peak = magnitude;
    }
  }
  return peak;
}

}  // namespace

std::vector<float> WaveformEnvelope(const float* samples,
                                    std::size_t count,
                                    std::size_t buckets) {
  if (samples == nullptr || count == 0 || buckets == 0) {
    return {};
  }

  std::vector<float> envelope(buckets, 0.0f);

  // Fewer samples than buckets would leave bars with no audio behind them, so
  // the output is shortened to one bar per sample.
  if (count < buckets) {
    for (std::size_t index = 0; index < count; ++index) {
      envelope[index] = std::fabs(samples[index]);
    }
    envelope.resize(count);
    return envelope;
  }

  const double samplesPerBucket = static_cast<double>(count) / static_cast<double>(buckets);
  for (std::size_t bucket = 0; bucket < buckets; ++bucket) {
    const std::size_t begin = static_cast<std::size_t>(bucket * samplesPerBucket);
    std::size_t end = static_cast<std::size_t>((bucket + 1) * samplesPerBucket);
    if (end <= begin) {
      end = begin + 1;
    }
    if (end > count) {
      end = count;
    }
    envelope[bucket] = bucketPeak(samples, begin, end);
  }
  return envelope;
}

}  // namespace audio
}  // namespace converge
