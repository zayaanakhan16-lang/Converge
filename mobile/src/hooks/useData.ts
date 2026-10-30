import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { EMPTY_FILTERS, type DiscoverFilters } from '../features/matching/engine';
import { repository } from '../services';
import type {
  AppNotification,
  Community,
  CommunityEvent,
  CommunityMembership,
  Connection,
  ConnectionRequest,
  Conversation,
  MatchResult,
  Message,
  Profile,
} from '../types/domain';

/**
 * Data hooks.
 *
 * Each hook owns its own loading and error state so screens never render a
 * spinner for data they are not showing. All reads go through the repository,
 * which means demo and live modes share the same code paths.
 */

export interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Replace or update local state after a mutation, avoiding a refetch. */
  setData: (next: T | ((current: T) => T)) => void;
}

function useAsync<T>(loader: () => Promise<T>, initial: T, deps: unknown[]): AsyncState<T> {
  const [data, setDataState] = useState<T>(initial);
  const setData = useCallback((next: T | ((current: T) => T)) => {
    setDataState((current) => (typeof next === 'function' ? (next as (value: T) => T)(current) : next));
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    // Loading and error are set inside the async body so the first render keeps
    // the previous data visible while the new request is in flight, instead of
    // flipping to a spinner and back.
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await loader();
        if (!active) return;
        setDataState(result);
      } catch (caught: unknown) {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'Could not load that.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const refresh = useCallback(async () => {
    setNonce((value) => value + 1);
  }, []);

  return { data, loading, error, refresh, setData };
}

export function useMatches(filters: DiscoverFilters = EMPTY_FILTERS): AsyncState<MatchResult[]> {
  const { user } = useAuth();
  const viewerId = user?.id ?? '';
  const key = JSON.stringify(filters);
  return useAsync<MatchResult[]>(
    () => (viewerId ? repository().getMatches(viewerId, filters) : Promise.resolve([])),
    [],
    [viewerId, key],
  );
}

export function useCommunities(options?: {
  search?: string;
  joinedOnly?: boolean;
  excludeJoined?: boolean;
}): AsyncState<Community[]> {
  const { user } = useAuth();
  const viewerId = user?.id ?? '';
  const search = options?.search ?? '';
  const joinedOnly = options?.joinedOnly ?? false;
  const excludeJoined = options?.excludeJoined ?? false;
  return useAsync<Community[]>(
    () =>
      viewerId
        ? repository().listCommunities(viewerId, { search, joinedOnly, excludeJoined })
        : Promise.resolve([]),
    [],
    [viewerId, search, joinedOnly, excludeJoined],
  );
}

export function useMemberships(): AsyncState<CommunityMembership[]> {
  const { user } = useAuth();
  const viewerId = user?.id ?? '';
  return useAsync<CommunityMembership[]>(
    () => (viewerId ? repository().getMemberships(viewerId) : Promise.resolve([])),
    [],
    [viewerId],
  );
}

export function useEvents(options?: {
  communityIds?: string[];
  attendingOnly?: boolean;
}): AsyncState<CommunityEvent[]> {
  const { user } = useAuth();
  const viewerId = user?.id ?? '';
  const key = JSON.stringify(options ?? {});
  return useAsync<CommunityEvent[]>(
    () =>
      viewerId
        ? repository().listEvents(viewerId, {
            communityIds: options?.communityIds,
            attendingOnly: options?.attendingOnly,
          })
        : Promise.resolve([]),
    [],
    [viewerId, key],
  );
}

export function useEvent(eventId: string | undefined): AsyncState<CommunityEvent | null> {
  return useAsync<CommunityEvent | null>(
    () => (eventId ? repository().getEvent(eventId) : Promise.resolve(null)),
    null,
    [eventId],
  );
}

export function useCommunity(communityId: string | undefined): AsyncState<Community | null> {
  return useAsync<Community | null>(
    () => (communityId ? repository().getCommunity(communityId) : Promise.resolve(null)),
    null,
    [communityId],
  );
}

