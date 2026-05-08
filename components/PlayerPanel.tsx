'use client';

import { PlayerState } from '@/lib/types';
import { HAPPINESS_MAX } from '@/lib/constants';

function HappinessBar({ value }: { value: number }) {
  const clamped = Math.max(0, value);
  return (
    <div className="flex gap-0.5 flex-wrap">
      {Array.from({ length: HAPPINESS_MAX }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < clamped
              ? 'bg-pink-400 shadow-[0_0_5px_rgba(255,100,150,0.7)]'
              : 'bg-gray-700'
          }`}
          style={{ width: i < clamped ? 16 : 13 }}
        />
      ))}
    </div>
  );
}

interface Props {
  player: PlayerState;
  isCurrent?: boolean;
  variant?: 'full' | 'north' | 'side';
  direction?: 'east' | 'west';
}

export default function PlayerPanel({ player, isCurrent = false, variant = 'full', direction }: Props) {
  const imakanoId = player.imakano.isRental ? 'rental' : player.imakano.id;

  // ── North (top of board) ──
  if (variant === 'north') {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-900/60 border-b border-gray-800/60">
        <div className="w-9 h-9 rounded-lg overflow-hidden border border-gray-700 flex-shrink-0">
          <img src={`/imakano/${imakanoId}.png`} alt="" className="w-full h-full object-cover object-top" draggable={false} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-bold truncate">{player.name}</p>
          <p className="text-gray-500 text-[9px] truncate">{player.imakano.name}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-pink-400 text-sm">♥</span>
          <span className={`text-sm font-bold ${player.happiness < 0 ? 'text-red-400' : 'text-pink-300'}`}>{player.happiness}</span>
        </div>
        <div className="text-gray-600 text-[10px] flex-shrink-0">手札 {player.hand.length}</div>
      </div>
    );
  }

  // ── Side (East / West, rotated) ──
  if (variant === 'side') {
    const deg = direction === 'east' ? 90 : -90;
    return (
      <div className="flex items-center justify-center bg-gray-900/40 border-gray-800/60"
        style={{ width: 52, borderLeftWidth: direction === 'east' ? 1 : 0, borderRightWidth: direction === 'west' ? 1 : 0, borderStyle: 'solid' }}>
        <div
          className="flex items-center gap-2"
          style={{ transform: `rotate(${deg}deg)`, whiteSpace: 'nowrap', pointerEvents: 'none' }}
        >
          <div className="w-7 h-9 rounded overflow-hidden border border-gray-700 flex-shrink-0">
            <img src={`/imakano/${imakanoId}.png`} alt="" className="w-full h-full object-cover object-top" draggable={false} />
          </div>
          <div>
            <p className="text-white text-[10px] font-bold">{player.name}</p>
            <p className={`text-[10px] font-bold ${player.happiness < 0 ? 'text-red-400' : 'text-pink-400'}`}>♥ {player.happiness}</p>
            <p className="text-gray-600 text-[9px]">手札 {player.hand.length}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Full (South / current player) ──
  return (
    <div className={`flex gap-3 px-4 py-3 border-t ${isCurrent ? 'border-cyan-900/60 bg-gray-950/80' : 'border-gray-800/60'}`}>
      <div className="relative w-14 h-16 rounded-xl overflow-hidden border-2 border-cyan-500/60 flex-shrink-0 shadow-[0_0_12px_rgba(0,229,255,0.2)]">
        <img src={`/imakano/${imakanoId}.png`} alt="" className="w-full h-full object-cover object-top" draggable={false} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-cyan-400 text-[10px]">{player.imakano.name}</p>
        <p className="text-white text-base font-bold truncate">{player.name}</p>
        {player.imakano.skillName && (
          <p className="text-yellow-400 text-[10px]">✨ {player.imakano.skillName}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`font-bold text-sm ${player.happiness < 0 ? 'text-red-400' : 'text-pink-400'}`}>♥ {player.happiness}</span>
          <span className="text-gray-600 text-xs">/ {HAPPINESS_MAX}</span>
          <HappinessBar value={player.happiness} />
        </div>
      </div>
    </div>
  );
}
