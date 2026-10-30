/**
 * JNI bridge between ConvergeAudioModule and the waveform DSP.
 *
 * The bridge is deliberately thin. It converts the incoming jfloatArray into a
 * plain pointer once, calls the pure C++ function, and copies the result back
 * into a new array. No business logic lives here, so the algorithm stays
 * testable without a JVM.
 */

#include <jni.h>

#include <cstddef>
#include <vector>

#include "waveform.h"

extern "C" JNIEXPORT jfloatArray JNICALL
Java_app_converge_audio_ConvergeAudioModule_nativeWaveformEnvelope(
    JNIEnv* env, jobject /* this */, jfloatArray samples_array, jint buckets) {
  if (samples_array == nullptr || buckets <= 0) {
    return env->NewFloatArray(0);
  }

  const jsize sample_count = env->GetArrayLength(samples_array);
  if (sample_count <= 0) {
    return env->NewFloatArray(0);
  }

  // GetPrimitiveArrayCritical avoids copying the whole recording across the JNI
  // boundary. The region is kept free of allocation and other JNI calls, which
  // is required while the array header is pinned.
  jfloat* raw = static_cast<jfloat*>(
      env->GetPrimitiveArrayCritical(samples_array, nullptr));
  if (raw == nullptr) {
    // The VM refused to pin the array, so a plain copy is used instead.
    std::vector<jfloat> copy(static_cast<std::size_t>(sample_count));
    env->GetFloatArrayRegion(samples_array, 0, sample_count, copy.data());
    const std::vector<float> envelope = converge::audio::WaveformEnvelope(
        copy.data(), copy.size(), static_cast<std::size_t>(buckets));
    jfloatArray result = env->NewFloatArray(static_cast<jsize>(envelope.size()));
    if (result != nullptr && !envelope.empty()) {
      env->SetFloatArrayRegion(result, 0, static_cast<jsize>(envelope.size()),
                               envelope.data());
    }
    return result;
  }

  const std::vector<float> envelope = converge::audio::WaveformEnvelope(
      raw, static_cast<std::size_t>(sample_count), static_cast<std::size_t>(buckets));
  env->ReleasePrimitiveArrayCritical(samples_array, raw, JNI_ABORT);

  jfloatArray result = env->NewFloatArray(static_cast<jsize>(envelope.size()));
  if (result != nullptr && !envelope.empty()) {
    env->SetFloatArrayRegion(result, 0, static_cast<jsize>(envelope.size()),
                             envelope.data());
  }
  return result;
}
