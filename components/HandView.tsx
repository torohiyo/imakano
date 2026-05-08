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
      <div className="text-center text-gray-700 py-6 text-sm border border-gray-800 rounded-xl">
        手札がありません
      </div>
    );
  }

  return (
    <div>
      <p className="text-gray-600 text-[10px] text-center mb-3">
        手札 {cards.length}枚　タップで選択
      </p>
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-4 justify-start px-2" style={{ minHeight: 112 }}>
        {cards.map(card => {
          const isUnplayable = disabled || (unplayableTypes?.has(card.def.type) ?? false);
          return (
            <button
              key={card.instanceId}
              onClick={() => !isUnplayable && onSelect(selectedId === card.instanceId ? null : card.instanceId)}
              disabled={isUnplayable}
              className="flex-shrink-0 relative"
              style={{ paddingTop: 12 }}
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
