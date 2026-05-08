'use client';

import { PlayerState } from '@/lib/types';

interface Props {
  player: PlayerState;
  isCurrent?: boolean;
  variant?: 'full' | 'north' | 'side';
  direction?: 'east' | 'west';
  onAttack?: () => void;
  onPortraitTap?: () => void;
}

export default function PlayerPanel({ player, isCurrent = false, variant = 'full', direction, onAttack, onPortraitTap }: Props) {
  const imakanoId = player.imakano.id;
  const happinessColor = player.happiness <= 0 ? 'text-red-400' : player.happiness >= 8 ? 'text-yellow-300' : 'text-pink-300';

  // ── North (top of board) ──
  if (variant === 'north') {
    const inner = (
      <div className={`flex items-center gap-3 px-4 py-2 bg-gray-900/60 border-b border-gray-800/60 w-full
        ${onAttack ? 'hover:bg-red-950/60 cursor-pointer' : ''}`}>
        <div className={`w-12 h-14 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all
          ${onAttack ? 'border-red-500 shadow-[0_0_12px_rgba(255,60,60,0.6)]' : 'border-gray-700'}`}>
          <img src={`/imakano/${imakanoId}.png`} alt="" className="w-full h-full object-cover object-top" draggable={false} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-bold truncate">{player.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-gray-500 text-[10px]">🃏</span>
            <span className="text-gray-400 text-[10px]">{player.hand.length}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <span className={`text-2xl font-bold tabular-nums ${happinessColor}`}>{player.happiness}</span>
          <span className="text-pink-500 text-[10px]">♥</span>
        </div>
      </div>
    );

    if (onAttack) return <button onClick={onAttack} className="w-full text-left">{inner}</button>;
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
          <div className={`w-9 h-11 rounded overflow-hidden border-2 flex-shrink-0 transition-all
            ${onAttack ? 'border-red-500 shadow-[0_0_10px_rgba(255,60,60,0.5)]' : 'border-gray-700'}`}>
            <img src={`/imakano/${imakanoId}.png`} alt="" className="w-full h-full object-cover object-top" draggable={false} />
          </div>
          <div>
            <p className="text-white text-[10px] font-bold">{player.name}</p>
            <p className={`text-lg font-bold tabular-nums ${happinessColor}`}>{player.happiness}</p>
            <p className="text-pink-500 text-[9px]">♥</p>
          </div>
        </div>
      </div>
    );

    if (onAttack) return <button onClick={onAttack} className="h-full block">{inner}</button>;
    return inner;
  }

  // ── Full (South / current player) ──
  return (
    <div className={`flex gap-3 px-4 py-3 border-t ${isCurrent ? 'border-cyan-900/60 bg-gray-950/80' : 'border-gray-800/60'}`}>
      <button
        onClick={onPortraitTap}
        disabled={!onPortraitTap}
        className={`relative w-16 h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all
          ${isCurrent ? 'border-cyan-500/80 shadow-[0_0_14px_rgba(0,229,255,0.3)]' : 'border-gray-700'}
          ${onPortraitTap ? 'active:brightness-125 cursor-pointer' : ''}`}
      >
        <img src={`/imakano/${imakanoId}.png`} alt="" className="w-full h-full object-cover object-top" draggable={false} />
        {onPortraitTap && (
          <div className="absolute bottom-0 inset-x-0 bg-yellow-500/80 py-0.5">
            <p className="text-black text-[8px] font-bold text-center">スキル</p>
          </div>
        )}
      </button>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className="text-gray-400 text-[10px]">{player.imakano.name}</p>
        <p className="text-white text-sm font-bold truncate">{player.name}</p>
      </div>
      <div className="flex flex-col items-end justify-center flex-shrink-0">
        <span className={`text-4xl font-bold tabular-nums ${happinessColor}`}>{player.happiness}</span>
        <span className="text-pink-500 text-xs">♥</span>
      </div>
    </div>
  );
}
