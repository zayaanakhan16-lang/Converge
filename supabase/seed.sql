-- Development seed data.
--
-- This mirrors `mobile/src/data/demo.ts` so the app behaves the same whether it
-- is running against the local demo dataset or a seeded Supabase project. It is
-- for development only: never run it against a production project.
--
-- Apply with:
--   supabase db reset          (runs migrations then seed.sql)
--   SEED=1 ./scripts/apply_migrations.sh   (plain PostgreSQL with the shim)
--
-- Accounts are created with a known password so the team can sign in. Every
-- account is clearly labelled a demo account in its headline.

begin;

-- ---- accounts -----------------------------------------------------------
-- The `on_auth_user_created` trigger creates the profile row and the default
-- English language for each of these.

insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', 'amara@converge.demo',
   crypt('converge-demo', gen_salt('bf')), now(), '{"display_name":"Amara Okonkwo"}'),
  ('22222222-2222-4222-8222-222222222222', 'diego@converge.demo',
   crypt('converge-demo', gen_salt('bf')), now(), '{"display_name":"Diego Salazar"}'),
  ('33333333-3333-4333-8333-333333333333', 'priya@converge.demo',
   crypt('converge-demo', gen_salt('bf')), now(), '{"display_name":"Priya Raman"}'),
  ('44444444-4444-4444-8444-444444444444', 'tom@converge.demo',
   crypt('converge-demo', gen_salt('bf')), now(), '{"display_name":"Tom Whitfield"}'),
  ('55555555-5555-4555-8555-555555555555', 'lena@converge.demo',
   crypt('converge-demo', gen_salt('bf')), now(), '{"display_name":"Lena Fischer"}'),
  ('66666666-6666-4666-8666-666666666666', 'yusuf@converge.demo',
   crypt('converge-demo', gen_salt('bf')), now(), '{"display_name":"Yusuf Karim"}'),
  ('77777777-7777-4777-8777-777777777777', 'nadia@converge.demo',
   crypt('converge-demo', gen_salt('bf')), now(), '{"display_name":"Nadia Haddad"}')
on conflict (id) do nothing;

-- ---- profiles -----------------------------------------------------------
-- Coordinates are snapped to the 0.05 degree grid the check constraint expects.

update public.profiles set
  headline = 'Second-year computer science student',
  bio = 'Looking for people to build small open-source tools with. I run a weekly study session at the university library.',
  visibility = 'discoverable',
  share_approximate_location = true,
  latitude = 53.50, longitude = -2.25, area_label = 'Northside',
  onboarding_completed = true
where id = '11111111-1111-4111-8111-111111111111';

update public.profiles set
  headline = 'Design student, open-source contributor',
  bio = 'I care about interfaces that work for everyone. Happy to review designs or pair on a project.',
  visibility = 'discoverable',
  share_approximate_location = true,
  latitude = 53.45, longitude = -2.25, area_label = 'Riverside',
  onboarding_completed = true
where id = '22222222-2222-4222-8222-222222222222';

update public.profiles set
  headline = 'Data science master''s student',
  bio = 'Working on urban mobility data. I like explaining statistics without jargon.',
  visibility = 'discoverable',
  share_approximate_location = true,
  latitude = 53.50, longitude = -2.20, area_label = 'Eastgate',
  onboarding_completed = true
where id = '33333333-3333-4333-8333-333333333333';

update public.profiles set
  headline = 'Apprentice electrician, evening coder',
  bio = 'Teaching myself to program after work. Looking for patient people to learn alongside.',
  visibility = 'discoverable',
  share_approximate_location = true,
  latitude = 53.45, longitude = -2.30, area_label = 'West Park',
  onboarding_completed = true
where id = '44444444-4444-4444-8444-444444444444';

update public.profiles set
  headline = 'Language exchange organiser',
  bio = 'I run a fortnightly German-English exchange at the community centre. Newcomers welcome.',
  visibility = 'discoverable',
  share_approximate_location = true,
  latitude = 53.45, longitude = -2.25, area_label = 'Riverside',
  onboarding_completed = true
where id = '55555555-5555-4555-8555-555555555555';

update public.profiles set
  headline = 'Robotics mentor and maker',
  bio = 'I help run the robotics society and teach electronics to beginners.',
  visibility = 'discoverable',
  share_approximate_location = true,
  latitude = 53.50, longitude = -2.20, area_label = 'Eastgate',
  onboarding_completed = true
