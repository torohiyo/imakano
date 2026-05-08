'use client';

import { CardInstance } from '@/lib/types';

const TYPE_CONFIG: Record<string, { border: string; glow: string; badge: string; label: string }> = {
  attack:  { border: 'border-red-500',    glow: 'glow-red',    badge: 'bg-red-900/90 text-red-200',    label: '攻撃' },
  defense: { border: 'border-blue-500',   glow: 'glow-blue',   badge: 'bg-blue-900/90 text-blue-200',  label: '防御' },
  special: { border: 'border-violet-500', glow: 'glow-purple', badge: 'bg-violet-900/90 text-violet-200', label: '特殊' },
};

interface Props {
  card: CardInstance;
  selected?: boolean;
  dimmed?: boolean;
  size?: 'sm' | 'md';
}

export default function CardComp({ card, selected, dimmed, size = 'md' }: Props) {
  const cfg = TYPE_CONFIG[card.def.type] ?? { border: 'border-gray-600', glow: '', badge: 'bg-gray-800 text-gray-300', label: '' };

  if (size === 'sm') {
    return (
      <div
        className={`relative rounded-xl overflow-hidden border-2 transition-all duration-150 select-none flex-shrink-0
          ${cfg.border} ${selected ? `${cfg.glow} card-selected` : ''}
          ${dimmed ? 'opacity-25 grayscale' : 'hover:brightness-110'}`}
        style={{ width: 68, height: 96 }}
      >
        <img
          src={`/cards/${card.def.id}.png`}
          alt={card.def.name}
          className="w-full h-full object-cover"
          draggable={false}
        />
        {/* Bottom overlay */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-5 pb-1 px-1">
          <p className="text-white text-[9px] font-bold text-center leading-tight">{card.def.name}</p>
        </div>
        {/* Type badge */}
        <div className={`absolute top-1 left-1 text-[7px] px-1 py-0.5 rounded font-bold leading-none ${cfg.badge}`}>
          {cfg.label}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`relative rounded-xl overflow-hidden border-2 transition-all select-none flex-shrink-0
          ${cfg.border} ${selected ? `${cfg.glow} ring-2 ring-white` : ''}
          ${dimmed ? 'opacity-25 grayscale' : 'hover:brightness-110'}`}
        style={{ width: 120, height: 168 }}
      >
        <img
          src={`/cards/${card.def.id}.png`}
          alt={card.def.name}
          className="w-full h-full object-cover"
          draggable={false}
        />
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-8 pb-2 px-2">
          <p className="text-white text-xs font-bold">{card.def.name}</p>
        </div>
        <div className={`absolute top-1.5 left-1.5 text-[9px] px-1.5 py-0.5 rounded font-bold ${cfg.badge}`}>
          {cfg.label}
        </div>
      </div>
      {/* Effect text below card */}
      <p className="text-gray-400 text-[10px] leading-relaxed text-center px-1 max-w-[120px]">
        {card.def.effectText}
      </p>
    </div>
  );
}
