import { GameState, CardInstance } from './types';
import { GameAction, skillConditionMet } from './gameEngine';
import { MARRIAGE_VICTORY_THRESHOLD, MAX_ATTACK_PLAYS, MAX_SPECIAL_PLAYS } from './constants';

// ── Card value for keeping (higher = more worth keeping) ─────────────────────
function keepValue(card: CardInstance, state: GameState, playerIdx: number): number {
  const p = state.players[playerIdx];
  switch (card.def.effectKey) {
    case 'marriage':    return p.happiness >= MARRIAGE_VICTORY_THRESHOLD ? 100 : 25;
    case 'ultra_defense': return 88;
    case 'ring':        return 82;
    case 'super_defense': return 76;
    case 'house':       return 70;
    case 'ultra_attack': return 66;
    case 'defense':     return 64;
    case 'super_attack': return 58;
    case 'letter':      return 54;
    case 'attack':      return 50;
    case 'bestfriend':  return 46;
    case 'father':      return p.happiness >= 7 ? 68 : 30;
    case 'sister':      return 40;
    case 'pet':         return 36;
    case 'utsu_novel':  return 28;
    case 'disney':      return 24;
    default:            return 18;
  }
}

// ── Card priority for playing (higher = play sooner, <0 = don't play) ────────
function playScore(card: CardInstance, state: GameState, cpuIdx: number): number {
  const cpu = state.players[cpuIdx];
  const oppIdx = state.players.findIndex((_, i) => i !== cpuIdx);
  const opp = state.players[oppIdx];

  switch (card.def.effectKey) {
    case 'marriage':
      return cpu.happiness >= MARRIAGE_VICTORY_THRESHOLD ? 1000 : -1;
    case 'ring':        return 84;
    case 'house':       return 72;
    case 'ultra_attack':
      return opp.happiness >= 5 ? 78 : opp.happiness >= 3 ? 48 : 14;
    case 'super_attack':
      return opp.happiness >= 4 ? 66 : opp.happiness >= 2 ? 38 : 10;
    case 'attack':
      return opp.happiness >= 3 ? 54 : 18;
    case 'letter':      return 58;
    case 'bestfriend':  return 50;
    case 'father':      return cpu.happiness >= 7 ? 68 : 12;
    case 'pet':         return 40;
    case 'sister':      return 36;
    case 'utsu_novel':
      return opp.happiness > cpu.happiness + 1 ? 46 : 18;
    case 'spy':
      return opp.happiness >= 3 ? 36 : 18;
    case 'disney':      return 26;
    default:            return 5;
  }
}

// ── Defense decision ──────────────────────────────────────────────────────────
function cpuDefenseDecision(
  state: GameState,
  cpuIdx: number,
  attackCard: CardInstance,
): GameAction {
  const cpu = state.players[cpuIdx];
  const dmg =
    attackCard.def.effectKey === 'ultra_attack' ? 3 :
    attackCard.def.effectKey === 'super_attack'  ? 2 : 1;
  const hpAfter = cpu.happiness - dmg;

  const defCards = cpu.hand.filter(c =>
    ['defense', 'super_defense', 'ultra_defense'].includes(c.def.effectKey)
  );

  // Skip if HP stays above safe threshold or no defense cards
  if (defCards.length === 0 || hpAfter >= 2) return { type: 'SKIP_DEFENSE' };

  // Use the cheapest defense card first (save stronger ones)
  const card =
    defCards.find(c => c.def.effectKey === 'defense') ??
    defCards.find(c => c.def.effectKey === 'super_defense') ??
    defCards[0];
  return { type: 'DEFEND', cardInstanceId: card.instanceId };
}

