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
    <div className="min-h-screen flex flex-col p-5 bg-gray-950/98">
      <div className="mb-6">
        <h2 className="text-white font-bold text-xl">{title}</h2>
        {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
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
        <ModalShell
          title={isSkill ? 'スキルの対象' : '攻撃対象を選択'}
          subtitle="相手を1人選んでください"
        >
          <div className="flex flex-col gap-3">
            {state.players.map((p, i) => {
              if (i === cur) return null;
              const imakanoId = p.imakano.isRental ? 'rental' : p.imakano.id;
              return (
                <button
                  key={p.id}
                  onClick={() => dispatch({ type: 'SELECT_TARGET', targetPlayerIdx: i })}
                  className="flex items-center gap-4 w-full bg-gray-900/80 hover:bg-gray-800 border border-gray-700 hover:border-cyan-600 rounded-xl px-4 py-3 transition-all text-left group"
                >
                  <div className="w-12 h-14 rounded-lg overflow-hidden border border-gray-600 group-hover:border-cyan-500 flex-shrink-0">
                    <img src={`/imakano/${imakanoId}.png`} alt="" className="w-full h-full object-cover object-top" />
                  </div>
                  <div>
                    <p className="text-white font-bold">{p.name}</p>
                    <p className="text-gray-400 text-sm">{p.imakano.name}</p>
                    <p className="text-pink-400 text-sm">♥ {p.happiness}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </ModalShell>
      );
    }

    case 'VIEW_SELECT': {
      return <ViewSelectModal state={state} dispatch={dispatch} />;
    }

    case 'VIEW_SELECT_SPECIALS': {
      return <ViewSelectSpecialsModal state={state} dispatch={dispatch} />;
    }

    case 'DISCARD': {
      return <DiscardModal state={state} dispatch={dispatch} />;
    }

    case 'PEEK_STEAL': {
      return <PeekStealModal state={state} dispatch={dispatch} />;
    }

    case 'PEEK_TRASH': {
      return <PeekTrashModal state={state} dispatch={dispatch} />;
    }

    case 'UTSU_NOVEL_CHOICE': {
      const player = state.players[cur];
      const canReturn = player.happiness >= 2;
      return (
        <ModalShell title="鬱小説" subtitle="全員の幸せゲージが -1 されました">
          <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4 mb-6">
            <p className="text-gray-300 text-sm">幸せゲージ -2（現在: {player.happiness}）で手札に戻せます</p>
          </div>
          <div className="flex flex-col gap-3 mt-auto">
            <button
              onClick={() => dispatch({ type: 'RESOLVE_UTSU_NOVEL', returnToHand: true })}
              disabled={!canReturn}
              className="w-full py-4 bg-violet-800 hover:bg-violet-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-bold text-white glow-purple"
            >
              幸せゲージ -2 → 手札に戻す
            </button>
            <button
              onClick={() => dispatch({ type: 'RESOLVE_UTSU_NOVEL', returnToHand: false })}
              className="w-full py-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-xl text-gray-300"
            >
              トラッシュ
            </button>
          </div>
        </ModalShell>
      );
    }

    default:
      return null;
  }
}

function ViewSelectModal({ state, dispatch }: Props) {
  const pending = state.pending as Extract<typeof state.pending, { type: 'VIEW_SELECT' }>;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { viewedCards, keepCount, label } = pending!;

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else if (next.size < keepCount) { next.add(id); }
      return next;
    });
  };

  return (
    <ModalShell title="イマカノの妹" subtitle={`${label}（${selected.size}/${keepCount}枚選択）`}>
      <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 justify-center">
        {viewedCards.map(card => (
          <button key={card.instanceId} onClick={() => toggle(card.instanceId)} className="flex-shrink-0">
            <CardComp card={card} selected={selected.has(card.instanceId)} size="md" />
          </button>
        ))}
      </div>
      <button
        onClick={() => dispatch({ type: 'RESOLVE_VIEW_SELECT', keptIds: [...selected] })}
        disabled={selected.size !== keepCount}
        className="w-full mt-4 py-4 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-bold text-white glow-cyan"
      >
        {selected.size}/{keepCount}枚を手札に加える
      </button>
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
    <ModalShell title="イマカノの手紙" subtitle={`特殊札を好きなだけ手札に追加（${selected.size}枚選択）`}>
      <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 justify-center flex-wrap">
        {viewedCards.map(card => {
          const isSpecial = card.def.type === 'special';
          return (
            <button key={card.instanceId} onClick={() => toggle(card)} className="flex-shrink-0" disabled={!isSpecial}>
              <CardComp card={card} selected={selected.has(card.instanceId)} dimmed={!isSpecial} size="md" />
            </button>
          );
        })}
      </div>
      <button
        onClick={() => dispatch({ type: 'RESOLVE_VIEW_SELECT_SPECIALS', keptIds: [...selected] })}
        className="w-full mt-4 py-4 bg-cyan-700 hover:bg-cyan-600 rounded-xl font-bold text-white glow-cyan"
      >
        {selected.size}枚を手札に加える
      </button>
    </ModalShell>
  );
}

