'use client';

import { useState, useEffect, useRef } from 'react';
import { GameState, CardInstance } from '@/lib/types';
import { GameAction, skillConditionMet } from '@/lib/gameEngine';
import { MAX_SPECIAL_PLAYS, MAX_ATTACK_PLAYS, MARRIAGE_VICTORY_THRESHOLD } from '@/lib/constants';
import HandView from './HandView';
import InteractionModal from './InteractionModal';
import GameLog from './GameLog';
import AnimationLayer from './AnimationLayer';
import { AnimationEvent, AnimEventPayload, AnimPosition, HeroineType } from '@/lib/animationTypes';
import CardComp from './CardComp';

// ── Canvas constants ──────────────────────────────────────────────────────────
const CW = 1080;
const CH = 1920;

// Safe area (top/bottom padding in canvas units)
const SAFE = 120;

// Zone layout (canvas px, from preview5)
// ① Opponent zone:  y=120,  h=402
// ② Opponent hand:  y=522,  h=350
// ③ Center band:    y=872,  h=175
// ④ My hand:        y=1047, h=350
// ⑤ My zone:        y=1397, h=402

interface Props {
  state: GameState;
  dispatch: (action: GameAction) => void;
  myPlayerIdx: number;
  afkWarningEnd?: number | null;
  onAfkWarning?: () => void;
}

// ── Happiness gauge ───────────────────────────────────────────────────────────
function HappinessGauge({ value }: { value: number }) {
  const clamped = Math.max(-10, Math.min(10, value));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {Array.from({ length: 21 }, (_, i) => {
        const v = i - 10;
        const active = clamped >= 0 ? (v >= 0 && v <= clamped) : (v <= 0 && v >= clamped);
        const isCur = v === clamped;
        let bg = 'rgba(255,255,255,0.09)';
        if (active) {
          if (v < 0)      bg = `rgba(${180 + v * 8},30,80,0.8)`;
          else if (v === 0) bg = 'rgba(200,200,200,0.65)';
          else if (v <= 5)  bg = `rgba(249,168,212,${0.6 + v * 0.06})`;
          else              bg = `rgba(250,${170 + (v - 5) * 10},50,0.8)`;
        }
        return (
          <div key={i} style={{
            width: 12, height: isCur ? 28 : 20,
            borderRadius: 3, background: bg, flexShrink: 0,
            boxShadow: isCur ? `0 0 8px ${bg}` : undefined,
            transition: 'all 0.2s',
          }} />
        );
      })}
    </div>
  );
}

function hpColor(hp: number) {
  if (hp <= -6) return '#dc2626';
  if (hp <  0)  return '#f87171';
  if (hp === 0) return '#d1d5db';
  if (hp >= 8)  return '#fde047';
  return '#f9a8d4';
}

function hpLabel(hp: number) {
  return hp >= 0 ? `+${hp}` : `${hp}`;
}