where id = '66666666-6666-4666-8666-666666666666';

-- A member who has chosen not to appear in discovery at all. Useful for
-- checking that privacy settings are respected end to end.
update public.profiles set
  headline = 'Keeping a low profile for now',
  bio = 'I would rather find people through communities than appear in a list.',
  visibility = 'private',
  share_approximate_location = false,
  onboarding_completed = true
where id = '77777777-7777-4777-8777-777777777777';

-- ---- interests, skills, goals, activities -------------------------------

insert into public.profile_interests (profile_id, interest_id) values
  ('11111111-1111-4111-8111-111111111111', 'programming'),
  ('11111111-1111-4111-8111-111111111111', 'open-source'),
  ('11111111-1111-4111-8111-111111111111', 'data-science'),
  ('11111111-1111-4111-8111-111111111111', 'student-societies'),
  ('11111111-1111-4111-8111-111111111111', 'climbing'),
  ('22222222-2222-4222-8222-222222222222', 'graphic-design'),
  ('22222222-2222-4222-8222-222222222222', 'programming'),
  ('22222222-2222-4222-8222-222222222222', 'open-source'),
  ('22222222-2222-4222-8222-222222222222', 'photography'),
  ('33333333-3333-4333-8333-333333333333', 'data-science'),
  ('33333333-3333-4333-8333-333333333333', 'mathematics'),
  ('33333333-3333-4333-8333-333333333333', 'cycling'),
  ('33333333-3333-4333-8333-333333333333', 'volunteering'),
  ('44444444-4444-4444-8444-444444444444', 'electronics'),
  ('44444444-4444-4444-8444-444444444444', 'programming'),
  ('44444444-4444-4444-8444-444444444444', 'football'),
  ('44444444-4444-4444-8444-444444444444', 'local-events'),
  ('55555555-5555-4555-8555-555555555555', 'languages'),
  ('55555555-5555-4555-8555-555555555555', 'history'),
  ('55555555-5555-4555-8555-555555555555', 'local-events'),
  ('55555555-5555-4555-8555-555555555555', 'choir'),
  ('66666666-6666-4666-8666-666666666666', 'robotics'),
  ('66666666-6666-4666-8666-666666666666', 'electronics'),
  ('66666666-6666-4666-8666-666666666666', 'mentoring'),
  ('77777777-7777-4777-8777-777777777777', 'creative-writing'),
  ('77777777-7777-4777-8777-777777777777', 'history')
on conflict do nothing;

insert into public.profile_skills (profile_id, skill_id, intent) values
  ('11111111-1111-4111-8111-111111111111', 'frontend', 'offer'),
  ('11111111-1111-4111-8111-111111111111', 'backend', 'offer'),
  ('11111111-1111-4111-8111-111111111111', 'data-analysis', 'offer'),
  ('11111111-1111-4111-8111-111111111111', 'machine-learning', 'learn'),
  ('11111111-1111-4111-8111-111111111111', 'ui-design', 'learn'),
  ('22222222-2222-4222-8222-222222222222', 'ui-design', 'offer'),
  ('22222222-2222-4222-8222-222222222222', 'illustration', 'offer'),
  ('22222222-2222-4222-8222-222222222222', 'frontend', 'offer'),
  ('22222222-2222-4222-8222-222222222222', 'backend', 'learn'),
  ('33333333-3333-4333-8333-333333333333', 'data-analysis', 'offer'),
  ('33333333-3333-4333-8333-333333333333', 'machine-learning', 'offer'),
  ('33333333-3333-4333-8333-333333333333', 'teaching', 'offer'),
  ('33333333-3333-4333-8333-333333333333', 'mobile', 'learn'),
  ('44444444-4444-4444-8444-444444444444', 'first-aid', 'offer'),
  ('44444444-4444-4444-8444-444444444444', 'repair', 'offer'),
  ('44444444-4444-4444-8444-444444444444', 'frontend', 'learn'),
  ('44444444-4444-4444-8444-444444444444', 'backend', 'learn'),
  ('55555555-5555-4555-8555-555555555555', 'teaching', 'offer'),
  ('55555555-5555-4555-8555-555555555555', 'event-planning', 'offer'),
  ('55555555-5555-4555-8555-555555555555', 'public-speaking', 'offer'),
  ('66666666-6666-4666-8666-666666666666', 'project-management', 'offer'),
  ('66666666-6666-4666-8666-666666666666', 'teaching', 'offer'),
  ('66666666-6666-4666-8666-666666666666', 'community-organising', 'offer')