function DiscardModal({ state, dispatch }: Props) {
  const pending = state.pending as Extract<typeof state.pending, { type: 'DISCARD' }>;
  const playerIdx = state.pendingTargetIdx ?? state.currentPlayerIndex;
  const player = state.players[playerIdx];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { count, cause } = pending!;

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else if (next.size < count) { next.add(id); }
      return next;
    });
  };

  return (
    <ModalShell title={`手札を${count}枚捨てる`} subtitle={`${player.name} — ${cause}`}>
      <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-4 justify-center" style={{ minHeight: 120 }}>
        {player.hand.map(card => (
          <button key={card.instanceId} onClick={() => toggle(card.instanceId)} className="flex-shrink-0" style={{ paddingTop: 12 }}>
            <CardComp card={card} selected={selected.has(card.instanceId)} size="sm" />
          </button>
        ))}
      </div>
      <button
        onClick={() => dispatch({ type: 'RESOLVE_DISCARD', discardedIds: [...selected] })}
        disabled={selected.size !== count}
        className="w-full mt-4 py-4 bg-red-800 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-bold text-white glow-red"
      >
        {selected.size}/{count}枚トラッシュ
      </button>
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
    <ModalShell title="カツアゲ" subtitle={`${target.name} の手札3枚を確認中。防御札を奪えます`}>
      <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 justify-center">
        {peekedCards.map(card => {
          const isDefense = card.def.type === 'defense';
          return (
            <button key={card.instanceId} onClick={() => toggle(card)} className="flex-shrink-0" disabled={!isDefense}>
              <CardComp card={card} selected={selected.has(card.instanceId)} dimmed={!isDefense} size="md" />
            </button>
          );
        })}
      </div>
      <button
        onClick={() => dispatch({ type: 'RESOLVE_PEEK_STEAL', stolenIds: [...selected] })}
        className="w-full mt-4 py-4 bg-yellow-700 hover:bg-yellow-600 rounded-xl font-bold text-white glow-gold"
      >
        {selected.size > 0 ? `防御札 ${selected.size}枚を奪う → 幸せゲージ +1` : '奪わない（効果なし）'}
      </button>
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
    <ModalShell title="スパイ" subtitle={`${target.name} の手札を確認中。防御札を1枚トラッシュできます`}>
      <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 justify-center">
        {peekedCards.map(card => {
          const isDefense = card.def.type === 'defense';
          return (
            <button key={card.instanceId} onClick={() => toggle(card)} className="flex-shrink-0" disabled={!isDefense}>
              <CardComp card={card} selected={selected === card.instanceId} dimmed={!isDefense} size="md" />
            </button>
          );
        })}
      </div>
      <button
        onClick={() => dispatch({ type: 'RESOLVE_PEEK_TRASH', trashedId: selected })}
        className="w-full mt-4 py-4 bg-red-900 hover:bg-red-800 border border-red-700 rounded-xl font-bold text-white"
      >
        {selected ? '選んだ防御札をトラッシュ' : 'トラッシュしない'}
      </button>
    </ModalShell>
  );
}
