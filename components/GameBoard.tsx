'use client';

import { useState } from 'react';
import { GameState } from '@/lib/types';
import { GameAction } from '@/lib/gameEngine';
import { MAX_SPECIAL_PLAYS, MAX_ATTACK_PLAYS } from '@/lib/constants';
import PlayerPanel from './PlayerPanel';
import HandView from './HandView';
import CardComp from './CardComp';
import InteractionModal from './InteractionModal';
import GameLog from './GameLog';

interface Props {
  state: GameState;
  dispatch: (action: GameAction) => void;
  myPlayerIdx: number;
}

function getImakanoId(state: GameState, playerIdx: number): string {
  const p = state.players[playerIdx];
  return p.imakano.isRental ? 'rental' : p.imakano.id;
}

export default function GameBoard({ state, dispatch, myPlayerIdx }: Props) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const n = state.players.length;
  const cur = state.currentPlayerIndex;
  const myPlayer = state.players[myPlayerIdx];
  const currentPlayer = state.players[cur];
  const isMyTurn = cur === myPlayerIdx;

  // Mahjong positions from my perspective (I am always South)
  const eastIdx  = n >= 3 ? (myPlayerIdx + 1) % n : -1;
  const northIdx = n === 2 ? (myPlayerIdx + 1) % n : n >= 3 ? (myPlayerIdx + 2) % n : -1;
  const westIdx  = n >= 4 ? (myPlayerIdx + 3) % n : -1;

  // Is there a pending interaction meant for me?
  const hasPending = state.pending !== null;
  const isDefenseTarget =
    state.phase === 'defense' &&
    state.pending?.type === 'DEFENSE_REACTION' &&
    state.pending.targetIdx === myPlayerIdx;

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

  // ── Defense reaction (shown only to the target player) ──
  if (isDefenseTarget && state.pending?.type === 'DEFENSE_REACTION') {
    const { attackerIdx, attackCard } = state.pending;
    const defensibleCards = myPlayer.hand.filter(c =>
      ['defense', 'super_defense', 'ultra_defense'].includes(c.def.effectKey)
    );
    return (
      <div className="min-h-screen flex flex-col p-4 gap-4">
        <div className="bg-red-950/80 border border-red-600 rounded-2xl p-4 glow-red">
          <p className="text-red-300 text-xs font-bold tracking-wider mb-2">⚔️ UNDER ATTACK</p>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0"><CardComp card={attackCard} size="sm" /></div>
            <div>
              <p className="text-white font-bold">{state.players[attackerIdx].name}</p>
              <p className="text-gray-400 text-sm">「{attackCard.def.name}」を使用</p>
              <p className="text-red-300 text-xs mt-1">{attackCard.def.effectText}</p>
            </div>
          </div>
        </div>
        <p className="text-white font-bold text-center">{myPlayer.name} — 防御しますか？</p>
        {defensibleCards.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2 justify-center">
            {defensibleCards.map(c => (
              <button key={c.instanceId} onClick={() => dispatch({ type: 'DEFEND', cardInstanceId: c.instanceId })} className="flex-shrink-0">
                <CardComp card={c} size="md" />
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-600 text-sm py-4 border border-gray-800 rounded-xl">防御できるカードがありません</div>
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

  // ── Pending interactions (for current player or discard target) ──
  if (hasPending && state.pending?.type !== 'DEFENSE_REACTION' && state.pending?.type !== 'PASS_DEVICE') {
    return <InteractionModal state={state} dispatch={dispatch} />;
  }

  // ── Main board (mahjong layout) ──
  const unplayableTypes = new Set<string>(['defense']);
  if (state.specialPlaysThisTurn >= MAX_SPECIAL_PLAYS) unplayableTypes.add('special');
  if (state.attackPlaysThisTurn >= MAX_ATTACK_PLAYS) unplayableTypes.add('attack');

  const isCurrentHighlighted = (idx: number) => idx === cur;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundImage: 'url(/board-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
    >
      {/* ── North ── */}
      {northIdx >= 0 && (
        <div className={isCurrentHighlighted(northIdx) ? 'ring-1 ring-cyan-500/60' : ''}>
          <PlayerPanel player={state.players[northIdx]} variant="north" />
        </div>
      )}

      {/* ── Middle row ── */}
      <div className="flex-1 flex min-h-0">

        {/* West */}
        {westIdx >= 0 ? (
          <div className={isCurrentHighlighted(westIdx) ? 'ring-1 ring-cyan-500/60' : ''}>
            <PlayerPanel player={state.players[westIdx]} variant="side" direction="west" />
          </div>
        ) : <div className="w-0" />}

        {/* Center field */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-3 relative">
          {/* Deck & trash counts */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 bg-black/50 border border-gray-700/60 rounded-lg px-3 py-1.5">
              <span className="text-gray-400">山札</span>
              <span className="text-white font-bold">{state.deck.length}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/50 border border-gray-700/60 rounded-lg px-3 py-1.5">
              <span className="text-gray-400">捨て札</span>
              <span className="text-white font-bold">{state.trash.length}</span>
            </div>
          </div>

          {/* Field decoration + last played card */}
          <div className="relative flex items-center justify-center">
            <img src="/field-center.png" alt="" className="absolute w-48 h-32 object-contain opacity-40 pointer-events-none" draggable={false} />
            {state.lastPlayedCard ? (
              <div className="flex flex-col items-center gap-1 relative z-10">
                <p className="text-gray-500 text-[9px] tracking-wider">LAST PLAYED</p>
                <CardComp card={state.lastPlayedCard} size="md" />
              </div>
            ) : (
              <div className="w-[120px] h-[168px] rounded-xl border-2 border-dashed border-gray-700/40 flex items-center justify-center relative z-10">
                <span className="text-gray-700 text-xs">場</span>
              </div>
            )}
          </div>

          {/* Trash top card */}
          {state.trash.length > 0 && state.lastPlayedCard?.instanceId !== state.trash[0].instanceId && (
            <div className="flex flex-col items-center gap-1 opacity-40">
              <CardComp card={state.trash[0]} size="sm" dimmed />
            </div>
          )}

          {/* Waiting / processing overlay */}
          {(state.phase === 'draw' || state.phase === 'end_turn' || state.phase === 'resolve') && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <p className="text-gray-400 animate-pulse text-sm">処理中...</p>
            </div>
          )}
          {state.phase === 'defense' && !isDefenseTarget && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="bg-gray-900/90 border border-red-800/60 rounded-2xl px-6 py-4 text-center">
                <p className="text-red-400 text-sm font-bold">⚔️ 攻撃中</p>
                <p className="text-gray-400 text-xs mt-1 animate-pulse">{state.players[state.pending?.type === 'DEFENSE_REACTION' ? state.pending.targetIdx : cur]?.name ?? ''} が応答中...</p>
              </div>
            </div>
          )}
        </div>

        {/* East */}
        {eastIdx >= 0 ? (
          <div className={isCurrentHighlighted(eastIdx) ? 'ring-1 ring-cyan-500/60' : ''}>
            <PlayerPanel player={state.players[eastIdx]} variant="side" direction="east" />
          </div>
        ) : <div className="w-0" />}
      </div>

      {/* ── South: me ── */}
      <div className={`border-t ${isCurrentHighlighted(myPlayerIdx) ? 'border-cyan-500/60' : 'border-gray-800/80'}`}>
        <PlayerPanel player={myPlayer} isCurrent={isMyTurn} variant="full" />

        <div className="px-4 pt-2 pb-1">

          {/* Skill phase */}
          {isMyTurn && state.phase === 'skill' && (
            <div className="flex flex-col gap-2">
              {myPlayer.imakano.skillKey && !myPlayer.skillUsedThisTurn && (
                <div className="bg-yellow-950/60 border border-yellow-700/60 rounded-xl p-3 glow-gold">
                  <p className="text-yellow-400 text-[10px] font-bold tracking-wider mb-0.5">✨ SKILL</p>
                  <p className="text-white text-sm font-bold">{myPlayer.imakano.skillName}</p>
                  <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{myPlayer.imakano.skillText}</p>
                </div>
              )}
              <div className="flex gap-2">
                {myPlayer.imakano.skillKey && !myPlayer.skillUsedThisTurn ? (
                  <button
                    onClick={() => dispatch({ type: 'USE_SKILL' })}
                    className="flex-1 py-3 bg-yellow-700 hover:bg-yellow-600 rounded-xl font-bold text-white text-sm glow-gold"
                  >
                    スキルを使う
                  </button>
                ) : (
                  <div className="flex-1 text-center text-gray-700 text-sm py-3 border border-gray-800 rounded-xl">
                    {myPlayer.imakano.skillKey ? 'スキル使用済み' : 'スキルなし'}
                  </div>
                )}
                <button
                  onClick={() => dispatch({ type: 'SKIP_SKILL' })}
                  className="flex-1 py-3 bg-gray-900/60 hover:bg-gray-800 border border-gray-800 rounded-xl text-gray-500 text-sm"
                >
                  スキップ
                </button>
              </div>
            </div>
          )}

          {/* Play phase — my turn */}
          {isMyTurn && state.phase === 'play' && !hasPending && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-center gap-4 text-xs">
                <span className={state.specialPlaysThisTurn >= MAX_SPECIAL_PLAYS ? 'text-gray-700 line-through' : 'text-violet-400'}>
                  特殊 {state.specialPlaysThisTurn}/{MAX_SPECIAL_PLAYS}
                </span>
                <span className={state.attackPlaysThisTurn >= MAX_ATTACK_PLAYS ? 'text-gray-700 line-through' : 'text-red-400'}>
                  攻撃 {state.attackPlaysThisTurn}/{MAX_ATTACK_PLAYS}
                </span>
              </div>
              <HandView
                cards={myPlayer.hand}
                selectedId={selectedCardId}
                onSelect={setSelectedCardId}
                unplayableTypes={unplayableTypes}
              />
              <div className="flex gap-2 items-center">
                <button
                  disabled={!selectedCardId}
                  onClick={() => {
                    if (selectedCardId) {
                      dispatch({ type: 'PLAY_CARD', cardInstanceId: selectedCardId });
                      setSelectedCardId(null);
                    }
                  }}
                  className="flex-1 py-3.5 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-bold text-white glow-cyan transition-all text-sm"
                >
                  {selectedCardId ? 'プレイ' : 'カードを選択'}
                </button>
                <button
                  onClick={() => dispatch({ type: 'SKIP_PLAY' })}
                  className="w-16 h-16 rounded-full bg-blue-700 hover:bg-blue-600 border-2 border-blue-400 shadow-[0_0_16px_rgba(60,130,255,0.5)] flex-shrink-0 flex flex-col items-center justify-center"
                >
                  <span className="text-white text-[9px] font-bold leading-tight">ターン</span>
                  <span className="text-white text-[9px] font-bold leading-tight">終了</span>
                </button>
              </div>
            </div>
          )}

          {/* Hand visible but not my turn */}
          {!isMyTurn && (
            <div className="flex flex-col gap-2">
              <HandView
                cards={myPlayer.hand}
                selectedId={null}
                onSelect={() => {}}
                unplayableTypes={new Set(['attack', 'defense', 'special'])}
              />
              <p className="text-center text-gray-600 text-xs py-1 animate-pulse">
                {currentPlayer.name} のターンを待っています...
              </p>
            </div>
          )}
        </div>

        <div className="px-4 pb-4">
          <GameLog log={state.log} maxItems={3} />
        </div>
      </div>
    </div>
  );
}
