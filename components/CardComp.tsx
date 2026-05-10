'use client';

import { CardInstance } from '@/lib/types';

const TYPE_CONFIG: Record<string, { border: string; glow: string; badge: string; label: string }> = {
  attack:  { border: 'border-red-500',    glow: 'glow-red',    badge: 'bg-red-900/90 text-red-200',    label: '攻撃' },
  defense: { border: 'border-blue-500',   glow: 'glow-blue',   badge: 'bg-blue-900/90 text-blue-200',  label: '防御' },
  special: { border: 'border-violet-500', glow: 'glow-purple', badge: 'bg-violet-900/90 text-violet-200', label: '特殊' },
};

const SIZES = {
  sm: { w: 68,  h: 96,  nameText: 'text-[9px]',  badgeText: 'text-[7px] px-1 py-0.5',   lift: -10 },
  md: { w: 120, h: 168, nameText: 'text-xs',      badgeText: 'text-[9px] px-1.5 py-0.5', lift: -12 },
  lg: { w: 200, h: 280, nameText: 'text-sm',      badgeText: 'text-xs px-2 py-1',         lift: -14 },
  xl: { w: 188, h: 264, nameText: 'text-sm',      badgeText: 'text-xs px-2 py-1',         lift: -28 },
};

interface Props {
  card: CardInstance;
  selected?: boolean;
  dimmed?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function CardComp({ card, selected, dimmed, size = 'md' }: Props) {
  const cfg = TYPE_CONFIG[card.def.type] ?? { border: 'border-gray-600', glow: '', badge: 'bg-gray-800 text-gray-300', label: '' };
  const { w, h, nameText, badgeText, lift } = SIZES[size];

  return (
    <div
      className={`relative rounded-xl overflow-hidden border-2 transition-all duration-200 select-none flex-shrink-0
        ${cfg.border} ${selected ? `${cfg.glow} ring-2 ring-white/80` : ''}
        ${dimmed ? 'opacity-25 grayscale' : 'hover:brightness-110'}`}
      style={{ width: w, height: h, transform: selected ? `translateY(${lift}px)` : undefined }}
    >
      <img
        src={`/cards/${card.def.id}.png`}
        alt={card.def.name}
        className="w-full h-full object-cover"
        draggable={false}
      />
    </div>
  );
}
