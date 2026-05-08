'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function genRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function genPlayerId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export default function SetupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [joinCode, setJoinCode] = useState('');

  const playerName = name.trim() || 'プレイヤー';

  const handleCreate = () => {
    const roomCode = genRoomCode();
    const pid = genPlayerId();
    router.push(`/game?room=${roomCode}&pid=${pid}&name=${encodeURIComponent(playerName)}`);
  };

  const handleJoin = () => {
    if (joinCode.length !== 4) return;
    const pid = genPlayerId();
    router.push(`/game?room=${joinCode.toUpperCase()}&pid=${pid}&name=${encodeURIComponent(playerName)}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">イマジナリー彼女ポーカー</h1>
        <p className="text-gray-400 mt-2 text-sm">リアルタイム対戦 — 最大4人</p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <input
          type="text"
          placeholder="あなたの名前"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          maxLength={10}
        />

        {mode === 'menu' && (
          <>
            <button
              onClick={() => setMode('create')}
              className="w-full py-4 bg-cyan-700 hover:bg-cyan-600 rounded-xl font-bold text-white text-lg glow-cyan"
            >
              ルームを作る
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full py-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl font-bold text-white text-lg"
            >
              ルームに参加する
            </button>
          </>
        )}

        {mode === 'create' && (
          <>
            <p className="text-gray-500 text-sm text-center">作成後に4桁のコードが発行されます。友達に共有してください。</p>
            <button
              onClick={handleCreate}
              className="w-full py-4 bg-cyan-700 hover:bg-cyan-600 rounded-xl font-bold text-white text-lg glow-cyan"
            >
              ルームを作成
            </button>
            <button onClick={() => setMode('menu')} className="text-gray-600 text-sm text-center">← 戻る</button>
          </>
        )}

        {mode === 'join' && (
          <>
            <input
              type="text"
              placeholder="ルームコード (例: AB23)"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 text-center tracking-[0.5em] text-xl font-bold"
            />
            <button
              onClick={handleJoin}
              disabled={joinCode.length !== 4}
              className="w-full py-4 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-bold text-white text-lg glow-cyan"
            >
              参加する
            </button>
            <button onClick={() => setMode('menu')} className="text-gray-600 text-sm text-center">← 戻る</button>
          </>
        )}
      </div>

      <p className="text-gray-700 text-xs text-center max-w-xs">
        幸せゲージ10以上で婚姻届をプレイすると結婚勝利 💍
      </p>
    </div>
  );
}
