'use client';

import { useEffect, useState } from 'react';
import { GameState } from '@/lib/types';
import { GameAction } from '@/lib/gameEngine';
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

export default function GameBoard({ state, dispatch }: Props) {
  const [defensePassConfirmed, setDefensePassConfirmed] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const cur = state.currentPlayerIndex;
  const currentPlayer = state.players[cur];

  // Reset defense-pass flag when leaving defense phase
  useEffect(() => {
    if (state.phase !== 'defense') setDefensePassConfirmed(false);
  }, [state.phase]);

  // Clear selected card on phase change
  useEffect(() => {
    setSelectedCardId(null);
  }, [state.phase]);

  // Auto-draw on draw phase
  useEffect(() => {
    if (state.phase === 'draw') {
      const t = setTimeout(() => dispatch({ type: 'DRAW_PHASE_DONE' }), 500);
      return () => clearTimeout(t);
    }
  }, [state.phase, dispatch]);

  // Auto-advance end_turn
  useEffect(() => {
    if (state.phase === 'end_turn') {
      const t = setTimeout(() => dispatch({ type: 'END_TURN' }), 700);
      return () => clearTimeout(t);
    }
  }, [state.phase, dispatch]);

  // ── Win screen ──
  if (state.phase === 'finished' && state.winner) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
        <div className="text-6xl">🎊</div>
        <h1 className="text-4xl font-bold text-yellow-400 text-center">
          結婚おめでとう！
        </h1>
        <p className="text-2xl text-white">{state.winner.name} さんの勝利！</p>
        <p className="text-gray-400">「{state.winner.imakano.name}」との結婚</p>
        <div className="w-full max-w-sm mt-4">
          <GameLog log={state.log} maxItems={20} />
        </div>
        <button
          onClick={() => (location.href = '/')}
          className="w-full max-w-sm py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white text-lg"
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
        reason={reason}
        onConfirm={() => dispatch({ type: 'CONFIRM_DEVICE_PASSED' })}
      />
    );
  }

  // ── Pass device to defender ──
  if (
    state.phase === 'defense' &&
    state.pending?.type === 'DEFENSE_REACTION' &&
    !defensePassConfirmed
  ) {
    const { targetIdx, attackerIdx } = state.pending;
    return (
      <PassDeviceModal
        playerName={state.players[targetIdx].name}
        reason={`${state.players[attackerIdx].name} から攻撃されました！防御しますか？`}
        onConfirm={() => setDefensePassConfirmed(true)}
      />
    );
  }

  // ── Defense reaction ──
  if (
    state.phase === 'defense' &&
    state.pending?.type === 'DEFENSE_REACTION' &&
    defensePassConfirmed
  ) {
    const { targetIdx, attackerIdx, attackCard } = state.pending;
    const target = state.players[targetIdx];
    const defensibleCards = target.hand.filter(c =>
      ['defense', 'super_defense', 'ultra_defense'].includes(c.def.effectKey)
    );

    return (
      <div className="min-h-screen flex flex-col p-4 gap-4">
        <div className="bg-red-950 border border-red-600 rounded-xl p-4">
          <p className="text-red-300 font-bold text-sm">⚔️ 攻撃を受けた！</p>
          <p className="text-white font-bold mt-1">
            {state.players[attackerIdx].name} →「{attackCard.def.name}」
          </p>
          <p className="text-gray-400 text-xs mt-1">{attackCard.def.effectText}</p>
        </div>

        <p className="text-white font-bold">{target.name} — 防御カードを選んでください</p>

        {defensibleCards.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {defensibleCards.map(c => (
              <button
                key={c.instanceId}
                onClick={() => dispatch({ type: 'DEFEND', cardInstanceId: c.instanceId })}
                className="text-left"
              >
                <CardComp card={c} />
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-gray-400 text-sm">
            防御できるカードがありません
          </div>
        )}

        <button
          onClick={() => dispatch({ type: 'SKIP_DEFENSE' })}
          className="w-full py-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-xl text-white font-bold"
        >
          防御しない（攻撃を受ける）
        </button>

        <GameLog log={state.log} maxItems={4} />
      </div>
    );
  }

  // ── Other pending interactions ──
  if (
    state.pending &&
    state.pending.type !== 'DEFENSE_REACTION' &&
    state.pending.type !== 'PASS_DEVICE'
  ) {
    return <InteractionModal state={state} dispatch={dispatch} />;
  }

  // ── Main game UI ──
  const otherPlayers = state.players.filter((_, i) => i !== cur);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 text-xs text-gray-500">
        <span>ターン {state.turnNumber}</span>
        <span>{currentPlayer.name} のターン</span>
        <span>山札 {state.deck.length}枚</span>
      </div>

      {/* Other players strip */}
      {otherPlayers.length > 0 && (
        <div className="flex gap-2 p-3 overflow-x-auto border-b border-gray-800">
          {state.players.map((p, i) =>
            i !== cur ? (
              <PlayerPanel key={p.id} player={p} isCurrent={false} compact />
            ) : null
          )}
        </div>
      )}

      {/* Current player */}
      <div className="p-4 border-b border-gray-800">
        <PlayerPanel player={currentPlayer} isCurrent compact={false} />
      </div>

      {/* Phase content */}
      <div className="flex-1 flex flex-col gap-4 p-4">
        {/* Draw phase — auto-handled by useEffect, show spinner */}
        {state.phase === 'draw' && (
          <div className="text-center text-gray-500 py-4 animate-pulse text-sm">
            カードを引いています...
          </div>
        )}

        {/* Skill phase */}
        {state.phase === 'skill' && (
          <div className="flex flex-col gap-3">
            {currentPlayer.imakano.skillKey && !currentPlayer.skillUsedThisTurn && (
              <div className="bg-yellow-950 border border-yellow-700 rounded-xl p-4">
                <p className="text-yellow-400 font-bold text-sm">
                  ✨ スキル: {currentPlayer.imakano.skillName}
                </p>
                <p className="text-gray-300 text-xs mt-1">{currentPlayer.imakano.skillText}</p>
              </div>
            )}
            {currentPlayer.imakano.skillKey && !currentPlayer.skillUsedThisTurn ? (
              <button
                onClick={() => dispatch({ type: 'USE_SKILL' })}
                className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 rounded-xl font-bold text-white"
              >
                スキルを使う
              </button>
            ) : (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-gray-500 text-sm text-center">
                {currentPlayer.imakano.skillKey
                  ? 'スキルは今ターン使用済み'
                  : 'このイマカノにはスキルがありません'}
              </div>
            )}
            <button
              onClick={() => dispatch({ type: 'SKIP_SKILL' })}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-400"
            >
              スキップしてカードフェーズへ
            </button>
          </div>
        )}

        {/* Play phase */}
        {state.phase === 'play' && !state.pending && (
          <div className="flex flex-col gap-4">
            <HandView
              cards={currentPlayer.hand}
              selectedId={selectedCardId}
              onSelect={setSelectedCardId}
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
                className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-bold text-white"
              >
                {selectedCardId ? 'カードをプレイ' : 'カードを選んでください'}
              </button>
              <button
                onClick={() => dispatch({ type: 'SKIP_PLAY' })}
                className="py-4 px-5 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-400"
              >
                パス
              </button>
            </div>
          </div>
        )}

        {/* End turn / resolve — auto advancing */}
        {(state.phase === 'end_turn' || state.phase === 'resolve') && (
          <div className="text-center text-gray-600 py-4 animate-pulse text-sm">
            ターン終了中...
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
