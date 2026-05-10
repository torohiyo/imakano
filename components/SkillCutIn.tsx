'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeroineType } from '@/lib/animationTypes';

const SKILL_ASSETS: Record<HeroineType, {
  imageUrl: string;
  borderColor: string;
  glowColor: string;
  skillColor: string;
  accentBg: string;
}> = {
  musician: {
    imageUrl: '/Skills/musician-skill.png',
    borderColor: 'rgba(80,190,255,0.9)',
    glowColor: 'rgba(60,170,255,0.5)',
    skillColor: '#bfeaff',
    accentBg: 'linear-gradient(135deg, rgba(0,60,120,0.6) 0%, rgba(0,20,60,0.85) 100%)',
  },
  yankee: {
    imageUrl: '/Skills/yankee-skill.png',
    borderColor: 'rgba(255,60,50,0.95)',
    glowColor: 'rgba(255,50,30,0.5)',
    skillColor: '#ffb199',
    accentBg: 'linear-gradient(135deg, rgba(120,20,0,0.6) 0%, rgba(60,0,0,0.85) 100%)',
  },
  otaku: {
    imageUrl: '/Skills/otaku-skill.png',
    borderColor: 'rgba(220,80,255,0.95)',
    glowColor: 'rgba(220,80,255,0.5)',
    skillColor: '#ffd1ff',
    accentBg: 'linear-gradient(135deg, rgba(80,0,120,0.6) 0%, rgba(30,0,60,0.85) 100%)',
  },
  jirai: {
    imageUrl: '/Skills/jirai-skill.png',
    borderColor: 'rgba(255,80,190,0.95)',
    glowColor: 'rgba(255,60,180,0.5)',
    skillColor: '#ffc2ef',
    accentBg: 'linear-gradient(135deg, rgba(120,0,80,0.6) 0%, rgba(60,0,40,0.85) 100%)',
  },
};

interface Props {
  heroineType: HeroineType;
  heroineName: string;
  skillName: string;
  onActivate?: () => void;
  onComplete: () => void;
}

export default function SkillCutIn({ heroineType, heroineName, skillName, onActivate, onComplete }: Props) {
  const asset = SKILL_ASSETS[heroineType];
  const [imageReady, setImageReady] = useState(false);

  // 画像プリロード: ロード完了後にアニメーション開始 & スキル発動
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageReady(true);
      onActivate?.();
    };
    img.onerror = () => {
      setImageReady(true);
      onActivate?.();
    };
    img.src = asset.imageUrl;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 画像ロード後に完了タイマー開始（1800ms表示）
  useEffect(() => {
    if (!imageReady) return;
    const t = setTimeout(onComplete, 1800);
    return () => clearTimeout(t);
  }, [imageReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      position: 'fixed', inset: 0,
      zIndex: 3000, pointerEvents: 'none', overflow: 'hidden',
    }}>
      {/* 即時: 暗転バックドロップ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.82 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.88)' }}
      />

      {/* 画像ロード完了後: フルスクリーンキャラクター */}
      <AnimatePresence>
        {imageReady && (
          <motion.div
            key="cutin-image"
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1.0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ position: 'absolute', inset: 0 }}
          >
            {/* キャラクター画像 フルスクリーン */}
            <img
              src={asset.imageUrl}
              alt={heroineName}
              draggable={false}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover',
                objectPosition: 'center 25%',
                filter: 'contrast(1.08) saturate(1.12)',
              }}
            />

            {/* 下からのグラデーション（テキスト可読性） */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 45%, transparent 70%)',
            }} />

            {/* サイドビネット */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to right, rgba(0,0,0,0.35) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.35) 100%)',
            }} />

            {/* グロー */}
            <div style={{
              position: 'absolute', inset: 0,
              background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${asset.glowColor}, transparent 70%)`,
              mixBlendMode: 'screen',
              opacity: 0.7,
            }} />

            {/* スウィープ光線 */}
            <motion.div
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: '120%', opacity: [0, 0.8, 0] }}
              transition={{ delay: 0.1, duration: 0.7, ease: 'easeOut' }}
              style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.75) 48%, transparent 52%), linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.3) 23%, transparent 27%)',
              }}
            />

            {/* 上下ボーダーライン */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: asset.borderColor,
                boxShadow: `0 0 20px ${asset.borderColor}, 0 0 40px ${asset.glowColor}`,
                transformOrigin: 'left',
              }}
            />
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
                background: asset.borderColor,
                boxShadow: `0 0 20px ${asset.borderColor}, 0 0 40px ${asset.glowColor}`,
                transformOrigin: 'right',
              }}
            />

            {/* スキル名テキスト（右下） */}
            <motion.div
              initial={{ x: 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.18, duration: 0.28, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                right: 'max(24px, env(safe-area-inset-right, 0px))',
                bottom: 'max(32px, env(safe-area-inset-bottom, 0px))',
                textAlign: 'right',
                textShadow: `0 0 12px rgba(255,255,255,0.9), 0 0 28px ${asset.glowColor}, 0 3px 0 rgba(0,0,0,0.8)`,
              }}
            >
              <p style={{
                color: 'rgba(255,255,255,0.8)',
                fontSize: 'clamp(13px, 3.5vw, 22px)',
                fontWeight: 700,
                letterSpacing: '0.12em',
                lineHeight: 1.2,
                marginBottom: 4,
              }}>
                {heroineName}
              </p>
              <p style={{
                color: asset.skillColor,
                fontSize: 'clamp(36px, 11vw, 80px)',
                fontWeight: 900,
                letterSpacing: '0.04em',
                lineHeight: 1,
              }}>
                {skillName}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ロード中インジケーター（画像待ち） */}
      {!imageReady && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
          style={{
            position: 'absolute', left: '50%', top: '50%',
            translate: '-50% -50%',
            width: 40, height: 40,
            border: `2px solid ${asset.borderColor}`,
            borderTopColor: 'transparent',
            borderRadius: '50%',
          }}
        />
      )}
    </div>
  );
}
