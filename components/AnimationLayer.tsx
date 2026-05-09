'use client';

import { useEffect } from 'react';
import { useAnimate, AnimatePresence, motion } from 'framer-motion';
import { AnimationEvent, AnimPosition } from '@/lib/animationTypes';
import CardComp from './CardComp';
import SkillCutIn from './SkillCutIn';

const CARD_TYPE_BURST: Record<string, string> = {
  attack:  'radial-gradient(circle, rgba(255,40,40,0.65), transparent 65%)',
  defense: 'radial-gradient(circle, rgba(80,180,255,0.65), transparent 65%)',
  special: 'radial-gradient(circle, rgba(255,220,120,0.55), rgba(150,80,255,0.25), transparent 70%)',
};

// Pixel offsets from viewport center to player areas (portrait mobile ~390×844)
const START_OFFSET: Record<AnimPosition, { x: number; y: number }> = {
  south: { x: 0,    y: 280  },
  north: { x: 0,    y: -280 },
  east:  { x: 260,  y: 60   },
  west:  { x: -260, y: 60   },
};

const NUMBER_POS: Record<AnimPosition, { left: string; top: string }> = {
  south: { left: '50%', top: '70%' },
  north: { left: '50%', top: '20%' },
  east:  { left: '82%', top: '50%' },
  west:  { left: '18%', top: '50%' },
};

// ── Card Reveal ──────────────────────────────────────────────────────────────
function CardRevealAnim({ event, onDone }: {
  event: Extract<AnimationEvent, { type: 'PLAY_CARD_REVEAL' }>;
  onDone: () => void;
}) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const offset = START_OFFSET[event.fromPosition];
  const cardType = event.card.def.type;
  const burstBg = CARD_TYPE_BURST[cardType] ?? CARD_TYPE_BURST.special;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!scope.current) return;
      // 1. fly to center
      await animate(scope.current, { x: 0, y: 0, scale: 1.15 }, { duration: 0.28, ease: 'easeOut' });
      if (cancelled) return;
      // 2. spin + glow
      await animate(scope.current, { rotateY: 360, scale: 1.28 }, { duration: 0.45, ease: 'easeInOut' });
      if (cancelled) return;
      await new Promise<void>(r => setTimeout(r, 220));
      if (cancelled) return;
      // 3. fade out
      await animate(scope.current, { opacity: 0, scale: 0.9, y: -24 }, { duration: 0.22 });
      if (!cancelled) onDone();
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      position: 'fixed', left: '50%', top: '45%',
      transform: 'translate(-50%, -50%)',
      perspective: '900px',
      zIndex: 1010, pointerEvents: 'none',
    }}>
      <motion.div
        ref={scope}
        initial={{ x: offset.x, y: offset.y, scale: 0.65, rotateY: 0, opacity: 1 }}
        style={{ transformStyle: 'preserve-3d', position: 'relative' }}
      >
        <CardComp card={event.card} size="lg" />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: [0, 1, 0], scale: [0.8, 1.2, 1.6] }}
          transition={{ delay: 0.55, duration: 0.65, ease: 'easeOut' }}
          style={{
            position: 'absolute', inset: '-30%',
            borderRadius: 24, pointerEvents: 'none',
            background: burstBg,
          }}
        />
      </motion.div>
    </div>
  );
}

// ── Floating Number ──────────────────────────────────────────────────────────
function FloatingNumber({ event, onDone }: {
  event: Extract<AnimationEvent, { type: 'DAMAGE' | 'HEAL' }>;
  onDone: () => void;
}) {
  const isDamage = event.type === 'DAMAGE';
  const pos = NUMBER_POS[event.targetPosition];
  const label = isDamage ? `-${event.amount}` : `+${event.amount}`;

  useEffect(() => {
    const t = setTimeout(onDone, 1300);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -70, scale: 1.3 }}
      transition={{ duration: 1.2, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        left: pos.left, top: pos.top,
        transform: 'translateX(-50%)',
        zIndex: 1020, pointerEvents: 'none',
        color: isDamage ? '#ff3b3b' : '#ffd86b',
        fontWeight: 800,
        fontSize: 'clamp(28px, 8vw, 54px)',
        textShadow: isDamage
          ? '0 0 14px rgba(255,0,0,0.8)'
          : '0 0 14px rgba(255,210,90,0.8)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {label}
    </motion.div>
  );
}

// ── Block ────────────────────────────────────────────────────────────────────
function BlockAnim({ event, onDone }: {
  event: Extract<AnimationEvent, { type: 'BLOCK' }>;
  onDone: () => void;
}) {
  const pos = NUMBER_POS[event.targetPosition];

  useEffect(() => {
    const t = setTimeout(onDone, 900);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.1, 1.0, 0.8] }}
      transition={{ duration: 0.85, times: [0, 0.25, 0.65, 1] }}
      style={{
        position: 'fixed',
        left: pos.left, top: pos.top,
        transform: 'translate(-50%, -50%)',
        zIndex: 1020, pointerEvents: 'none',
        width: 80, height: 80,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(80,180,255,0.7), transparent 70%)',
        border: '2px solid rgba(120,200,255,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <span style={{ color: '#93c5fd', fontWeight: 800, fontSize: 16 }}>防御</span>
    </motion.div>
  );
}