on conflict do nothing;

insert into public.profile_languages (profile_id, language_code, proficiency) values
  ('11111111-1111-4111-8111-111111111111', 'en', 'fluent'),
  ('22222222-2222-4222-8222-222222222222', 'es', 'native'),
  ('22222222-2222-4222-8222-222222222222', 'en', 'fluent'),
  ('33333333-3333-4333-8333-333333333333', 'en', 'fluent'),
  ('33333333-3333-4333-8333-333333333333', 'hi', 'native'),
  ('44444444-4444-4444-8444-444444444444', 'en', 'native'),
  ('55555555-5555-4555-8555-555555555555', 'de', 'native'),
  ('55555555-5555-4555-8555-555555555555', 'en', 'fluent'),
  ('55555555-5555-4555-8555-555555555555', 'fr', 'conversational'),
  ('66666666-6666-4666-8666-666666666666', 'en', 'fluent'),
  ('66666666-6666-4666-8666-666666666666', 'ur', 'native'),
  ('77777777-7777-4777-8777-777777777777', 'en', 'native'),
  ('77777777-7777-4777-8777-777777777777', 'ar', 'fluent')
on conflict do nothing;

insert into public.profile_goals (profile_id, goal_id) values
  ('11111111-1111-4111-8111-111111111111', 'find-collaborators'),
  ('11111111-1111-4111-8111-111111111111', 'build-confidence'),
  ('11111111-1111-4111-8111-111111111111', 'learn-skill'),
  ('22222222-2222-4222-8222-222222222222', 'find-collaborators'),
  ('22222222-2222-4222-8222-222222222222', 'mentor-others'),
  ('33333333-3333-4333-8333-333333333333', 'find-collaborators'),
  ('33333333-3333-4333-8333-333333333333', 'volunteer'),
  ('44444444-4444-4444-8444-444444444444', 'learn-skill'),
  ('44444444-4444-4444-8444-444444444444', 'make-friends'),
  ('55555555-5555-4555-8555-555555555555', 'practise-language'),
  ('55555555-5555-4555-8555-555555555555', 'join-community'),
  ('66666666-6666-4666-8666-666666666666', 'mentor-others'),
  ('77777777-7777-4777-8777-777777777777', 'make-friends')
on conflict do nothing;

insert into public.profile_activities (profile_id, activity_id) values
  ('11111111-1111-4111-8111-111111111111', 'study-sessions'),
  ('11111111-1111-4111-8111-111111111111', 'hackathons'),
  ('11111111-1111-4111-8111-111111111111', 'workshops'),
  ('22222222-2222-4222-8222-222222222222', 'hackathons'),
  ('22222222-2222-4222-8222-222222222222', 'workshops'),
  ('22222222-2222-4222-8222-222222222222', 'exhibitions'),
  ('33333333-3333-4333-8333-333333333333', 'study-sessions'),
  ('33333333-3333-4333-8333-333333333333', 'walking-groups'),
  ('33333333-3333-4333-8333-333333333333', 'volunteer-days'),
  ('44444444-4444-4444-8444-444444444444', 'study-sessions'),
  ('44444444-4444-4444-8444-444444444444', 'sports-meetups'),
  ('55555555-5555-4555-8555-555555555555', 'language-exchange'),
  ('55555555-5555-4555-8555-555555555555', 'open-mics'),
  ('55555555-5555-4555-8555-555555555555', 'book-clubs'),
  ('66666666-6666-4666-8666-666666666666', 'workshops'),
  ('77777777-7777-4777-8777-777777777777', 'book-clubs')
on conflict do nothing;

-- ---- communities --------------------------------------------------------

