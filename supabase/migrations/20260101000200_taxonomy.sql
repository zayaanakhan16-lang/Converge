-- Reference vocabulary.
--
-- These tables mirror `mobile/src/constants/taxonomy.ts`. They are read-only
-- from the app: only the service role may change them, so the ids used by the
-- matching engine cannot drift between releases.

create table public.interests (
  id text primary key,
  label text not null,
  category text not null,
  created_at timestamptz not null default now()
);

create table public.skills (
  id text primary key,
  label text not null,
  skill_group text not null,
  created_at timestamptz not null default now()
);

create table public.languages (
  code text primary key,
  label text not null,
  native_label text not null,
  -- Whether the translation pipeline is wired for this language today.
  translatable boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.goals (
  id text primary key,
  label text not null,
  created_at timestamptz not null default now()
);

create table public.activities (
  id text primary key,
  label text not null,
  created_at timestamptz not null default now()
);

insert into public.interests (id, label, category) values
  ('programming', 'Programming', 'technology'),
  ('open-source', 'Open source', 'technology'),
  ('robotics', 'Robotics', 'technology'),
  ('data-science', 'Data science', 'technology'),
  ('cybersecurity', 'Cybersecurity', 'technology'),
  ('game-development', 'Game development', 'technology'),
  ('graphic-design', 'Graphic design', 'arts'),
  ('photography', 'Photography', 'arts'),
  ('film', 'Film', 'arts'),
  ('creative-writing', 'Creative writing', 'arts'),
  ('debate', 'Debate', 'academia'),
  ('mathematics', 'Mathematics', 'academia'),
  ('physics', 'Physics', 'academia'),
  ('history', 'History', 'academia'),
  ('languages', 'Languages', 'academia'),
  ('basketball', 'Basketball', 'sport'),
  ('football', 'Football', 'sport'),
  ('running', 'Running', 'sport'),
  ('cycling', 'Cycling', 'sport'),
  ('climbing', 'Climbing', 'sport'),
  ('hiking', 'Hiking', 'outdoors'),
  ('gardening', 'Gardening', 'outdoors'),
  ('birdwatching', 'Birdwatching', 'outdoors'),
  ('volunteering', 'Volunteering', 'community'),
  ('student-societies', 'Student societies', 'community'),
  ('local-events', 'Local events', 'community'),
  ('mentoring', 'Mentoring', 'community'),
  ('woodwork', 'Woodwork', 'craft'),
  ('sewing', 'Sewing', 'craft'),
  ('electronics', 'Electronics', 'craft'),
  ('choir', 'Choir', 'music'),
  ('guitar', 'Guitar', 'music'),
  ('music-production', 'Music production', 'music'),
  ('outdoors', 'Outdoors', 'outdoors'),
  ('craft', 'Craft and making', 'craft')
on conflict (id) do nothing;

insert into public.skills (id, label, skill_group) values
  ('frontend', 'Front-end development', 'technical'),
  ('backend', 'Back-end development', 'technical'),
  ('mobile', 'Mobile development', 'technical'),
  ('data-analysis', 'Data analysis', 'technical'),
  ('machine-learning', 'Machine learning', 'technical'),
  ('devops', 'DevOps', 'technical'),
  ('ui-design', 'UI design', 'creative'),
  ('illustration', 'Illustration', 'creative'),
  ('video-editing', 'Video editing', 'creative'),
  ('copywriting', 'Copywriting', 'creative'),
  ('public-speaking', 'Public speaking', 'organisational'),
  ('event-planning', 'Event planning', 'organisational'),
  ('project-management', 'Project management', 'organisational'),
  ('teaching', 'Teaching', 'organisational'),
  ('community-organising', 'Community organising', 'organisational'),
  ('first-aid', 'First aid', 'practical'),
  ('cooking', 'Cooking', 'practical'),
  ('repair', 'Repair and maintenance', 'practical'),
  ('sound-engineering', 'Sound engineering', 'practical'),
  ('cybersecurity', 'Security engineering', 'technical')
on conflict (id) do nothing;

insert into public.languages (code, label, native_label, translatable) values
  ('en', 'English', 'English', true),
  ('es', 'Spanish', 'Español', true),
  ('fr', 'French', 'Français', true),
  ('de', 'German', 'Deutsch', true),
  ('pt', 'Portuguese', 'Português', true),
  ('ar', 'Arabic', 'العربية', true),
  ('hi', 'Hindi', 'हिन्दी', true),
  ('ur', 'Urdu', 'اردو', true),
  ('zh', 'Chinese (Simplified)', '简体中文', false),
  ('ja', 'Japanese', '日本語', false),
  ('sw', 'Swahili', 'Kiswahili', false),
  ('tr', 'Turkish', 'Türkçe', false)
on conflict (code) do nothing;

insert into public.goals (id, label) values
  ('find-collaborators', 'Find project collaborators'),
  ('learn-skill', 'Learn a new skill'),
  ('practise-language', 'Practise a language'),
  ('join-community', 'Join a community'),
  ('build-confidence', 'Build conversation confidence'),
  ('mentor-others', 'Mentor others'),
  ('make-friends', 'Make new friends'),
  ('volunteer', 'Volunteer locally')
on conflict (id) do nothing;

insert into public.activities (id, label) values
  ('study-sessions', 'Study sessions'),
  ('hackathons', 'Hackathons'),
  ('workshops', 'Workshops'),
  ('sports-meetups', 'Sports meet-ups'),
  ('walking-groups', 'Walking groups'),
  ('book-clubs', 'Book clubs'),
  ('volunteer-days', 'Volunteer days'),
  ('exhibitions', 'Exhibitions'),
  ('open-mics', 'Open mics'),
  ('language-exchange', 'Language exchange')
on conflict (id) do nothing;
