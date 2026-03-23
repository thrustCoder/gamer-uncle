import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { appCache } from '../services/storage/appCache';
import { useDebouncedEffect } from '../services/hooks/useDebouncedEffect';
import type { PlayerGroup, PlayerGroupsState } from '../types/playerGroups';
import { DEFAULT_PLAYER_GROUPS_STATE, MAX_GROUPS, DEFAULT_GROUP_NAME } from '../types/playerGroups';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface PlayerGroupsContextType {
  // State
  state: PlayerGroupsState;
  isLoading: boolean;
  activeGroup: PlayerGroup | null;

  // Group lifecycle
  enableGroups: () => Promise<void>;
  disableGroups: () => Promise<void>;
  createGroup: (name: string, playerCount: number, playerNames: string[], teamCount?: number) => void;
  updateGroup: (groupId: string, updates: Partial<Pick<PlayerGroup, 'name' | 'playerCount' | 'playerNames' | 'teamCount'>>) => void;
  deleteGroup: (groupId: string) => void;
  setActiveGroup: (groupId: string) => void;

  // Per-group data mutations
  updateActiveGroupData: (patch: Partial<Pick<PlayerGroup,
    'playerCount' | 'playerNames' | 'teamCount' |
    'gameScore' | 'leaderboard' | 'gameSetupGameName' | 'gameSetupPlayerCount' | 'gameSetupResponse'
  >>) => void;
}

const PlayerGroupsContext = createContext<PlayerGroupsContextType | undefined>(undefined);

export const PlayerGroupsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PlayerGroupsState>(DEFAULT_PLAYER_GROUPS_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const skipPersistRef = useRef(false);

  // Hydrate from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await appCache.getPlayerGroups();
        setState(saved);
      } catch {
        // Fall back to default
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Persist state changes (debounced)
  useDebouncedEffect(() => {
    if (!isLoading && !skipPersistRef.current) {
      appCache.setPlayerGroups(state);
    }
    skipPersistRef.current = false;
  }, [state, isLoading], 400);

  const activeGroup = useMemo(() => {
    if (!state.enabled || !state.activeGroupId) return null;
    return state.groups.find((g) => g.id === state.activeGroupId) ?? null;
  }, [state]);

  const enableGroups = useCallback(async () => {
    // Read current ungrouped state from appCache
    const [playerNames, playerCount, teamCount, gameScore, leaderboard, gameSetupGameName, gameSetupPlayerCount, gameSetupResponse] =
      await Promise.all([
        appCache.getPlayers([]),
        appCache.getPlayerCount(4),
        appCache.getTeamCount(2),
        appCache.getGameScore(),
        appCache.getLeaderboard(),
        appCache.getGameSetupGameName(),
        appCache.getGameSetupPlayerCount(),
        appCache.getGameSetupResponse(),
      ]);

    const finalNames = playerNames.length > 0
      ? playerNames
      : Array.from({ length: playerCount }, (_, i) => `P${i + 1}`);

    const groupId = generateUUID();
    const firstGroup: PlayerGroup = {
      id: groupId,
      name: DEFAULT_GROUP_NAME,
      playerCount,
      playerNames: finalNames,
      teamCount,
      gameScore,
      leaderboard,
      gameSetupGameName,
      gameSetupPlayerCount,
      gameSetupResponse,
    };

    setState({
      enabled: true,
      activeGroupId: groupId,
      groups: [firstGroup],
    });
  }, []);

  const disableGroups = useCallback(async () => {
    setState((prev) => {
      const active = prev.groups.find((g) => g.id === prev.activeGroupId);
      if (active) {
        // Write active group data back to ungrouped keys (fire-and-forget)
        Promise.all([
          appCache.setPlayers(active.playerNames),
          appCache.setPlayerCount(active.playerCount),
          appCache.setTeamCount(active.teamCount),
          appCache.setGameScore(active.gameScore),
          appCache.setLeaderboard(active.leaderboard),
          appCache.setGameSetupGameName(active.gameSetupGameName),
          appCache.setGameSetupPlayerCount(active.gameSetupPlayerCount),
          appCache.setGameSetupResponse(active.gameSetupResponse ?? ''),
        ]);
      }
      return DEFAULT_PLAYER_GROUPS_STATE;
    });
  }, []);

  const createGroup = useCallback((name: string, playerCount: number, playerNames: string[], teamCount = 2) => {
    setState((prev) => {
      if (prev.groups.length >= MAX_GROUPS) return prev;
      const newGroup: PlayerGroup = {
        id: generateUUID(),
        name,
        playerCount,
        playerNames,
        teamCount,
        gameScore: null,
        leaderboard: [],
        gameSetupGameName: '',
        gameSetupPlayerCount: playerCount,
        gameSetupResponse: null,
      };
      return {
        ...prev,
        groups: [...prev.groups, newGroup],
      };
    });
  }, []);

  const updateGroup = useCallback((groupId: string, updates: Partial<Pick<PlayerGroup, 'name' | 'playerCount' | 'playerNames' | 'teamCount'>>) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === groupId ? { ...g, ...updates } : g)),
    }));
  }, []);

  const deleteGroup = useCallback((groupId: string) => {
    setState((prev) => {
      // Must keep at least 1 group
      if (prev.groups.length <= 1) return prev;

      const filtered = prev.groups.filter((g) => g.id !== groupId);
      let newActiveId = prev.activeGroupId;

      // If deleting the active group, auto-select next
      if (prev.activeGroupId === groupId) {
        const deletedIndex = prev.groups.findIndex((g) => g.id === groupId);
        const nextIndex = Math.min(deletedIndex, filtered.length - 1);
        newActiveId = filtered[nextIndex]?.id ?? filtered[0]?.id ?? null;
      }

      return {
        ...prev,
        groups: filtered,
        activeGroupId: newActiveId,
      };
    });
  }, []);

  const setActiveGroup = useCallback((groupId: string) => {
    setState((prev) => {
      if (!prev.groups.some((g) => g.id === groupId)) return prev;
      return { ...prev, activeGroupId: groupId };
    });
  }, []);

  const updateActiveGroupData = useCallback((patch: Partial<Pick<PlayerGroup,
    'playerCount' | 'playerNames' | 'teamCount' |
    'gameScore' | 'leaderboard' | 'gameSetupGameName' | 'gameSetupPlayerCount' | 'gameSetupResponse'
  >>) => {
    setState((prev) => {
      if (!prev.activeGroupId) return prev;
      return {
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === prev.activeGroupId ? { ...g, ...patch } : g
        ),
      };
    });
  }, []);

  const contextValue = useMemo<PlayerGroupsContextType>(
    () => ({
      state,
      isLoading,
      activeGroup,
      enableGroups,
      disableGroups,
      createGroup,
      updateGroup,
      deleteGroup,
      setActiveGroup,
      updateActiveGroupData,
    }),
    [state, isLoading, activeGroup, enableGroups, disableGroups, createGroup, updateGroup, deleteGroup, setActiveGroup, updateActiveGroupData]
  );

  return (
    <PlayerGroupsContext.Provider value={contextValue}>
      {children}
    </PlayerGroupsContext.Provider>
  );
};

export const usePlayerGroups = (): PlayerGroupsContextType => {
  const context = useContext(PlayerGroupsContext);
  if (!context) {
    throw new Error('usePlayerGroups must be used within PlayerGroupsProvider');
  }
  return context;
};
