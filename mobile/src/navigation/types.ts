import type { NavigatorScreenParams } from '@react-navigation/native';

import type { DiscoverFilters } from '../features/matching/engine';

/** Root stack: auth flow, onboarding flow, then the signed-in app. */
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Onboarding: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};

export type OnboardingStackParamList = {
  OnboardingIntro: undefined;
  OnboardingIdentity: undefined;
  OnboardingInterests: undefined;
  OnboardingSkills: undefined;
  OnboardingLanguages: undefined;
  OnboardingGoals: undefined;
  OnboardingLocation: undefined;
  OnboardingPrivacy: undefined;
  OnboardingComplete: undefined;
};

export type MainTabParamList = {
  Discover: undefined;
  Communities: undefined;
  Connections: undefined;
  Messages: undefined;
  Profile: undefined;
};

export type DiscoverStackParamList = {
  DiscoverHome: { filters?: DiscoverFilters } | undefined;
  Filters: undefined;
  ProfileDetail: { userId: string };
  Coach: undefined;
};

export type CommunitiesStackParamList = {
  CommunitiesHome: undefined;
  CommunityDetail: { communityId: string };
  EventDetail: { eventId: string };
  CreateCommunity: undefined;
  JoinByCode: undefined;
  ScanCode: undefined;
  CommunityDiscussion: { communityId: string };
  CreateEvent: { communityId: string };
};

export type ConnectionsStackParamList = {
  ConnectionsHome: { tab?: 'incoming' | 'outgoing' | 'connections' } | undefined;
  ProfileDetail: { userId: string };
  Chat: { conversationId: string };
  Coach: undefined;
};

export type MessagesStackParamList = {
  Conversations: undefined;
  Chat: { conversationId: string };
  ProfileDetail: { userId: string };
  Coach: undefined;
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  EditProfile: undefined;
  EditInterests: undefined;
  EditSkills: undefined;
  EditLanguages: undefined;
  EditGoals: undefined;
  PrivacySettings: undefined;
  NotificationSettings: undefined;
  BlockedAccounts: undefined;
  DeleteAccount: undefined;
  Brand: undefined;
};

/** Maps every screen that can be deep-linked to its parent navigator. */
export const DEEP_LINK_ROUTES = {
  Chat: 'Messages',
  Connections: 'Connections',
  EventDetail: 'Communities',
  CommunityDetail: 'Communities',
  ProfileDetail: 'Discover',
} as const;
