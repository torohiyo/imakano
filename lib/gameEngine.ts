import { GameState, PlayerState, CardInstance, GameLog, Pending } from './types';
import { IMAKANO_DEFS } from './imakano';
import { buildDeck, shuffle } from './cards';
import {
  HAPPINESS_MAX, HAPPINESS_MIN, INITIAL_HAND_SIZE,
  DRAW_PER_TURN, MARRIAGE_VICTORY_THRESHOLD,
  MAX_SPECIAL_PLAYS, MAX_ATTACK_PLAYS,
} from './constants';

// ===== Actions =====

export type GameAction =
  | { type: 'START_GAME'; playerNames: string[] }
  | { type: 'CONFIRM_DEVICE_PASSED' }
  | { type: 'DRAW_PHASE_DONE' }
  | { type: 'USE_SKILL'; targetPlayerIdx?: number }
  | { type: 'SKIP_SKILL' }
  | { type: 'PLAY_CARD'; cardInstanceId: string }
  | { type: 'SELECT_TARGET'; targetPlayerIdx: number }
  | { type: 'DEFEND'; cardInstanceId: string }
  | { type: 'SKIP_DEFENSE' }
  | { type: 'RESOLVE_VIEW_SELECT'; keptIds: string[] }
  | { type: 'RESOLVE_VIEW_SELECT_SPECIALS'; keptIds: string[] }
  | { type: 'RESOLVE_DISCARD'; discardedIds: string[] }
  | { type: 'RESOLVE_PEEK_STEAL'; stolenIds: string[] }
  | { type: 'RESOLVE_PEEK_TRASH'; trashedId: string | null }
  | { type: 'RESOLVE_UTSU_NOVEL'; returnToHand: boolean }
  | { type: 'SKIP_PLAY' }
  | { type: 'END_TURN' }
  | { type: 'AFK_ELIMINATE' };

// ===== Helpers =====

function clampHappiness(v: number) {
  return Math.max(HAPPINESS_MIN, Math.min(HAPPINESS_MAX, v));
}

function addLog(state: GameState, text: string, type: GameLog['type'] = 'info'): GameState {
  return {
    ...state,
    logSeq: state.logSeq + 1,
    log: [{ id: state.logSeq, text, type }, ...state.log].slice(0, 100),
  };
}

function drawCards(deck: CardInstance[], trash: CardInstance[], count: number): {
  drawn: CardInstance[];
  deck: CardInstance[];
  trash: CardInstance[];
} {
  let d = [...deck];
  let t = [...trash];
  const drawn: CardInstance[] = [];
  for (let i = 0; i < count; i++) {
    if (d.length === 0) {
      if (t.length === 0) break;
      d = shuffle(t);
      t = [];
    }
    drawn.push(d[0]);
    d = d.slice(1);
  }
  return { drawn, deck: d, trash: t };
}

function adjustHappiness(players: PlayerState[], idx: number, delta: number): PlayerState[] {
  return players.map((p, i) =>
    i === idx ? { ...p, happiness: clampHappiness(p.happiness + delta) } : p
  );
}

function removeCardFromHand(players: PlayerState[], playerIdx: number, instanceId: string): PlayerState[] {
  return players.map((p, i) =>
    i === playerIdx ? { ...p, hand: p.hand.filter(c => c.instanceId !== instanceId) } : p
  );
}

function passDevice(state: GameState, toIdx: number, reason: string): GameState {
  return {
    ...state,
    phase: 'pass_device',
    pending: { type: 'PASS_DEVICE', toPlayerIdx: toIdx, reason },
  };
}

function nextPhase(_state: GameState): GameState['phase'] {
  return 'play';
}

function randomOpponentIdx(state: GameState, selfIdx: number): number {
  const opponents = state.players.map((_, i) => i).filter(i => i !== selfIdx);
  return opponents[Math.floor(Math.random() * opponents.length)];
}

// ===== START GAME =====

