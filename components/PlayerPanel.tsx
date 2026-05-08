'use client';

import { PlayerState } from '@/lib/types';
import { HAPPINESS_MAX } from '@/lib/constants';

function HappinessBar({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5 flex-wrap">
      {Array.from({ length: HAPPINESS_MAX }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < value
              ? 'bg-pink-400 shadow-[0_0_5px_rgba(255,100,150,0.7)]'
              : 'bg-gray-700'
          }`}
          style={{ width: i < value ? 16 : 13 }}
        />
      ))}
    </div>
  );
}

interface Props {
  player: PlayerState;
  isCurrent: boolean;
  compact?: boolean;
}

export default function PlayerPanel({ player, isCurrent, compact = false }: Props) {
  const imakanoId = player.imakano.isRental ? 'rental' : player.imakano.id;

  if (compact) {
    return (
      <div className={`flex-shrink-0 flex items-center gap-2 rounded-xl p-2 border backdrop-blur-sm min-w-[130px] ${
        isCurrent
          ? 'bg-cyan-950/50 border-cyan-500 glow-cyan'
          : 'bg-gray-900/50 border-gray-700/60'
      }`}>
        <div className="w-9 h-9 rounded-lg overflow-hidden border border-gray-600 flex-shrink-0">
          <img
            src={`/imakano/${imakanoId}.png`}
            alt={player.imakano.name}
            className="w-full h-full object-cover object-top"
            draggable={false}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white text-[11px] font-bold truncate">{player.name}</p>
          <p className="text-gray-500 text-[9px] truncate">{player.imakano.name}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-pink-400 text-[10px]">♥</span>
            <span className="text-pink-300 text-xs font-bold">{player.happiness}</span>
            <span className="text-gray-600 text-[9px]">/{HAPPINESS_MAX}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/70 border border-cyan-500/50 rounded-2xl p-4 backdrop-blur-sm glow-cyan">
      <div className="flex gap-4">
        <div className="relative w-20 h-24 rounded-xl overflow-hidden border-2 border-cyan-500/60 flex-shrink-0 shadow-[0_0_15px_rgba(0,229,255,0.25)]">
          <img
            src={`/imakano/${imakanoId}.png`}
            alt={player.imakano.name}
            className="w-full h-full object-cover object-top"
            draggable={false}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-cyan-400 text-xs">{player.imakano.name}</p>
          <p className="text-white text-xl font-bold truncate">{player.name}</p>
          {player.imakano.skillName && (
            <p className="text-yellow-400 text-[11px] mt-0.5">✨ {player.imakano.skillName}</p>
          )}
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-pink-300 text-xs">幸せ</span>
              <span className="text-pink-400 font-bold text-sm">{player.happiness}</span>
              <span className="text-gray-600 text-xs">/ {HAPPINESS_MAX}</span>
            </div>
            <HappinessBar value={player.happiness} />
          </div>
        </div>
      </div>
    </div>
  );
}