// ── Resolve pending interactions ──────────────────────────────────────────────
function cpuResolvePending(
  state: GameState,
  cpuIdx: number,
  pending: NonNullable<GameState['pending']>,
): GameAction | null {
  switch (pending.type) {
    case 'VIEW_SELECT': {
      const { viewedCards, keepCount } = pending;
      const sorted = [...viewedCards].sort(
        (a, b) => keepValue(b, state, cpuIdx) - keepValue(a, state, cpuIdx)
      );
      return { type: 'RESOLVE_VIEW_SELECT', keptIds: sorted.slice(0, keepCount).map(c => c.instanceId) };
    }
    case 'VIEW_SELECT_SPECIALS': {
      const keptIds = pending.viewedCards
        .filter(c => c.def.type === 'special')
        .map(c => c.instanceId);
      return { type: 'RESOLVE_VIEW_SELECT_SPECIALS', keptIds };
    }
    case 'DISCARD': {
      const playerIdx = state.pendingTargetIdx ?? state.currentPlayerIndex;
      const hand = state.players[playerIdx].hand;
      const sorted = [...hand].sort(
        (a, b) => keepValue(a, state, playerIdx) - keepValue(b, state, playerIdx)
      );
      const discardedIds = sorted
        .slice(0, Math.min(pending.count, hand.length))
        .map(c => c.instanceId);
      return { type: 'RESOLVE_DISCARD', discardedIds };
    }
    case 'PEEK_STEAL': {
      const stolenIds = pending.peekedCards
        .filter(c => c.def.type === 'defense')
        .map(c => c.instanceId);
      return { type: 'RESOLVE_PEEK_STEAL', stolenIds };
    }
    case 'PEEK_TRASH': {
      const defCard =
        pending.peekedCards.find(c => c.def.effectKey === 'ultra_defense') ??
        pending.peekedCards.find(c => c.def.effectKey === 'super_defense') ??
        pending.peekedCards.find(c => c.def.effectKey === 'defense');
      return { type: 'RESOLVE_PEEK_TRASH', trashedId: defCard?.instanceId ?? null };
    }
    case 'UTSU_NOVEL_CHOICE': {
      const cpu = state.players[cpuIdx];
      return { type: 'RESOLVE_UTSU_NOVEL', returnToHand: cpu.happiness >= 2 };
    }
    default:
      return null;
  }
}

// ── Card play decision ────────────────────────────────────────────────────────
function cpuPlayCard(state: GameState, cpuIdx: number): GameAction {
  const cpu = state.players[cpuIdx];

  const playable = cpu.hand.filter(c => {
    if (c.def.type === 'defense') return false;
    if (c.def.type === 'attack' && state.turnNumber === 1 && state.currentPlayerIndex === cpuIdx) return false;
    if (c.def.type === 'attack' && state.attackPlaysThisTurn >= MAX_ATTACK_PLAYS) return false;
    if (c.def.type === 'special' && state.specialPlaysThisTurn >= MAX_SPECIAL_PLAYS) return false;
    if (c.def.effectKey === 'marriage' && cpu.happiness < MARRIAGE_VICTORY_THRESHOLD) return false;
    return true;
  });

  if (playable.length === 0) return { type: 'SKIP_PLAY' };

  const best = playable.reduce((b, c) =>
    playScore(c, state, cpuIdx) > playScore(b, state, cpuIdx) ? c : b
  );

  if (playScore(best, state, cpuIdx) < 0) return { type: 'SKIP_PLAY' };

  return { type: 'PLAY_CARD', cardInstanceId: best.instanceId };
}

// ── Main decision function ────────────────────────────────────────────────────
export function cpuDecide(state: GameState, cpuIdx: number): GameAction | null {
  const { phase, pending, currentPlayerIndex: cur } = state;

  // Defense reaction: CPU is the defender (any turn)
  if (phase === 'defense' && pending?.type === 'DEFENSE_REACTION' && pending.targetIdx === cpuIdx) {
    return cpuDefenseDecision(state, cpuIdx, pending.attackCard);
  }

  // Discard cost: CPU is the target (may be non-CPU's turn after CPU defends)
  if (phase === 'play' && pending?.type === 'DISCARD') {
    const targetIdx = state.pendingTargetIdx ?? cur;
    if (targetIdx === cpuIdx) return cpuResolvePending(state, cpuIdx, pending);
  }

  // All other phases: only act on CPU's own turn
  if (cur !== cpuIdx) return null;

  switch (phase) {
    case 'draw':
      return { type: 'DRAW_PHASE_DONE' };

    case 'skill': {
      const cpu = state.players[cpuIdx];
      if (!cpu.skillUsedThisTurn && cpu.imakano.skillKey && skillConditionMet(state, cpuIdx)) {
        if (cpu.imakano.skillKey === 'skill_yankee') {
          const oppIdx = state.players.findIndex((_, i) => i !== cpuIdx);
          return { type: 'USE_SKILL', targetPlayerIdx: oppIdx };
        }
        return { type: 'USE_SKILL' };
      }
      return { type: 'SKIP_SKILL' };
    }

    case 'play':
      if (pending) return cpuResolvePending(state, cpuIdx, pending);
      return cpuPlayCard(state, cpuIdx);

    case 'end_turn':
      return { type: 'END_TURN' };

    default:
      return null;
  }
}