export function startGame(playerNames: string[]): GameState {
  const n = playerNames.length;

  const imakanoPool = shuffle([...IMAKANO_DEFS]).slice(0, n);

  const fullDeck = buildDeck();

  const players: PlayerState[] = imakanoPool.map((imakano, i) => ({
    id: `player-${i}`,
    name: playerNames[i],
    imakano,
    happiness: imakano.initialHappiness,
    hand: [],
    skillUsedThisTurn: false,
    isWinner: false,
    isDefeated: false,
  }));

  let deck = fullDeck;
  let trash: CardInstance[] = [];
  const playersWithHands = players.map(p => {
    const { drawn, deck: d, trash: t } = drawCards(deck, trash, INITIAL_HAND_SIZE);
    deck = d; trash = t;
    return { ...p, hand: drawn };
  });

  const firstIdx = Math.floor(Math.random() * n);

  const initialLog: GameLog[] = [];
  let logSeq = 0;
  const addL = (text: string, type: GameLog['type'] = 'info') => {
    initialLog.unshift({ id: logSeq++, text, type });
  };

  playersWithHands.forEach(p => {
    addL(`${p.name} は「${p.imakano.name}」を引きました`, 'info');
  });
  addL(`先攻: ${playersWithHands[firstIdx].name}（ランダム決定）`, 'system');

  return {
    phase: 'pass_device',
    players: playersWithHands,
    deck,
    trash,
    currentPlayerIndex: firstIdx,
    pendingCard: null,
    pendingTargetIdx: null,
    pending: {
      type: 'PASS_DEVICE',
      toPlayerIdx: firstIdx,
      reason: `ゲーム開始！${playersWithHands[firstIdx].name} さんのターンです`,
    },
    log: initialLog,
    logSeq,
    winner: null,
    turnNumber: 1,
    specialPlaysThisTurn: 0,
    attackPlaysThisTurn: 0,
    lastPlayedCard: null,
  };
}

