# Setup

Everything needed to run Converge locally: the mobile app, the database and the
backend. The app is written so that it runs with **no credentials at all**, in a
clearly labelled demo mode, so the first step below works on its own.

## Prerequisites

| Tool | Version | Needed for |
| --- | --- | --- |
| Node.js | 20 or newer | mobile app |
| Python | 3.11 or newer | backend |
| JDK | 17 or newer | Android build, Java native tests |
| CMake | 3.22 or newer, and a C++17 compiler | C++ native tests |
| Docker | any recent | local Supabase/PostgreSQL, optional |
| Android SDK | via Android Studio, or `eas build` | building the APK |

## 1. Mobile app, demo mode

This is the fastest way to see the product. It uses seeded demo data and needs no
backend.

```bash
cd mobile
npm install
npm start          # then press "a" for an Android device or emulator
```

With no `.env` file, the app starts in demo mode. A banner states that the data is
sample data, so demo mode is never mistaken for a live deployment. The demo
members, communities and events are in `mobile/src/data/demo.ts` and are described
in `docs/setup/demo-accounts.md`.

## 2. Connect a real Supabase project

Create a project at [supabase.com](https://supabase.com), then apply the schema.
Migrations are plain SQL and are applied in filename order.

```bash
# Point the Supabase CLI at your project, then push the migrations.
supabase link --project-ref <your-project-ref>
supabase db push

# Or apply them with psql, for any PostgreSQL with PostGIS:
DATABASE_URL=postgres://... ./scripts/apply_migrations.sh
```

`scripts/apply_migrations.sh` accepts `SHIM=1` to create the local `auth` schema
shim (only for a plain PostgreSQL, never for a real Supabase project, which
provides it) and `SEED=1` to load `supabase/seed.sql`.

In the Supabase dashboard, under Authentication, enable **Email** sign-in. If you
want to skip email confirmation while developing, turn "Confirm email" off — the
app handles both, but the flow is shorter without it.

Then create `mobile/.env` from the template:

```bash
cp .env.example mobile/.env
```

and fill in the two values from **Project settings → API**:

```
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
EXPO_PUBLIC_DEMO_MODE=false
```

Both values are public: they ship inside the app bundle and every access rule is
enforced by Row Level Security. The service-role key must never go here.

## 3. Backend

The backend serves matching, translation, the conversation coach and the
moderation queue. Every capability is optional; an unconfigured one reports itself
as unavailable rather than returning an invented result.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Check it is up:

```bash
curl localhost:8000/health
```

The response lists which capabilities are configured. Then point the app at it by
setting `EXPO_PUBLIC_BACKEND_URL` in `mobile/.env`. Use `http://10.0.2.2:8000` for
the Android emulator, since `localhost` inside the emulator is the emulator
itself.

To turn on translation and the model-backed coach, set `TRANSLATION_*` and
`COACH_*` in `backend/.env` (see `.env.example`). Leaving them blank keeps the
deterministic rule-based coach, which produces real feedback from the submitted
text with no model.

### Place search

Nearby discovery resolves place names on the backend, not on the device, so the
same lookup works on Android and web and the provider can be swapped without an
app release. `GEOCODING_PROVIDER` selects it:

- `nominatim` (default) needs no key. Its usage policy requires an identifying
  `GEOCODING_USER_AGENT`, which the service always sends, and at most one request
  per second, which the service enforces with a process-wide throttle.
- `mapbox` and `locationiq` need `GEOCODING_API_KEY` and suit higher volume.

The service never requests street addresses or premises, so a result is a
country, region, city or neighbourhood. That is deliberate: Converge stores an
approximate area and cannot store anything finer, and a geocoder that returned a
street would imply a precision the product does not keep. If the provider cannot
be reached the picker says the lookup failed; it never reports that a place does
not exist when the real problem was the network.

## 4. Database tests

The SQL suites need a freshly migrated database with **no** seed data, because
some cases count rows overall. `scripts/run_sql_tests.sh` checks for that and says
so clearly instead of reporting a confusing count mismatch.

```bash
# Against any migrated PostgreSQL:
DATABASE_URL=postgres://postgres:postgres@localhost:5432/converge \
  ./scripts/run_sql_tests.sh

# Or against a container, without needing the file inside it:
PSQL="docker exec -i my-postgres psql -U postgres -d converge" \
  ./scripts/run_sql_tests.sh
```

A suite passes by printing `TESTS PASSED`; the runner checks for that sentinel,
because `psql` exits successfully even when a case only raised a notice.

## 5. Android build

`android/` is generated by Expo Continuous Native Generation and is git-ignored —
never edit it by hand. Native behaviour is configured in `mobile/app.json` and the
config plugin `mobile/plugins/withConvergeAudio.js`, which copies the Java and C++
sources from `android-native/` into the generated project and wires the CMake
build.

### Cloud build (no Android SDK locally)

```bash
cd mobile
npx eas-cli@latest build --platform android --profile preview
```

EAS produces an installable APK and prints a download URL.

### Local build

```bash
cd mobile
npx expo prebuild --platform android --clean   # generates android/, runs the plugin
npx expo run:android --variant release         # builds and installs on a device
```

The first local build is slow because it compiles the native audio library and
React Native itself. If the app is installed but voice notes show no waveform, the
cause is almost always the optional transcoder: see `docs/setup/native-modules.md`.

### Install the APK

```bash
adb install -r path/to/converge.apk
```

## 6. Native module tests

Both native layers are tested on the host, with no emulator, because neither has
an Android dependency:

```bash
cd android-native/java && ./run_tests.sh   # WAV container parsing
cd android-native/cpp  && ./run_tests.sh   # amplitude envelope DSP
```

## Common problems

**`expo-doctor` reports mismatched versions.** Run `npx expo install --fix`, which
resolves SDK-compatible versions.

**The app shows demo data after configuring Supabase.** Check
`EXPO_PUBLIC_DEMO_MODE` is `false` and that both Supabase values are present;
the app falls back to demo mode rather than failing to start, and says so in the
banner.

**Backend calls fail from the emulator.** Use `10.0.2.2`, not `localhost`, and
make sure `CONVERGE_ALLOWED_ORIGINS` includes the dev server origin.

**A 503 from the backend.** That endpoint needs a capability that is not
configured. The message names the missing variable.

**Voice notes have no waveform.** `ffmpeg-kit` is not installed; the caption under it
the message will say so. See `docs/setup/native-modules.md`.