insert into public.communities
  (id, name, slug, description, purpose, join_code, membership_requires_approval,
   member_count, cover_colour, is_private, latitude, longitude, area_label, created_by)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Northside Coders', 'northside-coders',
   'A weekly build night for students and self-taught developers in the north of the city. Bring whatever you are working on.',
   'Build together, in person, every Wednesday.', 'NSC-4821', false, 0, '#0E3A4C', false,
   53.50, -2.25, 'Northside', '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Riverside Language Exchange', 'riverside-language-exchange',
   'Fortnightly exchange covering German, Spanish, French and Arabic. Tables are grouped by language so beginners are never lost.',
   'Practise a language with people who are learning too.', 'RLE-2210', false, 0, '#1FB8A6', false,
   53.45, -2.25, 'Riverside', '55555555-5555-4555-8555-555555555555'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'Eastgate Robotics Society', 'eastgate-robotics',
   'We build competition robots and run outreach workshops in local schools. New members are paired with an experienced builder.',
   'Learn robotics by building something real.', null, true, 0, '#14395E', false,
   53.50, -2.20, 'Eastgate', '66666666-6666-4666-8666-666666666666'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'West Park Growing Group', 'west-park-growing',
   'Two allotment plots shared with a youth group. Sessions run Saturday mornings, tools provided.',
   'Grow food and grow a neighbourhood.', 'WPG-1102', false, 0, '#1E7F5C', false,
   53.45, -2.30, 'West Park', '44444444-4444-4444-8444-444444444444'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'South Quay Repair Cafe', 'south-quay-repair-cafe',
   'Monthly repair cafe for electronics, textiles and small furniture. Volunteer repairers always needed.',
   'Fix things instead of replacing them.', null, true, 0, '#C2703F', false,
   53.40, -2.20, 'South Quay', '22222222-2222-4222-8222-222222222222'),
  ('aaaaaaaa-0000-4000-8000-000000000006', 'City Debate and Speaking', 'city-debate',
   'Thursday evening debate practice with a structured feedback round. Open to all experience levels.',
   'Speak clearly and listen carefully.', 'CDS-7734', false, 0, '#525C69', false,
   53.50, -2.25, 'Northside', '11111111-1111-4111-8111-111111111111')
on conflict (id) do nothing;

insert into public.community_interests (community_id, interest_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'programming'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'open-source'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'game-development'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'languages'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'history'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'robotics'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'electronics'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'mentoring'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'gardening'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'volunteering'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'electronics'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'sewing'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'woodwork'),
  ('aaaaaaaa-0000-4000-8000-000000000006', 'debate'),
  ('aaaaaaaa-0000-4000-8000-000000000006', 'creative-writing')
on conflict do nothing;

insert into public.community_languages (community_id, language_code) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'en'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'de'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'es'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'fr'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'ar'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'en'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'en'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'ur'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'en'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'en'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'fr'),
  ('aaaaaaaa-0000-4000-8000-000000000006', 'en')
on conflict do nothing;

