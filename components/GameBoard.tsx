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

// ── Portrait ─────────────────────────────────────────────────────────────────
function Portrait({
  imakanoId, width, skillRing = false, attackRing = false, skillLabel = false,
}: {
  imakanoId: string; width: number;
  skillRing?: boolean; attackRing?: boolean; skillLabel?: boolean;
}) {
  const height = Math.round(width * 1.25);
  const border = attackRing
    ? '2px solid rgba(220,38,38,0.9)'
    : '2px solid rgba(196,155,60,0.85)';
  const boxShadow = attackRing
    ? '0 0 0 1px rgba(220,38,38,0.4), 0 0 18px rgba(220,38,38,0.6)'
    : skillRing
    ? '0 0 0 1px rgba(250,200,50,0.5), 0 0 20px rgba(250,200,50,0.55), inset 0 0 0 1px rgba(255,220,100,0.2)'
    : '0 0 0 1px rgba(120,90,30,0.4), 0 4px 20px rgba(0,0,0,0.6)';
  return (
    <div style={{
      flexShrink: 0, width, height, borderRadius: 7,
      overflow: 'hidden',
      backgroundImage: `url('/imakano/${imakanoId}.png')`,
      backgroundSize: 'cover', backgroundPosition: 'top center',
      border, boxShadow, position: 'relative',
    }}>
      {skillLabel && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          paddingBottom: 2, paddingTop: 8, textAlign: 'center',
          background: 'linear-gradient(to top, rgba(160,110,0,0.9), transparent)',
          pointerEvents: 'none',
        }}>
          <span style={{ color: '#fef3c7', fontSize: 8, fontWeight: 700, letterSpacing: '0.12em' }}>SKILL</span>
        </div>
      )}
    </div>
  );
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
  const portraitSz = isLandscape ? 32 : 44;

  // defenseフェーズを抜けたときズームを強制クリア（DISCARDモーダルが埋もれるのを防ぐ）
  useEffect(() => {
    if (prevPhaseRef.current === 'defense' && state.phase !== 'defense') {
      setZoomedCard(null);
    }
    prevPhaseRef.current = state.phase;
  }, [state.phase]);

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

  const northIdx = n === 2 ? (myPlayerIdx + 1) % n : n >= 3 ? (myPlayerIdx + 2) % n : -1;
  const eastIdx  = n >= 3 ? (myPlayerIdx + 1) % n : -1;
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
  });

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

  let overlayContent: React.ReactNode = null;
  if (showInteractionModal && state.pending?.type === 'DISCARD') {
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
      {/* Rotate device overlay for portrait mobile */}
      <div
        className="portrait-rotate-overlay"
        style={{
          display: 'none',
          position: 'fixed', inset: 0, zIndex: 9999,
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
          background: 'rgba(5,0,15,0.97)',
        }}
      >
        <div style={{ fontSize: 52, transform: 'rotate(-90deg)' }}>📱</div>
        <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 18, fontWeight: 700, textAlign: 'center', letterSpacing: '0.04em' }}>
          デバイスを横向きに<br />してください
        </p>
      </div>

      <div
        style={{
          width: '100vw',
          // JS で取得した window.innerHeight を優先（Chrome iOS等でdvhが不正確な場合の対策）
          // boardHeight が null の初回レンダリング時は dvh にフォールバック
          height: boardHeight ? `${boardHeight}px` : '100dvh',
          display: 'grid',
          gridTemplateRows: isLandscape ? '13% 26% 13% 48%' : '16% 30% 14% 40%',
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
        {/* ── Zone 1: Opponent HUD ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          // 上: iOSステータスバー分（ノッチなしでも0pxになる）
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingLeft: 10, paddingRight: 10,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.78), rgba(0,0,0,0.45))',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          boxSizing: 'border-box',
        }}>
          {/* Deck / Grave counts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 6, background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <DeckIcon />
              <span style={{ color: 'white', fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{state.deck.length}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 6, background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <GraveIcon />
              <span style={{ color: 'white', fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{state.trash.length}</span>
            </div>
          </div>

          {/* Opponent portrait */}
          {opponentPlayer && northIdx >= 0 && (
            <Portrait imakanoId={opponentPlayer.imakano.id} width={portraitSz} />
          )}

          {/* Opponent info */}
          {opponentPlayer ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
              <p style={{ color: 'white', fontWeight: 700, fontSize: 'clamp(11px, 3vw, 15px)', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {opponentPlayer.imakano.name}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, lineHeight: 1.2 }}>{opponentPlayer.name}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                <span style={{ fontSize: 'clamp(20px, 5.5vw, 30px)', fontWeight: 800, color: opponentHpColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {opponentPlayer.happiness}
                </span>
                <span style={{ color: '#f9a8d4', fontSize: 'clamp(13px, 3.5vw, 19px)', lineHeight: 1 }}>♥</span>
              </div>
              <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                {Array.from({ length: Math.min(opponentPlayer.hand.length, 8) }, (_, i) => (
                  <div key={i} style={{ width: 5, height: 8, borderRadius: 1, background: 'rgba(148,163,184,0.35)', border: '1px solid rgba(255,255,255,0.08)' }} />
                ))}
                {opponentPlayer.hand.length > 8 && <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 8, marginLeft: 1 }}>+{opponentPlayer.hand.length - 8}</span>}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1 }} />
          )}

          {/* East/West side player indicators (4p) */}
          {(eastIdx >= 0 || westIdx >= 0) && (
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {westIdx >= 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <Portrait imakanoId={state.players[westIdx].imakano.id} width={26} />
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 7 }}>W</span>
                </div>
              )}
              {eastIdx >= 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <Portrait imakanoId={state.players[eastIdx].imakano.id} width={26} />
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 7 }}>E</span>
                </div>
              )}
            </div>
          )}

          {/* Log button */}
          <button
            onClick={() => setShowLog(v => !v)}
            style={{
              flexShrink: 0, width: 30, height: 30, borderRadius: 8,
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
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 12px',
          background: isMyTurn
            ? 'linear-gradient(to top, rgba(8,40,60,0.55), rgba(8,40,60,0.3))'
            : 'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.3))',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          overflow: 'hidden',
        }}>
          {isDefenseTarget && state.pending?.type === 'DEFENSE_REACTION' ? (
            /* Defense mode: attack info + skip button */
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>⚔️</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: '#fca5a5', fontSize: 11, fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {state.players[state.pending.attackerIdx].name}「{state.pending.attackCard.def.name}」
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>防御カードをタップして選択</p>
                </div>
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
            </>
          ) : (
            /* Normal mode: my portrait + HP */
            <>
              <button
                onClick={canUseSkill ? () => {
                  pushAnim({
                    type: 'SKILL_CUTIN',
                    heroineType: myPlayer.imakano.id as HeroineType,
                    heroineName: myPlayer.imakano.name,
                    skillName: myPlayer.imakano.skillName ?? 'スキル',
                  });
                  setTimeout(() => dispatch({ type: 'USE_SKILL' }), 1000);
                } : undefined}
                disabled={!canUseSkill}
                style={{ flexShrink: 0, cursor: canUseSkill ? 'pointer' : 'default' }}
              >
                <Portrait imakanoId={myPlayer.imakano.id} width={portraitSz} skillRing={canUseSkill} skillLabel={canUseSkill} />
              </button>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
                <p style={{ color: 'white', fontWeight: 700, fontSize: 'clamp(11px, 3vw, 15px)', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {myPlayer.imakano.name}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, lineHeight: 1.2 }}>{myPlayer.name}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                  <span style={{ fontSize: 'clamp(22px, 6vw, 34px)', fontWeight: 800, color: myHpColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums', textShadow: `0 0 18px ${myHpColor}60` }}>
                    {myPlayer.happiness}
                  </span>
                  <img src="/icons/icon-heart.png" alt="♥" style={{ width: 'clamp(15px, 4vw, 22px)', height: 'clamp(15px, 4vw, 22px)' }} draggable={false} />
                </div>
              </div>

              {!isMyTurn && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
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
                  <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9 }} className="animate-pulse">{currentPlayer.name}のターン</p>
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
      </div>
    </>
  );
}
