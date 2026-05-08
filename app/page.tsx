'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const router = useRouter();
  const [playerCount, setPlayerCount] = useState(2);
  const [names, setNames] = useState(['', '', '', '', '']);

  const handleStart = () => {
    const playerNames = names
      .slice(0, playerCount)
      .map((n, i) => n.trim() || `プレイヤー${i + 1}`);
    sessionStorage.setItem('playerNames', JSON.stringify(playerNames));
    router.push('/game');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">イマジナリー彼女ポーカー</h1>
        <p className="text-gray-400 mt-2 text-sm">同じ端末でローカル対戦</p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-6">
        <div>
          <p className="text-gray-300 text-sm mb-3 font-medium">プレイヤー人数</p>
          <div className="flex gap-2">
            {[2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setPlayerCount(n)}
                className={`flex-1 py-3 rounded-xl font-bold text-lg transition-colors ${
                  playerCount === n
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {n}人
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-gray-300 text-sm font-medium">プレイヤー名（省略可）</p>
          {Array.from({ length: playerCount }).map((_, i) => (
            <input
              key={i}
              type="text"
              placeholder={`プレイヤー${i + 1}`}
              value={names[i]}
              onChange={e => {
                const next = [...names];
                next[i] = e.target.value;
                setNames(next);
              }}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              maxLength={10}
            />
          ))}
        </div>

        <button
          onClick={handleStart}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-xl font-bold text-white text-lg transition-colors"
        >
          ゲーム開始 ♥
        </button>
      </div>

      <div className="text-center text-gray-600 text-xs max-w-xs">
        <p>各プレイヤーはイマカノを1枚引き、幸せゲージ10になったら結婚勝利！</p>
      </div>
    </div>
  );
}
