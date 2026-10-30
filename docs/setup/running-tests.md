# Running the tests

Four suites, all runnable locally with no cloud account. This records how to run
each one and what it actually covers.

## Mobile (TypeScript)

```bash
cd mobile
npx tsc --noEmit                 # types
npx eslint . --max-warnings 0    # lint, warnings are failures
npx jest                         # unit tests
```

`npx expo-doctor` additionally checks that dependency versions match the Expo SDK.

**What is covered.** The suites live next to the code they test:

| Suite | Covers |
| --- | --- |
| `features/matching/__tests__/engine.test.ts` | The match signal model: shared interests, complementary skills, aligned goals, language compatibility, and that each reason is explained rather than returned as a bare score. |
| `features/coach/__tests__/ruleCoach.test.ts` | The rule-based coach: that feedback is derived from the submitted text and that empty or trivial input is handled. |
| `services/demo/__tests__/DemoRepository.test.ts` | The demo repository against the `Repository` interface: connection states, consent rules for direct conversations, and message ordering. |
| `services/native/__tests__/audio.test.ts` | The JavaScript waveform implementation, using the same inputs and expectations as the native Java tests. |
| `utils/__tests__/validation.test.ts` | Form validation: email shape, password rules, display name bounds. |
| `plugins/__tests__/withConvergeAudio.test.js` | The Expo config plugin, against a real fixture tree on disk: that the native sources are copied, the Gradle CMake block is inserted and `MainApplication` is updated, and that all of it is idempotent. |

The lint gate is `--max-warnings 0`. A warning is a failure, which is why the few
unavoidable suppressions in `jest.setup.ts` carry an explanatory comment.

## Database

```bash
# Against any migrated PostgreSQL:
DATABASE_URL=postgres://postgres:postgres@localhost:5432/converge \
  ./scripts/run_sql_tests.sh

# Or inside a container, without the file needing to be visible there:
PSQL="docker exec -i my-postgres psql -U postgres -d converge" \
  ./scripts/run_sql_tests.sh
```

Two suites, both of which need a **freshly migrated database with no seed data**.
Some cases count rows overall, so seeded connections or conversations would make
the expected values meaningless. The runner checks for that condition and reports
it explicitly rather than showing a confusing count mismatch.

| Suite | Covers |
| --- | --- |
| `supabase/tests/rls_test.sql` | Row Level Security, exercised as four different members: that a member cannot read a profile outside their visibility level, cannot request a connection as somebody else, cannot create a direct conversation without a connection, cannot post into a conversation they are not part of, and that a blocked member sees nothing. |
| `supabase/tests/schema_test.sql` | Check constraints, by attempting writes that must be refused: a waveform bar outside 0–100, a wave-bar array longer than 64, a waveform without a duration, a blank message body, more than four attachments, a duplicate conversation member, and a second owner of a community. |

Both suites roll their fixtures back, so they can be run repeatedly against the
same database.

A suite passes by printing a `TESTS PASSED` sentinel, which the runner checks for.
The exit code alone is not enough: `psql` exits successfully even when a case only
raised a notice, so a suite could otherwise appear to pass while asserting nothing.

## Backend (Python)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest
```

| File | Covers |
| --- | --- |
| `tests/test_api.py` | The HTTP surface: health, and that unconfigured capabilities return 503 with a message naming the missing variable rather than a fabricated result. |
| `tests/test_matching.py` | The matching service: signal contributions, complementary skills, and that every reason carries an explanation. |
| `tests/test_services.py` | Translation and coach orchestration, including the unconfigured paths: the API reports `provider: "unavailable"` instead of inventing text. |

## Native (Java and C++)

Both native layers are tested on the host with no emulator, because neither
`WavDecoder` nor `waveform.cpp` has an Android dependency. That is the reason for
the split described in `docs/setup/native-modules.md`.

```bash
cd android-native/java && ./run_tests.sh   # WAV container parsing
cd android-native/cpp  && ./run_tests.sh   # amplitude envelope DSP
```

Requires a JDK for the first and CMake plus a C++17 compiler for the second. The
C++ build uses `-Werror`, so a warning fails the suite.

| Suite | Covers |
| --- | --- |
| `WavDecoderTest.java` | Mono and stereo decoding, that only the first channel is read, rejection of non-WAV and 8-bit files, an empty file, a chunk before `fmt`, and a truncated `data` chunk returning the frames actually present. |
| `waveform_test.cpp` | The envelope: silent input, a constant tone, that a lone peak sets its bar height, negative samples contributing their magnitude, and that an uneven split still returns every bar with the final sample in the final bucket. |

## Continuous integration

There is no CI workflow committed. The commands above are the full check, and
should be run before a change is proposed. If CI is added, `run_sql_tests.sh`
returns a non-zero exit code on failure and prints the failing case, so it can be
used as-is in a job.
