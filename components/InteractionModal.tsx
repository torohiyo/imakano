'use client';

import { useState } from 'react';
import { GameState, CardInstance } from '@/lib/types';
import { GameAction } from '@/lib/gameEngine';
import CardComp from './CardComp';

interface Props {
  state: GameState;
  dispatch: (action: GameAction) => void;
}

function ModalShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 shadow-2xl overflow-y-auto max-h-[80vh]"
      style={{ background: 'linear-gradient(to bottom, rgba(10,10,20,0.97), rgba(5,5,15,0.99))', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="mb-5">
        <h2 className="text-white font-bold text-xl tracking-wide">{title}</h2>
        {subtitle && <p className="text-white/40 text-sm mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function InteractionModal({ state, dispatch }: Props) {
  const { pending } = state;
  const cur = state.currentPlayerIndex;

  if (!pending) return null;

  switch (pending.type) {
    case 'SELECT_TARGET': {
      const isSkill = pending.source === 'skill';
      return (
        <ModalShell title={isSkill ? 'スキルの対象' : '攻撃対象'} subtitle="相手を1人選んでください">
          <div className="flex flex-col gap-3">
            {state.players.map((p, i) => {
              if (i === cur) return null;
              return (
                <button
                  key={p.id}
                  onClick={() => dispatch({ type: 'SELECT_TARGET', targetPlayerIdx: i })}
                  className="flex items-center gap-4 w-full rounded-xl px-4 py-3 text-left transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="w-12 h-14 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-white/10">
                    <img src={`/imakano/${p.imakano.id}.png`} alt="" className="w-full h-full object-cover object-top" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">{p.name}</p>
                    <p className="text-white/40 text-sm">{p.imakano.name}</p>
                    <p className="text-pink-400 text-sm font-bold">♥ {p.happiness}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </ModalShell>
      );
    }
    case 'VIEW_SELECT':     return <ViewSelectModal state={state} dispatch={dispatch} />;
    case 'VIEW_SELECT_SPECIALS': return <ViewSelectSpecialsModal state={state} dispatch={dispatch} />;
    case 'DISCARD':         return <DiscardModal state={state} dispatch={dispatch} />;
    case 'PEEK_STEAL':      return <PeekStealModal state={state} dispatch={dispatch} />;
    case 'PEEK_TRASH':      return <PeekTrashModal state={state} dispatch={dispatch} />;
    case 'UTSU_NOVEL_CHOICE': {
      const player = state.players[cur];
      const canReturn = player.happiness >= 2;
      return (
        <ModalShell title="鬱小説" subtitle="全員の幸せゲージが -1 されました">
          <p className="text-white/60 text-sm mb-6">幸せゲージ -2（現在: {player.happiness}）で手札に戻せます</p>
          <div className="flex flex-col gap-3">
            <ActionButton
              onClick={() => dispatch({ type: 'RESOLVE_UTSU_NOVEL', returnToHand: true })}
              disabled={!canReturn}
              variant="purple"
            >
              幸せゲージ -2 → 手札に戻す
            </ActionButton>
            <ActionButton onClick={() => dispatch({ type: 'RESOLVE_UTSU_NOVEL', returnToHand: false })} variant="ghost">
              トラッシュ
            </ActionButton>
          </div>
        </ModalShell>
      );
    }
    default: return null;
  }
}

function ActionButton({ children, onClick, disabled, variant = 'primary' }: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'danger' | 'ghost' | 'purple' | 'gold';
}) {
  const styles: Record<string, string> = {
    primary: 'bg-cyan-700 hover:bg-cyan-600 text-white',
    danger:  'bg-red-800 hover:bg-red-700 text-white',
    ghost:   'text-white/60 hover:text-white/90',
    purple:  'bg-violet-800 hover:bg-violet-700 text-white',
    gold:    'bg-yellow-700 hover:bg-yellow-600 text-white',
  };
  const ghostBorder = variant === 'ghost' ? 'border border-white/10' : '';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-3.5 rounded-xl font-semibold text-sm tracking-wide transition-all
        disabled:opacity-25 disabled:cursor-not-allowed ${styles[variant]} ${ghostBorder}`}
    >
      {children}
    </button>
  );
}

function CardRow({ cards, onTap, selectedIds, maxSelect }: {
  cards: CardInstance[];
  onTap: (card: CardInstance) => void;
  selectedIds: Set<string>;
  maxSelect?: number;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-3 justify-center" style={{ minHeight: 110 }}>
      {cards.map(card => (
        <button key={card.instanceId} onClick={() => onTap(card)} className="flex-shrink-0" style={{ paddingTop: 10 }}>
          <CardComp card={card} selected={selectedIds.has(card.instanceId)} size="sm" />
        </button>
      ))}
    </div>
  );
}

function ViewSelectModal({ state, dispatch }: Props) {
  const pending = state.pending as Extract<typeof state.pending, { type: 'VIEW_SELECT' }>;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { viewedCards, keepCount, label } = pending!;

  const toggle = (card: CardInstance) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(card.instanceId)) { next.delete(card.instanceId); }
      else if (next.size < keepCount) { next.add(card.instanceId); }
      return next;
    });
  };

  return (
    <ModalShell title="イマカノの妹" subtitle={`${label}（${selected.size} / ${keepCount} 枚選択）`}>
      <CardRow cards={viewedCards} onTap={toggle} selectedIds={selected} />
      <ActionButton
        onClick={() => dispatch({ type: 'RESOLVE_VIEW_SELECT', keptIds: [...selected] })}
        disabled={selected.size !== keepCount}
        variant="primary"
      >
        {selected.size}/{keepCount} 枚を手札に加える
      </ActionButton>
    </ModalShell>
  );
}

function ViewSelectSpecialsModal({ state, dispatch }: Props) {
  const pending = state.pending as Extract<typeof state.pending, { type: 'VIEW_SELECT_SPECIALS' }>;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { viewedCards } = pending!;

  const toggle = (card: CardInstance) => {
    if (card.def.type !== 'special') return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(card.instanceId) ? next.delete(card.instanceId) : next.add(card.instanceId);
      return next;
    });
  };

  return (
    <ModalShell title="イマカノの手紙" subtitle={`特殊札を好きなだけ手札に追加（${selected.size} 枚選択）`}>
      <div className="flex gap-3 overflow-x-auto pb-3 justify-center flex-wrap" style={{ minHeight: 110 }}>
        {viewedCards.map(card => (
          <button key={card.instanceId} onClick={() => toggle(card)} className="flex-shrink-0" style={{ paddingTop: 10 }} disabled={card.def.type !== 'special'}>
            <CardComp card={card} selected={selected.has(card.instanceId)} dimmed={card.def.type !== 'special'} size="sm" />
          </button>
        ))}
      </div>
      <ActionButton onClick={() => dispatch({ type: 'RESOLVE_VIEW_SELECT_SPECIALS', keptIds: [...selected] })} variant="primary">
        {selected.size} 枚を手札に加える
      </ActionButton>
    </ModalShell>
  );
}

function DiscardModal({ state, dispatch }: Props) {
  const pending = state.pending as Extract<typeof state.pending, { type: 'DISCARD' }>;
  const playerIdx = state.pendingTargetIdx ?? state.currentPlayerIndex;
  const player = state.players[playerIdx];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { count, cause } = pending!;
  const required = Math.min(count, player.hand.length);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else if (next.size < count) { next.add(id); }
      return next;
    });
  };

  return (
    <ModalShell title={`手札を ${count} 枚捨てる`} subtitle={`${player.name} — ${cause}`}>
      {player.hand.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-4">手札がありません</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3 justify-center" style={{ minHeight: 110 }}>
          {player.hand.map(card => (
            <button key={card.instanceId} onClick={() => toggle(card.instanceId)} className="flex-shrink-0" style={{ paddingTop: 10 }}>
              <CardComp card={card} selected={selected.has(card.instanceId)} size="sm" />
            </button>
          ))}
        </div>
      )}
      <ActionButton
        onClick={() => dispatch({ type: 'RESOLVE_DISCARD', discardedIds: [...selected] })}
        disabled={selected.size !== required}
        variant="danger"
      >
        {player.hand.length === 0 ? 'スキップ' : `${selected.size} / ${required} 枚トラッシュ`}
      </ActionButton>
    </ModalShell>
  );
}

function PeekStealModal({ state, dispatch }: Props) {
  const pending = state.pending as Extract<typeof state.pending, { type: 'PEEK_STEAL' }>;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { peekedCards, targetIdx } = pending!;
  const target = state.players[targetIdx];

  const toggle = (card: CardInstance) => {
    if (card.def.type !== 'defense') return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(card.instanceId) ? next.delete(card.instanceId) : next.add(card.instanceId);
      return next;
    });
  };

  return (
    <ModalShell title="カツアゲ" subtitle={`${target.name} の手札 3 枚を確認中`}>
      <p className="text-white/40 text-xs mb-4">防御札を選んで奪うことができます</p>
      <div className="flex gap-3 overflow-x-auto pb-3 justify-center" style={{ minHeight: 110 }}>
        {peekedCards.map(card => (
          <button key={card.instanceId} onClick={() => toggle(card)} className="flex-shrink-0" style={{ paddingTop: 10 }} disabled={card.def.type !== 'defense'}>
            <CardComp card={card} selected={selected.has(card.instanceId)} dimmed={card.def.type !== 'defense'} size="sm" />
          </button>
        ))}
      </div>
      <ActionButton onClick={() => dispatch({ type: 'RESOLVE_PEEK_STEAL', stolenIds: [...selected] })} variant="gold">
        {selected.size > 0 ? `防御札 ${selected.size} 枚を奪う → 幸せゲージ +1` : '奪わない'}
      </ActionButton>
    </ModalShell>
  );
}

function PeekTrashModal({ state, dispatch }: Props) {
  const pending = state.pending as Extract<typeof state.pending, { type: 'PEEK_TRASH' }>;
  const [selected, setSelected] = useState<string | null>(null);
  const { peekedCards, targetIdx } = pending!;
  const target = state.players[targetIdx];

  const toggle = (card: CardInstance) => {
    if (card.def.type !== 'defense') return;
    setSelected(prev => prev === card.instanceId ? null : card.instanceId);
  };

  return (
    <ModalShell title="スパイ" subtitle={`${target.name} の手札を確認中`}>
      <p className="text-white/40 text-xs mb-4">防御札を 1 枚トラッシュできます</p>
      <div className="flex gap-3 overflow-x-auto pb-3 justify-center" style={{ minHeight: 110 }}>
        {peekedCards.map(card => (
          <button key={card.instanceId} onClick={() => toggle(card)} className="flex-shrink-0" style={{ paddingTop: 10 }} disabled={card.def.type !== 'defense'}>
            <CardComp card={card} selected={selected === card.instanceId} dimmed={card.def.type !== 'defense'} size="sm" />
          </button>
        ))}
      </div>
      <ActionButton onClick={() => dispatch({ type: 'RESOLVE_PEEK_TRASH', trashedId: selected })} variant={selected ? 'danger' : 'ghost'}>
        {selected ? '選んだ防御札をトラッシュ' : 'トラッシュしない'}
      </ActionButton>
    </ModalShell>
  );
}
