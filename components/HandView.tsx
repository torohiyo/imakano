'use client';

import { useState, useEffect, useRef } from 'react';
import { CardInstance } from '@/lib/types';
import CardComp from './CardComp';

interface DragState {
  card: CardInstance;
  x: number;
  y: number;
}

interface Props {
  cards: CardInstance[];
  onTap: (card: CardInstance) => void;
  onDropPlay?: (card: CardInstance) => void;
  unplayableTypes?: Set<string>;
  unplayableIds?: Set<string>;
}

export default function HandView({ cards, onTap, onDropPlay, unplayableTypes, unplayableIds }: Props) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const touchStartY = useRef(0);

  // Document-level touch tracking for drag
  useEffect(() => {
    if (!drag) return;

    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      setDrag(prev => prev ? { ...prev, x: t.clientX, y: t.clientY } : null);
    };

    const onEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      const movedUpEnough = touchStartY.current - t.clientY > 60;
      const inPlayZone = t.clientY < window.innerHeight * 0.58;
      if (movedUpEnough && inPlayZone && drag) {
        onDropPlay?.(drag.card);
      }
      setDrag(null);
    };

    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd);
    return () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
  }, [drag, onDropPlay]);

  if (cards.length === 0) return null;

  return (
    <>
      <div
        className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 justify-start px-2"
        style={{ minHeight: 96, WebkitOverflowScrolling: 'touch' }}
      >
        {cards.map(card => {
          const isUnplayable = (unplayableTypes?.has(card.def.type) ?? false) || (unplayableIds?.has(card.instanceId) ?? false);
          const canDrag = !!onDropPlay && !isUnplayable;
          const isBeingDragged = drag?.card.instanceId === card.instanceId;

          return (
            <button
              key={card.instanceId}
              className="flex-shrink-0"
              style={{ paddingTop: 8, opacity: isBeingDragged ? 0.25 : 1, transition: 'opacity 0.15s' }}
              onClick={() => !drag && onTap(card)}
              // Touch drag
              onTouchStart={e => {
                if (!canDrag) return;
                const t = e.touches[0];
                touchStartY.current = t.clientY;
                setDrag({ card, x: t.clientX, y: t.clientY });
              }}
              // HTML5 DnD (desktop)
              draggable={canDrag}
              onDragStart={e => {
                e.dataTransfer.setData('cardInstanceId', card.instanceId);
                e.dataTransfer.effectAllowed = 'move';
              }}
            >
              <CardComp card={card} dimmed={isUnplayable} size="sm" />
            </button>
          );
        })}
      </div>

      {/* Touch drag preview (fixed position, follows finger) */}
      {drag && (
        <div
          style={{
            position: 'fixed',
            left: drag.x,
            top: drag.y,
            transform: 'translate(-50%, -65%) scale(1.15)',
            zIndex: 2000,
            pointerEvents: 'none',
            filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.6))',
          }}
        >
          <CardComp card={drag.card} size="sm" />
        </div>
      )}
    </>
  );
}
