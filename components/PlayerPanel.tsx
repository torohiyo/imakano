'use client';

import { PlayerState } from '@/lib/types';

// Portrait rendered as CSS background so the frame PNG's transparent center
// correctly reveals the character image underneath
function Portrait({
  imakanoId,
  width,
  height,
  borderRadius = '12px',
  skillRing = false,
  attackRing = false,
  skillLabel = false,
}: {
  imakanoId: string;
  width: number;
  height: number;
  borderRadius?: string;
  skillRing?: boolean;
  attackRing?: boolean;
  skillLabel?: boolean;
}) {
  return (
    <div
      className="relative flex-shrink-0 overflow-hidden"
      style={{
        width,
        height,
        borderRadius,
        backgroundImage: `url('/imakano/${imakanoId}.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'top center',
        boxShadow: attackRing
          ? '0 0 18px rgba(220,38,38,0.6)'
          : skillRing
          ? '0 0 20px rgba(250,200,50,0.5)'
          : '0 4px 20px rgba(0,0,0,0.5)',
        outline: attackRing
          ? '2px solid rgba(220,38,38,0.8)'
          : skillRing
          ? '2px solid rgba(250,200,50,0.7)'
          : 'none',
      }}
    >
      {/* Frame overlay — transparent center shows character via CSS background */}
      <img
        src="/icons/portrait-frame.png"
        alt=""
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ objectFit: 'fill' }}
        draggable={false}
      />
      {/* Skill label */}
      {skillLabel && (
        <div
          className="absolute bottom-0 inset-x-0 py-1 text-center pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(160,110,0,0.9), transparent)' }}
        >
          <span className="text-yellow-200 text-[9px] font-bold tracking-[0.18em] uppercase">Skill</span>
        </div>
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
  onPortraitTap?: () => void;
}

export default function PlayerPanel({
  player,
  isCurrent = false,
  variant = 'full',
  direction,
  onAttack,
  onPortraitTap,
}: Props) {
  const imakanoId = player.imakano.id;
  const hp = player.happiness;
  const hpColor = hp <= 0 ? '#f87171' : hp >= 8 ? '#fde047' : '#f9a8d4';

  // ── North (opponent — mirrors south layout) ──
  if (variant === 'north') {
    const inner = (
      <div
        className={`flex items-center justify-center gap-5 px-4 py-3 border-b transition-colors
          ${onAttack ? 'active:bg-red-950/30' : ''}`}
        style={{
          borderColor: 'rgba(255,255,255,0.05)',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.70), rgba(0,0,0,0.35))',
        }}
      >
        <Portrait
          imakanoId={imakanoId}
          width={90}
          height={112}
          borderRadius="14px"
          attackRing={!!onAttack}
        />

        <div className="flex flex-col gap-0.5">
          {/* Imakano name — large and prominent */}
          <p className="text-white font-bold text-lg leading-tight">{player.imakano.name}</p>
          {/* Player name — small, de-emphasized */}
          <p className="text-white/35 text-[11px] tracking-wide">{player.name}</p>
          {/* Happiness */}
          <div className="flex items-end gap-1.5 mt-1">
            <span className="text-4xl font-bold tabular-nums leading-none" style={{ color: hpColor }}>
              {hp}
            </span>
            <span className="text-pink-400 text-2xl leading-none mb-0.5">♥</span>
          </div>
          {/* Hand count */}
          <div className="flex gap-0.5 mt-1">
            {Array.from({ length: Math.min(player.hand.length, 7) }, (_, i) => (
              <div key={i} className="w-[8px] h-[11px] rounded-[2px]"
                style={{ background: 'linear-gradient(to bottom, rgba(148,163,184,0.5), rgba(100,116,139,0.3))', border: '1px solid rgba(255,255,255,0.1)' }} />
            ))}
            {player.hand.length > 7 && (
              <span className="text-white/25 text-[9px] ml-0.5">+{player.hand.length - 7}</span>
            )}
          </div>
        </div>
      </div>
    );

    return onAttack
      ? <button onClick={onAttack} className="w-full text-left">{inner}</button>
      : inner;
  }

  // ── Side (East / West) ──
  if (variant === 'side') {
    const deg = direction === 'east' ? 90 : -90;
    const inner = (
      <div
        className={`flex items-center justify-center h-full transition-colors ${onAttack ? 'active:bg-red-950/20' : ''}`}
        style={{
          width: 52,
          borderLeftWidth: direction === 'east' ? 1 : 0,
          borderRightWidth: direction === 'west' ? 1 : 0,
          borderStyle: 'solid',
          borderColor: 'rgba(255,255,255,0.05)',
          background: 'rgba(0,0,0,0.25)',
        }}
      >
        <div
          className="flex items-center gap-2"
          style={{ transform: `rotate(${deg}deg)`, whiteSpace: 'nowrap', pointerEvents: 'none' }}
        >
          <Portrait
            imakanoId={imakanoId}
            width={36}
            height={45}
            borderRadius="6px"
            attackRing={!!onAttack}
          />
          <div className="flex flex-col gap-0.5">
            <p className="text-white font-bold text-[11px] leading-tight">{player.imakano.name}</p>
            <p className="text-white/30 text-[9px]">{player.name}</p>
            <div className="flex items-center gap-1">
              <span className="text-xl font-bold tabular-nums" style={{ color: hpColor }}>{hp}</span>
              <span className="text-pink-400 text-sm">♥</span>
            </div>
          </div>
        </div>
      </div>
    );

    return onAttack
      ? <button onClick={onAttack} className="h-full block">{inner}</button>
      : inner;
  }

  // ── Full (South — my panel) ──
  return (
    <div
      className={`px-5 py-3 border-t transition-colors ${isCurrent ? 'border-cyan-700/30' : 'border-white/5'}`}
      style={{
        background: isCurrent
          ? 'linear-gradient(to top, rgba(8,40,60,0.5), transparent)'
          : 'transparent',
      }}
    >
      <div className="flex items-center justify-center gap-6">
        {/* Portrait — tappable for skill */}
        <button
          onClick={onPortraitTap}
          disabled={!onPortraitTap}
          className="flex-shrink-0"
          style={{ cursor: onPortraitTap ? 'pointer' : 'default' }}
        >
          <Portrait
            imakanoId={imakanoId}
            width={120}
            height={150}
            borderRadius="18px"
            skillRing={!!onPortraitTap}
            skillLabel={!!onPortraitTap}
          />
        </button>

        {/* Info + Happiness */}
        <div className="flex flex-col gap-0.5">
          {/* Imakano name — large, main identity */}
          <p className="text-white font-bold text-2xl leading-tight">{player.imakano.name}</p>
          {/* Player name — small, secondary */}
          <p className="text-white/35 text-xs tracking-wide">{player.name}</p>
          {/* Happiness — dominant visual element */}
          <div className="flex items-end gap-2 mt-2">
            <span
              className="text-6xl font-bold tabular-nums leading-none"
              style={{ color: hpColor, textShadow: `0 0 24px ${hpColor}55` }}
            >
              {hp}
            </span>
            <img
              src="/icons/icon-heart.png"
              alt="♥"
              className="w-9 h-9 mb-1"
              draggable={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
