'use client';

import { CardInstance } from '@/lib/types';
import CardComp from './CardComp';

interface Props {
  cards: CardInstance[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  disabled?: boolean;
}

export default function HandView({ cards, selectedId, onSelect, disabled = false }: Props) {
  if (cards.length === 0) {
    return (
      <div className="text-center text-gray-600 py-6 text-sm">手札がありません</div>
    );
  }

  return (
    <div>
      <p className="text-gray-400 text-xs mb-2">手札 ({cards.length}枚) — タップして選択</p>
      <div className="grid grid-cols-3 gap-2">
        {cards.map(card => (
          <button
            key={card.instanceId}
            onClick={() => !disabled && onSelect(selectedId === card.instanceId ? null : card.instanceId)}
            className="text-left"
            disabled={disabled}
          >
            <CardComp
              card={card}
              selected={selectedId === card.instanceId}
              dimmed={disabled}
              size="sm"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
