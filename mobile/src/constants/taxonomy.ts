/** Canonical vocabulary used across matching, discovery and profiles. */

export interface Interest {
  id: string;
  label: string;
  category: InterestCategory;
}

export type InterestCategory =
  | 'technology'
  | 'arts'
  | 'sport'
  | 'academia'
  | 'community'
  | 'outdoors'
  | 'craft'
  | 'music';

export const INTERESTS: Interest[] = [
  { id: 'programming', label: 'Programming', category: 'technology' },
  { id: 'open-source', label: 'Open source', category: 'technology' },
  { id: 'robotics', label: 'Robotics', category: 'technology' },
  { id: 'data-science', label: 'Data science', category: 'technology' },
  { id: 'cybersecurity', label: 'Cybersecurity', category: 'technology' },
  { id: 'game-development', label: 'Game development', category: 'technology' },
  { id: 'graphic-design', label: 'Graphic design', category: 'arts' },
  { id: 'photography', label: 'Photography', category: 'arts' },
  { id: 'film', label: 'Film', category: 'arts' },
  { id: 'creative-writing', label: 'Creative writing', category: 'arts' },
  { id: 'debate', label: 'Debate', category: 'academia' },
  { id: 'mathematics', label: 'Mathematics', category: 'academia' },
  { id: 'physics', label: 'Physics', category: 'academia' },
  { id: 'history', label: 'History', category: 'academia' },
  { id: 'languages', label: 'Languages', category: 'academia' },
  { id: 'basketball', label: 'Basketball', category: 'sport' },
  { id: 'football', label: 'Football', category: 'sport' },
  { id: 'running', label: 'Running', category: 'sport' },
  { id: 'cycling', label: 'Cycling', category: 'sport' },
  { id: 'climbing', label: 'Climbing', category: 'sport' },
  { id: 'hiking', label: 'Hiking', category: 'outdoors' },
  { id: 'gardening', label: 'Gardening', category: 'outdoors' },
  { id: 'birdwatching', label: 'Birdwatching', category: 'outdoors' },
  { id: 'volunteering', label: 'Volunteering', category: 'community' },
  { id: 'student-societies', label: 'Student societies', category: 'community' },
  { id: 'local-events', label: 'Local events', category: 'community' },
  { id: 'mentoring', label: 'Mentoring', category: 'community' },
  { id: 'woodwork', label: 'Woodwork', category: 'craft' },
  { id: 'sewing', label: 'Sewing', category: 'craft' },
  { id: 'electronics', label: 'Electronics', category: 'craft' },
  { id: 'choir', label: 'Choir', category: 'music' },
  { id: 'guitar', label: 'Guitar', category: 'music' },
  { id: 'music-production', label: 'Music production', category: 'music' },
  { id: 'outdoors', label: 'Outdoors', category: 'outdoors' },
  { id: 'craft', label: 'Craft and making', category: 'craft' },
];

export interface Skill {
  id: string;
  label: string;
  /** Skills are grouped so a profile can offer and request them. */
  group: 'technical' | 'creative' | 'organisational' | 'practical';
}

export const SKILLS: Skill[] = [
  { id: 'frontend', label: 'Front-end development', group: 'technical' },
  { id: 'backend', label: 'Back-end development', group: 'technical' },
  { id: 'mobile', label: 'Mobile development', group: 'technical' },
  { id: 'data-analysis', label: 'Data analysis', group: 'technical' },
  { id: 'machine-learning', label: 'Machine learning', group: 'technical' },
  { id: 'devops', label: 'DevOps', group: 'technical' },
  { id: 'ui-design', label: 'UI design', group: 'creative' },
  { id: 'illustration', label: 'Illustration', group: 'creative' },
  { id: 'video-editing', label: 'Video editing', group: 'creative' },
  { id: 'copywriting', label: 'Copywriting', group: 'creative' },
  { id: 'public-speaking', label: 'Public speaking', group: 'organisational' },
  { id: 'event-planning', label: 'Event planning', group: 'organisational' },
  { id: 'project-management', label: 'Project management', group: 'organisational' },
  { id: 'teaching', label: 'Teaching', group: 'organisational' },
  { id: 'community-organising', label: 'Community organising', group: 'organisational' },
  { id: 'first-aid', label: 'First aid', group: 'practical' },
  { id: 'cooking', label: 'Cooking', group: 'practical' },
  { id: 'repair', label: 'Repair and maintenance', group: 'practical' },
  { id: 'sound-engineering', label: 'Sound engineering', group: 'practical' },
  { id: 'cybersecurity', label: 'Security engineering', group: 'technical' },
];

