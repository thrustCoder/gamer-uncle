import React, { createContext, useContext, useEffect, useState } from 'react';
import { appCache } from '../services/storage/appCache';
import { useDebouncedEffect } from '../services/hooks/useDebouncedEffect';

type GameContextType = {
  players: string[];
  setPlayers: (players: string[]) => void;
  numTeams: number;
  setNumTeams: (num: number) => void;
};

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [players, setPlayers] = useState<string[]>([]);
  const [numTeams, setNumTeams] = useState<number>(2);

  // hydrate persisted state on mount
  useEffect(() => {
    (async () => {
      const [names, teams] = await Promise.all([
        appCache.getPlayers([]),
        appCache.getTeamCount(2),
      ]);
      if (names.length) setPlayers(names);
      setNumTeams(teams);
    })();
  }, []);

  // persist when changed
  useDebouncedEffect(() => {
    appCache.setPlayers(players);
  }, [players], 400);

  useEffect(() => {
    appCache.setTeamCount(numTeams);
  }, [numTeams]);

  return (
    <GameContext.Provider value={{ players, setPlayers, numTeams, setNumTeams }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used within GameProvider");
  return context;
};