'use client';

import { GameLog as GameLogType } from '@/lib/types';

const LOG_COLORS: Record<GameLogType['type'], string> = {
  info: 'text-gray-300',
  attack: 'text-red-400',
  defense: 'text-blue-400',
  happiness: 'text-pink-400',
  skill: 'text-yellow-400',
  system: 'text-gray-500',
  win: 'text-yellow-300 font-bold',
};

interface Props {
  log: GameLogType[];
  maxItems?: number;
}

export default function GameLog({ log, maxItems = 8 }: Props) {
  const displayed = log.slice(0, maxItems);

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3">
      <p className="text-gray-600 text-xs mb-2">ゲームログ</p>
      <div className="flex flex-col gap-1">
        {displayed.map(entry => (
          <p key={entry.id} className={`text-xs leading-relaxed ${LOG_COLORS[entry.type]}`}>
            {entry.text}
          </p>
        ))}
        {log.length === 0 && (
          <p className="text-gray-700 text-xs">まだ何もありません</p>
        )}
      </div>
    </div>
  );
}