// ===== REDUCER =====

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {

    // ===== デバイスパス確認 =====
    case 'CONFIRM_DEVICE_PASSED': {
      return { ...state, phase: 'draw', pending: null };
    }

    // ===== ドローフェーズ =====
    case 'DRAW_PHASE_DONE': {
      const cur = state.currentPlayerIndex;
      const { drawn, deck, trash } = drawCards(state.deck, state.trash, DRAW_PER_TURN);
      let s: GameState = { ...state, deck, trash };
      const players = s.players.map((p, i) =>
        i === cur ? { ...p, hand: [...p.hand, ...drawn] } : p
      );
      s = { ...s, players, phase: 'skill' };
      for (const c of drawn) {
        s = addLog(s, `${players[cur].name} が1枚引きました`, 'info');
      }
      const curPlayer = players[cur];
      if (!curPlayer.imakano.skillKey) {
        s = { ...s, phase: 'play' };
      }
      return s;
    }

    // ===== スキルフェーズ =====
    case 'USE_SKILL': {
      const cur = state.currentPlayerIndex;
      const player = state.players[cur];
      const sk = player.imakano.skillKey;
      if (!sk || player.skillUsedThisTurn) return state;

      switch (sk) {
        case 'skill_musician':
        case 'skill_otaku': {
          const sameCount = state.players.filter(p => p.happiness === player.happiness).length;
          const drawCount = Math.max(1, sameCount);
          const { drawn, deck, trash } = drawCards(state.deck, state.trash, drawCount);
          const players = state.players.map((p, i) => {
            if (i === cur) return { ...p, hand: [...p.hand, ...drawn], skillUsedThisTurn: true };
            return p;
          });
          const players2 = adjustHappiness(players, cur, 1);
          const s = addLog({ ...state, players: players2, deck, trash }, `【スキル】${player.name}「${player.imakano.skillName}」: ${drawCount}枚引いて幸せゲージ+1`, 'skill');
          return { ...s, phase: 'play' };
        }
        case 'skill_yankee': {
          const targetIdx = action.targetPlayerIdx ?? randomOpponentIdx(state, cur);
          const target = state.players[targetIdx];
          const peekCount = Math.min(3, target.hand.length);
          const peeked = target.hand.slice(0, peekCount);
          const players = state.players.map((p, i) =>
            i === cur ? { ...p, skillUsedThisTurn: true } : p
          );
          const s = addLog({ ...state, players }, `【スキル】${player.name}「ヤンキー」: ${target.name} の手札${peekCount}枚を見ます`, 'skill');
          return { ...s, pending: { type: 'PEEK_STEAL', targetIdx, peekedCards: peeked } };
        }
        case 'skill_jirai': {
          const n = state.players.length;
          const rightIdx = (cur + 1) % n;
          const rightPlayer = state.players[rightIdx];
          let players = state.players.map((p, i) => i === cur ? { ...p, skillUsedThisTurn: true } : p);
          let s: GameState = { ...state, players };
          if (rightPlayer.happiness < player.happiness) {
            players = adjustHappiness(players, cur, 2);
            s = addLog({ ...s, players }, `【スキル】${player.name}「地雷踏んだ」: 右隣より低いので幸せゲージ+2`, 'skill');
          } else {
            s = addLog(s, `【スキル】${player.name}「地雷踏んだ」: 条件未達成。何も起きない`, 'skill');
          }
          return { ...s, phase: 'play' };
        }
        default:
          return state;
      }
    }

    case 'SKIP_SKILL': {
      return { ...state, phase: 'play' };
    }

    // ===== カードプレイ =====
    case 'PLAY_CARD': {
      const cur = state.currentPlayerIndex;
      const card = state.players[cur].hand.find(c => c.instanceId === action.cardInstanceId);
      if (!card) return state;

      // 防御札は反応フェーズ専用。プレイフェーズでは使えない
      if (card.def.type === 'defense') return state;
      // 先攻1ターン目は攻撃不可
      if (card.def.type === 'attack' && state.turnNumber === 1) return state;
      // プレイ回数チェック
      if (card.def.type === 'attack' && state.attackPlaysThisTurn >= MAX_ATTACK_PLAYS) return state;
      if (card.def.type === 'special' && state.specialPlaysThisTurn >= MAX_SPECIAL_PLAYS) return state;

      const players = removeCardFromHand(state.players, cur, action.cardInstanceId);
      let s: GameState = {
        ...state,
        players,
        pendingCard: card,
        lastPlayedCard: card,
        attackPlaysThisTurn: card.def.type === 'attack'
          ? state.attackPlaysThisTurn + 1
          : state.attackPlaysThisTurn,
        specialPlaysThisTurn: card.def.type === 'special'
          ? state.specialPlaysThisTurn + 1
          : state.specialPlaysThisTurn,
      };

      switch (card.def.effectKey) {
        // ---- 攻撃系（ランダムで対象自動選択） ----
        case 'attack':
        case 'super_attack':
        case 'ultra_attack':
        case 'spy': {
          const targetIdx = randomOpponentIdx(s, cur);
          const target = s.players[targetIdx];
          if (card.def.effectKey === 'spy') {
            const s2 = addLog(s, `${s.players[cur].name}「スパイ」: ${target.name} の手札を確認`, 'skill');
            return { ...s2, pendingTargetIdx: targetIdx, pending: { type: 'PEEK_TRASH', targetIdx, peekedCards: target.hand } };
          }
          const s2 = addLog(s, `${s.players[cur].name} が ${target.name} に「${card.def.name}」を使用！`, 'attack');
          return { ...s2, phase: 'defense', pendingTargetIdx: targetIdx, pending: { type: 'DEFENSE_REACTION', attackerIdx: cur, targetIdx, attackCard: card } };
        }

        // ---- 幸せゲージ増加系 ----
        case 'ring': return resolveHappinessCard(s, cur, 4);
        case 'house': return resolveHappinessCard(s, cur, 3);
        case 'pet': return resolveHappinessCard(s, cur, 2);
        case 'disney': return resolveHappinessCard(s, cur, 1);

        // ---- ドロー系 ----
        case 'bestfriend': {
          const { drawn, deck, trash } = drawCards(s.deck, s.trash, 3);
          const ps = s.players.map((p, i) => i === cur ? { ...p, hand: [...p.hand, ...drawn] } : p);
          s = addLog({ ...s, players: ps, deck, trash }, `${ps[cur].name}「イマカノの親友」: 3枚引いた`, 'info');
          s = trashCard(s, card, cur);
          return { ...s, pendingCard: null, phase: nextPhase(s) };
        }
        case 'father': {
          if (s.players[cur].happiness >= 7) {
            const { drawn, deck, trash } = drawCards(s.deck, s.trash, 5);
            const ps = s.players.map((p, i) => i === cur ? { ...p, hand: [...p.hand, ...drawn] } : p);
            s = addLog({ ...s, players: ps, deck, trash }, `${ps[cur].name}「イマカノの父親」: 幸せゲージ7以上！5枚引いた`, 'info');
          } else {
            s = addLog(s, `${s.players[cur].name}「イマカノの父親」: 幸せゲージ不足。効果なし`, 'info');
          }
          s = trashCard(s, card, cur);
          return { ...s, pendingCard: null, phase: nextPhase(s) };
        }
        case 'sister': {
          const top4 = s.deck.slice(0, 4);
          const remaining = s.deck.slice(4);
          s = addLog({ ...s, deck: remaining }, `${s.players[cur].name}「イマカノの妹」: 山札上4枚を確認`, 'info');
          return { ...s, pending: { type: 'VIEW_SELECT', viewedCards: top4, keepCount: 2, label: '2枚を手札に加える' } };
        }
        case 'letter': {
          const top7 = s.deck.slice(0, 7);
          const remaining = s.deck.slice(7);
          s = addLog({ ...s, deck: remaining }, `${s.players[cur].name}「イマカノの手紙」: 山札上7枚を確認`, 'info');
          return { ...s, pending: { type: 'VIEW_SELECT_SPECIALS', viewedCards: top7 } };
        }
        case 'utsu_novel': {
          let ps = s.players.map((p, i) => i !== cur ? { ...p, happiness: clampHappiness(p.happiness - 1) } : p);
          s = addLog({ ...s, players: ps }, `${ps[cur].name}「鬱小説」: 全員の幸せゲージ -1`, 'attack');
          return { ...s, pending: { type: 'UTSU_NOVEL_CHOICE' } };
        }
        case 'marriage': {
          // 勝利条件: 幸せゲージ10以上で婚姻届をプレイ
          if (s.players[cur].happiness >= MARRIAGE_VICTORY_THRESHOLD) {
            s = trashCard(s, card, cur);
            return endGame({ ...s, pendingCard: null }, s.players[cur]);
          } else {
            s = addLog(s, `${s.players[cur].name}「婚姻届」: 幸せゲージが足りない（${s.players[cur].happiness}/${MARRIAGE_VICTORY_THRESHOLD}）`, 'info');
            s = trashCard(s, card, cur);
            return { ...s, pendingCard: null, phase: nextPhase(s) };
          }
        }
        default:
          s = trashCard(s, card, cur);
          return { ...s, pendingCard: null, phase: nextPhase(s) };
      }
    }

    // ===== ターゲット選択 =====
    case 'SELECT_TARGET': {
      const cur = state.currentPlayerIndex;
      const targetIdx = action.targetPlayerIdx;
      const pending = state.pending;
      if (!pending) return state;

      if (pending.type === 'SELECT_TARGET' && pending.source === 'skill') {
        return gameReducer(
          { ...state, pending: null },
          { type: 'USE_SKILL', targetPlayerIdx: targetIdx }
        );
      }

      if (pending.type === 'SELECT_TARGET' && pending.source === 'card') {
        const card = state.pendingCard;
        if (!card) return state;
        let s: GameState = { ...state, pending: null, pendingTargetIdx: targetIdx };

        if (card.def.effectKey === 'spy') {
          const target = state.players[targetIdx];
          s = addLog(s, `${state.players[cur].name}「スパイ」: ${target.name} の手札を確認`, 'skill');
          return { ...s, pending: { type: 'PEEK_TRASH', targetIdx, peekedCards: target.hand } };
        }

        s = addLog(s, `${s.players[cur].name} が ${s.players[targetIdx].name} に「${card.def.name}」を使用！`, 'attack');
        return { ...s, phase: 'defense', pending: { type: 'DEFENSE_REACTION', attackerIdx: cur, targetIdx, attackCard: card } };
      }

      return state;
    }

    // ===== 防御リアクション =====
    case 'DEFEND': {
      const pending = state.pending;
      if (!pending || pending.type !== 'DEFENSE_REACTION') return state;
      const { attackerIdx, targetIdx, attackCard } = pending;
      const defCard = state.players[targetIdx].hand.find(c => c.instanceId === action.cardInstanceId);
      if (!defCard || defCard.def.effectKey !== 'defense') return state;

      let s: GameState = { ...state, pending: null };
      const ps = removeCardFromHand(s.players, targetIdx, defCard.instanceId);
      s = { ...s, players: ps };
      s = addLog(s, `${ps[targetIdx].name}「防御」発動！手札1枚トラッシュが必要`, 'defense');
      s = { ...s, pendingCard: null };
      s = trashCard(s, defCard, targetIdx);
      s = trashCard(s, attackCard, attackerIdx);
      return { ...s, phase: 'play', pending: { type: 'DISCARD', count: 1, cause: '防御コスト' } };
    }

    case 'SKIP_DEFENSE': {
      const pending = state.pending;
      if (!pending || pending.type !== 'DEFENSE_REACTION') return state;
      const { attackerIdx, targetIdx, attackCard } = pending;
      let s: GameState = { ...state, pending: null, phase: 'resolve' as const };
      s = applyAttack(s, attackerIdx, targetIdx, attackCard);
      s = trashCard(s, attackCard, attackerIdx);
      s = { ...s, pendingCard: null, pendingTargetIdx: null };
      return { ...s, phase: 'play' };
    }

    // ===== インタラクション解決 =====
    case 'RESOLVE_VIEW_SELECT': {
      const cur = state.currentPlayerIndex;
      const pending = state.pending;
      if (!pending || pending.type !== 'VIEW_SELECT') return state;
      const { viewedCards, keepCount } = pending;
      const kept = viewedCards.filter(c => action.keptIds.includes(c.instanceId));
      const putBack = viewedCards.filter(c => !action.keptIds.includes(c.instanceId));
      if (kept.length !== keepCount) return state;
      const players = state.players.map((p, i) =>
        i === cur ? { ...p, hand: [...p.hand, ...kept] } : p
      );
      const deck = [...state.deck, ...putBack];
      const card = state.pendingCard;
      let s: GameState = addLog({ ...state, players, deck, pending: null }, `${players[cur].name}「イマカノの妹」: 2枚手札に加えた`, 'info');
      if (card) s = trashCard(s, card, cur);
      return { ...s, pendingCard: null, phase: nextPhase(s) };
    }

    case 'RESOLVE_VIEW_SELECT_SPECIALS': {
      const cur = state.currentPlayerIndex;
      const pending = state.pending;
      if (!pending || pending.type !== 'VIEW_SELECT_SPECIALS') return state;
      const { viewedCards } = pending;
      const kept = viewedCards.filter(c => action.keptIds.includes(c.instanceId));
      const putBack = viewedCards.filter(c => !action.keptIds.includes(c.instanceId));
      const players = state.players.map((p, i) =>
        i === cur ? { ...p, hand: [...p.hand, ...kept] } : p
      );
      const deck = [...state.deck, ...putBack];
      const card = state.pendingCard;
      let s: GameState = addLog({ ...state, players, deck, pending: null }, `${players[cur].name}「イマカノの手紙」: ${kept.length}枚の特殊札を手札に加えた`, 'info');
      if (card) s = trashCard(s, card, cur);
      return { ...s, pendingCard: null, phase: nextPhase(s) };
    }

    case 'RESOLVE_DISCARD': {
      const pending = state.pending;
      if (!pending || pending.type !== 'DISCARD') return state;
      const playerIdx = state.pendingTargetIdx ?? state.currentPlayerIndex;
      let s: GameState = { ...state, pending: null };
      const discarded = state.players[playerIdx].hand.filter(c =>
        action.discardedIds.includes(c.instanceId)
      );
      const players = state.players.map((p, i) =>
        i === playerIdx ? { ...p, hand: p.hand.filter(c => !action.discardedIds.includes(c.instanceId)) } : p
      );
      s = { ...s, players };
      for (const c of discarded) {
        s = trashCard(s, c, playerIdx);
      }
      s = addLog(s, `${state.players[playerIdx].name} が${discarded.length}枚トラッシュ（${pending.cause}）`, 'info');
      return { ...s, phase: 'play' };
    }

    case 'RESOLVE_PEEK_STEAL': {
      const cur = state.currentPlayerIndex;
      const pending = state.pending;
      if (!pending || pending.type !== 'PEEK_STEAL') return state;
      const { targetIdx, peekedCards } = pending;
      const stolen = peekedCards.filter(c => action.stolenIds.includes(c.instanceId));
      let players = state.players.map((p, i) => {
        if (i === targetIdx) return { ...p, hand: p.hand.filter(c => !action.stolenIds.includes(c.instanceId)) };
        if (i === cur) return { ...p, hand: [...p.hand, ...stolen] };
        return p;
      });
      let s: GameState = { ...state, players, pending: null };
      if (stolen.length > 0) {
        players = adjustHappiness(players, cur, 1);
        s = addLog({ ...s, players }, `【スキル】${players[cur].name}「ヤンキー」: 防御札${stolen.length}枚を奪い幸せゲージ+1`, 'skill');
      } else {
        s = addLog(s, `【スキル】${players[cur].name}「ヤンキー」: 防御札なし。効果なし`, 'skill');
      }
      return { ...s, phase: 'play' };
    }

    case 'RESOLVE_PEEK_TRASH': {
      const cur = state.currentPlayerIndex;
      const pending = state.pending;
      if (!pending || pending.type !== 'PEEK_TRASH') return state;
      const { targetIdx } = pending;
      const card = state.pendingCard;
      let s: GameState = { ...state, pending: null };
      if (action.trashedId) {
        const trashed = state.players[targetIdx].hand.find(c => c.instanceId === action.trashedId);
        if (trashed) {
          const players = removeCardFromHand(s.players, targetIdx, action.trashedId);
          s = trashCard({ ...s, players }, trashed, targetIdx);
          s = addLog(s, `${s.players[cur].name}「スパイ」: ${s.players[targetIdx].name} の防御札をトラッシュ`, 'attack');
        }
      } else {
        s = addLog(s, `${s.players[cur].name}「スパイ」: 防御札なし`, 'info');
      }
      if (card) s = trashCard(s, card, cur);
      return { ...s, pendingCard: null, pendingTargetIdx: null, phase: nextPhase(s) };
    }

    case 'RESOLVE_UTSU_NOVEL': {
      const cur = state.currentPlayerIndex;
      const card = state.pendingCard;
      let s: GameState = { ...state, pending: null };
      if (action.returnToHand && s.players[cur].happiness >= 2) {
        const players = adjustHappiness(s.players, cur, -2);
        const ps = players.map((p, i) =>
          i === cur && card ? { ...p, hand: [...p.hand, card] } : p
        );
        s = addLog({ ...s, players: ps }, `${ps[cur].name}「鬱小説」: 幸せゲージ-2 → 手札に戻した`, 'info');
      } else {
        if (card) s = trashCard(s, card, cur);
        s = addLog(s, `${s.players[cur].name}「鬱小説」: トラッシュ`, 'info');
      }
      return { ...s, pendingCard: null, phase: nextPhase(s) };
    }

    case 'SKIP_PLAY': {
      return { ...state, phase: 'end_turn' };
    }

    // ===== ターン終了 =====
    case 'END_TURN': {
      if (state.players.some(p => p.happiness < 0)) {
        return endGameByHappiness(state);
      }
      const n = state.players.length;
      const nextIdx = (state.currentPlayerIndex + 1) % n;
      const nextPlayer = state.players[nextIdx];
      const players = state.players.map((p, i) =>
        i === nextIdx ? { ...p, skillUsedThisTurn: false } : p
      );
      let s: GameState = addLog({ ...state, players }, `--- ${nextPlayer.name} のターン ---`, 'system');
      s = {
        ...s,
        currentPlayerIndex: nextIdx,
        pendingCard: null,
        pendingTargetIdx: null,
        turnNumber: state.turnNumber + 1,
        specialPlaysThisTurn: 0,
        attackPlaysThisTurn: 0,
      };
      return passDevice(s, nextIdx, `${nextPlayer.name} さんのターンです`);
    }

    // ===== 離席失格 =====
    case 'AFK_ELIMINATE': {
      const cur = state.currentPlayerIndex;
      const players = state.players.map((p, i) => i === cur ? { ...p, isDefeated: true } : p);
      let s: GameState = addLog({ ...state, players }, `${state.players[cur].name} が離席により失格`, 'system');
      const active = players.filter(p => !p.isDefeated);
      if (active.length <= 1) {
        return endGame(s, active[0] ?? players[0]);
      }
      const n = players.length;
      let nextIdx = (cur + 1) % n;
      while (players[nextIdx].isDefeated) nextIdx = (nextIdx + 1) % n;
      s = { ...s, currentPlayerIndex: nextIdx, specialPlaysThisTurn: 0, attackPlaysThisTurn: 0, pendingCard: null, pendingTargetIdx: null, pending: null, turnNumber: state.turnNumber + 1 };
      return passDevice(s, nextIdx, `${players[nextIdx].name} のターンです`);
    }

    default:
      return state;
  }
}

