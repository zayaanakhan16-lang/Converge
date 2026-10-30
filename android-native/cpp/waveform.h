#ifndef CONVERGE_AUDIO_WAVEFORM_H_
#define CONVERGE_AUDIO_WAVEFORM_H_

#include <cstddef>
#include <vector>

namespace converge {
namespace audio {

/**
 * Reduces decoded samples to a fixed number of peak values.
 *
 * The result is what the chat bubble draws as a waveform. Each value is the
 * largest absolute amplitude in its slice of the recording, so a bar is tall
 * exactly where somebody was speaking.
 *
 * Pure computation with no allocator or JNI dependency, which is what makes it
 * testable on a host machine as well as on a device.
 *
 * @param samples normalised samples, expected in the range -1..1
 * @param count number of samples
 * @param buckets number of bars to produce
 * @return `buckets` peak values, or fewer when there are fewer samples than
 *         buckets; empty when any argument is zero
 */
std::vector<float> WaveformEnvelope(const float* samples,
                                    std::size_t count,
                                    std::size_t buckets);

}  // namespace audio
}  // namespace converge

#endif  // CONVERGE_AUDIO_WAVEFORM_H_
