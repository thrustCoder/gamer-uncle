import React, { createContext, useContext, useState } from 'react';

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