// ===== 内部ヘルパー =====

function resolveHappinessCard(state: GameState, playerIdx: number, delta: number): GameState {
  const card = state.pendingCard!;
  const players = adjustHappiness(state.players, playerIdx, delta);
  let s: GameState = addLog({ ...state, players }, `${players[playerIdx].name}「${card.def.name}」: 幸せゲージ+${delta} → ${players[playerIdx].happiness}`, 'happiness');
  s = trashCard(s, card, playerIdx);
  return { ...s, pendingCard: null, phase: nextPhase(s) };
}

function applyAttack(state: GameState, attackerIdx: number, targetIdx: number, card: CardInstance): GameState {
  const ek = card.def.effectKey;
  let s = state;
  if (ek === 'attack') {
    const players = adjustHappiness(s.players, targetIdx, -1);
    s = addLog({ ...s, players }, `${players[targetIdx].name} の幸せゲージ -1 → ${players[targetIdx].happiness}`, 'attack');
  } else if (ek === 'super_attack') {
    let players = adjustHappiness(s.players, targetIdx, -2);
    players = adjustHappiness(players, attackerIdx, -1);
    s = addLog({ ...s, players }, `${players[targetIdx].name} の幸せゲージ -2、${players[attackerIdx].name} の幸せゲージ -1`, 'attack');
  } else if (ek === 'ultra_attack') {
    let players = adjustHappiness(s.players, targetIdx, -3);
    players = adjustHappiness(players, attackerIdx, -2);
    s = addLog({ ...s, players }, `${players[targetIdx].name} の幸せゲージ -3、${players[attackerIdx].name} の幸せゲージ -2`, 'attack');
  }
  return s;
}

