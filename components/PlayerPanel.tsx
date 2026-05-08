'use client';

import { PlayerState } from '@/lib/types';
import { HAPPINESS_MAX } from '@/lib/constants';

interface Props {
  player: PlayerState;
  isCurrent: boolean;
  compact?: boolean;
}

export default function PlayerPanel({ player, isCurrent, compact = false }: Props) {
  const hearts = Array.from({ length: HAPPINESS_MAX }, (_, i) => i < player.happiness);

  if (compact) {
    return (
      <div
        className={`flex-shrink-0 rounded-xl p-3 border min-w-[120px] ${
          isCurrent
            ? 'bg-indigo-950 border-indigo-500'
            : 'bg-gray-900 border-gray-700'
        }`}
      >
        <p className={`font-bold text-sm truncate ${isCurrent ? 'text-indigo-300' : 'text-white'}`}>
          {player.name}
        </p>
        <p className="text-gray-400 text-xs truncate">{player.imakano.name}</p>
        <div className="flex gap-0.5 mt-2 flex-wrap">
          {hearts.map((filled, i) => (
            <span key={i} className={`text-xs ${filled ? 'text-pink-400' : 'text-gray-700'}`}>
              ♥
            </span>
          ))}
        </div>
        <p className="text-gray-500 text-xs mt-1">手札 {player.hand.length}枚</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-indigo-500 rounded-2xl p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-indigo-300 text-xs font-medium mb-0.5">あなたのターン</p>
          <h2 className="text-white text-xl font-bold">{player.name}</h2>
          <p className="text-gray-400 text-sm mt-0.5">
            イマカノ：{player.imakano.name}
            {player.imakano.skillName && (
              <span className="ml-2 text-yellow-500 text-xs">✨ {player.imakano.skillName}</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-gray-500 text-xs">手札</p>
          <p className="text-white font-bold">{player.hand.length}枚</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-gray-400 text-xs">幸せゲージ</span>
          <span className="text-pink-400 font-bold text-sm">{player.happiness} / {HAPPINESS_MAX}</span>
        </div>
        <div className="flex gap-1">
          {hearts.map((filled, i) => (
            <span key={i} className={`text-lg ${filled ? 'text-pink-400' : 'text-gray-800'}`}>
              ♥
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