-- Membership: the seeded viewer (Amara) belongs to three communities, which is
-- what makes AuraMatch able to explain a shared community.
insert into public.community_members (community_id, profile_id, state, role, joined_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'member', 'owner', now()),
  ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'member', 'member', now()),
  ('aaaaaaaa-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'member', 'member', now()),
  ('aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'member', 'member', now()),
  ('aaaaaaaa-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 'member', 'member', now()),
  ('aaaaaaaa-0000-4000-8000-000000000002', '55555555-5555-4555-8555-555555555555', 'member', 'owner', now()),
  ('aaaaaaaa-0000-4000-8000-000000000003', '66666666-6666-4666-8666-666666666666', 'member', 'owner', now()),
  ('aaaaaaaa-0000-4000-8000-000000000003', '44444444-4444-4444-8444-444444444444', 'member', 'member', now()),
  ('aaaaaaaa-0000-4000-8000-000000000004', '44444444-4444-4444-8444-444444444444', 'member', 'owner', now()),
  ('aaaaaaaa-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', 'member', 'owner', now()),
  ('aaaaaaaa-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'member', 'owner', now()),
  ('aaaaaaaa-0000-4000-8000-000000000006', '55555555-5555-4555-8555-555555555555', 'member', 'member', now())
on conflict do nothing;

-- A pending membership request, so the organiser view has something to show.
insert into public.community_members (community_id, profile_id, state, role, note)
values ('aaaaaaaa-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333',
        'requested', 'member', 'I would like to learn how the competition team is organised.')
on conflict do nothing;

-- ---- events -------------------------------------------------------------

insert into public.events
  (id, community_id, title, description, starts_at, ends_at, venue_name, is_public_venue,
   capacity, activity_ids, language_codes, created_by, latitude, longitude)
values
  ('eeeeeeee-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Wednesday build night', 'Bring a project and a laptop. We pair people up in the first half hour.',
   now() + interval '3 days', now() + interval '3 days 3 hours', 'Northside Library, Meeting Room 2',
   true, 30, array['study-sessions','workshops'], array['en'],
   '11111111-1111-4111-8111-111111111111', 53.50, -2.25),
  ('eeeeeeee-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000002',
   'German-English exchange', 'Fortnightly exchange. Tables are grouped by level so nobody is lost.',
   now() + interval '5 days', now() + interval '5 days 2 hours', 'Riverside Community Centre, Hall B',
   true, 40, array['language-exchange'], array['de','en'],
   '55555555-5555-4555-8555-555555555555', 53.45, -2.25),
  ('eeeeeeee-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000003',
   'Robotics open workshop', 'Soldering stations and a starter kit for anyone new to electronics.',
   now() + interval '8 days', now() + interval '8 days 3 hours', 'Eastgate Maker Space',
   true, 12, array['workshops'], array['en'],
   '66666666-6666-4666-8666-666666666666', 53.50, -2.20),
  ('eeeeeeee-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000004',
   'Saturday growing session', 'Planting for the summer beds. Tools and gloves provided.',
   now() + interval '10 days', now() + interval '10 days 3 hours', 'West Park Allotments, Plot 14',
   true, 20, array['volunteer-days'], array['en'],
   '44444444-4444-4444-8444-444444444444', 53.45, -2.30),
  ('eeeeeeee-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000006',
   'Debate practice: technology and privacy', 'Structured practice with a feedback round at the end.',
   now() + interval '12 days', now() + interval '12 days 2 hours', 'Central Library, Room 4',
   true, 24, array['workshops'], array['en'],
   '11111111-1111-4111-8111-111111111111', 53.50, -2.25)
on conflict (id) do nothing;

insert into public.event_attendees (event_id, profile_id) values
  ('eeeeeeee-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222'),
  ('eeeeeeee-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444'),
  ('eeeeeeee-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111')
on conflict do nothing;

-- ---- connections and messages -------------------------------------------

-- Amara and Diego are already connected, so the messaging screens have real
-- history without needing two devices.
insert into public.connection_requests (id, from_user, to_user, reason, status, responded_at)
values ('dddddddd-0000-4000-8000-000000000001',
        '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111',
        'We are both in Northside Coders and both working on open-source tools.',
        'accepted', now() - interval '2 days')
on conflict (id) do nothing;

insert into public.connections (id, user_a, user_b, origin_request_id)
values ('ffffffff-0000-4000-8000-000000000001',
        '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
        'dddddddd-0000-4000-8000-000000000001')
on conflict do nothing;

-- An incoming request for the seeded viewer, so the Connections screen is not
-- empty on first sign-in.
insert into public.connection_requests (id, from_user, to_user, reason, status)
values ('dddddddd-0000-4000-8000-000000000002',
        '33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111',
        'Both interested in data science and looking for a project partner.', 'pending')
on conflict (id) do nothing;

insert into public.conversations (id, kind, last_message_at)
values ('99999999-0000-4000-8000-000000000001', 'direct', now() - interval '20 minutes')
on conflict (id) do nothing;

insert into public.conversation_members (conversation_id, profile_id) values
  ('99999999-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111'),
  ('99999999-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222')
on conflict do nothing;

insert into public.messages (id, conversation_id, sender_id, body, created_at) values
  ('11112222-0000-4000-8000-000000000001', '99999999-0000-4000-8000-000000000001',
   '22222222-2222-4222-8222-222222222222',
   'Hi Amara - I saw you are working on a small open-source tool. What are you building?',
   now() - interval '3 hours'),
  ('11112222-0000-4000-8000-000000000002', '99999999-0000-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111111',
   'A timetable planner for study groups. I am stuck on the drag-and-drop part.',
   now() - interval '2 hours'),
  ('11112222-0000-4000-8000-000000000003', '99999999-0000-4000-8000-000000000001',
   '22222222-2222-4222-8222-222222222222',
   'I have done that before. Happy to pair on it at Wednesday build night if you like.',
   now() - interval '20 minutes')
on conflict (id) do nothing;

-- ---- community discussion ----------------------------------------------

insert into public.community_messages (community_id, sender_id, body) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'Reminder: build night is Wednesday at 6pm in Meeting Room 2. Bring a project.'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   'I can bring a spare laptop if anyone needs one.'),
  ('aaaaaaaa-0000-4000-8000-000000000002', '55555555-5555-4555-8555-555555555555',
   'German table is full this fortnight, but there is room at the Spanish table.');

commit;
