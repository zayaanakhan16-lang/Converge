import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Compass, MessageSquareText, UserRound, Users, Handshake } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { Badge } from '../components/ui/Chip';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useConnections, useConversations } from '../hooks/useData';
import { typography } from '../theme';
import { CoachScreen } from '../screens/coach/CoachScreen';
import { CommunitiesScreen } from '../screens/communities/CommunitiesScreen';
import { CommunityDetailScreen } from '../screens/communities/CommunityDetailScreen';
import { CommunityDiscussionScreen } from '../screens/communities/CommunityDiscussionScreen';
import { CreateCommunityScreen } from '../screens/communities/CreateCommunityScreen';
import { CreateEventScreen } from '../screens/communities/CreateEventScreen';
import { EventDetailScreen } from '../screens/communities/EventDetailScreen';
import { JoinByCodeScreen } from '../screens/communities/JoinByCodeScreen';
import { ScanCodeScreen } from '../screens/communities/ScanCodeScreen';
import { ConnectionsScreen } from '../screens/connections/ConnectionsScreen';
import { DiscoverScreen } from '../screens/discover/DiscoverScreen';
import { FiltersScreen } from '../screens/discover/FiltersScreen';
import { ProfileDetailScreen } from '../screens/discover/ProfileDetailScreen';
import { ChatScreen } from '../screens/messages/ChatScreen';
import { ConversationsScreen } from '../screens/messages/ConversationsScreen';
import { BlockedAccountsScreen } from '../screens/profile/BlockedAccountsScreen';
import { BrandScreen } from '../screens/profile/BrandScreen';
import { DeleteAccountScreen } from '../screens/profile/DeleteAccountScreen';
import { EditGoalsScreen } from '../screens/profile/EditGoalsScreen';
import { EditInterestsScreen } from '../screens/profile/EditInterestsScreen';
import { EditLanguagesScreen } from '../screens/profile/EditLanguagesScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { EditSkillsScreen } from '../screens/profile/EditSkillsScreen';
import { NotificationSettingsScreen } from '../screens/profile/NotificationSettingsScreen';
import { PrivacySettingsScreen } from '../screens/profile/PrivacySettingsScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import type {
  CommunitiesStackParamList,
  ConnectionsStackParamList,
  DiscoverStackParamList,
  MainTabParamList,
  MessagesStackParamList,
  ProfileStackParamList,
} from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const DiscoverStack = createNativeStackNavigator<DiscoverStackParamList>();
const CommunitiesStack = createNativeStackNavigator<CommunitiesStackParamList>();
const ConnectionsStack = createNativeStackNavigator<ConnectionsStackParamList>();
const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

/** Shared header styling so every pushed screen looks like the same product. */
function useStackScreenOptions() {
  const { theme } = useTheme();
  return {
    headerStyle: { backgroundColor: theme.colors.background },
    headerTintColor: theme.colors.textPrimary,
    headerTitleStyle: {
      ...typography.title3,
      color: theme.colors.textPrimary,
    },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal' as const,
    contentStyle: { backgroundColor: theme.colors.background },
  };
}

function DiscoverNavigator() {
  const options = useStackScreenOptions();
  return (
    <DiscoverStack.Navigator screenOptions={options}>
      <DiscoverStack.Screen
        name="DiscoverHome"
        component={DiscoverScreen}
        options={{ headerShown: false, title: 'Discover' }}
      />
      <DiscoverStack.Screen
        name="Filters"
        component={FiltersScreen}
        options={{ title: 'Filters' }}
      />
      <DiscoverStack.Screen
        name="ProfileDetail"
        component={ProfileDetailScreen}
        options={{ title: 'Member' }}
      />
      <DiscoverStack.Screen name="Coach" component={CoachScreen} options={{ title: 'Coach' }} />
    </DiscoverStack.Navigator>
  );
}

function CommunitiesNavigator() {
  const options = useStackScreenOptions();
  return (
    <CommunitiesStack.Navigator screenOptions={options}>
      <CommunitiesStack.Screen
        name="CommunitiesHome"
        component={CommunitiesScreen}
        options={{ headerShown: false }}
      />
      <CommunitiesStack.Screen
        name="CommunityDetail"
        component={CommunityDetailScreen}
        options={{ title: 'Community' }}
      />
      <CommunitiesStack.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={{ title: 'Event' }}
      />
      <CommunitiesStack.Screen
        name="CreateCommunity"
        component={CreateCommunityScreen}
        options={{ title: 'New community' }}
      />
      <CommunitiesStack.Screen
        name="CreateEvent"
        component={CreateEventScreen}
        options={{ title: 'New event' }}
      />
      <CommunitiesStack.Screen
        name="JoinByCode"
        component={JoinByCodeScreen}
        options={{ title: 'Join with a code' }}
      />
      <CommunitiesStack.Screen
        name="ScanCode"
        component={ScanCodeScreen}
        options={{ title: 'Scan code' }}
      />
      <CommunitiesStack.Screen
        name="CommunityDiscussion"
        component={CommunityDiscussionScreen}
        options={{ title: 'Discussion' }}
      />
    </CommunitiesStack.Navigator>
  );
}

