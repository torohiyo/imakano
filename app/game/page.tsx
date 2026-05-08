'use client';

import { useReducer } from 'react';
import { gameReducer, startGame } from '@/lib/gameEngine';
import GameBoard from '@/components/GameBoard';

export default function GamePage() {
  const [state, dispatch] = useReducer(gameReducer, null, (_: null) => {
    const stored =
      typeof window !== 'undefined' ? sessionStorage.getItem('playerNames') : null;
    const names: string[] = stored
      ? JSON.parse(stored)
      : ['プレイヤー1', 'プレイヤー2'];
    return startGame(names);
  });

  return <GameBoard state={state} dispatch={dispatch} />;
}
