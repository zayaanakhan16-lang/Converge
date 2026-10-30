# Architecture

Converge is four programs that share one data model. This document explains what
each one owns, why the boundaries fall where they do, and how a request travels
through them.

## The four layers

```
┌──────────────────────────┐
│  mobile/  (TypeScript)   │  Expo / React Native. Everything the member sees.
└────────────┬─────────────┘
             │ Supabase client (RLS-protected)      HTTP (JSON)
             ▼                                            ▼
┌──────────────────────────┐                 ┌──────────────────────────┐
│  Supabase (PostgreSQL)   │                 │  backend/  (Python)      │
│  Auth, Realtime, Storage │◄────────────────│  FastAPI: matching,      │
│  Row Level Security      │  service role   │  translation, coach,     │
└──────────────────────────┘                 │  moderation              │
             ▲                               └──────────────────────────┘
             │ JNI
┌──────────────────────────┐
│  android-native/         │  Java (WAV parsing) + C++ (envelope DSP)
└──────────────────────────┘
```

Each layer is justified by a problem that is genuinely cheaper to solve there:

- **TypeScript** holds the entire product surface. It is the only language that
  must run on the device, and it is the source of truth for UI behaviour.
- **PostgreSQL** enforces the privacy model. Row Level Security is the difference
  between "the app asks politely" and "the database refuses", which matters on a
  platform used by students. Every access rule lives in a policy, not in a
  client-side check.
- **Python** does the work that needs a model or a corpus: scoring matches,
  calling a translation provider, running the conversation coach. Keeping it
  separate means the mobile bundle stays small and the AI code can be deployed
  and scaled on its own.
- **Java and C++** decode audio. Parsing a WAV container and computing an
  amplitude envelope means touching every sample; doing that across the React
  Native bridge once per sample would be slower than the recording itself.

## Request flows

### Loading the Discover feed

```
DiscoverScreen
  └─ useDiscovery()                 hook, owns loading/error/empty state
       └─ repository.listProfiles()  Repository interface
            ├─ SupabaseRepository    ← live mode
            └─ DemoRepository        ← demo mode
```

The screen never imports a Supabase client. It talks to the `Repository`
interface in `mobile/src/services/types.ts`, and the concrete implementation is
chosen once at startup. That is what lets the whole app run with no backend
credentials, as a labelled demo, without a single `if (demoMode)` inside a screen.

### Sending a connection request

```
ConnectionRequestDialog
  └─ repository.sendConnectionRequest(viewerId, targetId, reason)
       └─ SupabaseRepository  → insert into connection_requests
            └─ RLS policy "a member may only request as themselves"
```

The `reason` field is optional and stored with the request. It is what the
recipient reads before deciding, which is the point of the feature: consent with
context rather than a bare notification.

### Recording a voice note

```
ChatScreen
  ├─ useVoiceNoteRecorder()          expo-audio, writes an .m4a to the cache
  ├─ transcriber.transcribe()        backend /v1/language/transcribe (optional)
  ├─ voiceNoteWaveform(uri, mime)    services/native/audio.ts
  │    ├─ convertPcmToWav()          ffmpeg-kit, optional dependency
  │    ├─ ConvergeAudioModule        Java: WavDecoder → C++: envelope
  │    └─ envelopeFromWavBytes()     JavaScript fallback for Expo Go
  └─ repository.sendMessage({ body, voiceNoteSeconds, waveform })
       └─ insert into messages (waveform smallint[])
```

Every step after the recording is optional and degrades visibly. If the
transcriber is unconfigured the note is still sent and labelled with its
duration. If the waveform cannot be produced, the recipient sees the duration
alone rather than a fabricated flat line.

## Why the database rules are shaped this way

**Private messaging needs mutual consent.** There is no policy that lets a member
insert into `conversations` directly. Direct conversations are created by the
`open_direct_conversation` function, which refuses unless a row exists in
`connections`. The insert policy on `messages` then requires the sender to be a
member of the conversation. Two independent checks, so a bug in one does not open
the door.

**Location is approximate on purpose.** `profiles` does store a point, but it is
snapped to a 0.05 degree grid (~5 km) and a check constraint refuses anything off
that grid, so an exact captured coordinate cannot be written even by a buggy
client. `share_approximate_location` defaults to false, and the generated
`coarse_point` column is what PostGIS radius queries use. The order matters: the
constraint makes precision impossible, and the policy makes it opt-in. A label
(`area_label`) is what other members read; the point itself is never rendered.
PostGIS is also used for community and event proximity, where the thing being
measured is a venue, not a person.

**Blocking is absolute.** The `blocked_users` policies are written so that a
blocked pair cannot read each other's profile, see each other in search, or hold
a conversation. Because it is enforced by policy rather than by a filter in the
client, a blocked member cannot reappear through a code path that forgot to check.

## The matching engine

`backend/app/services/matching.py` computes a score from named, inspectable
signals: shared interests, complementary skills, aligned goals, language
compatibility, overlapping activity preferences, shared community membership, and
optional proximity. Each contribution is returned alongside the total, so the app
can show *why* two people were suggested.

There is no opaque percentage. The API returns `MatchReason` objects, each with a
kind, a human-readable explanation and the points it contributed. The mobile
engine in `mobile/src/features/matching/engine.ts` applies the same signal model
for demo mode, and both are covered by tests that assert on the explanations
rather than only on the score, so the two cannot drift apart quietly.

## Native module boundaries

`android-native/` is deliberately split:

- `java/app/converge/audio/WavDecoder.java` parses the RIFF container and returns
  normalised floats. It has no Android dependency, so it is tested with a plain
  JDK.
- `cpp/waveform.cpp` turns those floats into 64 bars using an RMS/peak envelope.
  It has no JNI or Android dependency, so it is tested as a plain binary.
- `cpp/waveform_jni.cpp` is the only file that knows about both worlds. It
  converts a `jfloatArray` to a `std::vector` and back, and does nothing else.

That split means the two pieces most likely to have an off-by-one error can be
tested on a build machine with no emulator. `mobile/plugins/withConvergeAudio.js`
copies the sources into the generated Android project at prebuild time and wires
the CMake build; its tests assert that this actually happens, because a plugin
that silently fails would only surface at link time.

## Configuration

All secrets are server-side. The mobile bundle only ever receives the Supabase
URL and anon key, both of which are public by design and protected by RLS. The
backend reads its service-role key, translation credentials and coach model from
the environment; any of them may be absent, in which case the corresponding
endpoint reports itself disabled rather than inventing a result. See
`.env.example` for the full list.
