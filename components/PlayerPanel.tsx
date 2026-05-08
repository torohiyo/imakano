'use client';

import { PlayerState } from '@/lib/types';

function HeartIcon({ className }: { className?: string }) {
  return <img src="/icons/icon-heart.png" alt="" className={className} draggable={false} />;
}

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
  const hp = player.happiness;
  const hpColor = hp <= 0 ? 'text-red-400' : hp >= 8 ? 'text-yellow-300' : 'text-pink-300';
  const heartColor = hp <= 0 ? 'text-red-400' : 'text-pink-400';

  // ── North ──
  if (variant === 'north') {
    const inner = (
      <div className={`flex items-center px-4 py-2 gap-4 w-full
        ${onAttack ? 'hover:bg-red-950/40' : ''}`}
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.65), rgba(0,0,0,0.30))' }}
      >
        <div className={`relative w-[72px] h-[90px] rounded-xl overflow-hidden flex-shrink-0 shadow-lg transition-all
          ${onAttack ? 'ring-2 ring-red-500 shadow-[0_0_18px_rgba(220,38,38,0.55)]' : 'ring-1 ring-white/10'}`}>
          <img src={`/imakano/${imakanoId}.png`} alt="" className="w-full h-full object-cover object-top" draggable={false} />
          <img src="/icons/portrait-frame.png" alt="" className="absolute inset-0 w-full h-full object-fill pointer-events-none" draggable={false} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white/90 text-sm font-semibold tracking-wide truncate">{player.name}</p>
          <p className="text-white/40 text-[11px] truncate">{player.imakano.name}</p>
          <div className="flex items-center gap-1 mt-1.5">
            <div className="flex gap-0.5">
              {Array.from({ length: Math.min(player.hand.length, 6) }, (_, i) => (
                <div key={i} className="w-[9px] h-3 rounded-[2px] bg-gradient-to-b from-blue-400/60 to-blue-700/60 border border-blue-300/20" />
              ))}
              {player.hand.length > 6 && <span className="text-white/30 text-[8px] ml-0.5">+{player.hand.length - 6}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
          <HeartIcon className={`w-4 h-4 ${heartColor}`} />
          <span className={`text-3xl font-bold tabular-nums leading-none ${hpColor}`}>{hp}</span>
        </div>
      </div>
    );

    return onAttack ? <button onClick={onAttack} className="w-full text-left">{inner}</button> : inner;
  }

  // ── Side ──
  if (variant === 'side') {
    const deg = direction === 'east' ? 90 : -90;
    const inner = (
      <div
        className={`flex items-center justify-center h-full transition-colors
          ${onAttack ? 'bg-red-950/20' : 'bg-black/20'}`}
        style={{ width: 52, borderLeftWidth: direction === 'east' ? 1 : 0, borderRightWidth: direction === 'west' ? 1 : 0, borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <div
          className="flex items-center gap-2"
          style={{ transform: `rotate(${deg}deg)`, whiteSpace: 'nowrap', pointerEvents: 'none' }}
        >
          <div className={`relative w-10 h-12 rounded-lg overflow-hidden flex-shrink-0 shadow-md transition-all
            ${onAttack ? 'ring-2 ring-red-500 shadow-[0_0_12px_rgba(220,38,38,0.5)]' : 'ring-1 ring-white/10'}`}>
            <img src={`/imakano/${imakanoId}.png`} alt="" className="w-full h-full object-cover object-top" draggable={false} />
            <img src="/icons/portrait-frame.png" alt="" className="absolute inset-0 w-full h-full object-fill pointer-events-none" draggable={false} />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-white/80 text-[10px] font-semibold">{player.name}</p>
            <div className="flex items-center gap-1">
              <HeartIcon className={`w-3 h-3 ${heartColor}`} />
              <span className={`text-xl font-bold tabular-nums ${hpColor}`}>{hp}</span>
            </div>
          </div>
        </div>
      </div>
    );

    return onAttack ? <button onClick={onAttack} className="h-full block">{inner}</button> : inner;
  }

  // ── Full (South) ──
  return (
    <div className={`px-5 py-3 border-t transition-colors
      ${isCurrent ? 'border-cyan-700/40 bg-gradient-to-t from-cyan-950/25 to-transparent' : 'border-white/5'}`}>
      <div className="flex items-center justify-center gap-6">
        {/* Portrait — large, tappable for skill */}
        <button
          onClick={onPortraitTap}
          disabled={!onPortraitTap}
          className="relative flex-shrink-0 group"
          style={{ cursor: onPortraitTap ? 'pointer' : 'default' }}
        >
          <div className="relative w-[120px] h-[150px] rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/10">
            <img src={`/imakano/${imakanoId}.png`} alt="" className="w-full h-full object-cover object-top" draggable={false} />
            <img src="/icons/portrait-frame.png" alt="" className="absolute inset-0 w-full h-full object-fill pointer-events-none" draggable={false} />
          </div>
          {/* Skill-available ring — golden pulse */}
          {onPortraitTap && (
            <>
              <div className="absolute inset-0 rounded-2xl ring-2 ring-yellow-400 pointer-events-none"
                style={{ boxShadow: '0 0 20px 2px rgba(250,200,50,0.45)', animation: 'pulse 1.8s ease-in-out infinite' }} />
              <div className="absolute bottom-0 inset-x-0 rounded-b-2xl py-1 text-center pointer-events-none"
                style={{ background: 'linear-gradient(to top, rgba(180,130,0,0.85), transparent)' }}>
                <span className="text-yellow-200 text-[10px] font-bold tracking-widest uppercase">Skill</span>
              </div>
            </>
          )}
        </button>

        {/* Happiness + name */}
        <div className="flex flex-col gap-1">
          <p className="text-white/40 text-[11px] tracking-wider uppercase">{player.imakano.name}</p>
          <p className="text-white/90 text-base font-bold tracking-wide">{player.name}</p>
          <div className="flex items-end gap-2 mt-1">
            <span className={`text-6xl font-bold tabular-nums leading-none ${hpColor}`}
              style={{ textShadow: hp <= 0 ? '0 0 20px rgba(239,68,68,0.6)' : '0 0 20px rgba(244,114,182,0.4)' }}>
              {hp}
            </span>
            <HeartIcon className={`w-7 h-7 mb-1 ${heartColor}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