export function useCommunityMembers(communityId: string | undefined): AsyncState<Profile[]> {
  return useAsync<Profile[]>(
    () => (communityId ? repository().getCommunityMembers(communityId) : Promise.resolve([])),
    [],
    [communityId],
  );
}

export function useCommunityMessages(communityId: string | undefined): AsyncState<Message[]> {
  return useAsync<Message[]>(
    () => (communityId ? repository().getCommunityMessages(communityId) : Promise.resolve([])),
    [],
    [communityId],
  );
}

export function useProfile(userId: string | undefined): AsyncState<Profile | null> {
  return useAsync<Profile | null>(
    () => (userId ? repository().getProfile(userId) : Promise.resolve(null)),
    null,
    [userId],
  );
}

export function useProfiles(): AsyncState<Profile[]> {
  return useAsync<Profile[]>(() => repository().listProfiles(), [], []);
}

export interface ConnectionData {
  incoming: ConnectionRequest[];
  outgoing: ConnectionRequest[];
  connections: Connection[];
}

export function useConnections(): AsyncState<ConnectionData> {
  const { user } = useAuth();
  const viewerId = user?.id ?? '';
  const loader = useCallback(async (): Promise<ConnectionData> => {
    if (!viewerId) return { incoming: [], outgoing: [], connections: [] };
    const [requests, connections] = await Promise.all([
      repository().listConnectionRequests(viewerId),
      repository().listConnections(viewerId),
    ]);
    return { ...requests, connections };
  }, [viewerId]);
  return useAsync<ConnectionData>(loader, { incoming: [], outgoing: [], connections: [] }, [
    viewerId,
  ]);
}

export function useConversations(): AsyncState<Conversation[]> {
  const { user } = useAuth();
  const viewerId = user?.id ?? '';
  return useAsync<Conversation[]>(
    () => (viewerId ? repository().listConversations(viewerId) : Promise.resolve([])),
    [],
    [viewerId],
  );
}

export function useConversation(conversationId: string | undefined): AsyncState<Conversation | null> {
  return useAsync<Conversation | null>(
    () => (conversationId ? repository().getConversation(conversationId) : Promise.resolve(null)),
    null,
    [conversationId],
  );
}

export function useMessages(conversationId: string | undefined): AsyncState<Message[]> {
  const state = useAsync<Message[]>(
    () => (conversationId ? repository().listMessages(conversationId) : Promise.resolve([])),
    [],
    [conversationId],
  );
  const { setData } = state;

  useEffect(() => {
    if (!conversationId) return;
    // Realtime in live mode, an in-process emitter in demo mode. Both deliver
    // only messages for the open conversation.
    return repository().onMessageInsert(conversationId, (message) => {
      setData((current) => {
        if (current.some((existing) => existing.id === message.id)) return current;
        return [...current, message];
      });
    });
  }, [conversationId, setData]);

  return state;
}

export function useNotifications(): AsyncState<AppNotification[]> & { unreadCount: number } {
  const { user } = useAuth();
  const viewerId = user?.id ?? '';
  const state = useAsync<AppNotification[]>(
    () => (viewerId ? repository().listNotifications(viewerId) : Promise.resolve([])),
    [],
    [viewerId],
  );
  const unreadCount = useMemo(
    () => state.data.filter((notification) => !notification.readAt).length,
    [state.data],
  );
  return { ...state, unreadCount };
}

export function useBlockedUsers(): AsyncState<Array<{ userId: string; blockedAt: string }>> {
  const { user } = useAuth();
  const viewerId = user?.id ?? '';
  return useAsync<Array<{ userId: string; blockedAt: string }>>(
    () => (viewerId ? repository().listBlockedUsers(viewerId) : Promise.resolve([])),
    [],
    [viewerId],
  );
}

/** Wraps a mutation so screens get consistent busy and error handling. */
export function useMutation<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
): {
  run: (...args: TArgs) => Promise<TResult | null>;
  busy: boolean;
  error: string | null;
  clearError: () => void;
} {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setBusy(true);
      setError(null);
      try {
        return await action(...args);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'That did not work. Try again.');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [action],
  );

  return { run, busy, error, clearError: () => setError(null) };
}
