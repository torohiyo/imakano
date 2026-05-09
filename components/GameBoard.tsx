'use client';

import { useState, useEffect, useRef } from 'react';
import { GameState, CardInstance } from '@/lib/types';
import { GameAction, skillConditionMet } from '@/lib/gameEngine';
import { MAX_SPECIAL_PLAYS, MAX_ATTACK_PLAYS, MARRIAGE_VICTORY_THRESHOLD } from '@/lib/constants';
import PlayerPanel from './PlayerPanel';
import HandView from './HandView';
import CardComp from './CardComp';
import InteractionModal from './InteractionModal';
import GameLog from './GameLog';
import AnimationLayer from './AnimationLayer';
import { AnimationEvent, AnimEventPayload, AnimPosition } from '@/lib/animationTypes';

interface Props {
  state: GameState;
  dispatch: (action: GameAction) => void;
  myPlayerIdx: number;
  afkWarningEnd?: number | null;
  onAfkWarning?: () => void;
}

function DeckIcon({ className }: { className?: string }) {
  return <img src="/icons/icon-deck.png" alt="" className={className} draggable={false} />;
}
function GraveIcon({ className }: { className?: string }) {
  return <img src="/icons/icon-grave.png" alt="" className={className} draggable={false} />;
}
function ScrollIcon({ className }: { className?: string }) {
  return <img src="/icons/icon-scroll.png" alt="" className={className} draggable={false} />;
}

// ── Card zoom overlay ──
function CardZoomOverlay({ card, actionLabel, onAction, onClose }: {
  card: CardInstance;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 gap-5"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()}>
        <CardComp card={card} size="lg" />
      </div>
      <div className="max-w-xs text-center px-2" onClick={e => e.stopPropagation()}>
        <p className="text-white/70 text-sm leading-relaxed">{card.def.effectText}</p>
      </div>
      <div className="flex gap-3 w-full max-w-xs" onClick={e => e.stopPropagation()}>
        {actionLabel && onAction && (
          <button
            onClick={() => { onAction(); onClose(); }}
            className="flex-1 py-4 rounded-xl font-bold text-white tracking-wide"
            style={{ background: 'linear-gradient(135deg, #0e7490, #0891b2)', boxShadow: '0 0 20px rgba(8,145,178,0.4)' }}
          >
            {actionLabel}
          </button>
        )}
        <button
          onClick={onClose}
          className="flex-1 py-4 rounded-xl font-semibold text-white/60"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

// ── Turn End button ──
function TurnEndButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-[76px] h-[76px] rounded-full flex flex-col items-center justify-center flex-shrink-0 transition-transform active:scale-95"
      style={{
        background: 'radial-gradient(circle at 40% 35%, #3b82f6, #1d4ed8)',
        boxShadow: '0 0 24px rgba(59,130,246,0.55), inset 0 1px 1px rgba(255,255,255,0.2)',
        border: '2px solid rgba(147,197,253,0.5)',
      }}
    >
      <span className="text-white text-[11px] font-bold leading-tight tracking-wider">ターン</span>
      <span className="text-white text-[11px] font-bold leading-tight tracking-wider">終了</span>
    </button>
  );
}

