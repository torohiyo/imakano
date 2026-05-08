'use client';

import { CardInstance } from '@/lib/types';

const TYPE_STYLES: Record<string, string> = {
  attack: 'bg-red-950 border-red-700',
  defense: 'bg-blue-950 border-blue-700',
  special: 'bg-violet-950 border-violet-700',
};

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  attack: { label: '攻撃', cls: 'bg-red-800 text-red-200' },
  defense: { label: '防御', cls: 'bg-blue-800 text-blue-200' },
  special: { label: '特殊', cls: 'bg-violet-800 text-violet-200' },
};

interface Props {
  card: CardInstance;
  selected?: boolean;
  dimmed?: boolean;
  size?: 'sm' | 'md';
}

export default function CardComp({ card, selected, dimmed, size = 'md' }: Props) {
  const base = TYPE_STYLES[card.def.type] ?? 'bg-gray-900 border-gray-700';
  const badge = TYPE_BADGE[card.def.type];

  if (size === 'sm') {
    return (
      <div
        className={`relative rounded-xl border-2 p-2 transition-all select-none ${base} ${
          selected ? 'ring-2 ring-white -translate-y-2 scale-105' : ''
        } ${dimmed ? 'opacity-40' : ''}`}
      >
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${badge.cls}`}>
          {badge.label}
        </span>
        <p className="text-white font-bold text-xs mt-1 leading-tight">{card.def.name}</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border-2 p-3 transition-all select-none ${base} ${
        selected ? 'ring-2 ring-white -translate-y-1' : ''
      } ${dimmed ? 'opacity-40' : ''}`}
    >
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${badge.cls}`}>
        {badge.label}
      </span>
      <p className="text-white font-bold text-sm mt-2">{card.def.name}</p>
      <p className="text-gray-400 text-xs mt-1 leading-relaxed">{card.def.effectText}</p>
    </div>
  );
}