function trashCard(state: GameState, card: CardInstance, _playerIdx: number): GameState {
  return { ...state, trash: [card, ...state.trash] };
}

function canDefend(defKey: string, _attackKey: string): boolean {
  return defKey === 'defense';
}

function endGameByHappiness(state: GameState): GameState {
  const winner = [...state.players].sort((a, b) => b.happiness - a.happiness)[0];
  const players = state.players.map(p => p.id === winner.id ? { ...p, isWinner: true } : p);
  const s: GameState = addLog({ ...state, players },
    `💔 幸せゲージがマイナスに！${winner.name} の勝利（幸せ: ${winner.happiness}）`, 'win');
  return { ...s, phase: 'finished', winner };
}

function endGame(state: GameState, winner: PlayerState): GameState {
  const players = state.players.map(p => p.id === winner.id ? { ...p, isWinner: true } : p);
  const s: GameState = addLog({ ...state, players }, `🎊 ${winner.name} が婚姻届を提出！結婚勝利！`, 'win');
  return { ...s, phase: 'finished', winner };
}

// ===== スキル発動条件チェック（UI用） =====
export function skillConditionMet(state: GameState, playerIdx: number): boolean {
  const player = state.players[playerIdx];
  const sk = player.imakano.skillKey;
  if (!sk) return false;
  switch (sk) {
    case 'skill_musician':
    case 'skill_otaku':
      return state.players.some((p, i) => i !== playerIdx && p.happiness === player.happiness);
    case 'skill_jirai': {
      const rightIdx = (playerIdx + 1) % state.players.length;
      return player.happiness > state.players[rightIdx].happiness;
    }
    default:
      return true;
  }
}