// ── Card back ─────────────────────────────────────────────────────────────────
function CardBack() {
  return (
    <div style={{
      width: 180, height: 252, borderRadius: 12, flexShrink: 0,
      background: 'linear-gradient(135deg, #180a28, #0a0518)',
      border: '2px solid rgba(255,255,255,0.1)',
    }} />
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function DeckIcon()  { return <img src="/icons/icon-deck.png"   alt="" style={{ width: 36, height: 36 }} draggable={false} />; }
function GraveIcon() { return <img src="/icons/icon-grave.png"  alt="" style={{ width: 36, height: 36 }} draggable={false} />; }
function ScrollIcon(){ return <img src="/icons/icon-scroll.png" alt="" style={{ width: 36, height: 36 }} draggable={false} />; }

// ── Main ──────────────────────────────────────────────────────────────────────
export default function GameBoard({ state, dispatch, myPlayerIdx, afkWarningEnd, onAfkWarning }: Props) {
  const [zoomedCard, setZoomedCard] = useState<CardInstance | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [afkSecondsLeft, setAfkSecondsLeft] = useState<number | null>(null);
  const [animEvents, setAnimEvents] = useState<AnimationEvent[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [boardDims, setBoardDims] = useState<{ w: number; h: number } | null>(null);
  const [modalDelay, setModalDelay] = useState(false);
  const [showStuckRecovery, setShowStuckRecovery] = useState(false);
  const animSeq = useRef(0);
  const prevStateRef = useRef<GameState>(state);
  const initialTurnShown = useRef(false);
  const prevPendingTypeRef = useRef<string | null>(null);
  const prevPhaseRef = useRef<string>(state.phase);

  useEffect(() => {
    const update = () => setBoardDims({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update); };
  }, []);

  const scale = boardDims ? Math.min(boardDims.w / CW, boardDims.h / CH) : 1;
  const offsetX = boardDims ? (boardDims.w - CW * scale) / 2 : 0;
  const offsetY = boardDims ? (boardDims.h - CH * scale) / 2 : 0;

  useEffect(() => {
    if (prevPhaseRef.current === 'defense' && state.phase !== 'defense') setZoomedCard(null);
    prevPhaseRef.current = state.phase;
  }, [state.phase]);

  useEffect(() => {
    const p = state.pending;
    if (!p) { setShowStuckRecovery(false); return; }
    const needsAction = (() => {
      if (p.type === 'DEFENSE_REACTION') return p.targetIdx === myPlayerIdx;
      if (p.type === 'DISCARD') return (state.pendingTargetIdx ?? state.currentPlayerIndex) === myPlayerIdx;
      if (['PEEK_STEAL','PEEK_TRASH','VIEW_SELECT','VIEW_SELECT_SPECIALS','UTSU_NOVEL_CHOICE'].includes(p.type))
        return state.currentPlayerIndex === myPlayerIdx;
      return false;
    })();
    if (!needsAction) { setShowStuckRecovery(false); return; }
    setShowStuckRecovery(false);
    const t = setTimeout(() => setShowStuckRecovery(true), 8000);
    return () => clearTimeout(t);
  }, [state.pending, state.currentPlayerIndex, state.pendingTargetIdx]); // eslint-disable-line

  useEffect(() => {
    const newType = state.pending?.type ?? null;
    if (newType !== prevPendingTypeRef.current) {
      prevPendingTypeRef.current = newType;
      if (newType === 'VIEW_SELECT' || newType === 'VIEW_SELECT_SPECIALS') {
        setModalDelay(true);
        const t = setTimeout(() => setModalDelay(false), 1400);
        return () => clearTimeout(t);
      }
    }
  }, [state.pending?.type]);

  const n = state.players.length;
  const cur = state.currentPlayerIndex;
  const myPlayer = state.players[myPlayerIdx];
  const isMyTurn = cur === myPlayerIdx;
  const northIdx = (myPlayerIdx + 1) % n;
  const opponentPlayer = state.players[northIdx] ?? null;

  function playerPos(idx: number): AnimPosition {
    return idx === myPlayerIdx ? 'south' : 'north';
  }

  function pushAnim(ev: AnimEventPayload) {
    const id = ++animSeq.current;
    setAnimEvents(prev => [...prev, { ...ev, id } as AnimationEvent]);
  }

  useEffect(() => {
    if (state.phase === 'skill' && cur === myPlayerIdx) dispatch({ type: 'SKIP_SKILL' });
  }, [state.phase, cur, myPlayerIdx]); // eslint-disable-line

  useEffect(() => {
    if (!afkWarningEnd) { setAfkSecondsLeft(null); return; }
    const tick = () => { const l = Math.ceil((afkWarningEnd - Date.now()) / 1000); setAfkSecondsLeft(l > 0 ? l : 0); };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [afkWarningEnd]);

  useEffect(() => {
    const prev = prevStateRef.current;
    if (state.lastPlayedCard && state.lastPlayedCard.instanceId !== prev.lastPlayedCard?.instanceId) {
      pushAnim({ type: 'PLAY_CARD_REVEAL', card: state.lastPlayedCard, fromPosition: playerPos(state.currentPlayerIndex) });
    }
    state.players.forEach((p, i) => {
      const prevHp = prev.players[i]?.happiness ?? p.happiness;
      const delta = p.happiness - prevHp;
      if (delta < 0) { pushAnim({ type: 'DAMAGE', targetPosition: playerPos(i), amount: -delta }); if (-delta >= 2) pushAnim({ type: 'DAMAGE_FLASH' }); }
      else if (delta > 0) pushAnim({ type: 'HEAL', targetPosition: playerPos(i), amount: delta });
    });
    const prevPending = prev.pending;
    if (prevPending?.type === 'DEFENSE_REACTION' && state.pending?.type !== 'DEFENSE_REACTION') {
      const { targetIdx } = prevPending;
      const prevHp = prev.players[targetIdx]?.happiness;
      const curHp  = state.players[targetIdx]?.happiness;
      if (prevHp !== undefined && curHp !== undefined && curHp >= prevHp) pushAnim({ type: 'BLOCK', targetPosition: playerPos(targetIdx) });
    }
    if (state.currentPlayerIndex !== prev.currentPlayerIndex && state.phase !== 'finished') {
      pushAnim(state.currentPlayerIndex === myPlayerIdx ? { type: 'YOUR_TURN' } : { type: 'OPPONENT_TURN' });
    }
    if (state.phase === 'finished' && prev.phase !== 'finished' && state.winner) {
      pushAnim({ type: 'WIN_MARRIAGE', playerName: state.winner.name, imakanoName: state.winner.imakano.name });
    }
    prevStateRef.current = state;
  }, [state]); // eslint-disable-line

  useEffect(() => {
    if (initialTurnShown.current) return;
    if (state.phase === 'play' || state.phase === 'skill' || state.phase === 'draw') {
      initialTurnShown.current = true;
      pushAnim(state.currentPlayerIndex === myPlayerIdx ? { type: 'YOUR_TURN' } : { type: 'OPPONENT_TURN' });
    }
  }, [state.phase]); // eslint-disable-line

  const hasPending = state.pending !== null;
  const isDefenseTarget = state.phase === 'defense' && state.pending?.type === 'DEFENSE_REACTION' && state.pending.targetIdx === myPlayerIdx;

  const unplayableTypes = new Set<string>(['defense']);
  if (state.specialPlaysThisTurn >= MAX_SPECIAL_PLAYS) unplayableTypes.add('special');
  if (state.attackPlaysThisTurn >= MAX_ATTACK_PLAYS || state.turnNumber === 1) unplayableTypes.add('attack');

  const unplayableIds = new Set<string>();
  myPlayer.hand.forEach(c => {
    if (c.def.effectKey === 'marriage' && myPlayer.happiness < MARRIAGE_VICTORY_THRESHOLD) unplayableIds.add(c.instanceId);
    if (c.def.effectKey === 'father' && myPlayer.happiness < 7) unplayableIds.add(c.instanceId);
  });

  function forceResolve() {
    const p = state.pending; if (!p) return;
    setShowStuckRecovery(false);
    switch (p.type) {
      case 'DEFENSE_REACTION':       dispatch({ type: 'SKIP_DEFENSE' }); break;
      case 'DISCARD':                dispatch({ type: 'RESOLVE_DISCARD', discardedIds: [] }); break;
      case 'PEEK_STEAL':             dispatch({ type: 'RESOLVE_PEEK_STEAL', stolenIds: [] }); break;
      case 'PEEK_TRASH':             dispatch({ type: 'RESOLVE_PEEK_TRASH', trashedId: null }); break;
      case 'VIEW_SELECT':            dispatch({ type: 'RESOLVE_VIEW_SELECT', keptIds: [] }); break;
      case 'VIEW_SELECT_SPECIALS':   dispatch({ type: 'RESOLVE_VIEW_SELECT_SPECIALS', keptIds: [] }); break;
      case 'UTSU_NOVEL_CHOICE':      dispatch({ type: 'RESOLVE_UTSU_NOVEL', returnToHand: false }); break;
    }
  }

  const canUseSkill = !!(isMyTurn && myPlayer.imakano.skillKey && !myPlayer.skillUsedThisTurn
    && (state.phase === 'skill' || state.phase === 'play') && !hasPending && skillConditionMet(state, myPlayerIdx));

  const canPlayZoomed = zoomedCard !== null && isMyTurn && state.phase === 'play' && !hasPending
    && !unplayableTypes.has(zoomedCard.def.type) && !unplayableIds.has(zoomedCard.instanceId);
  const isDefenseZoom = zoomedCard !== null && isDefenseTarget && zoomedCard.def.effectKey === 'defense';

  const handUnplayableIds: Set<string> = isDefenseTarget
    ? new Set(myPlayer.hand.filter(c => c.def.effectKey !== 'defense').map(c => c.instanceId))
    : unplayableIds;
  const handUnplayableTypes: Set<string> = isDefenseTarget
    ? new Set(['attack', 'special'])
    : (!isMyTurn || state.phase !== 'play' || hasPending)
      ? new Set(['attack', 'defense', 'special'])
      : unplayableTypes;

  const myHpColor  = hpColor(myPlayer.happiness);
  const oppHpColor = opponentPlayer ? hpColor(opponentPlayer.happiness) : '#f9a8d4';

  const showInteractionModal = hasPending && !modalDelay
    && state.pending?.type !== 'DEFENSE_REACTION'
    && state.pending?.type !== 'PASS_DEVICE'
    && state.pending?.type !== 'SELECT_TARGET';
  const highPriorityModal = showInteractionModal && (
    state.pending?.type === 'DISCARD' || state.pending?.type === 'PEEK_STEAL' || state.pending?.type === 'PEEK_TRASH'
  );

  // ── Win screen ──
  if (state.phase === 'finished' && state.winner) {
    const wId = state.players.find(p => p.id === state.winner!.id)?.imakano.id ?? 'no_girlfriend';
    return (
      <div style={{ width: '100vw', height: boardDims ? `${boardDims.h}px` : '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, padding: 48, background: 'linear-gradient(to bottom,#0a0010,#050008)' }}>
        <div style={{ width: 200, height: 250, borderRadius: 16, overflow: 'hidden', boxShadow: '0 0 40px rgba(234,179,8,0.5)', border: '2px solid rgba(234,179,8,0.6)' }}>
          <img src={`/imakano/${wId}.png`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'rgba(234,179,8,0.7)', fontSize: 13, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 8 }}>Congratulations</p>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: 'white' }}>{state.winner.name}</h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: 8, fontSize: 14 }}>「{state.winner.imakano.name}」との結婚</p>
        </div>
        <button onClick={() => (location.href = '/')} style={{ width: 280, padding: '16px 0', borderRadius: 14, fontWeight: 700, color: 'white', fontSize: 16, background: 'linear-gradient(135deg,#b45309,#d97706)', boxShadow: '0 0 24px rgba(217,119,6,0.4)' }}>
          最初に戻る
        </button>
      </div>
    );
  }

  // ── Overlay ──
  let overlayContent: React.ReactNode = null;
  if (highPriorityModal) {
    overlayContent = (
      <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
        <div style={{ width: '100%', maxWidth: 800 }}><InteractionModal state={state} dispatch={dispatch} /></div>
      </div>
    );
  } else if (zoomedCard) {
    let actionLabel: string | undefined;
    let onAction: (() => void) | undefined;
    if (canPlayZoomed) { actionLabel = 'プレイ'; onAction = () => dispatch({ type: 'PLAY_CARD', cardInstanceId: zoomedCard.instanceId }); }
    else if (isDefenseZoom) { actionLabel = '防御する'; onAction = () => dispatch({ type: 'DEFEND', cardInstanceId: zoomedCard.instanceId }); }
    overlayContent = (
      <div style={{ position: 'absolute', inset: 0, zIndex: 90, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, padding: 48, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }} onClick={() => setZoomedCard(null)}>
        <div onClick={e => e.stopPropagation()} style={{ width: 330, height: 462, borderRadius: 16, overflow: 'hidden', boxShadow: '0 0 40px rgba(0,0,0,0.8)' }}>
          <img src={`/cards/${zoomedCard.def.id}.png`} alt={zoomedCard.def.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
        </div>
        <div style={{ maxWidth: 600, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 28, lineHeight: 1.5 }}>{zoomedCard.def.effectText}</p>
        </div>
        <div style={{ display: 'flex', gap: 24, width: '100%', maxWidth: 600 }} onClick={e => e.stopPropagation()}>
          {actionLabel && onAction && (
            <button onClick={() => { onAction!(); setZoomedCard(null); }} style={{ flex: 1, padding: '28px 0', borderRadius: 20, fontWeight: 700, color: 'white', fontSize: 28, background: 'linear-gradient(135deg,#0e7490,#0891b2)', boxShadow: '0 0 40px rgba(8,145,178,0.4)' }}>{actionLabel}</button>
          )}
          <button onClick={() => setZoomedCard(null)} style={{ flex: 1, padding: '28px 0', borderRadius: 20, fontWeight: 600, color: 'rgba(255,255,255,0.5)', fontSize: 28, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>閉じる</button>
        </div>
      </div>
    );
  } else if (showInteractionModal) {
    overlayContent = (
      <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
        <div style={{ width: '100%', maxWidth: 800 }}><InteractionModal state={state} dispatch={dispatch} /></div>
      </div>
    );
  }

  // ── Render ──
  return (
    <div style={{ width: boardDims ? boardDims.w : '100vw', height: boardDims ? boardDims.h : '100dvh', overflow: 'hidden', position: 'relative', background: '#08080f' }}>
      <div style={{
        position: 'absolute',
        left: offsetX, top: offsetY,
        width: CW, height: CH,
        transformOrigin: 'top left',
        transform: `scale(${scale})`,
        backgroundImage: 'url(/board-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>

        {/* ════════════ ① 相手ゾーン  y=120 h=402 ════════════ */}
        <div style={{ position: 'absolute', left: 0, top: SAFE, width: CW, height: 402, background: 'linear-gradient(to bottom,rgba(0,0,0,0.85),rgba(0,0,0,0.45))', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>

          {/* ポートレート（中央 x=440） */}
          {opponentPlayer && (
            <div style={{ position: 'absolute', left: 440, top: 10, width: 200, height: 380, borderRadius: 16, overflow: 'hidden' }}>
              <img src={`/frames/${opponentPlayer.imakano.id}.png`} alt="" draggable={false}
                style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 2px 16px rgba(0,0,0,0.8))' }} />
            </div>
          )}

          {/* 名前・HP・ゲージ（左） */}
          {opponentPlayer && (
            <div style={{ position: 'absolute', left: 28, top: 28, width: 390 }}>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 40, fontWeight: 700, lineHeight: 1 }}>{opponentPlayer.name}</p>
              <p style={{ color: 'rgba(249,168,212,0.55)', fontSize: 26, marginTop: 6 }}>{opponentPlayer.imakano.name}</p>
              <div style={{ marginTop: 20, display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ color: oppHpColor, fontSize: 100, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums', textShadow: `0 0 24px ${oppHpColor}80` }}>{hpLabel(opponentPlayer.happiness)}</span>
                <span style={{ color: oppHpColor, fontSize: 50 }}>♥</span>
              </div>
              <div style={{ marginTop: 18 }}><HappinessGauge value={opponentPlayer.happiness} /></div>
            </div>
          )}

          {/* ログボタン（右） */}
          <button onClick={() => setShowLog(v => !v)} style={{
            position: 'absolute', right: 28, top: 28, width: 96, height: 96,
            borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: showLog ? 'rgba(56,189,248,0.15)' : 'rgba(20,20,40,0.7)',
            border: `1px solid ${showLog ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.1)'}`,
          }}>
            <ScrollIcon />
          </button>
        </div>

        {/* ════════════ ② 相手手札（裏面）  y=522 h=350 ════════════ */}
        <div style={{ position: 'absolute', left: 0, top: 522, width: CW, height: 350, background: 'rgba(0,0,0,0.22)', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '0 28px' }}>
          {opponentPlayer && opponentPlayer.hand.map((_, i) => <CardBack key={i} />)}
        </div>

        {/* ════════════ ③ 中央帯  y=872 h=175 ════════════ */}
        <div style={{ position: 'absolute', left: 0, top: 872, width: CW, height: 175, borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 32px', gap: 20, background: isDefenseTarget ? 'rgba(220,38,38,0.08)' : 'transparent' }}>
          {isDefenseTarget && state.pending?.type === 'DEFENSE_REACTION' ? (
            /* 防御モード：攻撃情報 + 防御しないボタン */
            <>
              <span style={{ fontSize: 56, flexShrink: 0 }}>⚔️</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#fca5a5', fontSize: 32, fontWeight: 700, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {state.players[state.pending.attackerIdx].name}「{state.pending.attackCard.def.name}」
                </p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 24, marginTop: 6 }}>防御カードをタップ</p>
              </div>
              <button
                onClick={() => dispatch({ type: 'SKIP_DEFENSE' })}
                style={{ flexShrink: 0, padding: '20px 32px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)', fontSize: 28, fontWeight: 600 }}
              >
                防御しない
              </button>
            </>
          ) : (
            /* 通常モード */
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(20,20,40,0.75)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '16px 24px' }}>
                <DeckIcon /><span style={{ color: 'white', fontSize: 36, fontWeight: 800 }}>{state.deck.length}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(20,20,40,0.75)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '16px 24px' }}>
                <GraveIcon /><span style={{ color: 'white', fontSize: 36, fontWeight: 800 }}>{state.trash.length}</span>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 28, letterSpacing: '0.15em' }}>
                  {state.phase === 'defense' ? '防御選択中…' : isMyTurn ? '自分のターン' : '相手のターン'}
                </p>
              </div>
            </>
          )}
        </div>

        {/* ════════════ ④ 自分手札  y=1047 h=350 ════════════ */}
        <div
          style={{ position: 'absolute', left: 0, top: 1047, width: CW, height: 350, background: 'rgba(0,0,0,0.22)', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', padding: '0 28px', zIndex: 5 }}
          onDragOver={e => { e.preventDefault(); if (isMyTurn && state.phase === 'play' && !hasPending) setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={e => {
            e.preventDefault(); setIsDragOver(false);
            const id = e.dataTransfer.getData('cardInstanceId');
            if (id && isMyTurn && state.phase === 'play' && !hasPending) dispatch({ type: 'PLAY_CARD', cardInstanceId: id });
          }}
        >
          {isDragOver && <div style={{ position: 'absolute', inset: 0, background: 'rgba(56,189,248,0.07)', border: '2px solid rgba(56,189,248,0.35)', pointerEvents: 'none' }} />}

          <HandView
              cards={myPlayer.hand}
              onTap={setZoomedCard}
              onDropPlay={isMyTurn && state.phase === 'play' && !hasPending ? card => {
                if (!unplayableTypes.has(card.def.type) && !unplayableIds.has(card.instanceId))
                  dispatch({ type: 'PLAY_CARD', cardInstanceId: card.instanceId });
              } : undefined}
              unplayableTypes={handUnplayableTypes}
              unplayableIds={handUnplayableIds}
              size="xl"
            />
        </div>

        {/* ════════════ ⑤ 自分ゾーン  y=1397 h=402 ════════════ */}
        <div style={{ position: 'absolute', left: 0, top: 1397, width: CW, height: 402, background: isMyTurn ? 'linear-gradient(to top,rgba(8,40,60,0.75),rgba(8,40,60,0.4))' : 'linear-gradient(to top,rgba(0,0,0,0.75),rgba(0,0,0,0.4))', borderTop: '1px solid rgba(255,255,255,0.06)' }}>

          {/* ポートレート（中央 x=440） */}
          <div style={{ position: 'absolute', left: 440, top: 10, width: 200, height: 380, borderRadius: 16, overflow: 'hidden', zIndex: 3 }}>
            <button
              onClick={canUseSkill ? () => pushAnim({ type: 'SKILL_CUTIN', heroineType: myPlayer.imakano.id as HeroineType, heroineName: myPlayer.imakano.name, skillName: myPlayer.imakano.skillName ?? 'スキル', onActivate: () => dispatch({ type: 'USE_SKILL' }) }) : undefined}
              disabled={!canUseSkill}
              style={{ width: '100%', height: '100%', background: 'none', border: 'none', padding: 0, cursor: canUseSkill ? 'pointer' : 'default', position: 'relative' }}
            >
              <img src={`/frames/${myPlayer.imakano.id}.png`} alt="" draggable={false}
                style={{ width: '100%', height: '100%', objectFit: 'contain', filter: canUseSkill ? 'drop-shadow(0 0 20px rgba(250,200,50,0.9)) brightness(1.08)' : 'drop-shadow(0 2px 16px rgba(0,0,0,0.8))', transition: 'filter 0.3s' }} />
              {canUseSkill && <div style={{ position: 'absolute', inset: 0, borderRadius: 16, boxShadow: '0 0 0 3px rgba(250,200,50,0.7), 0 0 32px rgba(250,200,50,0.4)', pointerEvents: 'none' }} />}
            </button>
          </div>

          {/* 名前・HP・ゲージ（左） */}
          <div style={{ position: 'absolute', left: 28, top: 28, width: 390 }}>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 40, fontWeight: 700, lineHeight: 1 }}>{myPlayer.name}</p>
            <p style={{ color: 'rgba(249,168,212,0.55)', fontSize: 26, marginTop: 6 }}>{myPlayer.imakano.name}</p>
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ color: myHpColor, fontSize: 100, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums', textShadow: `0 0 24px ${myHpColor}80` }}>{hpLabel(myPlayer.happiness)}</span>
              <img src="/icons/icon-heart.png" alt="♥" style={{ width: 50, height: 50 }} draggable={false} />
            </div>
            <div style={{ marginTop: 18 }}><HappinessGauge value={myPlayer.happiness} /></div>
            {myPlayer.happiness >= MARRIAGE_VICTORY_THRESHOLD && (
              <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', padding: '6px 16px', borderRadius: 8, background: 'rgba(250,200,50,0.12)', border: '1px solid rgba(250,200,50,0.4)' }}>
                <span style={{ color: 'rgba(250,200,50,0.9)', fontSize: 22, fontWeight: 700 }}>婚姻届使用可能</span>
              </div>
            )}
          </div>

          {/* スキル + ターン終了（右） */}
          <div style={{ position: 'absolute', right: 28, top: 14, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-end' }}>
            {/* スキルボタン */}
            <button
              onClick={canUseSkill ? () => pushAnim({ type: 'SKILL_CUTIN', heroineType: myPlayer.imakano.id as HeroineType, heroineName: myPlayer.imakano.name, skillName: myPlayer.imakano.skillName ?? 'スキル', onActivate: () => dispatch({ type: 'USE_SKILL' }) }) : undefined}
              disabled={!canUseSkill}
              style={{
                width: 180, height: 180, borderRadius: '50%',
                background: canUseSkill ? 'rgba(250,200,50,0.1)' : 'rgba(40,40,40,0.6)',
                border: canUseSkill ? '3px solid rgba(250,200,50,0.6)' : '2px solid rgba(255,255,255,0.08)',
                boxShadow: canUseSkill ? '0 0 36px rgba(250,200,50,0.25)' : 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: canUseSkill ? 'pointer' : 'default',
              }}
            >
              <span style={{ color: canUseSkill ? 'rgba(250,200,50,0.9)' : 'rgba(255,255,255,0.2)', fontSize: 28, fontWeight: 700, lineHeight: 1.4 }}>スキル</span>
              <span style={{ color: canUseSkill ? 'rgba(250,200,50,0.65)' : 'rgba(255,255,255,0.1)', fontSize: 22, lineHeight: 1.3 }}>
                {myPlayer.skillUsedThisTurn ? '使用済' : myPlayer.imakano.skillKey ? '1/1' : '—'}
              </span>
            </button>

            {/* ターン終了 */}
            {isMyTurn && state.phase === 'play' && !hasPending && (
              <button onClick={() => dispatch({ type: 'SKIP_PLAY' })} style={{
                width: 180, height: 180, borderRadius: '50%',
                background: 'radial-gradient(circle at 40% 35%,#3b82f6,#1d4ed8)',
                border: '3px solid rgba(147,197,253,0.5)',
                boxShadow: '0 0 36px rgba(59,130,246,0.45)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: 'white', fontSize: 28, fontWeight: 700, lineHeight: 1.5 }}>ターン</span>
                <span style={{ color: 'white', fontSize: 28, fontWeight: 700, lineHeight: 1.5 }}>終了</span>
              </button>
            )}

            {/* 離席警告（自分のターンでない時） */}
            {!isMyTurn && (
              afkSecondsLeft !== null
                ? <span style={{ color: '#f87171', fontSize: 24, fontWeight: 700 }} className="animate-pulse">失格まで {afkSecondsLeft}秒</span>
                : <button onClick={onAfkWarning} style={{ padding: '12px 20px', borderRadius: 12, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 22 }}>離席警告</button>
            )}
          </div>
        </div>

        {/* ── ログパネル ── */}
        {showLog && (
          <div style={{ position: 'absolute', top: SAFE, left: 0, right: 0, zIndex: 30, padding: '8px 24px' }}>
            <GameLog log={state.log} maxItems={6} />
          </div>
        )}

        {/* ── Overlays ── */}
        {overlayContent}

        {/* ── Animation layer ── */}
        <AnimationLayer events={animEvents} onDone={id => setAnimEvents(prev => prev.filter(e => e.id !== id))} />

        {/* ── Stuck recovery ── */}
        {showStuckRecovery && (
          <div style={{ position: 'absolute', right: 24, bottom: 160, zIndex: 60 }}>
            <div style={{ background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(251,146,60,0.5)', borderRadius: 16, padding: '16px 24px', boxShadow: '0 0 24px rgba(251,146,60,0.2)' }}>
              <p style={{ color: 'rgba(251,146,60,0.85)', fontSize: 22, fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>処理が止まっています</p>
              <button onClick={forceResolve} style={{ display: 'block', width: '100%', padding: '12px 28px', borderRadius: 10, background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.4)', color: 'rgba(251,146,60,0.9)', fontSize: 22, fontWeight: 700 }}>
                スキップして続ける
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
