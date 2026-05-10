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

// ── Icons ────────────────────────────────────────────────────────────────────
function DeckIcon() {
  return <img src="/icons/icon-deck.png" alt="" style={{ width: 14, height: 14 }} draggable={false} />;
}
function GraveIcon() {
  return <img src="/icons/icon-grave.png" alt="" style={{ width: 14, height: 14 }} draggable={false} />;
}
function ScrollIcon() {
  return <img src="/icons/icon-scroll.png" alt="" style={{ width: 14, height: 14 }} draggable={false} />;
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
        position: 'absolute', inset: 0, zIndex: 50,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 24, gap: 16,
        background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()}>
        <CardComp card={card} size="lg" />
      </div>
      <div style={{ maxWidth: 280, textAlign: 'center', padding: '0 8px' }} onClick={e => e.stopPropagation()}>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 1.5 }}>{card.def.effectText}</p>
      </div>
      <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 280 }} onClick={e => e.stopPropagation()}>
        {actionLabel && onAction && (
          <button
            onClick={() => { onAction(); onClose(); }}
            style={{
              flex: 1, padding: '14px 0', borderRadius: 12,
              fontWeight: 700, color: 'white', letterSpacing: '0.05em',
              background: 'linear-gradient(135deg, #0e7490, #0891b2)',
              boxShadow: '0 0 20px rgba(8,145,178,0.4)',
            }}
          >
            {actionLabel}
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            flex: 1, padding: '14px 0', borderRadius: 12,
            fontWeight: 600, color: 'rgba(255,255,255,0.5)',
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

// ── Turn End button ───────────────────────────────────────────────────────────
function TurnEndButton({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  const sz = compact ? 52 : 64;
  return (
    <button
      onClick={onClick}
      style={{
        width: sz, height: sz, borderRadius: '50%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        background: 'radial-gradient(circle at 40% 35%, #3b82f6, #1d4ed8)',
        boxShadow: '0 0 20px rgba(59,130,246,0.55), inset 0 1px 1px rgba(255,255,255,0.2)',
        border: '2px solid rgba(147,197,253,0.5)',
        transition: 'transform 0.1s',
      }}
    >
      <span style={{ color: 'white', fontSize: compact ? 9 : 10, fontWeight: 700, letterSpacing: '0.1em', lineHeight: 1.3 }}>ターン</span>
      <span style={{ color: 'white', fontSize: compact ? 9 : 10, fontWeight: 700, letterSpacing: '0.1em', lineHeight: 1.3 }}>終了</span>
    </button>
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

  // window.innerHeight/innerWidth でブラウザUIを除いた正確なサイズを取得（Chrome iOS対応）
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

  const boardHeight = boardDims?.h ?? null;
  const isLandscape = boardDims ? boardDims.w > boardDims.h : true;

  // defenseフェーズを抜けたときズームを強制クリア（DISCARDモーダルが埋もれるのを防ぐ）
  useEffect(() => {
    if (prevPhaseRef.current === 'defense' && state.phase !== 'defense') {
      setZoomedCard(null);
    }
    prevPhaseRef.current = state.phase;
  }, [state.phase]);

  // Stuck detection: show recovery button after 8s of unresolved human-interactive pending
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

  // VIEW_SELECT/VIEW_SELECT_SPECIALS はカードプレイアニメ後にモーダルを表示
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
  const currentPlayer = state.players[cur];
  const isMyTurn = cur === myPlayerIdx;

  const northIdx = (myPlayerIdx + 1) % n;

  function playerPos(idx: number): AnimPosition {
    if (idx === myPlayerIdx) return 'south';
    return 'north';
  }

  function pushAnim(ev: AnimEventPayload) {
    const id = ++animSeq.current;
    setAnimEvents(prev => [...prev, { ...ev, id } as AnimationEvent]);
  }

  // Auto-skip skill phase
  useEffect(() => {
    if (state.phase === 'skill' && cur === myPlayerIdx) {
      dispatch({ type: 'SKIP_SKILL' });
    }
  }, [state.phase, cur, myPlayerIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // AFK countdown
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

  // Detect state changes → fire animations
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

  // Initial turn banner
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
    if (c.def.effectKey === 'father' && myPlayer.happiness < 7) {
      unplayableIds.add(c.instanceId);
    }
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

  // 防御フェーズ中は防御札のみ選択可能
  const handUnplayableIds: Set<string> = isDefenseTarget
    ? new Set(myPlayer.hand
        .filter(c => c.def.effectKey !== 'defense')
        .map(c => c.instanceId))
    : unplayableIds;
  const handUnplayableTypes: Set<string> = isDefenseTarget
    ? new Set(['attack', 'special'])
    : (!isMyTurn || state.phase !== 'play' || hasPending)
      ? new Set(['attack', 'defense', 'special'])
      : unplayableTypes;

  // HP colors
  const myHp = myPlayer.happiness;
  const myHpColor = myHp <= 0 ? '#f87171' : myHp >= 8 ? '#fde047' : '#f9a8d4';
  const opponentPlayer = northIdx >= 0 ? state.players[northIdx] : null;
  const opponentHp = opponentPlayer?.happiness ?? 0;
  const opponentHpColor = opponentHp <= 0 ? '#f87171' : opponentHp >= 8 ? '#fde047' : '#f9a8d4';

  // ── Win screen ──
  if (state.phase === 'finished' && state.winner) {
    const wImakanoId = state.players.find(p => p.id === state.winner!.id)?.imakano.id ?? 'no_girlfriend';
    const h = boardHeight ?? 0;
    // 横持ちランドスケープ（高さ < 幅）かどうかで portrait サイズを切り替え
    const isLandscape = typeof window !== 'undefined' && window.innerWidth > window.innerHeight;
    const portraitW = isLandscape ? Math.min(88, h * 0.22) : 120;
    const portraitH = Math.round(portraitW * 1.25);
    return (
      <div style={{
        width: '100vw',
        height: boardHeight ? `${boardHeight}px` : '100dvh',
        display: 'flex',
        flexDirection: isLandscape ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isLandscape ? 32 : 20,
        padding: isLandscape ? '16px 40px' : '24px 24px',
        paddingBottom: `max(${isLandscape ? 16 : 24}px, env(safe-area-inset-bottom, 0px))`,
        boxSizing: 'border-box',
        background: 'linear-gradient(to bottom, #0a0010, #050008)',
        overflow: 'hidden',
      }}>
        {/* イマカノ肖像 */}
        <div style={{
          width: portraitW, height: portraitH, flexShrink: 0,
          borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 0 36px rgba(234,179,8,0.45)',
          border: '2px solid rgba(234,179,8,0.6)',
        }}>
          <img src={`/imakano/${wImakanoId}.png`} alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
        </div>

        {/* テキスト＋ボタン */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: isLandscape ? 12 : 16,
          width: isLandscape ? 'auto' : '100%',
          maxWidth: 360,
        }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'rgba(234,179,8,0.7)', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>
              Congratulations
            </p>
            <h1 style={{ fontSize: isLandscape ? 26 : 30, fontWeight: 700, color: 'white', lineHeight: 1.2 }}>
              {state.winner.name}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: 6, fontSize: 13 }}>
              「{state.winner.imakano.name}」との結婚
            </p>
          </div>
          <button
            onClick={() => (location.href = '/')}
            style={{
              width: isLandscape ? 200 : '100%', padding: '14px 0', borderRadius: 12,
              fontWeight: 700, color: 'white', letterSpacing: '0.05em', fontSize: 15,
              background: 'linear-gradient(135deg, #b45309, #d97706)',
              boxShadow: '0 0 20px rgba(217,119,6,0.4)',
            }}
          >
            最初に戻る
          </button>
        </div>
      </div>
    );
  }

  // ── Overlay (zoom or interaction modal) ──
  // DISCARDモーダルはズームより優先（防御後にズームが残った場合でも確実に表示）
  const showInteractionModal =
    hasPending &&
    !modalDelay &&
    state.pending?.type !== 'DEFENSE_REACTION' &&
    state.pending?.type !== 'PASS_DEVICE' &&
    state.pending?.type !== 'SELECT_TARGET';

  const highPriorityModal = showInteractionModal && (
    state.pending?.type === 'DISCARD' ||
    state.pending?.type === 'PEEK_STEAL' ||
    state.pending?.type === 'PEEK_TRASH'
  );
  let overlayContent: React.ReactNode = null;
  if (highPriorityModal) {
    overlayContent = (
      <div style={{
        position: 'absolute', inset: 0, zIndex: 50,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 16,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
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
      <div style={{
        position: 'absolute', inset: 0, zIndex: 40,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 16,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          <InteractionModal state={state} dispatch={dispatch} />
        </div>
      </div>
    );
  }

  // ── Main 4-zone grid ──
  return (
    <>
<div
        style={{
          width: '100vw',
          // JS で取得した window.innerHeight を優先（Chrome iOS等でdvhが不正確な場合の対策）
          // boardHeight が null の初回レンダリング時は dvh にフォールバック
          height: boardHeight ? `${boardHeight}px` : '100dvh',
          display: 'grid',
          gridTemplateRows: isLandscape ? '25% 12% 25% 38%' : '22% 14% 22% 42%',
          overflow: 'hidden',
          position: 'relative',
          backgroundImage: 'url(/board-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxSizing: 'border-box',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
        }}
        className="game-board-root"
      >
        {/* ── Zone 1: Opponent ── */}
        <div style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.72), rgba(0,0,0,0.38))',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          boxSizing: 'border-box', overflow: 'hidden',
        }}>
          {/* Character image + HP — centered as a unit */}
          {opponentPlayer && (
            <>
              <img
                src={`/frames/${opponentPlayer.imakano.id}.png`}
                alt="" draggable={false}
                style={{
                  height: '82%', width: 'auto', objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 16px rgba(0,0,0,0.75))',
                  pointerEvents: 'none',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 14 }}>
                <span style={{ fontSize: 'clamp(28px, 7vw, 46px)', fontWeight: 800, color: opponentHpColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums', textShadow: `0 0 20px ${opponentHpColor}70` }}>
                  {opponentPlayer.happiness}
                </span>
                <span style={{ color: '#f9a8d4', fontSize: 'clamp(18px, 4.5vw, 28px)', lineHeight: 1 }}>♥</span>
              </div>
            </>
          )}

          {/* Deck/Grave - top-left */}
          <div style={{ position: 'absolute', top: 6, left: 10, display: 'flex', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 5px', borderRadius: 5, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <DeckIcon /><span style={{ color: 'white', fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{state.deck.length}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 5px', borderRadius: 5, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <GraveIcon /><span style={{ color: 'white', fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{state.trash.length}</span>
            </div>
          </div>

          {/* Log button - top-right */}
          <button
            onClick={() => setShowLog(v => !v)}
            style={{
              position: 'absolute', top: 6, right: 10,
              width: 30, height: 30, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: showLog ? 'rgba(56,189,248,0.15)' : 'rgba(0,0,0,0.5)',
              border: `1px solid ${showLog ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.07)'}`,
            }}
          >
            <ScrollIcon />
          </button>
        </div>

        {/* ── Zone 2: Center resolution area ── */}
        <div
          style={{
            position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}
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
          {/* Field decoration */}
          <img src="/field-center.png" alt="" draggable={false}
            style={{ position: 'absolute', width: 140, height: 90, objectFit: 'contain', opacity: 0.12, mixBlendMode: 'screen', pointerEvents: 'none' }} />

          {/* Drop glow */}
          {isDragOver && (
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'rgba(56,189,248,0.08)',
              border: '2px solid rgba(56,189,248,0.4)',
              boxShadow: 'inset 0 0 30px rgba(56,189,248,0.15)',
            }} />
          )}

          {/* Active card */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            {state.lastPlayedCard ? (
              <button onClick={() => setZoomedCard(state.lastPlayedCard!)}>
                <CardComp card={state.lastPlayedCard} size="sm" />
              </button>
            ) : (
              <div style={{
                width: 68, height: 96, borderRadius: 8,
                border: `2px dashed ${isDragOver ? 'rgba(56,189,248,0.6)' : 'rgba(255,255,255,0.07)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isMyTurn && state.phase === 'play' && (
                  <p style={{ color: 'rgba(255,255,255,0.13)', fontSize: 9, textAlign: 'center', lineHeight: 1.4 }}>ここへ<br />ドロップ</p>
                )}
              </div>
            )}
          </div>

          {/* Processing states */}
          {(state.phase === 'draw' || state.phase === 'end_turn' || state.phase === 'resolve') && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.15)' }}>
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, letterSpacing: '0.15em' }} className="animate-pulse">処理中…</p>
            </div>
          )}
          {state.phase === 'defense' && !isDefenseTarget && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.18)' }}>
              <div style={{
                padding: '10px 20px', borderRadius: 14, textAlign: 'center',
                background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(220,38,38,0.3)',
                boxShadow: '0 0 22px rgba(220,38,38,0.12)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 3 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#f87171' }} className="animate-pulse" />
                  <p style={{ color: '#f87171', fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Waiting</p>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#f87171' }} className="animate-pulse" />
                </div>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>
                  {state.pending?.type === 'DEFENSE_REACTION'
                    ? state.players[state.pending.targetIdx]?.name
                    : '相手'}が防御を選択中
                </p>
              </div>
            </div>
          )}

          {/* Log panel */}
          {showLog && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30, padding: '4px 8px' }}>
              <GameLog log={state.log} maxItems={5} />
            </div>
          )}
        </div>

        {/* ── Zone 3: My HUD ── */}
        <div style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isMyTurn
            ? 'linear-gradient(to top, rgba(8,40,60,0.55), rgba(8,40,60,0.3))'
            : 'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.3))',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          overflow: 'hidden',
        }}>
          {isDefenseTarget && state.pending?.type === 'DEFENSE_REACTION' ? (
            /* Defense mode: attack info + skip button */
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', width: '100%' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚔️</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#fca5a5', fontSize: 11, fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {state.players[state.pending.attackerIdx].name}「{state.pending.attackCard.def.name}」
                </p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>防御カードをタップして選択</p>
              </div>
              <button
                onClick={() => dispatch({ type: 'SKIP_DEFENSE' })}
                style={{
                  flexShrink: 0, padding: '6px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600,
                }}
              >
                防御しない
              </button>
            </div>
          ) : (
            <>
              {/* Character image + HP — centered as a unit */}
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
                style={{ height: '82%', display: 'flex', alignItems: 'center', position: 'relative', cursor: canUseSkill ? 'pointer' : 'default' }}
              >
                <img
                  src={`/frames/${myPlayer.imakano.id}.png`}
                  alt="" draggable={false}
                  style={{
                    height: '100%', width: 'auto', objectFit: 'contain',
                    filter: canUseSkill
                      ? 'drop-shadow(0 0 16px rgba(250,200,50,0.85)) brightness(1.08)'
                      : 'drop-shadow(0 2px 16px rgba(0,0,0,0.75))',
                    transition: 'filter 0.3s',
                  }}
                />
                {canUseSkill && (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 6, boxShadow: '0 0 0 2px rgba(250,200,50,0.7), 0 0 24px rgba(250,200,50,0.35)' }} />
                )}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 14 }}>
                <span style={{ fontSize: 'clamp(28px, 7vw, 46px)', fontWeight: 800, color: myHpColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums', textShadow: `0 0 20px ${myHpColor}70` }}>
                  {myPlayer.happiness}
                </span>
                <img src="/icons/icon-heart.png" alt="♥" style={{ width: 'clamp(18px, 4.5vw, 28px)', height: 'clamp(18px, 4.5vw, 28px)' }} draggable={false} />
              </div>

              {/* Not my turn - top-right */}
              {!isMyTurn && (
                <div style={{ position: 'absolute', top: 8, right: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  {afkSecondsLeft !== null ? (
                    <span style={{ color: '#f87171', fontSize: 10, fontWeight: 700 }} className="animate-pulse">失格まで {afkSecondsLeft}秒</span>
                  ) : (
                    <button
                      onClick={onAfkWarning}
                      style={{
                        fontSize: 10, padding: '4px 8px', borderRadius: 8,
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

        {/* ── Zone 4: Hand area ── */}
        <div style={{
          position: 'relative',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          background: 'linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0.35))',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          // 下: iOSホームインジケーター分（横持ちで約21px）
          paddingTop: 6,
          paddingBottom: 'max(6px, env(safe-area-inset-bottom, 0px))',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}>
          <div style={{ paddingRight: isMyTurn && state.phase === 'play' && !hasPending ? (isLandscape ? 68 : 80) : 12, paddingLeft: 8 }}>
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

          {/* Turn end button */}
          {isMyTurn && state.phase === 'play' && !hasPending && (
            <div style={{
              position: 'absolute',
              right: 10,
              bottom: 'max(10px, env(safe-area-inset-bottom, 0px))',
            }}>
              <TurnEndButton onClick={() => dispatch({ type: 'SKIP_PLAY' })} compact={isLandscape} />
            </div>
          )}
        </div>

        {/* ── Overlay (card zoom / interaction modal) ── */}
        {overlayContent}

        {/* ── Animation layer ── */}
        <AnimationLayer
          events={animEvents}
          onDone={id => setAnimEvents(prev => prev.filter(e => e.id !== id))}
        />

        {/* ── Stuck recovery ── */}
        {showStuckRecovery && (
          <div style={{
            position: 'absolute', right: 12,
            bottom: 'max(80px, calc(env(safe-area-inset-bottom, 0px) + 72px))',
            zIndex: 60, pointerEvents: 'auto',
          }}>
            <div style={{
              background: 'rgba(0,0,0,0.88)', border: '1px solid rgba(251,146,60,0.5)',
              borderRadius: 10, padding: '8px 12px',
              boxShadow: '0 0 16px rgba(251,146,60,0.2)',
            }}>
              <p style={{ color: 'rgba(251,146,60,0.85)', fontSize: 10, fontWeight: 700, marginBottom: 6, textAlign: 'center', letterSpacing: '0.05em' }}>
                処理が止まっています
              </p>
              <button
                onClick={forceResolve}
                style={{
                  display: 'block', width: '100%', padding: '6px 14px', borderRadius: 7,
                  background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.4)',
                  color: 'rgba(251,146,60,0.9)', fontSize: 11, fontWeight: 700,
                }}
              >
                スキップして続ける
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
