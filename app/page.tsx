'use client';

import { useRouter } from 'next/navigation';

const PLAYER_NAMES = ['ゴリラ', 'バナナ', 'ジャングル', 'ドンキー'];

function genPlayerId(): string {
  return Math.random().toString(36).slice(2, 11);
}

function randomName(): string {
  return PLAYER_NAMES[Math.floor(Math.random() * PLAYER_NAMES.length)];
}

export default function SetupPage() {
  const router = useRouter();

  const handleJoin = (room: string) => {
    const pid = genPlayerId();
    const name = randomName();
    router.push(`/game?room=${room}&pid=${pid}&name=${encodeURIComponent(name)}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">イマジナリー彼女ポーカー</h1>
        <p className="text-gray-400 mt-2 text-sm">リアルタイム対戦 — 最大4人</p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <p className="text-gray-500 text-sm text-center">ルームを選んで参加（名前はランダム）</p>
        {[1, 2, 3].map(n => (
          <button
            key={n}
            onClick={() => handleJoin(String(n))}
            className="w-full py-5 bg-cyan-800 hover:bg-cyan-700 active:bg-cyan-600 rounded-2xl font-bold text-white text-xl glow-cyan transition-all"
          >
            ルーム {n}
          </button>
        ))}
      </div>

      <p className="text-gray-700 text-xs text-center max-w-xs">
        幸せゲージ10以上で婚姻届をプレイすると結婚勝利 💍
      </p>
    </div>
  );
}
