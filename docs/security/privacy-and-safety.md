# Privacy and safety

Converge is built to be usable by students and younger people, so the privacy
model is enforced where it cannot be bypassed rather than where it is convenient.

The guiding rule: **a control that only exists in the app is not a control.** Every
restriction below is enforced by a database policy, a check constraint or a
function, so a modified client, an old build or a mistyped query in a future
feature cannot get past it.

## Discovery is opt-in

`profiles.visibility` defaults to `community`, not `public`. A new member is
visible to the communities they have joined, and nowhere else, until they change
it. `show_in_community_lists` allows a member to stay a member without appearing
in the member list of that community.

The discover policies only return a profile when the viewer is authorised for that
profile's current visibility level, so hidden profiles are absent from the result
set rather than filtered out afterwards. There is nothing to leak in a count or a
pagination cursor.

## Location

There is no way to store an exact coordinate. `profiles.latitude` and
`longitude` are snapped by the client to a 0.05 degree grid (roughly 5 km), and
`profiles_coarse_grid` rejects any row that is not on that grid:

```sql
constraint profiles_coarse_grid check (
  latitude is null
  or (abs(latitude / 0.05 - round(latitude / 0.05)) < 0.000001
      and abs(longitude / 0.05 - round(longitude / 0.05)) < 0.000001)
)
```

This is the important shape to keep: precision is impossible by construction, not
merely discouraged. Sharing is additionally opt-in
(`share_approximate_location` defaults to `false`), so a member who never enables
it has no point stored at all. What another member reads is `area_label`, a piece
of text; the point is only ever used inside a radius query and is never rendered.

The Android manifest declares `ACCESS_COARSE_LOCATION` and explicitly blocks
`ACCESS_FINE_LOCATION`, so the OS will not grant precise location even if a future
contributor asks for it. Satellite imagery is not used to identify or track
anyone. There is no continuous location tracking: a position is written when the
member chooses to update it, and at no other time.

## Messaging requires mutual consent

A direct conversation cannot be created by inserting a row. It is created by
`open_direct_conversation`, which refuses unless a `connections` row already links
the two members. Membership is then required to read or write messages, enforced
by the policies on `conversation_members` and `messages`.

Two independent checks guard the same outcome on purpose. If the function were
ever bypassed, the policy on `messages` still refuses the write; if the policy were
ever loosened, the function still refuses to create the conversation. This is the
single most important property of the product, so it is defended twice.

Connection requests carry an optional `reason` field, which is what the recipient
reads before deciding. Consent with context is the point; a bare notification is
not enough.

## Blocking

A block is absolute, and it is enforced by policy rather than by a filter:

- A blocked pair cannot read each other's profiles, in any visibility mode.
- Neither appears in the other's search or discover results.
- Existing conversations are unreadable to each other.
- New connection requests in either direction are refused.

Because these are policies, a future screen that forgets to check for blocks still
cannot show the data. This is why blocking is a table with policies rather than a
boolean flag consulted by the UI.

## Reporting

Any member can insert a report about a profile, message or event, with a reason
and an optional note. `reports` is write-only from the client's perspective: RLS
allows a member to insert their own reports and read back their own, and nothing
else. Triage happens server-side over the service-role key, through the backend's
`/v1/moderation` endpoints, which require the shared client token.

## No public personal contact details

There is no phone number, email address or external handle anywhere in the schema.
A profile has a display name, an optional headline and bio, an avatar, and the
taxonomy links. Contact happens inside Converge, after consent, or not at all.
This removes the most common route by which a young person is contacted off the
platform by a stranger.

## Rate limits

The backend applies a per-identity sliding window (`CONVERGE_RATE_LIMIT_PER_MINUTE`,
default 60) to every route through `rate_limited`, and returns `429` with a
`Retry-After` header. Write endpoints additionally require a shared secret in the
`X-Converge-Client` header, which stops the deployment from being an open relay.

Moderation-heavy actions are the ones most worth limiting further; the limiter is
applied per router so a stricter value can be set for a specific surface without
touching the rest.

## In-person activities

Community and event discovery deliberately routes through a community, and events
have a venue and an organiser. The app does not suggest a private meeting between
two members who have not met, there is no "meet up now" affordance, and no feature
recommends a one-to-one meeting at a personal address. Proximity is used to
suggest a community or an event, never to arrange a private encounter.

## Secrets

- The mobile bundle only receives the Supabase URL and anon key. Both are public
  by design and defended by RLS.
- The service-role key, translation credentials and coach credentials are
  server-side only and read from the environment.
- `.env` is git-ignored; `.env.example` documents the variables with empty values.
- When a capability is unconfigured, the API reports it as unavailable rather than
  degrading into a fabricated result. There is no code path that invents a
  translation or a match.

## What is verified

- `supabase/tests/rls_test.sql` exercises the policies as four different members,
  including one who is blocked and one who has opted out of discovery, and asserts
  that unauthorised reads and writes are refused.
- `supabase/tests/schema_test.sql` asserts the check constraints by attempting
  writes that must fail, including a waveform bar outside 0–100 and a second owner
  of a community.
- `backend/tests/` covers the moderation and translation endpoints, including the
  unconfigured paths.

Run them with `scripts/run_sql_tests.sh` and `pytest` in `backend/`. See
`docs/setup/running-tests.md`.