function ConnectionsNavigator() {
  const options = useStackScreenOptions();
  return (
    <ConnectionsStack.Navigator screenOptions={options}>
      <ConnectionsStack.Screen
        name="ConnectionsHome"
        component={ConnectionsScreen}
        options={{ headerShown: false }}
      />
      <ConnectionsStack.Screen
        name="ProfileDetail"
        component={ProfileDetailScreen}
        options={{ title: 'Member' }}
      />
      <ConnectionsStack.Screen name="Chat" component={ChatScreen} options={{ title: 'Message' }} />
      <ConnectionsStack.Screen name="Coach" component={CoachScreen} options={{ title: 'Coach' }} />
    </ConnectionsStack.Navigator>
  );
}

function MessagesNavigator() {
  const options = useStackScreenOptions();
  return (
    <MessagesStack.Navigator screenOptions={options}>
      <MessagesStack.Screen
        name="Conversations"
        component={ConversationsScreen}
        options={{ headerShown: false }}
      />
      <MessagesStack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ headerShown: false, title: 'Message' }}
      />
      <MessagesStack.Screen
        name="ProfileDetail"
        component={ProfileDetailScreen}
        options={{ title: 'Member' }}
      />
      <MessagesStack.Screen name="Coach" component={CoachScreen} options={{ title: 'Coach' }} />
    </MessagesStack.Navigator>
  );
}

function ProfileNavigator() {
  const options = useStackScreenOptions();
  return (
    <ProfileStack.Navigator screenOptions={options}>
      <ProfileStack.Screen
        name="ProfileHome"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <ProfileStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: 'Edit profile' }}
      />
      <ProfileStack.Screen
        name="EditInterests"
        component={EditInterestsScreen}
        options={{ title: 'Interests' }}
      />
      <ProfileStack.Screen
        name="EditSkills"
        component={EditSkillsScreen}
        options={{ title: 'Skills' }}
      />
      <ProfileStack.Screen
        name="EditLanguages"
        component={EditLanguagesScreen}
        options={{ title: 'Languages' }}
      />
      <ProfileStack.Screen
        name="EditGoals"
        component={EditGoalsScreen}
        options={{ title: 'Goals' }}
      />
      <ProfileStack.Screen
        name="PrivacySettings"
        component={PrivacySettingsScreen}
        options={{ title: 'Privacy' }}
      />
      <ProfileStack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ title: 'Notifications' }}
      />
      <ProfileStack.Screen
        name="BlockedAccounts"
        component={BlockedAccountsScreen}
        options={{ title: 'Blocked accounts' }}
      />
      <ProfileStack.Screen
        name="DeleteAccount"
        component={DeleteAccountScreen}
        options={{ title: 'Delete account' }}
      />
      <ProfileStack.Screen name="Brand" component={BrandScreen} options={{ title: 'Brand' }} />
    </ProfileStack.Navigator>
  );
}

/**
 * Bottom tab navigation.
 *
 * Five destinations map to the journey: Discover, Communities, Connections,
 * Messages and Profile. Badges show unread work rather than engagement counts.
 */
export function MainTabs() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const connections = useConnections();
  const conversations = useConversations();

  const pendingRequests = connections.data.incoming.length;
  const unreadMessages = conversations.data.reduce(
    (total, conversation) => total + conversation.unreadCount,
    0,
  );
  void user;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth * 2,
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { ...typography.caption, fontSize: 11 },
      }}
    >
      <Tab.Screen
        name="Discover"
        component={DiscoverNavigator}
        options={{
          tabBarLabel: 'Discover',
          tabBarIcon: ({ color, size }) => (
            <Compass size={size ?? 22} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="Communities"
        component={CommunitiesNavigator}
        options={{
          tabBarLabel: 'Communities',
          tabBarIcon: ({ color, size }) => (
            <Users size={size ?? 22} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="Connections"
        component={ConnectionsNavigator}
        options={{
          tabBarLabel: 'Connections',
          tabBarIcon: ({ color, size }) => (
            <Handshake size={size ?? 22} color={color} strokeWidth={2} />
          ),
          tabBarBadge: pendingRequests > 0 ? pendingRequests : undefined,
          tabBarBadgeStyle: { backgroundColor: theme.colors.accent, fontSize: 10 },
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesNavigator}
        options={{
          tabBarLabel: 'Messages',
          tabBarIcon: ({ color, size }) => (
            <MessageSquareText size={size ?? 22} color={color} strokeWidth={2} />
          ),
          tabBarBadge: unreadMessages > 0 ? unreadMessages : undefined,
          tabBarBadgeStyle: { backgroundColor: theme.colors.accent, fontSize: 10 },
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileNavigator}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <UserRound size={size ?? 22} color={color} strokeWidth={2} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export { Badge };
