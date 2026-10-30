# Converge

**Find common ground. Start meaningful conversations.**

Converge is an AI-assisted social connection platform. It helps people discover
others with shared interests, skills and goals, build confidence in conversations,
connect through mutual consent, communicate across language barriers, and take
part in communities and real-world activities.

It is not another feed, not a generic messenger, not a people-nearby map, and not
a dating app. Its purpose is to turn shared interests and community participation
into meaningful communication and collaboration.

The central journey is the product:

```
DISCOVER -> UNDERSTAND -> PRACTISE -> CONNECT -> COMMUNICATE -> PARTICIPATE
```

Discover people and communities. Understand, in plain words, why a suggestion was
made. Practise the conversation before you start it. Connect, with mutual consent.
Communicate, translated if needed. Participate in a discussion or an event.

## Try it now

The app runs with no backend and no credentials, on a clearly labelled demo
dataset:

```bash
cd mobile
npm install
npm start          # press "a" for Android
```

A banner states that the data is sample data, so demo mode is never mistaken for
a live deployment.

## What is implemented

| Area | Status |
| --- | --- |
| Authentication | Signup, login, logout, password recovery, password visibility, validation, session persistence. Real Supabase Auth when configured; demo sign-in otherwise. |
| Onboarding | Multi-step, every optional field skippable: display name, avatar, interests, skills, languages, goals, preferred activities, short introduction. |
| Discover | Member, community, club and event discovery with filters for interests, languages, activities and goals. |
| Place search | Nearby discovery around a device area or any place in the world, resolved by a real geocoder on the backend. Nothing finer than a city is ever stored. |
| AuraMatch | A signal model over shared interests, complementary skills, aligned goals, language compatibility, activity preferences, shared membership and optional proximity. Every suggestion carries its reasons as text. There is no unexplained percentage. |
| Communities | Browsing, profiles, membership requests, events, QR join codes, and group discussions. |
| Connections | Requests with an optional reason, accept, decline, cancel, remove, block, report. Direct messaging is opened only by mutual acceptance. |
| Messaging | Realtime text, timestamps, delivery and read status, conversation list, history, unread counts, emoji, attachments with validation, and voice notes with a real waveform. |
| Language assistant | A translation pipeline with the original kept alongside the translation. Unconfigured means reported as unavailable, never invented. |
| Conversation coach | Practice for introductions, opening conversations, networking, asking questions and joining discussions, with concise feedback tied to what was submitted. |
| Profile and settings | Profile editing, the full taxonomy, language preferences, privacy and visibility, notification preferences, blocked accounts, and account deletion. |

### Honest status of the AI and voice features

These degrade visibly rather than silently, which is why they are called out here:

- **Translation** requires `TRANSLATION_PROVIDER`, `TRANSLATION_API_KEY` and
  `TRANSLATION_API_URL` on the backend. Without them the endpoint reports
  `provider: "unavailable"` and the app says translation is off. No text is
  invented.
- **Conversation coach** runs a deterministic rule-based implementation with no
  model, and produces real feedback derived from the submitted text. Setting
  `COACH_MODEL` switches to a model-backed coach. Both paths are real.
- **Voice-note waveforms** use the Android native module for PCM analysis.
  Producing PCM from an AAC recording additionally needs the optional
  `ffmpeg-kit-react-native` transcoder, which is not a dependency. Without it the
  note is still sent and shown with its duration, and the reason is stated. A
  flat line is never drawn to fill the gap. Details in
  `docs/setup/native-modules.md`.
- **Place search** runs on the backend through `GEOCODING_PROVIDER`. Nominatim
  needs no key and is the default; Mapbox and LocationIQ are also wired. When no
  provider is reachable the picker says the lookup failed rather than reporting
  that the place does not exist. See `docs/setup/getting-started.md`.
- **Maps** use MapLibre with OpenStreetMap data. Location is approximate: a point
  is snapped to a ~5 km grid by a database check constraint, sharing is opt-in,
  and an exact coordinate cannot be stored. See
  `docs/security/privacy-and-safety.md`.

## Technology

| Layer | Choice | Why |
| --- | --- | --- |
| Mobile | Expo SDK 58, React Native, TypeScript, React Navigation | Android-first, and the primary product surface |
| UI | React Native SVG, Lucide | Vector drawing for the mark and the native waveform |
| Database | Supabase / PostgreSQL with PostGIS | Row Level Security is where the privacy model is enforced |
| Backend | FastAPI (Python) | Matching, translation, coaching and moderation, deployable independently |
| Native | Java + C++ | WAV parsing and envelope DSP, both testable without an emulator |

The four languages each have one job. TypeScript builds the product, Python runs
the intelligence, Java parses the audio container, and C++ computes the envelope.
Nothing exists merely to lengthen the list. The reasoning, and the boundary
between the layers, is in `docs/architecture/overview.md`.

