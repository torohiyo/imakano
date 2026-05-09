'use client';

import { useReducer, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { gameReducer, startGame } from '@/lib/gameEngine';
import { cpuDecide } from '@/lib/cpuAI';
import GameBoard from '@/components/GameBoard';

const HUMAN_IDX = 0;
const CPU_IDX = 1;

// ── In-game: drives CPU turns automatically ───────────────────────────────────
function SoloGame({ playerName }: { playerName: string }) {
  const [state, dispatch] = useReducer(
    gameReducer,
    undefined,
    () => startGame([playerName, 'CPU'])
  );

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    if (state.phase === 'finished') return;

    // Cancel any stale scheduled action
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const seq = ++seqRef.current;

    const schedule = (action: Parameters<typeof dispatch>[0], delayMs: number) => {
      timeoutRef.current = setTimeout(() => {
        if (seqRef.current === seq) dispatch(action);
      }, delayMs);
    };

    // Auto-advance phases that need no player input in solo mode
    if (state.phase === 'pass_device' && state.pending?.type === 'PASS_DEVICE') {
      schedule({ type: 'CONFIRM_DEVICE_PASSED' }, 450);
      return;
    }
    if (state.phase === 'draw') {
      // CPU draw is slightly slower so the player notices the turn changed
      schedule({ type: 'DRAW_PHASE_DONE' }, state.currentPlayerIndex === CPU_IDX ? 600 : 150);
      return;
    }
    if (state.phase === 'end_turn') {
      schedule({ type: 'END_TURN' }, 250);
      return;
    }

    // CPU decisions (including defense and discard-as-defender)
    const action = cpuDecide(state, CPU_IDX);
    if (!action) return;

    const delay =
      action.type === 'SKIP_SKILL'    ?  80 :
      action.type === 'RESOLVE_DISCARD' ? 80 :  // near-instant: hides CPU hand from modal
      action.type === 'RESOLVE_PEEK_STEAL' || action.type === 'RESOLVE_PEEK_TRASH' ? 500 :
      action.type === 'SKIP_PLAY'     ? 500 :
      action.type === 'SKIP_DEFENSE'  ? 600 :
      action.type === 'DEFEND'        ? 800 :
      750;

    schedule(action, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [state]);

  return (
    <GameBoard
      state={state}
      dispatch={dispatch}
      myPlayerIdx={HUMAN_IDX}
    />
  );
}

// ── Setup screen ──────────────────────────────────────────────────────────────
export default function SoloPage() {
  const [started, setStarted] = useState(false);
  const [name, setName] = useState('');
  const router = useRouter();

  if (started) {
    return <SoloGame playerName={name.trim() || 'プレイヤー'} />;
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 36, padding: 24,
      background: 'linear-gradient(160deg, #0a0014 0%, #08080f 60%, #100008 100%)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: 'rgba(220,80,180,0.7)', fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 10 }}>
          CPU Battle
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'white', letterSpacing: '0.04em' }}>
          一人回し
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 8 }}>
          ランダムなイマカノでCPUと対戦
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="text"
          placeholder="プレイヤー名（省略可）"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') setStarted(true); }}
          maxLength={20}
          style={{
            width: '100%', padding: '14px 16px', borderRadius: 12,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'white', fontSize: 15,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={() => setStarted(true)}
          style={{
            width: '100%', padding: '16px 0', borderRadius: 12,
            fontWeight: 800, fontSize: 16, color: 'white',
            background: 'linear-gradient(135deg, #7e1d6e, #b21b9a)',
            boxShadow: '0 0 28px rgba(178,27,154,0.4)',
            border: 'none', cursor: 'pointer',
          }}
        >
          ゲーム開始
        </button>
        <button
          onClick={() => router.push('/')}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 12,
            fontWeight: 600, fontSize: 14, color: 'rgba(255,255,255,0.4)',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            cursor: 'pointer',
          }}
        >
          戻る
        </button>
      </div>
    </div>
  );
}
