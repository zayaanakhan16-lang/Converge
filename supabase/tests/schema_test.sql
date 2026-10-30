-- Schema constraint tests.
--
-- These cover the table-level rules that RLS tests do not reach: a constraint is
-- only proven by attempting a write that should be refused. Like the RLS tests,
-- this file needs a freshly migrated database with no seed data. Every fixture
-- is rolled back at the end.
--
--   docker exec -i converge-pg psql -U postgres -v ON_ERROR_STOP=1 \
--     -f - < supabase/tests/schema_test.sql

\set ON_ERROR_STOP on
set client_min_messages to notice;

begin;

-- ---- helpers ------------------------------------------------------------

create or replace function pg_temp.assert_true(condition boolean, label text)
returns void language plpgsql as $$
begin
  if not condition then
    raise exception 'FAIL %', label;
  end if;
  raise notice 'ok   %', label;
end;
$$;

-- Runs a statement and asserts the database refused it.
create or replace function pg_temp.assert_rejected(statement text, label text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    raise notice 'ok   %', label;
    return;
  end;
  raise exception 'FAIL %: the write was accepted', label;
end;
$$;

-- ---- fixtures -----------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1000000-0000-4000-8000-000000000001', 'schema.one@converge.test', '{"display_name":"One"}'),
  ('a1000000-0000-4000-8000-000000000002', 'schema.two@converge.test', '{"display_name":"Two"}');

insert into public.conversations (id, kind)
values ('a2000000-0000-4000-8000-000000000001', 'direct');

-- ---- waveform constraint ------------------------------------------------

insert into public.messages (conversation_id, sender_id, body, voice_note_seconds, waveform)
values ('a2000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000001',
        'Voice note (3s)', 3, array[0, 42, 100]::smallint[]);
select pg_temp.assert_true(true, 'a voice note with a waveform is accepted');

-- A voice note whose extraction failed is still a valid message: the sender is
-- told why, and the note is sent without bars.
insert into public.messages (conversation_id, sender_id, body, voice_note_seconds)
values ('a2000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000001',
        'Voice note (4s)', 4);
select pg_temp.assert_true(true, 'a voice note without a waveform is accepted');

insert into public.messages (conversation_id, sender_id, body)
values ('a2000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000001',
        'Just text');
select pg_temp.assert_true(true, 'a text message is accepted');

select pg_temp.assert_rejected(
  $sql$insert into public.messages (conversation_id, sender_id, body, waveform)
       values ('a2000000-0000-4000-8000-000000000001',
               'a1000000-0000-4000-8000-000000000001',
               'Waveform without a duration', array[1, 2, 3]::smallint[])$sql$,
  'a waveform without a voice-note duration is rejected');

select pg_temp.assert_rejected(
  $sql$insert into public.messages (conversation_id, sender_id, body, voice_note_seconds, waveform)
       values ('a2000000-0000-4000-8000-000000000001',
               'a1000000-0000-4000-8000-000000000001',
               'Too loud', 3, array[1, 101]::smallint[])$sql$,
  'a bar above 100 is rejected');

select pg_temp.assert_rejected(
  $sql$insert into public.messages (conversation_id, sender_id, body, voice_note_seconds, waveform)
       values ('a2000000-0000-4000-8000-000000000001',
               'a1000000-0000-4000-8000-000000000001',
               'Negative bar', 3, array[-1, 50]::smallint[])$sql$,
  'a negative bar is rejected');

select pg_temp.assert_rejected(
  $sql$insert into public.messages (conversation_id, sender_id, body, voice_note_seconds, waveform)
       values ('a2000000-0000-4000-8000-000000000001',
               'a1000000-0000-4000-8000-000000000001',
               'Null bar', 3, array[50, null]::smallint[])$sql$,
  'a null bar is rejected');

select pg_temp.assert_rejected(
  $sql$insert into public.messages (conversation_id, sender_id, body, voice_note_seconds, waveform)
       values ('a2000000-0000-4000-8000-000000000001',
               'a1000000-0000-4000-8000-000000000001',
               'Empty waveform', 3, array[]::smallint[])$sql$,
  'an empty waveform is rejected');

select pg_temp.assert_rejected(
  $sql$insert into public.messages (conversation_id, sender_id, body, voice_note_seconds, waveform)
       values ('a2000000-0000-4000-8000-000000000001',
               'a1000000-0000-4000-8000-000000000001',
               'Too many bars', 3,
               (select array_agg(50::smallint) from generate_series(1, 65)))$sql$,
  'a waveform longer than 64 bars is rejected');

-- ---- body and attachment limits ----------------------------------------

select pg_temp.assert_rejected(
  $sql$insert into public.messages (conversation_id, sender_id, body)
       values ('a2000000-0000-4000-8000-000000000001',
               'a1000000-0000-4000-8000-000000000001', '   ')$sql$,
  'a whitespace-only message is rejected');

select pg_temp.assert_rejected(
  $sql$insert into public.messages (conversation_id, sender_id, body, attachments)
       values ('a2000000-0000-4000-8000-000000000001',
               'a1000000-0000-4000-8000-000000000001',
               'Five files', '[{},{},{},{},{}]'::jsonb)$sql$,
  'more than four attachments is rejected');

-- ---- conversation membership -------------------------------------------

select pg_temp.assert_rejected(
  $sql$insert into public.conversation_members (conversation_id, profile_id)
       values ('a2000000-0000-4000-8000-000000000001',
               'a1000000-0000-4000-8000-000000000001'),
            ('a2000000-0000-4000-8000-000000000001',
             'a1000000-0000-4000-8000-000000000001')$sql$,
  'the same member cannot join a conversation twice');

-- ---- single owner per community ----------------------------------------

insert into public.communities (id, name, slug, description, purpose, join_code, created_by)
values ('a3000000-0000-4000-8000-000000000001', 'Schema Club', 'schema-club',
        'A community used by the schema tests.', 'Test the constraints.', 'SCHEMA01',
        'a1000000-0000-4000-8000-000000000001');

insert into public.community_members (community_id, profile_id, state, role)
values ('a3000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000001', 'member', 'owner');

select pg_temp.assert_rejected(
  $sql$insert into public.community_members (community_id, profile_id, state, role)
       values ('a3000000-0000-4000-8000-000000000001',
               'a1000000-0000-4000-8000-000000000002', 'member', 'owner')$sql$,
  'a community cannot have two owners');

rollback;

do $$
begin
  raise notice 'SCHEMA TESTS PASSED';
end;
$$;
