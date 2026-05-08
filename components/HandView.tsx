'use client';

import { CardInstance } from '@/lib/types';
import CardComp from './CardComp';

interface Props {
  cards: CardInstance[];
  onTap: (card: CardInstance) => void;
  unplayableTypes?: Set<string>;
  unplayableIds?: Set<string>;
}

export default function HandView({ cards, onTap, unplayableTypes, unplayableIds }: Props) {
  if (cards.length === 0) {
    return <div className="text-center text-gray-700 py-4 text-xs">手札なし</div>;
  }

  return (
    <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 justify-start px-2" style={{ minHeight: 96 }}>
      {cards.map(card => {
        const isUnplayable = (unplayableTypes?.has(card.def.type) ?? false) || (unplayableIds?.has(card.instanceId) ?? false);
        return (
          <button
            key={card.instanceId}
            onClick={() => onTap(card)}
            className="flex-shrink-0"
            style={{ paddingTop: 8 }}
          >
            <CardComp card={card} dimmed={isUnplayable} size="sm" />
          </button>
        );
      })}
    </div>
  );
}
