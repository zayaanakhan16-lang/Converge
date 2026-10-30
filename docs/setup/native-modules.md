# Native modules

Worth reading before touching `android-native/` or
`mobile/plugins/withConvergeAudio.js`. This covers what the native code does, why
it exists, how it is wired into an Expo build, and what is deliberately absent.

## What it does

Voice notes are drawn with a real waveform, taken from the recording itself. The
pipeline is:

```
recording (.m4a, AAC)
  └─ convertPcmToWav()        ffmpeg-kit, optional: AAC → 16-bit PCM WAV
       └─ ConvergeAudioModule  Java: parse RIFF container → float[] samples
            └─ waveform.cpp    C++: peak/RMS envelope → 64 bars, 0-100
                 └─ messages.waveform  smallint[], rendered by WaveformBars
```

Nothing in this chain is synthesised. If any step is unavailable, the note is
still sent and shown with its duration alone, and the sender is told why.

## Why Java and C++ rather than TypeScript

Parsing a WAV container means reading a byte stream and handling chunk boundaries
and endianness. Computing an envelope means touching every sample, which for a
30-second note at 16 kHz is 480,000 values. Doing that in JavaScript would block
the UI thread; doing it across the React Native bridge once per sample would be
slower than the recording itself.

The split between the two is deliberate:

| File | Responsibility | Depends on |
| --- | --- | --- |
| `java/app/converge/audio/WavDecoder.java` | Parse RIFF, return normalised floats | nothing but the JDK |
| `java/app/converge/audio/ConvergeAudioModule.java` | React Native bridge | React Native |
| `java/app/converge/audio/ConvergeAudioPackage.java` | Register the module | React Native |
| `cpp/waveform.cpp` | Envelope: floats → bars | nothing but the standard library |
| `cpp/waveform_jni.cpp` | Convert `jfloatArray` ↔ `std::vector` | JNI |
| `cpp/waveform.h` | The one function both sides agree on | nothing |

`WavDecoder` and `waveform.cpp` have no Android or JNI dependency **on purpose**.
They hold the logic most likely to harbour an off-by-one error, and this is what
lets both be tested on a build machine with no emulator:

```bash
cd android-native/java && ./run_tests.sh
cd android-native/cpp  && ./run_tests.sh
```

## The optional transcoder

`ffmpeg-kit-react-native` is **not** a dependency. It is a large native library and
messaging works entirely without it; it is only needed to turn an AAC recording
into PCM that `WavDecoder` can read.

Decoding AAC by hand was rejected: a lossy codec is a large amount of native code
to get subtly wrong, and a mis-decoded waveform would be misleading in a way that
is hard to notice.

When `ffmpeg-kit` is absent, `convertPcmToWav` returns `null`,
`voiceNoteWaveform` reports `source: 'unavailable'` with a reason, and the app
shows the duration without bars. Nothing is faked.

To enable it:

```bash
cd mobile
npx expo install ffmpeg-kit-react-native
npx expo prebuild --platform android --clean
npx expo run:android
```

It cannot run in Expo Go. `isTranscodingAvailable()` in
`mobile/src/utils/audioFiles.ts` reports the current state at runtime.

## The JavaScript fallback

`mobile/src/services/native/audio.ts` contains `envelopeFromWavBytes`, a pure
TypeScript implementation of the same envelope. It runs when the native module is
not present, which is the case in Expo Go and in the Jest environment.

It is held to the same specification as the native path: the TypeScript tests in
`mobile/src/services/native/__tests__/audio.test.ts` and the Java tests in
`WavDecoderTest.java` use the same inputs and the same expected values. A fallback
that disagreed with the native path would be a subtle bug that only appeared on one
of the two, so they are checked against one specification rather than two.

## How the sources reach the build

The canonical sources live in `android-native/` at the repository root, not inside
`mobile/`, because they are not JavaScript and do not belong in the app bundle.
Expo regenerates `android/` from scratch on every prebuild, so a config plugin is
what carries them across.

`mobile/plugins/withConvergeAudio.js`:

1. Copies `android-native/java/app/**` to `app/src/main/java/app/**`, keeping the
   package layout. The host tests in `java/test/` are skipped.
2. Copies the four C++ files to `app/src/main/cpp/`.
3. Inserts the CMake block into `app/build.gradle`.
4. Adds `ConvergeAudioPackage` to `MainApplication`, handling both the Kotlin and
   Java templates.

Steps 3 and 4 are idempotent, so running prebuild twice does not duplicate
anything. Every one of these steps is covered by
`mobile/plugins/__tests__/withConvergeAudio.test.js`, which runs the real
functions against a fixture tree on disk. That matters because a plugin that
silently fails to wire the library would only surface much later, at link time on
a build machine.

`android/` and `ios/` are git-ignored. Never edit them by hand: the change will be
lost on the next prebuild. Change `app.json` or the plugin instead.

## Constraints

- Only uncompressed 16-bit PCM is accepted by `WavDecoder`. Anything else raises
  `WavDecodeException` rather than being guessed at, because a wrong
  interpretation would show a misleading waveform.
- Only the first channel is read. A voice note is mono in practice, and mixing
  channels would average away the peak the waveform is meant to show.
- A malformed header claiming a huge sample count is rejected
  (`MAX_SAMPLES`), so a corrupt file cannot exhaust memory.
- A truncated `data` chunk returns the frames actually present rather than
  throwing or padding with silence.
- The waveform is capped at 64 bars, matching the check constraint in
  `supabase/migrations/20260101001000_message_waveform.sql`.
