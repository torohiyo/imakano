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

function FaceDownCards({ count }: { count: number }) {
  const show = Math.min(count, 7);
  return (
    <div className="flex items-center" style={{ height: 28 }}>
      {Array.from({ length: show }, (_, i) => (
        <div
          key={i}
          className="rounded border border-blue-800 bg-gradient-to-br from-blue-950 to-blue-900 flex-shrink-0"
          style={{ width: 16, height: 24, marginLeft: i > 0 ? -6 : 0, zIndex: i }}
        />
      ))}
      {count > show && (
        <span className="text-gray-500 text-[9px] ml-1">+{count - show}</span>
      )}
    </div>
  );
}

interface Props {
  player: PlayerState;
  isCurrent?: boolean;
  variant?: 'full' | 'north' | 'side';
  direction?: 'east' | 'west';
  onAttack?: () => void;
}

export default function PlayerPanel({ player, isCurrent = false, variant = 'full', direction, onAttack }: Props) {
  const imakanoId = player.imakano.id;

  // ── North (top of board) ──
  if (variant === 'north') {
    const inner = (
      <div className={`flex items-center gap-3 px-4 py-2 bg-gray-900/60 border-b border-gray-800/60 w-full
        ${onAttack ? 'hover:bg-red-950/60 cursor-pointer' : ''}`}>
        <div className={`w-10 h-12 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all
          ${onAttack ? 'border-red-500 shadow-[0_0_10px_rgba(255,60,60,0.5)]' : 'border-gray-700'}`}>
          <img src={`/imakano/${imakanoId}.png`} alt="" className="w-full h-full object-cover object-top" draggable={false} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-bold truncate">{player.name}</p>
          <p className="text-gray-500 text-[9px] truncate">{player.imakano.name}</p>
          <FaceDownCards count={player.hand.length} />
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-pink-400 text-sm">♥</span>
            <span className={`text-sm font-bold ${player.happiness < 0 ? 'text-red-400' : 'text-pink-300'}`}>{player.happiness}</span>
          </div>
          {onAttack && (
            <span className="text-red-400 text-[9px] font-bold animate-pulse">タップ</span>
          )}
        </div>
      </div>
    );

    if (onAttack) {
      return <button onClick={onAttack} className="w-full text-left">{inner}</button>;
    }
    return inner;
  }

  // ── Side (East / West, rotated) ──
  if (variant === 'side') {
    const deg = direction === 'east' ? 90 : -90;
    const inner = (
      <div
        className={`flex items-center justify-center bg-gray-900/40 border-gray-800/60 h-full
          ${onAttack ? 'bg-red-950/30 cursor-pointer' : ''}`}
        style={{ width: 52, borderLeftWidth: direction === 'east' ? 1 : 0, borderRightWidth: direction === 'west' ? 1 : 0, borderStyle: 'solid' }}
      >
        <div
          className="flex items-center gap-2"
          style={{ transform: `rotate(${deg}deg)`, whiteSpace: 'nowrap', pointerEvents: 'none' }}
        >
          <div className={`w-8 h-10 rounded overflow-hidden border-2 flex-shrink-0 transition-all
            ${onAttack ? 'border-red-500 shadow-[0_0_8px_rgba(255,60,60,0.5)]' : 'border-gray-700'}`}>
            <img src={`/imakano/${imakanoId}.png`} alt="" className="w-full h-full object-cover object-top" draggable={false} />
          </div>
          <div>
            <p className="text-white text-[10px] font-bold">{player.name}</p>
            <p className={`text-[10px] font-bold ${player.happiness < 0 ? 'text-red-400' : 'text-pink-400'}`}>♥ {player.happiness}</p>
            <div className="flex items-center" style={{ height: 20 }}>
              {Array.from({ length: Math.min(player.hand.length, 5) }, (_, i) => (
                <div key={i} className="rounded border border-blue-800 bg-blue-950 flex-shrink-0"
                  style={{ width: 10, height: 14, marginLeft: i > 0 ? -4 : 0 }} />
              ))}
              {player.hand.length > 5 && <span className="text-gray-500 text-[8px] ml-0.5">+{player.hand.length - 5}</span>}
            </div>
            {onAttack && <p className="text-red-400 text-[9px] font-bold animate-pulse">タップ</p>}
          </div>
        </div>
      </div>
    );

    if (onAttack) {
      return (
        <button onClick={onAttack} className="h-full block">
          {inner}
        </button>
      );
    }
    return inner;
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
