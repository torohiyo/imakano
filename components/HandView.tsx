'use client';

import { CardInstance } from '@/lib/types';
import CardComp from './CardComp';

interface Props {
  cards: CardInstance[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  disabled?: boolean;
  unplayableTypes?: Set<string>;
}

export default function HandView({ cards, selectedId, onSelect, disabled = false, unplayableTypes }: Props) {
  if (cards.length === 0) {
    return (
      <div className="text-center text-gray-600 py-6 text-sm">手札がありません</div>
    );
  }

  return (
    <div>
      <p className="text-gray-400 text-xs mb-2">手札 ({cards.length}枚) — タップして選択</p>
      <div className="grid grid-cols-3 gap-2">
        {cards.map(card => {
          const isUnplayable = disabled || (unplayableTypes?.has(card.def.type) ?? false);
          return (
            <button
              key={card.instanceId}
              onClick={() => !isUnplayable && onSelect(selectedId === card.instanceId ? null : card.instanceId)}
              className="text-left"
              disabled={isUnplayable}
            >
              <CardComp
                card={card}
                selected={selectedId === card.instanceId}
                dimmed={isUnplayable}
                size="sm"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
