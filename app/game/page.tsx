'use client';

import { useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import usePartySocket from 'partysocket/react';
import GameBoard from '@/components/GameBoard';
import LobbyScreen from '@/components/LobbyScreen';
import { GameState } from '@/lib/types';
import type { GameAction } from '@/lib/gameEngine';

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || 'localhost:1999';

type SyncMsg =
  | { type: 'SYNC'; phase: 'lobby'; players: { name: string; isHost: boolean; online: boolean }[]; isHost: boolean }
  | { type: 'SYNC'; phase: 'playing'; game: GameState; yourPlayerIdx: number; afkWarningEnd: number | null };

function GameInner() {
  const params = useSearchParams();
  const roomCode = params.get('room') ?? '';
  const playerId = params.get('pid') ?? '';
  const playerName = params.get('name') ?? 'プレイヤー';

  const [sync, setSync] = useState<SyncMsg | null>(null);

  const socket = usePartySocket({
    host: PARTYKIT_HOST,
    room: roomCode,
    onOpen() {
      socket.send(JSON.stringify({ type: 'JOIN', playerId, name: playerName }));
    },
    onMessage(evt) {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'SYNC') setSync(msg as SyncMsg);
    },
  });

  const dispatch = useCallback((action: GameAction) => {
    socket.send(JSON.stringify({ type: 'ACTION', playerId, action }));
  }, [socket, playerId]);

  const startGame = useCallback(() => {
    socket.send(JSON.stringify({ type: 'START_GAME', playerId }));
  }, [socket, playerId]);

  const sendAfkWarning = useCallback(() => {
    socket.send(JSON.stringify({ type: 'AFK_WARNING', playerId }));
  }, [socket, playerId]);

  if (!sync) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400 animate-pulse text-sm">接続中...</p>
        <p className="text-gray-700 text-xs">ルーム: {roomCode}</p>
      </div>
    );
  }

  if (sync.phase === 'lobby') {
    return (
      <LobbyScreen
        roomCode={roomCode}
        players={sync.players}
        isHost={sync.isHost}
        onStart={startGame}
      />
    );
  }

  return (
    <GameBoard
      state={sync.game}
      dispatch={dispatch}
      myPlayerIdx={sync.yourPlayerIdx}
      afkWarningEnd={sync.afkWarningEnd}
      onAfkWarning={sendAfkWarning}
    />
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">読み込み中...</p>
      </div>
    }>
      <GameInner />
    </Suspense>
  );
}
