'use client';

import { useEffect, useState } from 'react';
import { GameState } from '@/lib/types';
import { GameAction } from '@/lib/gameEngine';
import { MAX_SPECIAL_PLAYS, MAX_ATTACK_PLAYS } from '@/lib/constants';
import PassDeviceModal from './PassDeviceModal';
import PlayerPanel from './PlayerPanel';
import HandView from './HandView';
import CardComp from './CardComp';
import InteractionModal from './InteractionModal';
import GameLog from './GameLog';

interface Props {
  state: GameState;
  dispatch: (action: GameAction) => void;
}

function getImakanoId(state: GameState, playerIdx: number): string {
  const p = state.players[playerIdx];
  return p.imakano.isRental ? 'rental' : p.imakano.id;
}

export default function GameBoard({ state, dispatch }: Props) {
  const [defensePassConfirmed, setDefensePassConfirmed] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const cur = state.currentPlayerIndex;
  const currentPlayer = state.players[cur];

  useEffect(() => {
    if (state.phase !== 'defense') setDefensePassConfirmed(false);
  }, [state.phase]);

  useEffect(() => {
    setSelectedCardId(null);
  }, [state.phase]);

  // Auto-draw
  useEffect(() => {
    if (state.phase === 'draw') {
      const t = setTimeout(() => dispatch({ type: 'DRAW_PHASE_DONE' }), 600);
      return () => clearTimeout(t);
    }
  }, [state.phase, dispatch]);

  // Auto end_turn
  useEffect(() => {
    if (state.phase === 'end_turn') {
      const t = setTimeout(() => dispatch({ type: 'END_TURN' }), 700);
      return () => clearTimeout(t);
    }
  }, [state.phase, dispatch]);

  // ── Win screen ──
  if (state.phase === 'finished' && state.winner) {
    const wImakanoId = getImakanoId(state, state.players.findIndex(p => p.id === state.winner!.id));
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
        <div className="w-36 h-44 rounded-2xl overflow-hidden border-2 border-yellow-400 shadow-[0_0_30px_rgba(255,200,50,0.5)]">
          <img src={`/imakano/${wImakanoId}.png`} alt="" className="w-full h-full object-cover object-top" />
        </div>
        <div className="text-center">
          <p className="text-yellow-400 text-sm tracking-widest mb-1">CONGRATULATIONS</p>
          <h1 className="text-4xl font-bold text-white">{state.winner.name}</h1>
          <p className="text-gray-400 mt-2">「{state.winner.imakano.name}」との結婚 🎊</p>
        </div>
        <div className="w-full max-w-sm">
          <GameLog log={state.log} maxItems={15} />
        </div>
        <button
          onClick={() => (location.href = '/')}
          className="w-full max-w-sm py-4 bg-yellow-600 hover:bg-yellow-500 rounded-xl font-bold text-white text-lg glow-gold"
        >
          最初に戻る
        </button>
      </div>
    );
  }

  // ── Pass device (turn start) ──
  if (state.phase === 'pass_device' && state.pending?.type === 'PASS_DEVICE') {
    const { toPlayerIdx, reason } = state.pending;
    return (
      <PassDeviceModal
        playerName={state.players[toPlayerIdx].name}
        imakanoId={getImakanoId(state, toPlayerIdx)}
        reason={reason}
        onConfirm={() => dispatch({ type: 'CONFIRM_DEVICE_PASSED' })}
      />
    );
  }

  // ── Pass device to defender ──
  if (state.phase === 'defense' && state.pending?.type === 'DEFENSE_REACTION' && !defensePassConfirmed) {
    const { targetIdx, attackerIdx } = state.pending;
    return (
      <PassDeviceModal
        playerName={state.players[targetIdx].name}
        imakanoId={getImakanoId(state, targetIdx)}
        reason={`${state.players[attackerIdx].name} から攻撃されました！`}
        onConfirm={() => setDefensePassConfirmed(true)}
      />
    );
  }

  // ── Defense reaction ──
  if (state.phase === 'defense' && state.pending?.type === 'DEFENSE_REACTION' && defensePassConfirmed) {
    const { targetIdx, attackerIdx, attackCard } = state.pending;
    const target = state.players[targetIdx];
    const defensibleCards = target.hand.filter(c =>
      ['defense', 'super_defense', 'ultra_defense'].includes(c.def.effectKey)
    );

    return (
      <div className="min-h-screen flex flex-col p-4 gap-4">
        {/* Attack info */}
        <div className="bg-red-950/80 border border-red-600 rounded-2xl p-4 glow-red">
          <p className="text-red-300 text-xs font-bold tracking-wider mb-2">⚔️ UNDER ATTACK</p>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <CardComp card={attackCard} size="sm" />
            </div>
            <div>
              <p className="text-white font-bold">{state.players[attackerIdx].name}</p>
              <p className="text-gray-400 text-sm">「{attackCard.def.name}」を使用</p>
              <p className="text-red-300 text-xs mt-1">{attackCard.def.effectText}</p>
            </div>
          </div>
        </div>

        <p className="text-white font-bold text-center">{target.name} — 防御しますか？</p>

        {/* Defense cards */}
        {defensibleCards.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2 justify-center">
            {defensibleCards.map(c => (
              <button
                key={c.instanceId}
                onClick={() => dispatch({ type: 'DEFEND', cardInstanceId: c.instanceId })}
                className="flex-shrink-0"
              >
                <CardComp card={c} size="md" />
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-600 text-sm py-4 border border-gray-800 rounded-xl">
            防御できるカードがありません
          </div>
        )}

        <button
          onClick={() => dispatch({ type: 'SKIP_DEFENSE' })}
          className="w-full py-4 bg-gray-900 hover:bg-gray-800 border border-gray-700 rounded-xl text-gray-300 font-bold"
        >
          防御しない（攻撃を受ける）
        </button>

        <GameLog log={state.log} maxItems={4} />
      </div>
    );
  }

  // ── Pending interactions ──
  if (state.pending && state.pending.type !== 'DEFENSE_REACTION' && state.pending.type !== 'PASS_DEVICE') {
    return <InteractionModal state={state} dispatch={dispatch} />;
  }

  // ── Main game UI ──
  const unplayableTypes = new Set<string>(['defense']);
  if (state.specialPlaysThisTurn >= MAX_SPECIAL_PLAYS) unplayableTypes.add('special');
  if (state.attackPlaysThisTurn >= MAX_ATTACK_PLAYS) unplayableTypes.add('attack');

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-gray-800/60 backdrop-blur-sm">
        <span className="text-gray-600 text-xs">Turn {state.turnNumber}</span>
        <span className="text-cyan-600 text-xs font-medium">{currentPlayer.name}</span>
        <span className="text-gray-600 text-xs">山札 {state.deck.length}</span>
      </div>

      {/* Other players */}
      <div className="flex gap-2 px-3 py-2 overflow-x-auto hide-scrollbar border-b border-gray-800/40">
        {state.players.map((p, i) =>
          i !== cur ? (
            <PlayerPanel key={p.id} player={p} isCurrent={false} compact />
          ) : null
        )}
      </div>

      {/* Current player */}
      <div className="px-4 pt-3 pb-2">
        <PlayerPanel player={currentPlayer} isCurrent compact={false} />
      </div>

      {/* Phase area */}
      <div className="flex-1 flex flex-col gap-3 px-4 py-2">

        {/* Draw */}
        {state.phase === 'draw' && (
          <div className="text-center text-gray-600 animate-pulse text-sm py-4">
            カードを引いています...
          </div>
        )}

        {/* Skill */}
        {state.phase === 'skill' && (
          <div className="flex flex-col gap-3">
            {currentPlayer.imakano.skillKey && !currentPlayer.skillUsedThisTurn && (
              <div className="bg-yellow-950/60 border border-yellow-700/60 rounded-2xl p-4 glow-gold">
                <p className="text-yellow-400 text-xs font-bold tracking-wider mb-1">✨ SKILL</p>
                <p className="text-white font-bold">{currentPlayer.imakano.skillName}</p>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">{currentPlayer.imakano.skillText}</p>
              </div>
            )}
            {currentPlayer.imakano.skillKey && !currentPlayer.skillUsedThisTurn ? (
              <button
                onClick={() => dispatch({ type: 'USE_SKILL' })}
                className="w-full py-4 bg-yellow-700 hover:bg-yellow-600 rounded-xl font-bold text-white glow-gold"
              >
                スキルを使う
              </button>
            ) : (
              <div className="text-center text-gray-700 text-sm py-3 border border-gray-800 rounded-xl">
                {currentPlayer.imakano.skillKey ? 'スキル使用済み' : 'スキルなし'}
              </div>
            )}
            <button
              onClick={() => dispatch({ type: 'SKIP_SKILL' })}
              className="w-full py-3 bg-gray-900/60 hover:bg-gray-800 border border-gray-800 rounded-xl text-gray-500"
            >
              スキップ → カードフェーズへ
            </button>
          </div>
        )}

        {/* Play */}
        {state.phase === 'play' && !state.pending && (
          <div className="flex flex-col gap-3">
            {/* Play quota */}
            <div className="flex justify-center gap-4 text-xs">
              <span className={state.specialPlaysThisTurn >= MAX_SPECIAL_PLAYS ? 'text-gray-700 line-through' : 'text-violet-400'}>
                特殊 {state.specialPlaysThisTurn}/{MAX_SPECIAL_PLAYS}
              </span>
              <span className={state.attackPlaysThisTurn >= MAX_ATTACK_PLAYS ? 'text-gray-700 line-through' : 'text-red-400'}>
                攻撃 {state.attackPlaysThisTurn}/{MAX_ATTACK_PLAYS}
              </span>
            </div>

            <HandView
              cards={currentPlayer.hand}
              selectedId={selectedCardId}
              onSelect={setSelectedCardId}
              unplayableTypes={unplayableTypes}
            />

            <div className="flex gap-3">
              <button
                disabled={!selectedCardId}
                onClick={() => {
                  if (selectedCardId) {
                    dispatch({ type: 'PLAY_CARD', cardInstanceId: selectedCardId });
                    setSelectedCardId(null);
                  }
                }}
                className="flex-1 py-4 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-bold text-white glow-cyan transition-all"
              >
                {selectedCardId ? 'プレイ' : 'カードを選択'}
              </button>
              <button
                onClick={() => dispatch({ type: 'SKIP_PLAY' })}
                className="py-4 px-5 bg-gray-900 hover:bg-gray-800 border border-gray-700 rounded-xl text-gray-500"
              >
                パス
              </button>
            </div>
          </div>
        )}

        {/* Transitional */}
        {(state.phase === 'end_turn' || state.phase === 'resolve') && (
          <div className="text-center text-gray-700 animate-pulse text-sm py-4">
            処理中...
          </div>
        )}
      </div>

      {/* Log */}
      <div className="px-4 pb-6">
        <GameLog log={state.log} />
      </div>
    </div>
  );
}