export default function GameBoard({ state, dispatch, myPlayerIdx, afkWarningEnd, onAfkWarning }: Props) {
  const [zoomedCard, setZoomedCard] = useState<CardInstance | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [afkSecondsLeft, setAfkSecondsLeft] = useState<number | null>(null);
  const [animEvents, setAnimEvents] = useState<AnimationEvent[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const animSeq = useRef(0);
  const prevStateRef = useRef<GameState>(state);
  const initialTurnShown = useRef(false);

  const n = state.players.length;
  const cur = state.currentPlayerIndex;
  const myPlayer = state.players[myPlayerIdx];
  const currentPlayer = state.players[cur];
  const isMyTurn = cur === myPlayerIdx;

  // Auto-skip skill phase — skill is triggered by portrait tap during play phase
  useEffect(() => {
    if (state.phase === 'skill' && cur === myPlayerIdx) {
      dispatch({ type: 'SKIP_SKILL' });
    }
  }, [state.phase, cur, myPlayerIdx]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const eastIdx  = n >= 3 ? (myPlayerIdx + 1) % n : -1;
  const northIdx = n === 2 ? (myPlayerIdx + 1) % n : n >= 3 ? (myPlayerIdx + 2) % n : -1;
  const westIdx  = n >= 4 ? (myPlayerIdx + 3) % n : -1;

  function playerPos(idx: number): AnimPosition {
    if (idx === myPlayerIdx) return 'south';
    if (idx === northIdx)    return 'north';
    if (idx === eastIdx)     return 'east';
    if (idx === westIdx)     return 'west';
    return 'north';
  }

  function pushAnim(ev: AnimEventPayload) {
    const id = ++animSeq.current;
    setAnimEvents(prev => [...prev, { ...ev, id } as AnimationEvent]);
  }

  // Detect state changes → fire animation events
  useEffect(() => {
    const prev = prevStateRef.current;

    // Card played
    if (state.lastPlayedCard && state.lastPlayedCard.instanceId !== prev.lastPlayedCard?.instanceId) {
      pushAnim({
        type: 'PLAY_CARD_REVEAL',
        card: state.lastPlayedCard,
        fromPosition: playerPos(state.currentPlayerIndex),
      });
    }

    // Happiness changes
    state.players.forEach((p, i) => {
      const prevHp = prev.players[i]?.happiness ?? p.happiness;
      const delta = p.happiness - prevHp;
      if (delta < 0) pushAnim({ type: 'DAMAGE', targetPosition: playerPos(i), amount: -delta });
      else if (delta > 0) pushAnim({ type: 'HEAL', targetPosition: playerPos(i), amount: delta });
    });

    // Block: defense reaction resolved and target's hp didn't drop
    const prevPending = prev.pending;
    if (prevPending?.type === 'DEFENSE_REACTION' && state.pending?.type !== 'DEFENSE_REACTION') {
      const { targetIdx } = prevPending;
      const prevHp = prev.players[targetIdx]?.happiness;
      const curHp  = state.players[targetIdx]?.happiness;
      if (prevHp !== undefined && curHp !== undefined && curHp >= prevHp) {
        pushAnim({ type: 'BLOCK', targetPosition: playerPos(targetIdx) });
      }
    }

    // Turn change
    if (state.currentPlayerIndex !== prev.currentPlayerIndex && state.phase !== 'finished') {
      pushAnim(state.currentPlayerIndex === myPlayerIdx ? { type: 'YOUR_TURN' } : { type: 'OPPONENT_TURN' });
    }

    // Win
    if (state.phase === 'finished' && prev.phase !== 'finished' && state.winner) {
      pushAnim({ type: 'WIN_MARRIAGE', playerName: state.winner.name, imakanoName: state.winner.imakano.name });
    }

    prevStateRef.current = state;
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show turn banner on first playable phase
  useEffect(() => {
    if (initialTurnShown.current) return;
    if (state.phase === 'play' || state.phase === 'skill' || state.phase === 'draw') {
      initialTurnShown.current = true;
      pushAnim(state.currentPlayerIndex === myPlayerIdx ? { type: 'YOUR_TURN' } : { type: 'OPPONENT_TURN' });
    }
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const canPlayZoomed = zoomedCard !== null
    && isMyTurn && state.phase === 'play' && !hasPending
    && !unplayableTypes.has(zoomedCard.def.type)
    && !unplayableIds.has(zoomedCard.instanceId);

  const isDefenseZoom = zoomedCard !== null
    && isDefenseTarget
    && ['defense', 'super_defense', 'ultra_defense'].includes(zoomedCard.def.effectKey);

  const canUseSkill = isMyTurn
    && myPlayer.imakano.skillKey
    && !myPlayer.skillUsedThisTurn
    && (state.phase === 'skill' || state.phase === 'play')
    && !hasPending
    && skillConditionMet(state, myPlayerIdx);

  const isSelectingTarget = state.pending?.type === 'SELECT_TARGET';

  // ── Win screen ──
  if (state.phase === 'finished' && state.winner) {
    const wImakanoId = state.players.find(p => p.id === state.winner!.id)?.imakano.id ?? 'no_girlfriend';
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6"
        style={{ background: 'linear-gradient(to bottom, #0a0010, #050008)' }}>
        <div className="w-36 h-44 rounded-2xl overflow-hidden ring-2 ring-yellow-400/70"
          style={{ boxShadow: '0 0 40px rgba(234,179,8,0.4)' }}>
          <img src={`/imakano/${wImakanoId}.png`} alt="" className="w-full h-full object-cover object-top" />
        </div>
        <div className="text-center">
          <p className="text-yellow-400/80 text-xs tracking-[0.3em] uppercase mb-2">Congratulations</p>
          <h1 className="text-4xl font-bold text-white">{state.winner.name}</h1>
          <p className="text-white/40 mt-2 text-sm">「{state.winner.imakano.name}」との結婚</p>
        </div>
        <div className="w-full max-w-sm">
          <GameLog log={state.log} maxItems={15} />
        </div>
        <button
          onClick={() => (location.href = '/')}
          className="w-full max-w-sm py-4 rounded-xl font-bold text-white tracking-wide"
          style={{ background: 'linear-gradient(135deg, #b45309, #d97706)', boxShadow: '0 0 24px rgba(217,119,6,0.4)' }}
        >
          最初に戻る
        </button>
      </div>
    );
  }

  // ── Compute overlay (defense or interaction) ──
  let overlayContent: React.ReactNode = null;

  if (zoomedCard) {
    let actionLabel: string | undefined;
    let onAction: (() => void) | undefined;
    if (canPlayZoomed) { actionLabel = 'プレイ'; onAction = () => dispatch({ type: 'PLAY_CARD', cardInstanceId: zoomedCard.instanceId }); }
    else if (isDefenseZoom) { actionLabel = '防御する'; onAction = () => dispatch({ type: 'DEFEND', cardInstanceId: zoomedCard.instanceId }); }
    overlayContent = (
      <CardZoomOverlay card={zoomedCard} actionLabel={actionLabel} onAction={onAction} onClose={() => setZoomedCard(null)} />
    );
  } else if (isDefenseTarget && state.pending?.type === 'DEFENSE_REACTION') {
    const { attackerIdx, attackCard } = state.pending;
    const defensibleCards = myPlayer.hand.filter(c => ['defense', 'super_defense', 'ultra_defense'].includes(c.def.effectKey));
    overlayContent = (
      <div className="absolute inset-0 z-40 flex flex-col justify-end"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
        <div className="m-4 rounded-2xl p-4" style={{ background: 'rgba(5,5,15,0.97)', border: '1px solid rgba(220,38,38,0.4)', boxShadow: '0 0 30px rgba(220,38,38,0.2)' }}>
          <p className="text-red-400/80 text-[10px] font-bold tracking-[0.2em] uppercase mb-3">Under Attack</p>
          <div className="flex items-center gap-4 mb-4">
            <button className="flex-shrink-0" onClick={() => setZoomedCard(attackCard)}>
              <CardComp card={attackCard} size="sm" />
            </button>
            <div>
              <p className="text-white font-semibold">{state.players[attackerIdx].name}</p>
              <p className="text-white/40 text-sm">「{attackCard.def.name}」</p>
              <p className="text-white/25 text-xs">タップで詳細</p>
            </div>
          </div>
          {defensibleCards.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2 justify-start" style={{ minHeight: 96 }}>
              {defensibleCards.map(c => (
                <button key={c.instanceId} onClick={() => setZoomedCard(c)} className="flex-shrink-0" style={{ paddingTop: 8 }}>
                  <CardComp card={c} size="sm" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-white/25 text-sm text-center py-4">防御カードなし</p>
          )}
          <button
            onClick={() => dispatch({ type: 'SKIP_DEFENSE' })}
            className="w-full py-3 rounded-xl font-semibold text-white/50 mt-2 transition-colors hover:text-white/80"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            防御しない
          </button>
        </div>
      </div>
    );
  } else if (hasPending && state.pending?.type !== 'DEFENSE_REACTION' && state.pending?.type !== 'PASS_DEVICE' && state.pending?.type !== 'SELECT_TARGET') {
    overlayContent = (
      <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
        <div className="w-full max-w-lg">
          <InteractionModal state={state} dispatch={dispatch} />
        </div>
      </div>
    );
  }

  const isHighlighted = (idx: number) => idx === cur;

  // ── Main board ──
  return (
    <div className="h-screen flex flex-col overflow-hidden relative"
      style={{ backgroundImage: 'url(/board-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>

      {/* Board dims when overlay is active */}
      <div className={`flex-1 flex flex-col min-h-0 transition-opacity duration-200 ${overlayContent ? 'opacity-50 pointer-events-none' : ''}`}>

        {/* ── North ── */}
        {northIdx >= 0 && (
          <div className={isHighlighted(northIdx) ? 'ring-1 ring-cyan-500/30' : ''}>
            <PlayerPanel
              player={state.players[northIdx]}
              variant="north"
              onAttack={isSelectingTarget ? () => dispatch({ type: 'SELECT_TARGET', targetPlayerIdx: northIdx }) : undefined}
            />
          </div>
        )}

        {/* ── Middle ── */}
        <div className="flex-1 flex min-h-0">

          {/* West */}
          {westIdx >= 0 ? (
            <div className={isHighlighted(westIdx) ? 'ring-1 ring-cyan-500/30' : ''}>
              <PlayerPanel
                player={state.players[westIdx]}
                variant="side"
                direction="west"
                onAttack={isSelectingTarget ? () => dispatch({ type: 'SELECT_TARGET', targetPlayerIdx: westIdx }) : undefined}
              />
            </div>
          ) : <div className="w-0" />}

          {/* Center field */}
          <div className="flex-1 flex flex-col items-center justify-center gap-3 relative">

            {/* Deck / trash counts */}
            <div className="absolute top-2 left-2 flex gap-1.5">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <DeckIcon className="w-4 h-4 text-white/50" />
                <span className="text-white text-xs font-bold tabular-nums">{state.deck.length}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <GraveIcon className="w-4 h-4 text-white/50" />
                <span className="text-white text-xs font-bold tabular-nums">{state.trash.length}</span>
              </div>
            </div>

            {/* Log toggle */}
            <button
              onClick={() => setShowLog(v => !v)}
              className="absolute top-2 right-2 w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <ScrollIcon className="w-4 h-4 text-white/50" />
            </button>

            {/* Field decoration + last played card (also DnD drop zone) */}
            <div
              className="relative flex items-center justify-center"
              onDragOver={e => { e.preventDefault(); if (isMyTurn && state.phase === 'play' && !hasPending) setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setIsDragOver(false);
                const instanceId = e.dataTransfer.getData('cardInstanceId');
                if (instanceId && isMyTurn && state.phase === 'play' && !hasPending) {
                  dispatch({ type: 'PLAY_CARD', cardInstanceId: instanceId });
                }
              }}
              style={{ padding: 16 }}
            >
              <img src="/field-center.png" alt="" className="absolute w-48 h-32 object-contain pointer-events-none" style={{ opacity: 0.18, mixBlendMode: 'screen' }} draggable={false} />
              {/* Drop target glow */}
              {isDragOver && (
                <div className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{ background: 'rgba(56,189,248,0.15)', border: '2px solid rgba(56,189,248,0.5)', boxShadow: '0 0 24px rgba(56,189,248,0.3)' }} />
              )}
              {state.lastPlayedCard ? (
                <button className="relative z-10" onClick={() => setZoomedCard(state.lastPlayedCard!)}>
                  <CardComp card={state.lastPlayedCard} size="md" />
                </button>
              ) : (
                <div className="relative z-10 rounded-xl flex items-center justify-center"
                  style={{ width: 120, height: 168, border: `2px dashed ${isDragOver ? 'rgba(56,189,248,0.6)' : 'rgba(255,255,255,0.1)'}` }} />
              )}
            </div>

            {/* SELECT_TARGET prompt */}
            {isSelectingTarget && (
              <div className="px-5 py-2 rounded-xl"
                style={{ background: 'rgba(127,29,29,0.7)', border: '1px solid rgba(220,38,38,0.4)' }}>
                <p className="text-red-300 text-xs font-bold tracking-wider">攻撃対象を選択</p>
              </div>
            )}

            {/* Waiting states */}
            {(state.phase === 'draw' || state.phase === 'end_turn' || state.phase === 'resolve') && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <p className="text-white/30 animate-pulse text-sm tracking-wider">処理中</p>
              </div>
            )}
            {state.phase === 'defense' && !isDefenseTarget && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="px-6 py-5 rounded-2xl text-center"
                  style={{ background: 'rgba(0,0,0,0.80)', border: '1px solid rgba(220,38,38,0.3)', boxShadow: '0 0 30px rgba(220,38,38,0.15)' }}>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                    <p className="text-red-400 text-xs font-bold tracking-[0.2em] uppercase">Waiting for Opponent</p>
                    <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  </div>
                  <p className="text-white/40 text-xs">
                    {state.pending?.type === 'DEFENSE_REACTION'
                      ? state.players[state.pending.targetIdx]?.name
                      : '相手'} が防御を選択中
                  </p>
                </div>
              </div>
            )}

            {/* Log panel */}
            {showLog && (
              <div className="absolute inset-x-2 top-12 z-30">
                <GameLog log={state.log} maxItems={8} />
              </div>
            )}
          </div>

          {/* East */}
          {eastIdx >= 0 ? (
            <div className={isHighlighted(eastIdx) ? 'ring-1 ring-cyan-500/30' : ''}>
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
        <div className={`border-t ${isHighlighted(myPlayerIdx) ? 'border-cyan-700/40' : 'border-white/5'}`}>
          <PlayerPanel
            player={myPlayer}
            isCurrent={isMyTurn}
            variant="full"
            onPortraitTap={canUseSkill ? () => dispatch({ type: 'USE_SKILL' }) : undefined}
          />

          {/* Play phase */}
          {isMyTurn && state.phase === 'play' && !hasPending && (
            <div className="relative px-4 pt-1 pb-4">
              <div style={{ paddingRight: 88 }}>
                <HandView
                  cards={myPlayer.hand}
                  onTap={setZoomedCard}
                  onDropPlay={card => {
                    if (!unplayableTypes.has(card.def.type) && !unplayableIds.has(card.instanceId)) {
                      dispatch({ type: 'PLAY_CARD', cardInstanceId: card.instanceId });
                    }
                  }}
                  unplayableTypes={unplayableTypes}
                  unplayableIds={unplayableIds}
                />
              </div>
              {/* Turn end — fixed to bottom-right, never pushed off screen */}
              <div className="absolute right-4 bottom-4">
                <TurnEndButton onClick={() => dispatch({ type: 'SKIP_PLAY' })} />
              </div>
            </div>
          )}

          {/* Not my turn */}
          {!isMyTurn && (
            <div className="relative px-4 pt-1 pb-4">
              <div style={{ paddingRight: 88 }}>
                <HandView cards={myPlayer.hand} onTap={setZoomedCard} unplayableTypes={new Set(['attack', 'defense', 'special'])} />
              </div>
              <div className="absolute right-4 bottom-4 flex flex-col items-end gap-2">
                {afkSecondsLeft !== null ? (
                  <span className="text-red-400 text-xs font-bold animate-pulse">失格まで {afkSecondsLeft}秒</span>
                ) : (
                  <button
                    onClick={onAfkWarning}
                    className="text-[11px] px-3 py-1.5 rounded-lg text-white/30 hover:text-red-400 transition-colors"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    離席警告
                  </button>
                )}
                <p className="text-white/25 text-[10px] animate-pulse">{currentPlayer.name}のターン</p>
              </div>
            </div>
          )}

          {/* Skill phase (brief, auto-skips — just show nothing) */}
          {isMyTurn && state.phase === 'skill' && (
            <div className="px-4 pb-4">
              <HandView cards={myPlayer.hand} onTap={setZoomedCard} unplayableTypes={new Set(['attack', 'defense', 'special'])} />
            </div>
          )}
        </div>
      </div>

      {/* ── Overlay ── */}
      {overlayContent}

      {/* ── Animation Layer ── */}
      <AnimationLayer
        events={animEvents}
        onDone={id => setAnimEvents(prev => prev.filter(e => e.id !== id))}
      />
    </div>
  );
}
