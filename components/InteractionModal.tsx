'use client';

import { useState } from 'react';
import { GameState, CardInstance } from '@/lib/types';
import { GameAction } from '@/lib/gameEngine';
import CardComp from './CardComp';

interface Props {
  state: GameState;
  dispatch: (action: GameAction) => void;
}

export default function InteractionModal({ state, dispatch }: Props) {
  const { pending } = state;
  const cur = state.currentPlayerIndex;

  if (!pending) return null;

  switch (pending.type) {
    case 'SELECT_TARGET': {
      const isSkill = pending.source === 'skill';
      return (
        <ModalShell title={isSkill ? 'スキルの対象を選んでください' : '攻撃対象を選んでください'}>
          <div className="flex flex-col gap-3">
            {state.players.map((p, i) => {
              if (i === cur) return null;
              return (
                <button
                  key={p.id}
                  onClick={() => dispatch({ type: 'SELECT_TARGET', targetPlayerIdx: i })}
                  className="w-full py-4 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 border border-gray-600 rounded-xl text-left px-4"
                >
                  <p className="text-white font-bold">{p.name}</p>
                  <p className="text-gray-400 text-sm">{p.imakano.name} — ♥ {p.happiness}</p>
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
        <ModalShell title="鬱小説">
          <p className="text-gray-300 text-sm mb-2">
            全員の幸せゲージが -1 されました。
          </p>
          <p className="text-gray-400 text-sm mb-6">
            幸せゲージ -2（現在: {player.happiness}）で手札に戻すか、このままトラッシュするか選んでください。
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => dispatch({ type: 'RESOLVE_UTSU_NOVEL', returnToHand: true })}
              disabled={!canReturn}
              className="w-full py-4 bg-violet-800 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-bold text-white"
            >
              幸せゲージ -2 → 手札に戻す
            </button>
            <button
              onClick={() => dispatch({ type: 'RESOLVE_UTSU_NOVEL', returnToHand: false })}
              className="w-full py-4 bg-gray-700 hover:bg-gray-600 rounded-xl text-gray-300"
            >
              そのままトラッシュ
            </button>
          </div>
        </ModalShell>
      );
    }

    default:
      return null;
  }
}

function ModalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col p-5 bg-gray-950">
      <h2 className="text-white font-bold text-xl mb-6">{title}</h2>
      {children}
    </div>
  );
}

function ViewSelectModal({ state, dispatch }: Props) {
  const pending = state.pending as Extract<typeof state.pending, { type: 'VIEW_SELECT' }>;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { viewedCards, keepCount, label } = pending!;

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < keepCount) {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <ModalShell title="カードを確認">
      <p className="text-gray-400 text-sm mb-4">{label}（{selected.size}/{keepCount}枚選択中）</p>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {viewedCards.map(card => (
          <button key={card.instanceId} onClick={() => toggle(card.instanceId)} className="text-left">
            <CardComp card={card} selected={selected.has(card.instanceId)} />
          </button>
        ))}
      </div>
      <button
        onClick={() => dispatch({ type: 'RESOLVE_VIEW_SELECT', keptIds: [...selected] })}
        disabled={selected.size !== keepCount}
        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-bold text-white"
      >
        決定（{selected.size}/{keepCount}）
      </button>
    </ModalShell>
  );
}

function ViewSelectSpecialsModal({ state, dispatch }: Props) {
  const pending = state.pending as Extract<typeof state.pending, { type: 'VIEW_SELECT_SPECIALS' }>;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { viewedCards } = pending!;

  const toggle = (id: string, isSpecial: boolean) => {
    if (!isSpecial) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <ModalShell title="イマカノの手紙">
      <p className="text-gray-400 text-sm mb-4">特殊札を好きなだけ手札に加えられます（{selected.size}枚選択中）</p>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {viewedCards.map(card => {
          const isSpecial = card.def.type === 'special';
          return (
            <button
              key={card.instanceId}
              onClick={() => toggle(card.instanceId, isSpecial)}
              className="text-left"
              disabled={!isSpecial}
            >
              <CardComp card={card} selected={selected.has(card.instanceId)} dimmed={!isSpecial} />
            </button>
          );
        })}
      </div>
      <button
        onClick={() => dispatch({ type: 'RESOLVE_VIEW_SELECT_SPECIALS', keptIds: [...selected] })}
        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white"
      >
        決定（{selected.size}枚を手札に加える）
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
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < count) {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <ModalShell title={`手札を${count}枚捨てる`}>
      <p className="text-gray-400 text-sm mb-1">{player.name} — {cause}</p>
      <p className="text-gray-500 text-xs mb-4">{selected.size}/{count}枚選択中</p>
      <div className="grid grid-cols-3 gap-2 mb-6">
        {player.hand.map(card => (
          <button key={card.instanceId} onClick={() => toggle(card.instanceId)} className="text-left">
            <CardComp card={card} selected={selected.has(card.instanceId)} size="sm" />
          </button>
        ))}
      </div>
      <button
        onClick={() => dispatch({ type: 'RESOLVE_DISCARD', discardedIds: [...selected] })}
        disabled={selected.size !== count}
        className="w-full py-4 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-bold text-white"
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

  const defenseCards = peekedCards.filter(c => c.def.type === 'defense');

  return (
    <ModalShell title="カツアゲ">
      <p className="text-gray-400 text-sm mb-4">
        {target.name} の手札3枚を見ています。防御札を選んで奪えます。
      </p>
      {peekedCards.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {peekedCards.map(card => {
            const isDefense = card.def.type === 'defense';
            return (
              <button
                key={card.instanceId}
                onClick={() => toggle(card)}
                disabled={!isDefense}
                className="text-left"
              >
                <CardComp card={card} selected={selected.has(card.instanceId)} dimmed={!isDefense} />
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-gray-600 text-sm mb-6">手札なし</p>
      )}
      <button
        onClick={() => dispatch({ type: 'RESOLVE_PEEK_STEAL', stolenIds: [...selected] })}
        className="w-full py-4 bg-yellow-700 hover:bg-yellow-600 rounded-xl font-bold text-white"
      >
        {selected.size > 0
          ? `防御札 ${selected.size}枚を奪う → 幸せゲージ+1`
          : '奪わない（効果なし）'}
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
    setSelected(prev => (prev === card.instanceId ? null : card.instanceId));
  };

  return (
    <ModalShell title="スパイ">
      <p className="text-gray-400 text-sm mb-4">
        {target.name} の手札を確認しました。防御札を1枚トラッシュできます。
      </p>
      {peekedCards.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {peekedCards.map(card => {
            const isDefense = card.def.type === 'defense';
            return (
              <button
                key={card.instanceId}
                onClick={() => toggle(card)}
                disabled={!isDefense}
                className="text-left"
              >
                <CardComp card={card} selected={selected === card.instanceId} dimmed={!isDefense} />
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-gray-600 text-sm mb-6">手札なし</p>
      )}
      <button
        onClick={() => dispatch({ type: 'RESOLVE_PEEK_TRASH', trashedId: selected })}
        className="w-full py-4 bg-red-800 hover:bg-red-700 rounded-xl font-bold text-white"
      >
        {selected ? '選んだ防御札をトラッシュ' : 'そのまま終わる（防御札なし or スキップ）'}
      </button>
    </ModalShell>
  );
}
