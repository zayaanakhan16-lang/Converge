# Demo accounts and demo mode

Converge can run against two different data sources, and the difference is always
visible in the app. This document records what each one is and how to tell them
apart, so demo data is never mistaken for a live deployment.

## Demo mode

Demo mode is a complete, self-contained in-memory dataset with no network calls.
It exists so the app can be explored, reviewed and tested without a backend.

How it is selected: leaving `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` blank in `mobile/.env` starts the app in demo
mode. `EXPO_PUBLIC_DEMO_MODE=false` forces live mode even without Supabase,
which is only useful for explicit override during development.

How you know you are in it: a banner is shown on the main screens stating that
the data is sample data. This is not optional styling — it is the safeguard
against a reviewer or a new team member believing they are looking at real users.

The dataset lives in `mobile/src/data/demo.ts` and is served by
`mobile/src/services/demo/DemoRepository.ts`, which implements the same
`Repository` interface as the Supabase implementation. Screens therefore contain
no demo-mode branches; the difference is entirely below the interface.

## Demo members

Signing in to demo mode does not require a password. The signed-in member is
**Amara Okonkwo**, chosen because the seeded relationships are arranged around
her: two existing connections and two conversations, one connection request she
has received and one she has sent.

The other members exist to give the matching engine, the discovery filters and the
connection states something real to work with. Among them:

| Member | Why they exist in the dataset |
| --- | --- |
| Amara Okonkwo | The signed-in member. The relationships are arranged around her. |
| Diego Salazar | Has sent Amara a pending request with a reason, so the "answer a request" flow is reachable. |
| Priya Raman | Amara has sent her a request, so the "sent, awaiting reply" state is reachable. |
| Grace Adeyemi | A connection of Amara's, with a direct conversation. |
| Ravi Chandran | A connection of Amara's, with an unread conversation. |
| Yusuf Karim | Shares a community with Amara, so the "same club" match reason is reachable. |
| Lena Fischer | A different community and language profile, so the filters have a distinct case. |
| Nadia Haddad | A further community member, so member lists are longer than a single page. |

The descriptions here describe the dataset's purpose, not real people. No demo
member corresponds to a real person, and the avatars are generated from initials.

## Seeded Supabase accounts

`supabase/seed.sql` mirrors the same dataset into a real database, so the app
behaves the same way whether it is pointed at demo mode or at a seeded project.
It is for development only: **never run it against a production project.**

Seven accounts are created, all with the password `converge-demo`:

```
amara@converge.demo    amara@converge.demo is the signed-in member
diego@converge.demo    priya@converge.demo    tom@converge.demo
lena@converge.demo     yusuf@converge.demo    nadia@converge.demo
```

Every seeded account is clearly labelled a demo account in its headline, so a
member of the dataset is identifiable as such from inside the app.

Apply it with `supabase db reset`, which runs the migrations and then the seed, or
with `SEED=1 ./scripts/apply_migrations.sh` against a plain PostgreSQL that has
the auth shim.

> The seeded password is committed in plain text. That is intentional and safe for
> a development seed, and it is the reason the seed must not be run against a
> production project. Do not reuse the pattern for real accounts.

## Which one am I looking at?

| | Demo mode | Seeded project |
| --- | --- | --- |
| Sign-in | Any credentials, or none | `amara@converge.demo` / `converge-demo` |
| Data is stored | In memory; resets on reload | In PostgreSQL; persists |
| Banner shown | Yes | No |
| Realtime updates | No | Yes |
| Translation / coach | Disabled, reported as unavailable | Works when the backend is configured |
| Requires network | No | Yes |
