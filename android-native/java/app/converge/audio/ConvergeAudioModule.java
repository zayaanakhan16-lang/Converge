package app.converge.audio;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableNativeArray;

import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Native voice-note waveform extraction, exposed to React Native as
 * {@code ConvergeAudio}.
 *
 * <p>Two native layers cooperate here and each does only what it is suited to:
 * {@link WavDecoder} on the Java side reads the WAV container, and the C++
 * {@code converge::audio::WaveformEnvelope} reduces the samples to bars. Both run
 * on a background executor because decoding a multi-minute recording must never
 * block the UI thread.
 *
 * <p>The module is loaded by {@code ConvergeAudioPackage}. Callers use the
 * TypeScript wrapper in {@code mobile/src/services/native/audio.ts}, which falls
 * back to a JavaScript implementation when the module is absent, so the app still
 * runs in Expo Go and on web.
 *
 * <p>Typing this file needs React Native's Java sources on the compile classpath.
 * See {@code android-native/README.md} for the Gradle wiring.
 */
public class ConvergeAudioModule extends ReactContextBaseJavaModule {

    public static final String NAME = "ConvergeAudio";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    /** Loads the companion C++ library. Absent in a JS-only build, which is fine. */
    static {
        try {
            System.loadLibrary("converge-audio");
        } catch (UnsatisfiedLinkError ignored) {
            // The JavaScript fallback covers this case.
        }
    }

    public ConvergeAudioModule(ReactApplicationContext context) {
        super(context);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    /**
     * Extracts a waveform envelope from a local WAV recording.
     *
     * @param path absolute path to the recorded file
     * @param buckets number of bars to return
     * @param promise resolves with an array of floats in the range 0..1
     */
    @ReactMethod
    public void waveformFromWav(final String path, final int buckets, final Promise promise) {
        if (buckets <= 0) {
            promise.reject("invalid_argument", "A waveform needs at least one bar.");
            return;
        }
        executor.execute(() -> {
            try {
                float[] samples = WavDecoder.decodeMono16(new File(path));
                float[] envelope = nativeWaveformEnvelope(samples, buckets);
                WritableArray result = new WritableNativeArray();
                for (float value : envelope) {
                    result.pushDouble(value);
                }
                promise.resolve(result);
            } catch (WavDecoder.WavDecodeException cause) {
                promise.reject("decode_failed", cause.getMessage());
            } catch (Exception cause) {
                promise.reject("waveform_failed", "The waveform could not be produced.");
            }
        });
    }

    /** Implemented in {@code android-native/cpp/waveform_jni.cpp}. */
    private native float[] nativeWaveformEnvelope(float[] samples, int buckets);

    @Override
    public void invalidate() {
        executor.shutdown();
        super.invalidate();
    }
}