// ── Win Flash ────────────────────────────────────────────────────────────────
function WinFlash({ onDone }: { event: Extract<AnimationEvent, { type: 'WIN_MARRIAGE' }>; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.85, 0] }}
      transition={{ duration: 0.6 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1005, pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(255,255,255,0.9), rgba(255,220,160,0.4), rgba(255,160,210,0.2))',
      }}
    />
  );
}

// ── Screen Flash (for heavy damage) ─────────────────────────────────────────
function ScreenFlashRed({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.22, 0] }}
      transition={{ duration: 0.38 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1005, pointerEvents: 'none',
        background: 'rgba(255,0,50,0.18)',
      }}
    />
  );
}

// ── Turn Banner ──────────────────────────────────────────────────────────────
function TurnBanner({ isYours, onDone }: { isYours: boolean; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  const logoSrc = isYours ? '/icons/your-turn.png' : '/icons/opponent-turn.png';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      style={{
        position: 'fixed',
        left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1050, pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
      }}
    >
      {/* Glow backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.5, 0.3] }}
        transition={{ duration: 0.6 }}
        style={{
          position: 'absolute', inset: -40,
          borderRadius: 32,
          background: isYours
            ? 'radial-gradient(circle, rgba(56,189,248,0.35), transparent 70%)'
            : 'radial-gradient(circle, rgba(248,113,113,0.35), transparent 70%)',
          filter: 'blur(12px)',
        }}
      />
      {/* Logo image */}
      <motion.img
        src={logoSrc}
        alt={isYours ? 'Your Turn' : "Opponent's Turn"}
        draggable={false}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.6, times: [0, 0.15, 0.75, 1] }}
        style={{ width: 'min(72vw, 340px)', objectFit: 'contain', position: 'relative' }}
        onError={e => {
          // Fallback text if image not found
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      {/* Fallback text (shown if image fails) */}
      <motion.p
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.6, times: [0, 0.15, 0.75, 1] }}
        style={{
          position: 'relative',
          color: isYours ? '#7dd3fc' : '#fca5a5',
          fontWeight: 800, fontSize: 'clamp(22px, 6vw, 36px)',
          letterSpacing: '0.08em',
          textShadow: isYours
            ? '0 0 20px rgba(56,189,248,0.8)'
            : '0 0 20px rgba(248,113,113,0.8)',
          marginTop: 4,
        }}
      >
        {isYours ? 'Your Turn' : "Opponent's Turn"}
      </motion.p>
    </motion.div>
  );
}

// ── Main Layer ───────────────────────────────────────────────────────────────
interface Props {
  events: AnimationEvent[];
  onDone: (id: number) => void;
}

export default function AnimationLayer({ events, onDone }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      pointerEvents: 'none', zIndex: 1000,
      overflow: 'hidden',
    }}>
      <AnimatePresence>
        {events.map(ev => {
          const key = ev.id;
          const done = () => onDone(ev.id);
          if (ev.type === 'PLAY_CARD_REVEAL')
            return <CardRevealAnim key={key} event={ev} onDone={done} />;
          if (ev.type === 'DAMAGE') {
            const needsFlash = ev.amount >= 2;
            return (
              <>
                <FloatingNumber key={key} event={ev} onDone={done} />
                {needsFlash && <ScreenFlashRed key={`flash-${key}`} onDone={() => {}} />}
              </>
            );
          }
          if (ev.type === 'HEAL')
            return <FloatingNumber key={key} event={ev} onDone={done} />;
          if (ev.type === 'BLOCK')
            return <BlockAnim key={key} event={ev} onDone={done} />;
          if (ev.type === 'WIN_MARRIAGE')
            return <WinFlash key={key} event={ev} onDone={done} />;
          if (ev.type === 'YOUR_TURN')
            return <TurnBanner key={key} isYours={true} onDone={done} />;
          if (ev.type === 'OPPONENT_TURN')
            return <TurnBanner key={key} isYours={false} onDone={done} />;
          if (ev.type === 'SKILL_CUTIN')
            return (
              <SkillCutIn
                key={key}
                heroineType={ev.heroineType}
                heroineName={ev.heroineName}
                skillName={ev.skillName}
                onComplete={done}
              />
            );
          return null;
        })}
      </AnimatePresence>
    </div>
  );
}