export interface Language {
  code: string;
  label: string;
  /** Endonym, shown when the user's UI language differs from the target. */
  nativeLabel: string;
  /** Languages the translation pipeline is wired for today. */
  translatable: boolean;
}

export const LANGUAGES: Language[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', translatable: true },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', translatable: true },
  { code: 'fr', label: 'French', nativeLabel: 'Français', translatable: true },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', translatable: true },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português', translatable: true },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', translatable: true },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', translatable: true },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو', translatable: true },
  { code: 'zh', label: 'Chinese (Simplified)', nativeLabel: '简体中文', translatable: false },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語', translatable: false },
  { code: 'sw', label: 'Swahili', nativeLabel: 'Kiswahili', translatable: false },
  { code: 'tr', label: 'Turkish', nativeLabel: 'Türkçe', translatable: false },
];

/** Language codes wired into the translation pipeline. */
export const TRANSLATABLE_LANGUAGE_CODES = LANGUAGES.filter((l) => l.translatable).map(
  (l) => l.code,
);

export const GOALS = [
  { id: 'find-collaborators', label: 'Find project collaborators' },
  { id: 'learn-skill', label: 'Learn a new skill' },
  { id: 'practise-language', label: 'Practise a language' },
  { id: 'join-community', label: 'Join a community' },
  { id: 'build-confidence', label: 'Build conversation confidence' },
  { id: 'mentor-others', label: 'Mentor others' },
  { id: 'make-friends', label: 'Make new friends' },
  { id: 'volunteer', label: 'Volunteer locally' },
] as const;

export type GoalId = (typeof GOALS)[number]['id'];

export const ACTIVITIES = [
  { id: 'study-sessions', label: 'Study sessions' },
  { id: 'hackathons', label: 'Hackathons' },
  { id: 'workshops', label: 'Workshops' },
  { id: 'sports-meetups', label: 'Sports meet-ups' },
  { id: 'walking-groups', label: 'Walking groups' },
  { id: 'book-clubs', label: 'Book clubs' },
  { id: 'volunteer-days', label: 'Volunteer days' },
  { id: 'exhibitions', label: 'Exhibitions' },
  { id: 'open-mics', label: 'Open mics' },
  { id: 'language-exchange', label: 'Language exchange' },
] as const;

export type ActivityId = (typeof ACTIVITIES)[number]['id'];

export const INTEREST_BY_ID = new Map(INTERESTS.map((i) => [i.id, i]));
export const SKILL_BY_ID = new Map(SKILLS.map((s) => [s.id, s]));
export const LANGUAGE_BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));
export const GOAL_BY_ID = new Map<string, { id: string; label: string }>(
  GOALS.map((g) => [g.id as string, { id: g.id, label: g.label }]),
);
export const ACTIVITY_BY_ID = new Map<string, { id: string; label: string }>(
  ACTIVITIES.map((a) => [a.id as string, { id: a.id, label: a.label }]),
);

export function labelForInterest(id: string): string {
  return INTEREST_BY_ID.get(id)?.label ?? id;
}

export function labelForSkill(id: string): string {
  return SKILL_BY_ID.get(id)?.label ?? id;
}

export function labelForLanguage(code: string): string {
  return LANGUAGE_BY_CODE.get(code)?.label ?? code.toUpperCase();
}

export function labelForGoal(id: string): string {
  return GOAL_BY_ID.get(id)?.label ?? id;
}

export function labelForActivity(id: string): string {
  return ACTIVITY_BY_ID.get(id)?.label ?? id;
}
