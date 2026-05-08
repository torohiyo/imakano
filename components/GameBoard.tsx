'use client';

import { useState, useEffect } from 'react';
import { GameState, CardInstance } from '@/lib/types';
import { GameAction } from '@/lib/gameEngine';
import { MAX_SPECIAL_PLAYS, MAX_ATTACK_PLAYS, MARRIAGE_VICTORY_THRESHOLD } from '@/lib/constants';
import PlayerPanel from './PlayerPanel';
import HandView from './HandView';
import CardComp from './CardComp';
import InteractionModal from './InteractionModal';
import GameLog from './GameLog';

interface Props {
  state: GameState;
  dispatch: (action: GameAction) => void;
  myPlayerIdx: number;
  afkWarningEnd?: number | null;
  onAfkWarning?: () => void;
}

function getImakanoId(state: GameState, playerIdx: number): string {
  return state.players[playerIdx].imakano.id;
}

// Card zoom overlay — shown when tapping any card
function CardZoomOverlay({
  card,
  actionLabel,
  onAction,
  onClose,
}: {
  card: CardInstance;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6 gap-5"
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()}>
        <CardComp card={card} size="lg" />
      </div>
      <div className="max-w-xs text-center" onClick={e => e.stopPropagation()}>
        <p className="text-gray-300 text-sm leading-relaxed">{card.def.effectText}</p>
      </div>
      <div className="flex gap-3 w-full max-w-xs" onClick={e => e.stopPropagation()}>
        {actionLabel && onAction && (
          <button
            onClick={() => { onAction(); onClose(); }}
            className="flex-1 py-4 bg-cyan-700 hover:bg-cyan-600 rounded-xl font-bold text-white glow-cyan"
          >
            {actionLabel}
          </button>
        )}
        <button
          onClick={onClose}
          className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-300"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

export default function GameBoard({ state, dispatch, myPlayerIdx, afkWarningEnd, onAfkWarning }: Props) {
  const [zoomedCard, setZoomedCard] = useState<CardInstance | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [afkSecondsLeft, setAfkSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!afkWarningEnd) { setAfkSecondsLeft(null); return; }
    const tick = () => {
      const left = Math.ceil((afkWarningEnd - Date.now()) / 1000);
      setAfkSecondsLeft(left > 0 ? left : 0);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [afkWarningEnd]);

  const n = state.players.length;
  const cur = state.currentPlayerIndex;
  const myPlayer = state.players[myPlayerIdx];
  const currentPlayer = state.players[cur];
  const isMyTurn = cur === myPlayerIdx;

  const eastIdx  = n >= 3 ? (myPlayerIdx + 1) % n : -1;
  const northIdx = n === 2 ? (myPlayerIdx + 1) % n : n >= 3 ? (myPlayerIdx + 2) % n : -1;
  const westIdx  = n >= 4 ? (myPlayerIdx + 3) % n : -1;

  const hasPending = state.pending !== null;
  const isDefenseTarget =
    state.phase === 'defense' &&
    state.pending?.type === 'DEFENSE_REACTION' &&
    state.pending.targetIdx === myPlayerIdx;

  const unplayableTypes = new Set<string>(['defense']);
  if (state.specialPlaysThisTurn >= MAX_SPECIAL_PLAYS) unplayableTypes.add('special');
  if (state.attackPlaysThisTurn >= MAX_ATTACK_PLAYS || state.turnNumber === 1) unplayableTypes.add('attack');

  const unplayableIds = new Set<string>();
  myPlayer.hand.forEach(c => {
    if (c.def.effectKey === 'marriage' && myPlayer.happiness < MARRIAGE_VICTORY_THRESHOLD) {
      unplayableIds.add(c.instanceId);
    }
  });

  // Can the zoomed card be played right now?
  const canPlayZoomed = zoomedCard !== null
    && isMyTurn
    && state.phase === 'play'
    && !hasPending
    && !unplayableTypes.has(zoomedCard.def.type)
    && !unplayableIds.has(zoomedCard.instanceId);

  // Can the zoomed defense card be used in defense reaction?
  const isDefenseZoom = zoomedCard !== null
    && isDefenseTarget
    && ['defense', 'super_defense', 'ultra_defense'].includes(zoomedCard.def.effectKey);

  // Can skill be used? during skill OR play phase, portrait tap triggers it anytime
  const canUseSkill = isMyTurn
    && myPlayer.imakano.skillKey
    && !myPlayer.skillUsedThisTurn
    && (state.phase === 'skill' || state.phase === 'play')
    && !hasPending;

  // ── Card zoom overlay ──
  if (zoomedCard) {
    let actionLabel: string | undefined;
    let onAction: (() => void) | undefined;
    if (canPlayZoomed) {
      actionLabel = 'プレイ';
      onAction = () => dispatch({ type: 'PLAY_CARD', cardInstanceId: zoomedCard.instanceId });
    } else if (isDefenseZoom) {
      actionLabel = '防御する';
      onAction = () => dispatch({ type: 'DEFEND', cardInstanceId: zoomedCard.instanceId });
    }
    return (
      <CardZoomOverlay
        card={zoomedCard}
        actionLabel={actionLabel}
        onAction={onAction}
        onClose={() => setZoomedCard(null)}
      />
    );
  }

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
            <button className="flex-shrink-0" onClick={() => setZoomedCard(attackCard)}>
              <CardComp card={attackCard} size="sm" />
            </button>
            <div>
              <p className="text-white font-bold">{state.players[attackerIdx].name}</p>
              <p className="text-gray-400 text-sm">「{attackCard.def.name}」</p>
              <p className="text-gray-500 text-xs mt-0.5">タップで詳細</p>
            </div>
          </div>
        </div>
        <p className="text-white font-bold text-center">{myPlayer.name} — 防御しますか？</p>
        {defensibleCards.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2 justify-center">
            {defensibleCards.map(c => (
              <button key={c.instanceId} onClick={() => setZoomedCard(c)} className="flex-shrink-0">
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
          防御しない
        </button>
      </div>
    );
  }

  // ── Pending interactions ──
  if (hasPending && state.pending?.type !== 'DEFENSE_REACTION' && state.pending?.type !== 'PASS_DEVICE' && state.pending?.type !== 'SELECT_TARGET') {
    return <InteractionModal state={state} dispatch={dispatch} />;
  }

  const isSelectingTarget = state.pending?.type === 'SELECT_TARGET';
  const isCurrentHighlighted = (idx: number) => idx === cur;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundImage: 'url(/board-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
    >
      {/* ── North ── */}
      {northIdx >= 0 && (
        <div className={isCurrentHighlighted(northIdx) ? 'ring-1 ring-cyan-500/60' : ''}>
          <PlayerPanel
            player={state.players[northIdx]}
            variant="north"
            onAttack={isSelectingTarget ? () => dispatch({ type: 'SELECT_TARGET', targetPlayerIdx: northIdx }) : undefined}
          />
        </div>
      )}

      {/* ── Middle row ── */}
      <div className="flex-1 flex min-h-0">

        {/* West */}
        {westIdx >= 0 ? (
          <div className={`${isCurrentHighlighted(westIdx) ? 'ring-1 ring-cyan-500/60' : ''} self-stretch flex`}>
            <PlayerPanel
              player={state.players[westIdx]}
              variant="side"
              direction="west"
              onAttack={isSelectingTarget ? () => dispatch({ type: 'SELECT_TARGET', targetPlayerIdx: westIdx }) : undefined}
            />
          </div>
        ) : <div className="w-0" />}

        {/* Center field */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-3 relative">
          {/* Deck & trash — icon + number only */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <div className="flex items-center gap-1 bg-black/50 rounded-lg px-2 py-1">
              <span className="text-gray-400 text-xs">🃏</span>
              <span className="text-white text-xs font-bold">{state.deck.length}</span>
            </div>
            <div className="flex items-center gap-1 bg-black/50 rounded-lg px-2 py-1">
              <span className="text-gray-400 text-xs">🗑</span>
              <span className="text-white text-xs font-bold">{state.trash.length}</span>
            </div>
          </div>

          {/* Log toggle */}
          <button
            onClick={() => setShowLog(v => !v)}
            className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-lg flex items-center justify-center text-gray-400 hover:text-white text-sm"
          >
            📋
          </button>

          {/* Field decoration + last played card */}
          <div className="relative flex items-center justify-center">
            <img src="/field-center.png" alt="" className="absolute w-48 h-32 object-contain opacity-40 pointer-events-none" draggable={false} />
            {state.lastPlayedCard ? (
              <button
                className="relative z-10"
                onClick={() => setZoomedCard(state.lastPlayedCard!)}
              >
                <CardComp card={state.lastPlayedCard} size="md" />
              </button>
            ) : (
              <div className="w-[120px] h-[168px] rounded-xl border-2 border-dashed border-gray-700/40 flex items-center justify-center relative z-10">
                <span className="text-gray-700 text-xs">場</span>
              </div>
            )}
          </div>

          {/* SELECT_TARGET prompt */}
          {isSelectingTarget && (
            <div className="bg-red-950/80 border border-red-700 rounded-xl px-4 py-2 text-center">
              <p className="text-red-300 text-xs font-bold">⚔️ 攻撃対象を選択</p>
            </div>
          )}

          {/* Waiting overlay */}
          {(state.phase === 'draw' || state.phase === 'end_turn' || state.phase === 'resolve') && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <p className="text-gray-400 animate-pulse text-sm">処理中...</p>
            </div>
          )}
          {state.phase === 'defense' && !isDefenseTarget && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="bg-gray-900/90 border border-red-800/60 rounded-2xl px-6 py-4 text-center">
                <p className="text-red-400 text-sm font-bold">⚔️ 攻撃中</p>
                <p className="text-gray-400 text-xs mt-1 animate-pulse">
                  {state.players[state.pending?.type === 'DEFENSE_REACTION' ? state.pending.targetIdx : cur]?.name ?? ''} が応答中...
                </p>
              </div>
            </div>
          )}

          {/* Inline log panel */}
          {showLog && (
            <div className="absolute inset-x-2 top-12 z-40">
              <GameLog log={state.log} maxItems={8} />
            </div>
          )}
        </div>

        {/* East */}
        {eastIdx >= 0 ? (
          <div className={`${isCurrentHighlighted(eastIdx) ? 'ring-1 ring-cyan-500/60' : ''} self-stretch flex`}>
            <PlayerPanel
              player={state.players[eastIdx]}
              variant="side"
              direction="east"
              onAttack={isSelectingTarget ? () => dispatch({ type: 'SELECT_TARGET', targetPlayerIdx: eastIdx }) : undefined}
            />
          </div>
        ) : <div className="w-0" />}
      </div>

      {/* ── South: me ── */}
      <div className={`border-t ${isCurrentHighlighted(myPlayerIdx) ? 'border-cyan-500/60' : 'border-gray-800/80'}`}>
        <PlayerPanel
          player={myPlayer}
          isCurrent={isMyTurn}
          variant="full"
          onPortraitTap={canUseSkill ? () => dispatch({ type: 'USE_SKILL' }) : undefined}
        />

        <div className="px-4 pt-2 pb-4">

          {/* Skill phase buttons */}
          {isMyTurn && state.phase === 'skill' && (
            <div className="flex gap-2 mb-2">
              {myPlayer.imakano.skillKey && !myPlayer.skillUsedThisTurn ? (
                <button
                  onClick={() => dispatch({ type: 'USE_SKILL' })}
                  className="flex-1 py-3 bg-yellow-700 hover:bg-yellow-600 rounded-xl font-bold text-white text-sm glow-gold"
                >
                  ✨ {myPlayer.imakano.skillName}
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
          )}

          {/* Play phase */}
          {isMyTurn && state.phase === 'play' && !hasPending && (
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <HandView
                  cards={myPlayer.hand}
                  onTap={setZoomedCard}
                  unplayableTypes={unplayableTypes}
                  unplayableIds={unplayableIds}
                />
              </div>
              <button
                onClick={() => dispatch({ type: 'SKIP_PLAY' })}
                className="w-20 h-20 rounded-full bg-blue-700 hover:bg-blue-600 border-2 border-blue-400 shadow-[0_0_20px_rgba(60,130,255,0.6)] flex-shrink-0 flex flex-col items-center justify-center mb-2"
              >
                <span className="text-white text-xs font-bold leading-tight">ターン</span>
                <span className="text-white text-xs font-bold leading-tight">終了</span>
              </button>
            </div>
          )}

          {/* Not my turn — hand visible for reading only */}
          {!isMyTurn && (
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <HandView
                  cards={myPlayer.hand}
                  onTap={setZoomedCard}
                  unplayableTypes={new Set(['attack', 'defense', 'special'])}
                />
              </div>
              <div className="flex flex-col items-end gap-1 mb-2 flex-shrink-0">
                {afkSecondsLeft !== null ? (
                  <span className="text-red-400 text-xs font-bold animate-pulse">失格まで {afkSecondsLeft}秒</span>
                ) : (
                  <button
                    onClick={onAfkWarning}
                    className="text-[10px] px-2 py-1 bg-gray-900 hover:bg-red-950 border border-gray-700 hover:border-red-700 rounded-lg text-gray-500 hover:text-red-400 transition-all"
                  >
                    離席警告
                  </button>
                )}
                <p className="text-gray-700 text-[10px] animate-pulse text-right">{currentPlayer.name}のターン</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
