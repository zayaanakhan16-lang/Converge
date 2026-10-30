-- Voice-note waveform.
--
-- The bars drawn under a voice note are derived from the recording by the native
-- Java/C++ module (see android-native/), then stored so the recipient does not
-- re-decode audio on every render.
--
-- Stored as small integers on a 0-100 scale rather than floats: the values are
-- only ever drawn, so a percentage of full scale is exact for that purpose and
-- takes half the space of a real array.

alter table public.messages
  add column if not exists waveform smallint[];

comment on column public.messages.waveform is
  'Peak amplitude per bar, 0-100, produced by the native audio module. Null when the waveform could not be extracted.';

-- A check constraint cannot contain a subquery, so the per-bar range test lives
-- in an immutable function instead. It has to be strict about null elements:
-- `0 <= all (bars)` is null, not false, when any element is null, which would
-- let a null bar through and render as a gap in the waveform.
create or replace function public.is_valid_waveform(bars smallint[])
returns boolean
language sql
immutable
as $$
  select case
    when bars is null then true
    when array_length(bars, 1) is null then false
    when array_length(bars, 1) not between 1 and 64 then false
    when array_position(bars, null) is not null then false
    else 0 <= all (bars) and 100 >= all (bars)
  end;
$$;

alter table public.messages
  drop constraint if exists messages_waveform_valid;

-- A waveform only exists alongside a duration. A voice note whose extraction
-- failed is still a valid message: the sender is told why and the note is sent
-- without bars, so a null waveform is a normal state.
alter table public.messages
  add constraint messages_waveform_valid check (
    public.is_valid_waveform(waveform)
    and (waveform is null or voice_note_seconds is not null)
  );
