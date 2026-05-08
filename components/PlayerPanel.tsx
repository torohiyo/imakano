'use client';

import { PlayerState } from '@/lib/types';

// Frame is placed BEHIND the character so its opaque interior is hidden by the portrait.
// Only the frame's decorative border (in the padding area) remains visible.
function Portrait({
  imakanoId,
  width,
  height,
  framePad,
  borderRadius = '12px',
  skillRing = false,
  attackRing = false,
  skillLabel = false,
}: {
  imakanoId: string;
  width: number;
  height: number;
  framePad: number;
  borderRadius?: string;
  skillRing?: boolean;
  attackRing?: boolean;
  skillLabel?: boolean;
}) {
  const outerW = width + framePad * 2;
  const outerH = height + framePad * 2;

  return (
    <div style={{ position: 'relative', flexShrink: 0, width: outerW, height: outerH }}>
      {/* Frame behind — z-index 0 */}
      <img
        src="/icons/portrait-frame.png"
        alt=""
        draggable={false}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', zIndex: 0, pointerEvents: 'none' }}
      />
      {/* Character in front — covers the frame's interior */}
      <div
        style={{
          position: 'absolute',
          top: framePad,
          left: framePad,
          width,
          height,
          overflow: 'hidden',
          borderRadius,
          zIndex: 1,
          boxShadow: attackRing
            ? '0 0 0 2px rgba(220,38,38,0.9), 0 0 18px rgba(220,38,38,0.6)'
            : skillRing
            ? '0 0 0 2px rgba(250,200,50,0.8), 0 0 20px rgba(250,200,50,0.5)'
            : '0 4px 20px rgba(0,0,0,0.5)',
        }}
      >
        <img
          src={`/imakano/${imakanoId}.png`}
          alt=""
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
        />
      </div>
      {/* Skill label — above character */}
      {skillLabel && (
        <div
          style={{
            position: 'absolute',
            bottom: framePad,
            left: framePad,
            right: framePad,
            borderBottomLeftRadius: borderRadius,
            borderBottomRightRadius: borderRadius,
            paddingBottom: 4,
            paddingTop: 10,
            textAlign: 'center',
            background: 'linear-gradient(to top, rgba(160,110,0,0.9), transparent)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        >
          <span style={{ color: '#fef3c7', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em' }}>SKILL</span>
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
          framePad={13}
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
            framePad={5}
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
            framePad={17}
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
