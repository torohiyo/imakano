'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { HeroineType } from '@/lib/animationTypes';

const SKILL_ASSETS: Record<HeroineType, {
  imageUrl: string;
  borderColor: string;
  glowColor: string;
  skillColor: string;
  shadowColor: string;
}> = {
  musician: {
    imageUrl: '/Skills/musician-skill.png',
    borderColor: 'rgba(80,190,255,0.9)',
    glowColor: 'rgba(60,170,255,0.65)',
    skillColor: '#bfeaff',
    shadowColor: '0 0 32px rgba(60,170,255,0.65), inset 0 0 34px rgba(80,190,255,0.18)',
  },
  yankee: {
    imageUrl: '/Skills/yankee-skill.png',
    borderColor: 'rgba(255,60,50,0.95)',
    glowColor: 'rgba(255,50,30,0.7)',
    skillColor: '#ffb199',
    shadowColor: '0 0 34px rgba(255,50,30,0.7), inset 0 0 34px rgba(255,80,40,0.18)',
  },
  otaku: {
    imageUrl: '/Skills/otaku-skill.png',
    borderColor: 'rgba(220,80,255,0.95)',
    glowColor: 'rgba(220,80,255,0.72)',
    skillColor: '#ffd1ff',
    shadowColor: '0 0 34px rgba(220,80,255,0.72), inset 0 0 34px rgba(255,90,230,0.18)',
  },
  jirai: {
    imageUrl: '/Skills/jirai-skill.png',
    borderColor: 'rgba(255,80,190,0.95)',
    glowColor: 'rgba(255,60,180,0.8)',
    skillColor: '#ffc2ef',
    shadowColor: '0 0 36px rgba(255,60,180,0.8), inset 0 0 36px rgba(255,80,190,0.2)',
  },
};

interface Props {
  heroineType: HeroineType;
  heroineName: string;
  skillName: string;
  onComplete: () => void;
}

export default function SkillCutIn({ heroineType, heroineName, skillName, onComplete }: Props) {
  const asset = SKILL_ASSETS[heroineType];

  useEffect(() => {
    // Total: ~1100ms (in 250 + hold 600 + out 250)
    const t = setTimeout(onComplete, 1100);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      zIndex: 3000, pointerEvents: 'none', overflow: 'hidden',
    }}>
      {/* Dim backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)' }}
      />

      {/* Cut-in banner */}
      <motion.div
        initial={{ x: '-115%', skewX: -10 }}
        animate={{ x: '0%',    skewX: -10 }}
        exit={{    x: '115%',  skewX: -10 }}
        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{
          position: 'absolute',
          left: '-4vw', right: '-4vw',
          top: '50%',
          height: 'min(34vh, 240px)',
          transform: 'translateY(-50%)',
          overflow: 'hidden',
          borderTop: `2px solid ${asset.borderColor}`,
          borderBottom: `2px solid ${asset.borderColor}`,
          boxShadow: asset.shadowColor,
          clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
        }}
      >
        {/* Character image */}
        <img
          src={asset.imageUrl}
          alt={heroineName}
          draggable={false}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center top',
            transform: 'scale(1.06)',
            filter: 'contrast(1.08) saturate(1.15)',
          }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />

        {/* Glow overlay */}
        <div style={{
          position: 'absolute', inset: '-20%',
          background: `radial-gradient(circle at 40% 50%, ${asset.glowColor}, transparent 65%)`,
          mixBlendMode: 'screen',
          opacity: 0.85,
          pointerEvents: 'none',
        }} />

        {/* Sweep light lines */}
        <motion.div
          initial={{ x: '-80%', opacity: 0 }}
          animate={{ x: '80%',  opacity: [0, 0.7, 0] }}
          transition={{ delay: 0.15, duration: 0.65, ease: 'easeOut' }}
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.85) 48%, transparent 52%), linear-gradient(115deg, transparent 15%, rgba(255,255,255,0.35) 18%, transparent 22%)',
            pointerEvents: 'none',
          }}
        />

        {/* Skill name text */}
        <motion.div
          initial={{ x: 40, opacity: 0, scale: 0.88 }}
          animate={{ x: 0,  opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.22, ease: 'easeOut' }}
          style={{
            position: 'absolute', right: '8%', bottom: '10%',
            textAlign: 'right',
            textShadow: `0 0 10px rgba(255,255,255,0.9), 0 0 22px ${asset.glowColor}, 0 3px 0 rgba(0,0,0,0.6)`,
          }}
        >
          <p style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: 'clamp(13px, 3vw, 20px)',
            fontWeight: 700,
            letterSpacing: '0.1em',
            lineHeight: 1.2,
          }}>
            {heroineName}
          </p>
          <p style={{
            color: asset.skillColor,
            fontSize: 'clamp(32px, 10vw, 72px)',
            fontWeight: 900,
            letterSpacing: '0.06em',
            lineHeight: 1,
          }}>
            {skillName}
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
