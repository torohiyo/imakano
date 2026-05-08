'use client';

import { GameLog as GameLogType } from '@/lib/types';

const LOG_COLORS: Record<GameLogType['type'], string> = {
  info:     'text-gray-400',
  attack:   'text-red-400',
  defense:  'text-blue-400',
  happiness:'text-pink-400',
  skill:    'text-yellow-400',
  system:   'text-gray-600',
  win:      'text-yellow-300 font-bold',
};

interface Props {
  log: GameLogType[];
  maxItems?: number;
}

export default function GameLog({ log, maxItems = 8 }: Props) {
  const displayed = log.slice(0, maxItems);
  return (
    <div className="bg-black/40 border border-gray-800/60 rounded-xl p-3 backdrop-blur-sm">
      <p className="text-gray-700 text-[10px] mb-2 tracking-wider">GAME LOG</p>
      <div className="flex flex-col gap-1">
        {displayed.map((entry, i) => (
          <p
            key={entry.id}
            className={`text-[11px] leading-relaxed transition-opacity ${LOG_COLORS[entry.type]} ${i === 0 ? 'opacity-100' : 'opacity-70'}`}
          >
            {entry.text}
          </p>
        ))}
        {log.length === 0 && (
          <p className="text-gray-800 text-xs">まだ何もありません</p>
        )}
      </div>
    </div>
  );
}