## Repository layout

```
Converge/
|- mobile/                 Expo application
|  |- src/
|  |  |- components/       UI primitives and the brand mark
|  |  |- screens/          43 screens, grouped by area
|  |  |- features/         matching, coach, messaging, communities, ...
|  |  |- navigation/       Tab and stack structure
|  |  |- services/         Repository interface, Supabase and demo implementations
|  |  |- hooks/            Data, fonts, voice recording
|  |  |- context/          Auth, theme
|  |  |- theme/            Colour and type tokens
|  |  |- data/             The demo dataset
|  |  - utils/             Validation, audio, formatting
|  - plugins/              Expo config plugin for the native audio module
|- backend/                FastAPI service
|  - app/{api,core,services,schemas}/
|- android-native/         Java and C++, with host test runners
|- supabase/               Migrations, seed, and the SQL test suites
|- brand/                  Logo, icons, typography, colour tokens
|- docs/                   Architecture, design, privacy, setup
|- scripts/                Migration and SQL test runners
|- .env.example
- README.md
```

## The brand

The mark is three paths converging on a single point: distinct strokes that meet,
rather than a symbol that stands for "chat". The two rejected directions and the
reason they were rejected are in `docs/design/design-system.md`.

The palette is deep teal on warm neutral. `brand/guidelines/colour-tokens.json`
holds the machine-readable tokens; every pair in use was checked against WCAG AA
in both themes. Plus Jakarta Sans carries the display sizes and Inter carries
everything read at length.

Deliverables: primary and secondary logos, the app icon in all Android densities,
light and dark themes, the typography system, colour tokens, brand guidelines, and
SVG sources with transparent PNG exports. All under `brand/`.

## Privacy by architecture

Converge may be used by students and younger people, so the controls are enforced
where they cannot be bypassed. The rule is that a restriction existing only in the
app is not a restriction.

- **Discovery is opt-in.** The default visibility is community-only.
- **Exact location cannot be stored.** A check constraint refuses any point off
  the ~5 km grid, and there is no fine-location permission in the manifest.
- **Messaging needs mutual consent.** Two independent database checks enforce it.
- **Blocking is absolute and policy-enforced**, so no future screen can leak past it.
- **No phone numbers or email addresses exist in the schema at all.**
- **Rate limits** per identity, plus a shared client token on write endpoints.
- **No unsolicited private messaging**, and no feature that suggests a private
  meeting between members who have not met.

The full model, including what the test suites assert about it, is in
`docs/security/privacy-and-safety.md`.

## Getting started

```bash
cd mobile && npm install && npm start     # demo mode, no credentials needed
```

For Supabase, the backend, the database tests and the Android build, see
`docs/setup/getting-started.md`.

## Tests

```bash
cd mobile && npx tsc --noEmit && npx eslint . --max-warnings 0 && npx jest
cd backend && pytest
cd android-native/java && ./run_tests.sh
cd android-native/cpp  && ./run_tests.sh
DATABASE_URL=postgres://... ./scripts/run_sql_tests.sh
```

Seven mobile suites, 62 backend tests, two native host suites and three SQL suites.
What each one covers, and the pitfalls in running them, is in
`docs/setup/running-tests.md`.

## Building the Android APK

```bash
cd mobile
npx eas-cli@latest build --platform android --profile preview
```

Produces an installable APK and prints a download URL. For a local build:

```bash
npx expo prebuild --platform android --clean
npx expo run:android --variant release
```

`android/` is generated by Expo and is git-ignored. Native behaviour is configured
in `app.json` and `plugins/withConvergeAudio.js`, never by editing generated files.

## Documentation

| Document | Contents |
| --- | --- |
| `docs/architecture/overview.md` | The four layers, the request flows, and why the boundaries fall there |
| `docs/design/design-system.md` | Brand, colour, type, spacing, states, navigation, motion, accessibility |
| `docs/security/privacy-and-safety.md` | The enforced privacy model, and how each control is verified |
| `docs/setup/getting-started.md` | Running the app, Supabase, the backend, and the Android build |
| `docs/setup/demo-accounts.md` | The demo dataset, and how to tell demo mode from live |
| `docs/setup/native-modules.md` | The Java and C++ audio pipeline and the config plugin |
| `docs/setup/running-tests.md` | Every suite, what it covers, and how to run it |

## Configuration

`.env.example` lists every variable with empty values. The mobile bundle only ever
receives the Supabase URL and anon key, both public by design and defended by RLS.
Every secret - the service-role key, translation credentials, the coach model and
the client token - is server-side only. `.env` is git-ignored.

## Licence

See `mobile/LICENSE`.
