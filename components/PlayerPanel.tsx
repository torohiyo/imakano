'use client';

import { PlayerState } from '@/lib/types';

// Frame PNG is 154×184 px (ratio 0.837).
// Container must match this ratio exactly to avoid stretching.
// Character is CSS background-image; transparent frame sits on top.
function Portrait({
  imakanoId,
  width,
  skillRing = false,
  attackRing = false,
  skillLabel = false,
}: {
  imakanoId: string;
  width: number;
  skillRing?: boolean;
  attackRing?: boolean;
  skillLabel?: boolean;
}) {
  const height = Math.round(width * 1.25); // 4:5 portrait ratio

  const border = attackRing
    ? '2px solid rgba(220,38,38,0.9)'
    : '2px solid rgba(196,155,60,0.85)';

  const boxShadow = attackRing
    ? '0 0 0 1px rgba(220,38,38,0.4), 0 0 18px rgba(220,38,38,0.6), inset 0 0 0 1px rgba(255,100,100,0.15)'
    : skillRing
    ? '0 0 0 1px rgba(250,200,50,0.5), 0 0 20px rgba(250,200,50,0.55), inset 0 0 0 1px rgba(255,220,100,0.2)'
    : '0 0 0 1px rgba(120,90,30,0.4), 0 4px 20px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,220,100,0.08)';

  return (
    <div
      style={{
        position: 'relative',
        flexShrink: 0,
        width,
        height,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundImage: `url('/imakano/${imakanoId}.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'top center',
        border,
        boxShadow,
      }}
    >
      {skillLabel && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingBottom: 4,
            paddingTop: 10,
            textAlign: 'center',
            background: 'linear-gradient(to top, rgba(160,110,0,0.9), transparent)',
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

  // ── North ──
  if (variant === 'north') {
    const inner = (
      <div
        className={`flex items-center justify-center gap-5 px-4 py-3 border-b ${onAttack ? 'active:bg-red-950/30' : ''}`}
        style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'linear-gradient(to bottom, rgba(0,0,0,0.70), rgba(0,0,0,0.35))' }}
      >
        <Portrait imakanoId={imakanoId} width={88} attackRing={!!onAttack} />
        <div className="flex flex-col gap-0.5">
          <p className="text-white font-bold text-lg leading-tight">{player.imakano.name}</p>
          <p className="text-white/35 text-[11px]">{player.name}</p>
          <div className="flex items-end gap-1.5 mt-1">
            <span className="text-4xl font-bold tabular-nums leading-none" style={{ color: hpColor }}>{hp}</span>
            <span className="text-pink-400 text-2xl leading-none mb-0.5">♥</span>
          </div>
          <div className="flex gap-0.5 mt-1">
            {Array.from({ length: Math.min(player.hand.length, 7) }, (_, i) => (
              <div key={i} className="w-[8px] h-[11px] rounded-[2px]"
                style={{ background: 'linear-gradient(to bottom, rgba(148,163,184,0.5), rgba(100,116,139,0.3))', border: '1px solid rgba(255,255,255,0.1)' }} />
            ))}
            {player.hand.length > 7 && <span className="text-white/25 text-[9px] ml-0.5">+{player.hand.length - 7}</span>}
          </div>
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
        className={`flex items-center justify-center h-full ${onAttack ? 'active:bg-red-950/20' : ''}`}
        style={{ width: 52, borderLeftWidth: direction === 'east' ? 1 : 0, borderRightWidth: direction === 'west' ? 1 : 0, borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.25)' }}
      >
        <div className="flex items-center gap-2" style={{ transform: `rotate(${deg}deg)`, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {/* Side portrait: small, no frame */}
          <div
            style={{ width: 36, height: 48, borderRadius: 6, overflow: 'hidden', flexShrink: 0, backgroundImage: `url('/imakano/${imakanoId}.png')`, backgroundSize: 'cover', backgroundPosition: 'top center', boxShadow: onAttack ? '0 0 0 2px rgba(220,38,38,0.9)' : '0 2px 8px rgba(0,0,0,0.5)' }}
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
    return onAttack ? <button onClick={onAttack} className="h-full block">{inner}</button> : inner;
  }

  // ── Full (South) ──
  return (
    <div
      className={`px-5 py-3 border-t ${isCurrent ? 'border-cyan-700/30' : 'border-white/5'}`}
      style={{ background: isCurrent ? 'linear-gradient(to top, rgba(8,40,60,0.5), transparent)' : 'transparent' }}
    >
      <div className="flex items-center justify-center gap-6">
        <button onClick={onPortraitTap} disabled={!onPortraitTap} style={{ cursor: onPortraitTap ? 'pointer' : 'default' }}>
          <Portrait imakanoId={imakanoId} width={130} skillRing={!!onPortraitTap} skillLabel={!!onPortraitTap} />
        </button>
        <div className="flex flex-col gap-0.5">
          <p className="text-white font-bold text-2xl leading-tight">{player.imakano.name}</p>
          <p className="text-white/35 text-xs">{player.name}</p>
          <div className="flex items-end gap-2 mt-2">
            <span className="text-6xl font-bold tabular-nums leading-none" style={{ color: hpColor, textShadow: `0 0 24px ${hpColor}55` }}>
              {hp}
            </span>
            <img src="/icons/icon-heart.png" alt="♥" className="w-9 h-9 mb-1" draggable={false} />
          </div>
        </div>
      </div>
    </div>
  );
}
