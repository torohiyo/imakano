'use client';

import { useState, useEffect, useRef } from 'react';
import { GameState, CardInstance } from '@/lib/types';
import { GameAction, skillConditionMet } from '@/lib/gameEngine';
import { MAX_SPECIAL_PLAYS, MAX_ATTACK_PLAYS, MARRIAGE_VICTORY_THRESHOLD } from '@/lib/constants';
import HandView from './HandView';
import CardComp from './CardComp';
import InteractionModal from './InteractionModal';
import GameLog from './GameLog';
import AnimationLayer from './AnimationLayer';
import { AnimationEvent, AnimEventPayload, AnimPosition, HeroineType } from '@/lib/animationTypes';

interface Props {
  state: GameState;
  dispatch: (action: GameAction) => void;
  myPlayerIdx: number;
  afkWarningEnd?: number | null;
  onAfkWarning?: () => void;
}

// ── Canvas constants ──────────────────────────────────────────────────────────
const CW = 1080;
const CH = 1920;

// ── Happiness gauge ───────────────────────────────────────────────────────────
function HappinessGauge({ value, w = 336 }: { value: number; w?: number }) {
  const clamped = Math.max(-10, Math.min(10, value));
  return (
    <div style={{ width: w, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 4 }}>
      {Array.from({ length: 21 }, (_, i) => {
        const slotVal = i - 10;
        let active = false;
        if (clamped >= 0) active = slotVal >= 0 && slotVal <= clamped;
        else active = slotVal <= 0 && slotVal >= clamped;
        const isCurrent = slotVal === clamped;

        let bg: string;
        if (!active) {
          bg = 'rgba(255,255,255,0.08)';
        } else if (slotVal < 0) {
          bg = `rgba(${180 + slotVal * 8},30,80,${0.7 + Math.abs(slotVal) * 0.025})`;
        } else if (slotVal === 0) {
          bg = 'rgba(220,220,220,0.6)';
        } else if (slotVal <= 5) {
          bg = `rgba(249,168,212,${0.6 + slotVal * 0.06})`;
        } else {
          bg = `rgba(250,${170 + (slotVal - 5) * 10},50,${0.75 + (slotVal - 5) * 0.04})`;
        }

        return (
          <div
            key={i}
            style={{
              width: 12, height: isCurrent ? 28 : 20,
              borderRadius: 3,
              background: bg,
              boxShadow: isCurrent ? `0 0 8px ${bg}` : undefined,
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
          />
        );
      })}
    </div>
  );
}

// ── HP number color ───────────────────────────────────────────────────────────
function hpColor(hp: number): string {
  if (hp <= -6) return '#dc2626';
  if (hp < 0)   return '#f87171';
  if (hp === 0) return '#d1d5db';
  if (hp >= 8)  return '#fde047';
  return '#f9a8d4';
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function DeckIcon() {
  return <img src="/icons/icon-deck.png" alt="" style={{ width: 28, height: 28 }} draggable={false} />;
}
function GraveIcon() {
  return <img src="/icons/icon-grave.png" alt="" style={{ width: 28, height: 28 }} draggable={false} />;
}
function ScrollIcon() {
  return <img src="/icons/icon-scroll.png" alt="" style={{ width: 28, height: 28 }} draggable={false} />;
}

// ── Card zoom overlay ─────────────────────────────────────────────────────────
function CardZoomOverlay({ card, actionLabel, onAction, onClose }: {
  card: CardInstance;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 90,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 32, padding: 48,
        background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: 330, height: 462, borderRadius: 16, overflow: 'hidden', boxShadow: '0 0 40px rgba(0,0,0,0.8)' }}>
        <img src={`/cards/${card.def.id}.png`} alt={card.def.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
      </div>
      <div style={{ maxWidth: 600, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 28, lineHeight: 1.5 }}>{card.def.effectText}</p>
      </div>
      <div style={{ display: 'flex', gap: 24, width: '100%', maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        {actionLabel && onAction && (
          <button
            onClick={() => { onAction(); onClose(); }}
            style={{
              flex: 1, padding: '28px 0', borderRadius: 20,
              fontWeight: 700, color: 'white', letterSpacing: '0.05em', fontSize: 28,
              background: 'linear-gradient(135deg, #0e7490, #0891b2)',
              boxShadow: '0 0 40px rgba(8,145,178,0.4)',
            }}
          >
            {actionLabel}
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            flex: 1, padding: '28px 0', borderRadius: 20,
            fontWeight: 600, color: 'rgba(255,255,255,0.5)', fontSize: 28,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
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
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  // Scale canvas to fit screen (letterbox)
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
      if (['PEEK_STEAL', 'PEEK_TRASH', 'VIEW_SELECT', 'VIEW_SELECT_SPECIALS', 'UTSU_NOVEL_CHOICE'].includes(p.type))
        return state.currentPlayerIndex === myPlayerIdx;
      return false;
    })();
    if (!needsAction) { setShowStuckRecovery(false); return; }
    setShowStuckRecovery(false);
    const t = setTimeout(() => setShowStuckRecovery(true), 8000);
    return () => clearTimeout(t);
  }, [state.pending, state.currentPlayerIndex, state.pendingTargetIdx]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (idx === myPlayerIdx) return 'south';
    return 'north';
  }

  function pushAnim(ev: AnimEventPayload) {
    const id = ++animSeq.current;
    setAnimEvents(prev => [...prev, { ...ev, id } as AnimationEvent]);
  }

  useEffect(() => {
    if (state.phase === 'skill' && cur === myPlayerIdx) dispatch({ type: 'SKIP_SKILL' });
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

  useEffect(() => {
    const prev = prevStateRef.current;
    if (state.lastPlayedCard && state.lastPlayedCard.instanceId !== prev.lastPlayedCard?.instanceId) {
      pushAnim({ type: 'PLAY_CARD_REVEAL', card: state.lastPlayedCard, fromPosition: playerPos(state.currentPlayerIndex) });
    }
    state.players.forEach((p, i) => {
      const prevHp = prev.players[i]?.happiness ?? p.happiness;
      const delta = p.happiness - prevHp;
      if (delta < 0) {
        pushAnim({ type: 'DAMAGE', targetPosition: playerPos(i), amount: -delta });
        if (-delta >= 2) pushAnim({ type: 'DAMAGE_FLASH' });
      } else if (delta > 0) {
        pushAnim({ type: 'HEAL', targetPosition: playerPos(i), amount: delta });
      }
    });
    const prevPending = prev.pending;
    if (prevPending?.type === 'DEFENSE_REACTION' && state.pending?.type !== 'DEFENSE_REACTION') {
      const { targetIdx } = prevPending;
      const prevHp = prev.players[targetIdx]?.happiness;
      const curHp  = state.players[targetIdx]?.happiness;
      if (prevHp !== undefined && curHp !== undefined && curHp >= prevHp) {
        pushAnim({ type: 'BLOCK', targetPosition: playerPos(targetIdx) });
      }
    }
    if (state.currentPlayerIndex !== prev.currentPlayerIndex && state.phase !== 'finished') {
      pushAnim(state.currentPlayerIndex === myPlayerIdx ? { type: 'YOUR_TURN' } : { type: 'OPPONENT_TURN' });
    }
    if (state.phase === 'finished' && prev.phase !== 'finished' && state.winner) {
      pushAnim({ type: 'WIN_MARRIAGE', playerName: state.winner.name, imakanoName: state.winner.imakano.name });
    }
    prevStateRef.current = state;
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (c.def.effectKey === 'marriage' && myPlayer.happiness < MARRIAGE_VICTORY_THRESHOLD) unplayableIds.add(c.instanceId);
    if (c.def.effectKey === 'father' && myPlayer.happiness < 7) unplayableIds.add(c.instanceId);
  });

  function forceResolve() {
    const p = state.pending;
    if (!p) return;
    setShowStuckRecovery(false);
    switch (p.type) {
      case 'DEFENSE_REACTION': dispatch({ type: 'SKIP_DEFENSE' }); break;
      case 'DISCARD': dispatch({ type: 'RESOLVE_DISCARD', discardedIds: [] }); break;
      case 'PEEK_STEAL': dispatch({ type: 'RESOLVE_PEEK_STEAL', stolenIds: [] }); break;
      case 'PEEK_TRASH': dispatch({ type: 'RESOLVE_PEEK_TRASH', trashedId: null }); break;
      case 'VIEW_SELECT': dispatch({ type: 'RESOLVE_VIEW_SELECT', keptIds: [] }); break;
      case 'VIEW_SELECT_SPECIALS': dispatch({ type: 'RESOLVE_VIEW_SELECT_SPECIALS', keptIds: [] }); break;
      case 'UTSU_NOVEL_CHOICE': dispatch({ type: 'RESOLVE_UTSU_NOVEL', returnToHand: false }); break;
    }
  }

  const canUseSkill = !!(isMyTurn
    && myPlayer.imakano.skillKey
    && !myPlayer.skillUsedThisTurn
    && (state.phase === 'skill' || state.phase === 'play')
    && !hasPending
    && skillConditionMet(state, myPlayerIdx));

  const canPlayZoomed = zoomedCard !== null
    && isMyTurn && state.phase === 'play' && !hasPending
    && !unplayableTypes.has(zoomedCard.def.type)
    && !unplayableIds.has(zoomedCard.instanceId);
  const isDefenseZoom = zoomedCard !== null
    && isDefenseTarget
    && zoomedCard.def.effectKey === 'defense';

  const handUnplayableIds: Set<string> = isDefenseTarget
    ? new Set(myPlayer.hand.filter(c => c.def.effectKey !== 'defense').map(c => c.instanceId))
    : unplayableIds;
  const handUnplayableTypes: Set<string> = isDefenseTarget
    ? new Set(['attack', 'special'])
    : (!isMyTurn || state.phase !== 'play' || hasPending)
      ? new Set(['attack', 'defense', 'special'])
      : unplayableTypes;

  const myHpColor = hpColor(myPlayer.happiness);
  const oppHpColor = opponentPlayer ? hpColor(opponentPlayer.happiness) : '#f9a8d4';

  const showInteractionModal =
    hasPending && !modalDelay &&
    state.pending?.type !== 'DEFENSE_REACTION' &&
    state.pending?.type !== 'PASS_DEVICE' &&
    state.pending?.type !== 'SELECT_TARGET';

  const highPriorityModal = showInteractionModal && (
    state.pending?.type === 'DISCARD' ||
    state.pending?.type === 'PEEK_STEAL' ||
    state.pending?.type === 'PEEK_TRASH'
  );

  // ── Win screen ──
  if (state.phase === 'finished' && state.winner) {
    const wImakanoId = state.players.find(p => p.id === state.winner!.id)?.imakano.id ?? 'no_girlfriend';
    return (
      <div style={{
        width: '100vw', height: boardDims ? `${boardDims.h}px` : '100dvh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 32,
        padding: 48, boxSizing: 'border-box',
        background: 'linear-gradient(to bottom, #0a0010, #050008)',
      }}>
        <div style={{
          width: 200, height: 250, borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 0 40px rgba(234,179,8,0.5)',
          border: '2px solid rgba(234,179,8,0.6)',
        }}>
          <img src={`/imakano/${wImakanoId}.png`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'rgba(234,179,8,0.7)', fontSize: 13, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 8 }}>Congratulations</p>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: 'white', lineHeight: 1.2 }}>{state.winner.name}</h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: 8, fontSize: 14 }}>「{state.winner.imakano.name}」との結婚</p>
        </div>
        <button
          onClick={() => (location.href = '/')}
          style={{
            width: 280, padding: '16px 0', borderRadius: 14,
            fontWeight: 700, color: 'white', fontSize: 16,
            background: 'linear-gradient(135deg, #b45309, #d97706)',
            boxShadow: '0 0 24px rgba(217,119,6,0.4)',
          }}
        >
          最初に戻る
        </button>
      </div>
    );
  }

  // ── Overlay content ──
  let overlayContent: React.ReactNode = null;
  if (highPriorityModal) {
    overlayContent = (
      <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
        <div style={{ width: '100%', maxWidth: 800 }}>
          <InteractionModal state={state} dispatch={dispatch} />
        </div>
      </div>
    );
  } else if (zoomedCard) {
    let actionLabel: string | undefined;
    let onAction: (() => void) | undefined;
    if (canPlayZoomed) { actionLabel = 'プレイ'; onAction = () => dispatch({ type: 'PLAY_CARD', cardInstanceId: zoomedCard.instanceId }); }
    else if (isDefenseZoom) { actionLabel = '防御する'; onAction = () => dispatch({ type: 'DEFEND', cardInstanceId: zoomedCard.instanceId }); }
    overlayContent = <CardZoomOverlay card={zoomedCard} actionLabel={actionLabel} onAction={onAction} onClose={() => setZoomedCard(null)} />;
  } else if (showInteractionModal) {
    overlayContent = (
      <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
        <div style={{ width: '100%', maxWidth: 800 }}>
          <InteractionModal state={state} dispatch={dispatch} />
        </div>
      </div>
    );
  }

  // ── Helpers for absolute positions inside 1080×1920 canvas ──
  function abs(x: number, y: number, w: number, h: number, extra?: React.CSSProperties): React.CSSProperties {
    return { position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box', ...extra };
  }

  return (
    <div style={{
      width: boardDims ? boardDims.w : '100vw',
      height: boardDims ? boardDims.h : '100dvh',
      overflow: 'hidden',
      position: 'relative',
      background: '#08080f',
    }}>
      {/* ── Scaled 1080×1920 canvas ── */}
      <div style={{
        position: 'absolute',
        left: offsetX,
        top: offsetY,
        width: CW,
        height: CH,
        transformOrigin: 'top left',
        transform: `scale(${scale})`,
        backgroundImage: 'url(/board-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>

        {/* ════════════════════════════════════════════════
            ZONE 1: 上部HUD（相手情報）y=24 h=256
            ════════════════════════════════════════════════ */}
        <div style={abs(0, 0, CW, 280, {
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.82), rgba(0,0,0,0.4))',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        })}>
          {/* 山札 */}
          <div style={abs(24, 40, 132, 132, {
            background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
          })}>
            <DeckIcon />
            <span style={{ color: 'white', fontSize: 28, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{state.deck.length}</span>
          </div>

          {/* 捨て札 */}
          <div style={abs(24, 188, 132, 80, {
            background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
          })}>
            <GraveIcon />
            <span style={{ color: 'white', fontSize: 28, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{state.trash.length}</span>
          </div>

          {/* 相手ポートレート */}
          {opponentPlayer && (
            <div style={abs(300, 28, 340, 220, { overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' })}>
              <img
                src={`/frames/${opponentPlayer.imakano.id}.png`}
                alt="" draggable={false}
                style={{ height: '100%', width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 2px 20px rgba(0,0,0,0.8))' }}
              />
            </div>
          )}

          {/* 相手名 */}
          {opponentPlayer && (
            <div style={abs(668, 48, 240, 44)}>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 32, fontWeight: 700, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {opponentPlayer.name}
              </p>
              <p style={{ color: 'rgba(249,168,212,0.6)', fontSize: 22, lineHeight: 1.2 }}>{opponentPlayer.imakano.name}</p>
            </div>
          )}

          {/* 相手幸せ数値 + ハート */}
          {opponentPlayer && (
            <div style={abs(668, 128, 200, 92, { display: 'flex', alignItems: 'center', gap: 8 })}>
              <span style={{ fontSize: 84, fontWeight: 900, color: oppHpColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums', textShadow: `0 0 24px ${oppHpColor}80` }}>
                {opponentPlayer.happiness >= 0 ? `+${opponentPlayer.happiness}` : `${opponentPlayer.happiness}`}
              </span>
              <span style={{ color: '#f9a8d4', fontSize: 44, lineHeight: 1 }}>♥</span>
            </div>
          )}

          {/* 相手ゲージ */}
          {opponentPlayer && (
            <div style={abs(668, 230, 336, 28)}>
              <HappinessGauge value={opponentPlayer.happiness} w={336} />
            </div>
          )}

          {/* メニュー（ログ）ボタン */}
          <button
            onClick={() => setShowLog(v => !v)}
            style={abs(948, 40, 108, 108, {
              borderRadius: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: showLog ? 'rgba(56,189,248,0.15)' : 'rgba(0,0,0,0.5)',
              border: `1px solid ${showLog ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.08)'}`,
            })}
          >
            <ScrollIcon />
          </button>

          {/* スキル状態インジケータ（相手） */}
          {opponentPlayer && opponentPlayer.imakano.skillKey && (
            <div style={abs(860, 116, 68, 68, {
              borderRadius: '50%',
              background: opponentPlayer.skillUsedThisTurn
                ? 'rgba(60,60,60,0.6)'
                : 'rgba(250,200,50,0.15)',
              border: opponentPlayer.skillUsedThisTurn
                ? '2px solid rgba(255,255,255,0.1)'
                : '2px solid rgba(250,200,50,0.6)',
              boxShadow: opponentPlayer.skillUsedThisTurn ? 'none' : '0 0 16px rgba(250,200,50,0.3)',
            })} />
          )}
        </div>

        {/* ════════════════════════════════════════════════
            ZONE 2: 中央解決エリア y=296 h=720
            ════════════════════════════════════════════════ */}
        <div
          style={abs(0, 280, CW, 760, {
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          })}
          onDragOver={e => {
            e.preventDefault();
            if (isMyTurn && state.phase === 'play' && !hasPending) setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={e => {
            e.preventDefault();
            setIsDragOver(false);
            const instanceId = e.dataTransfer.getData('cardInstanceId');
            if (instanceId && isMyTurn && state.phase === 'play' && !hasPending) {
              dispatch({ type: 'PLAY_CARD', cardInstanceId: instanceId });
            }
          }}
        >
          {/* フィールド装飾 */}
          <div style={abs(96, 40, 888, 672, {
            borderRadius: 40,
            border: `2px solid ${isDragOver ? 'rgba(56,189,248,0.5)' : 'rgba(255,255,255,0.04)'}`,
            background: isDragOver ? 'rgba(56,189,248,0.05)' : 'transparent',
          })}>
            <img src="/field-center.png" alt="" draggable={false}
              style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 400, height: 240, objectFit: 'contain', opacity: 0.1, mixBlendMode: 'screen', pointerEvents: 'none' }} />
          </div>

          {/* 中央カード */}
          <div style={abs(375, 174, 330, 462, { zIndex: 2 })}>
            {state.lastPlayedCard ? (
              <button
                onClick={() => setZoomedCard(state.lastPlayedCard!)}
                style={{ width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
              >
                <img src={`/cards/${state.lastPlayedCard.def.id}.png`} alt={state.lastPlayedCard.def.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
              </button>
            ) : (
              <div style={{
                width: '100%', height: '100%', borderRadius: 16,
                border: `2px dashed ${isDragOver ? 'rgba(56,189,248,0.6)' : 'rgba(255,255,255,0.08)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isMyTurn && state.phase === 'play' && (
                  <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: 24, textAlign: 'center', lineHeight: 1.6 }}>ここへ<br />ドロップ</p>
                )}
              </div>
            )}
          </div>

          {/* ターン終了ボタン */}
          {isMyTurn && state.phase === 'play' && !hasPending && (
            <button
              onClick={() => dispatch({ type: 'SKIP_PLAY' })}
              style={abs(814, 500, 220, 220, {
                borderRadius: '50%',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: 'radial-gradient(circle at 40% 35%, #3b82f6, #1d4ed8)',
                boxShadow: '0 0 40px rgba(59,130,246,0.55), inset 0 2px 2px rgba(255,255,255,0.2)',
                border: '3px solid rgba(147,197,253,0.5)',
                zIndex: 5,
              })}
            >
              <span style={{ color: 'white', fontSize: 28, fontWeight: 700, letterSpacing: '0.1em', lineHeight: 1.3 }}>ターン</span>
              <span style={{ color: 'white', fontSize: 28, fontWeight: 700, letterSpacing: '0.1em', lineHeight: 1.3 }}>終了</span>
            </button>
          )}

          {/* 処理中表示 */}
          {(state.phase === 'draw' || state.phase === 'end_turn' || state.phase === 'resolve') && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 24, letterSpacing: '0.15em' }} className="animate-pulse">処理中…</p>
            </div>
          )}
          {state.phase === 'defense' && !isDefenseTarget && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                padding: '20px 40px', borderRadius: 20, textAlign: 'center',
                background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(220,38,38,0.35)',
              }}>
                <p style={{ color: '#f87171', fontSize: 24, fontWeight: 700, letterSpacing: '0.15em' }}>待機中…</p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 20, marginTop: 4 }}>
                  {state.pending?.type === 'DEFENSE_REACTION'
                    ? state.players[state.pending.targetIdx]?.name
                    : '相手'}が防御を選択中
                </p>
              </div>
            </div>
          )}

          {/* ログパネル */}
          {showLog && (
            <div style={{ position: 'absolute', top: 0, left: 24, right: 24, zIndex: 30, padding: '8px 0' }}>
              <GameLog log={state.log} maxItems={5} />
            </div>
          )}

          {/* ログボタン（仕様 9-1: x=24 y=948→ここでは相対 y=668） */}
          <button
            onClick={() => setShowLog(v => !v)}
            style={abs(24, 580, 92, 120, {
              borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)',
            })}
          >
            <ScrollIcon />
          </button>
        </div>

        {/* ════════════════════════════════════════════════
            ZONE 3: 下部HUD（自分情報）y=1040 h=272
            ════════════════════════════════════════════════ */}
        <div style={abs(0, 1040, CW, 280, {
          background: isMyTurn
            ? 'linear-gradient(to top, rgba(8,40,60,0.65), rgba(8,40,60,0.35))'
            : 'linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0.35))',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        })}>
          {isDefenseTarget && state.pending?.type === 'DEFENSE_REACTION' ? (
            /* 防御モード */
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px' }}>
              <span style={{ fontSize: 40, flexShrink: 0 }}>⚔️</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#fca5a5', fontSize: 28, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {state.players[state.pending.attackerIdx].name}「{state.pending.attackCard.def.name}」
                </p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 22 }}>防御カードをタップして選択</p>
              </div>
              <button
                onClick={() => dispatch({ type: 'SKIP_DEFENSE' })}
                style={{
                  flexShrink: 0, padding: '14px 24px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.55)', fontSize: 24, fontWeight: 600,
                }}
              >
                防御しない
              </button>
            </div>
          ) : (
            <>
              {/* 自分ポートレート（中央寄り） */}
              <div style={abs(316, -80, 280, 340, { zIndex: 3, overflow: 'visible' })}>
                <button
                  onClick={canUseSkill ? () => {
                    pushAnim({
                      type: 'SKILL_CUTIN',
                      heroineType: myPlayer.imakano.id as HeroineType,
                      heroineName: myPlayer.imakano.name,
                      skillName: myPlayer.imakano.skillName ?? 'スキル',
                      onActivate: () => dispatch({ type: 'USE_SKILL' }),
                    });
                  } : undefined}
                  disabled={!canUseSkill}
                  style={{
                    width: '100%', height: '100%', position: 'relative',
                    cursor: canUseSkill ? 'pointer' : 'default',
                    background: 'none', border: 'none', padding: 0,
                  }}
                >
                  <img
                    src={`/frames/${myPlayer.imakano.id}.png`}
                    alt="" draggable={false}
                    style={{
                      width: '100%', height: '100%', objectFit: 'contain',
                      filter: canUseSkill
                        ? 'drop-shadow(0 0 20px rgba(250,200,50,0.9)) brightness(1.08)'
                        : 'drop-shadow(0 4px 20px rgba(0,0,0,0.8))',
                      transition: 'filter 0.3s',
                    }}
                  />
                  {canUseSkill && (
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 8, boxShadow: '0 0 0 3px rgba(250,200,50,0.7), 0 0 32px rgba(250,200,50,0.4)' }} />
                  )}
                </button>
              </div>

              {/* 自分名 */}
              <div style={abs(176, 52, 130, 68)}>
                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 28, fontWeight: 700, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {myPlayer.name}
                </p>
                <p style={{ color: 'rgba(249,168,212,0.6)', fontSize: 20, lineHeight: 1.2 }}>{myPlayer.imakano.name}</p>
              </div>

              {/* 自分幸せ数値 */}
              <div style={abs(160, 140, 200, 92, { display: 'flex', alignItems: 'center', gap: 8 })}>
                <span style={{ fontSize: 84, fontWeight: 900, color: myHpColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums', textShadow: `0 0 24px ${myHpColor}80` }}>
                  {myPlayer.happiness >= 0 ? `+${myPlayer.happiness}` : `${myPlayer.happiness}`}
                </span>
                <img src="/icons/icon-heart.png" alt="♥" style={{ width: 44, height: 44 }} draggable={false} />
              </div>

              {/* 自分ゲージ */}
              <div style={abs(24, 240, 336, 28)}>
                <HappinessGauge value={myPlayer.happiness} w={336} />
              </div>

              {/* 婚姻届使用可能通知 */}
              {myPlayer.happiness >= MARRIAGE_VICTORY_THRESHOLD && (
                <div style={abs(630, 220, 340, 32, {
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(250,200,50,0.12)', border: '1px solid rgba(250,200,50,0.4)',
                  borderRadius: 6,
                })}>
                  <span style={{ color: 'rgba(250,200,50,0.9)', fontSize: 20, fontWeight: 700, letterSpacing: '0.05em' }}>婚姻届使用可能</span>
                </div>
              )}

              {/* スキルボタン */}
              <div style={abs(804, 48, 180, 180, { zIndex: 4 })}>
                <button
                  onClick={canUseSkill ? () => {
                    pushAnim({
                      type: 'SKILL_CUTIN',
                      heroineType: myPlayer.imakano.id as HeroineType,
                      heroineName: myPlayer.imakano.name,
                      skillName: myPlayer.imakano.skillName ?? 'スキル',
                      onActivate: () => dispatch({ type: 'USE_SKILL' }),
                    });
                  } : undefined}
                  disabled={!canUseSkill}
                  style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: canUseSkill
                      ? 'radial-gradient(circle at 40% 35%, rgba(250,200,50,0.3), rgba(180,140,20,0.2))'
                      : 'rgba(40,40,40,0.6)',
                    border: canUseSkill
                      ? '3px solid rgba(250,200,50,0.7)'
                      : '2px solid rgba(255,255,255,0.08)',
                    boxShadow: canUseSkill ? '0 0 40px rgba(250,200,50,0.35)' : 'none',
                    cursor: canUseSkill ? 'pointer' : 'default',
                  }}
                >
                  <span style={{ color: canUseSkill ? 'rgba(250,200,50,0.9)' : 'rgba(255,255,255,0.2)', fontSize: 22, fontWeight: 700, lineHeight: 1.3, textAlign: 'center' }}>
                    スキル
                  </span>
                  <span style={{ color: canUseSkill ? 'rgba(250,200,50,0.7)' : 'rgba(255,255,255,0.1)', fontSize: 18, lineHeight: 1.2 }}>
                    {myPlayer.skillUsedThisTurn ? '使用済' : myPlayer.imakano.skillKey ? '1/1' : '—'}
                  </span>
                </button>
              </div>

              {/* 離席警告（自分のターンでない時） */}
              {!isMyTurn && (
                <div style={abs(660, 56, 220, 60, { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 })}>
                  {afkSecondsLeft !== null ? (
                    <span style={{ color: '#f87171', fontSize: 22, fontWeight: 700 }} className="animate-pulse">失格まで {afkSecondsLeft}秒</span>
                  ) : (
                    <button
                      onClick={onAfkWarning}
                      style={{
                        fontSize: 20, padding: '8px 16px', borderRadius: 10,
                        color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      離席警告
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ════════════════════════════════════════════════
            ZONE 4: 手札エリア y=1320 h=576
            ════════════════════════════════════════════════ */}
        <div style={abs(0, 1320, CW, CH - 1320, {
          background: 'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.4))',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          paddingBottom: 24,
        })}>
          <div style={{ paddingLeft: 24, paddingRight: 24 }}>
            <HandView
              cards={myPlayer.hand}
              onTap={setZoomedCard}
              onDropPlay={isMyTurn && state.phase === 'play' && !hasPending ? card => {
                if (!unplayableTypes.has(card.def.type) && !unplayableIds.has(card.instanceId)) {
                  dispatch({ type: 'PLAY_CARD', cardInstanceId: card.instanceId });
                }
              } : undefined}
              unplayableTypes={handUnplayableTypes}
              unplayableIds={handUnplayableIds}
            />
          </div>
        </div>

        {/* ── Overlay ── */}
        {overlayContent}

        {/* ── Animation layer ── */}
        <AnimationLayer
          events={animEvents}
          onDone={id => setAnimEvents(prev => prev.filter(e => e.id !== id))}
        />

        {/* ── Stuck recovery ── */}
        {showStuckRecovery && (
          <div style={{ position: 'absolute', right: 24, bottom: 640, zIndex: 60 }}>
            <div style={{
              background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(251,146,60,0.5)',
              borderRadius: 16, padding: '16px 24px',
              boxShadow: '0 0 24px rgba(251,146,60,0.2)',
            }}>
              <p style={{ color: 'rgba(251,146,60,0.85)', fontSize: 22, fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>
                処理が止まっています
              </p>
              <button
                onClick={forceResolve}
                style={{
                  display: 'block', width: '100%', padding: '12px 28px', borderRadius: 10,
                  background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.4)',
                  color: 'rgba(251,146,60,0.9)', fontSize: 22, fontWeight: 700,
                }}
              >
                スキップして続ける
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
