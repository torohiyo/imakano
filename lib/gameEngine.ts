'use client';

import { GameState, PlayerState, CardInstance, GameLog, Pending } from './types';
import { IMAKANO_DEFS, RENTAL_IMAKANO } from './imakano';
import { buildDeck, shuffle } from './cards';
import {
  HAPPINESS_MAX, HAPPINESS_MIN, INITIAL_HAND_SIZE,
  DRAW_PER_TURN, MARRIAGE_VICTORY_THRESHOLD,
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
  | { type: 'END_TURN' };

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

function checkWin(players: PlayerState[]): PlayerState | null {
  return players.find(p => p.happiness >= MARRIAGE_VICTORY_THRESHOLD) ?? null;
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

// ===== START GAME =====

export function startGame(playerNames: string[]): GameState {
  const n = playerNames.length;

  // イマカノカードをシャッフル（n+1枚使用）
  const imakanoPool = shuffle([...IMAKANO_DEFS]).slice(0, n + 1);
  const dealt = imakanoPool.slice(0, n);
  // 未使用1枚は場に残るだけ

  // 全デッキを生成してシャッフル
  const fullDeck = buildDeck();

  // プレイヤー生成
  const players: PlayerState[] = dealt.map((imakano, i) => {
    const isNoGf = imakano.id === 'no_girlfriend';
    const actualImakano = isNoGf ? RENTAL_IMAKANO : imakano;
    return {
      id: `player-${i}`,
      name: playerNames[i],
      imakano: actualImakano,
      happiness: actualImakano.initialHappiness,
      hand: [],
      skillUsedThisTurn: false,
      isWinner: false,
      isDefeated: false,
    };
  });

  // 手札配布
  let deck = fullDeck;
  let trash: CardInstance[] = [];
  const playersWithHands = players.map(p => {
    const { drawn, deck: d, trash: t } = drawCards(deck, trash, INITIAL_HAND_SIZE);
    deck = d; trash = t;
    return { ...p, hand: drawn };
  });

  // 先攻決定: レンタルイマカノのプレイヤー→それ以外はランダム
  const rentalIdx = playersWithHands.findIndex(p => p.imakano.isRental);
  const firstIdx = rentalIdx >= 0 ? rentalIdx : Math.floor(Math.random() * n);

  const noGfPlayer = playersWithHands.find(p => p.imakano.isRental);

  const initialLog: GameLog[] = [];
  let logSeq = 0;
  const addL = (text: string, type: GameLog['type'] = 'info') => {
    initialLog.unshift({ id: logSeq++, text, type });
  };

  playersWithHands.forEach((p, i) => {
    addL(`${p.name} は「${p.imakano.name}」を引きました`, 'info');
  });
  if (noGfPlayer) {
    addL(`【${noGfPlayer.name}】「彼女いないです」`, 'system');
    addL(`${noGfPlayer.name} はレンタルイマカノを受け取り、先攻になりました`, 'system');
  } else {
    addL(`先攻: ${playersWithHands[firstIdx].name}（ランダム決定）`, 'system');
  }

  const state: GameState = {
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
  };

  return state;
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
      let s = { ...state, deck, trash };
      const players = s.players.map((p, i) =>
        i === cur ? { ...p, hand: [...p.hand, ...drawn] } : p
      );
      s = { ...s, players, phase: 'skill' };
      for (const c of drawn) {
        s = addLog(s, `${players[cur].name} が1枚引きました`, 'info');
      }
      // スキルを持っていないプレイヤーはスキルフェーズをスキップ
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
          const winner = checkWin(players2);
          let s = addLog({ ...state, players: players2, deck, trash }, `【スキル】${player.name}「${player.imakano.skillName}」: ${drawCount}枚引いて幸せゲージ+1`, 'skill');
          if (winner) return endGame(s, winner);
          return { ...s, phase: 'play' };
        }
        case 'skill_yankee': {
          if (action.targetPlayerIdx === undefined) {
            // ターゲット選択が必要
            return { ...state, pending: { type: 'SELECT_TARGET', source: 'skill', skillKey: sk } };
          }
          const targetIdx = action.targetPlayerIdx;
          const target = state.players[targetIdx];
          const peekCount = Math.min(3, target.hand.length);
          const peeked = target.hand.slice(0, peekCount);
          const players = state.players.map((p, i) =>
            i === cur ? { ...p, skillUsedThisTurn: true } : p
          );
          let s = addLog({ ...state, players }, `【スキル】${player.name}「ヤンキー」: ${target.name} の手札${peekCount}枚を見ます`, 'skill');
          return { ...s, pending: { type: 'PEEK_STEAL', targetIdx, peekedCards: peeked } };
        }
        case 'skill_jirai': {
          const n = state.players.length;
          const rightIdx = (cur + 1) % n;
          const rightPlayer = state.players[rightIdx];
          let s = { ...state };
          let players = s.players.map((p, i) => i === cur ? { ...p, skillUsedThisTurn: true } : p);
          if (rightPlayer.happiness < player.happiness) {
            players = adjustHappiness(players, cur, 2);
            s = addLog({ ...s, players }, `【スキル】${player.name}「地雷踏んだ」: 右隣より低いので幸せゲージ+2`, 'skill');
            const winner = checkWin(players);
            if (winner) return endGame(s, winner);
          } else {
            s = addLog({ ...s, players }, `【スキル】${player.name}「地雷踏んだ」: 条件未達成。何も起きない`, 'skill');
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

      // 手札から除く
      const players = removeCardFromHand(state.players, cur, action.cardInstanceId);
      let s: GameState = { ...state, players, pendingCard: card };

      switch (card.def.effectKey) {
        // ---- 攻撃系（ターゲット選択が必要） ----
        case 'attack':
        case 'super_attack':
        case 'ultra_attack':
        case 'spy':
          return { ...s, pending: { type: 'SELECT_TARGET', source: 'card', cardInstanceId: action.cardInstanceId } };

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
          return trashCard(s, card, cur);
        }
        case 'father': {
          if (s.players[cur].happiness >= 7) {
            const { drawn, deck, trash } = drawCards(s.deck, s.trash, 5);
            const ps = s.players.map((p, i) => i === cur ? { ...p, hand: [...p.hand, ...drawn] } : p);
            s = addLog({ ...s, players: ps, deck, trash }, `${ps[cur].name}「イマカノの父親」: 幸せゲージ7以上！5枚引いた`, 'info');
          } else {
            s = addLog(s, `${s.players[cur].name}「イマカノの父親」: 幸せゲージ不足。効果なし`, 'info');
          }
          return trashCard(s, card, cur);
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
          // 全員 -1
          let ps = s.players.map((p, i) => i !== cur ? { ...p, happiness: clampHappiness(p.happiness - 1) } : p);
          s = addLog({ ...s, players: ps }, `${ps[cur].name}「鬱小説」: 全員の幸せゲージ -1`, 'attack');
          return { ...s, pending: { type: 'UTSU_NOVEL_CHOICE' } };
        }
        default:
          return trashCard(s, card, cur);
      }
    }

    // ===== ターゲット選択 =====
    case 'SELECT_TARGET': {
      const cur = state.currentPlayerIndex;
      const targetIdx = action.targetPlayerIdx;
      const pending = state.pending;
      if (!pending) return state;

      if (pending.type === 'SELECT_TARGET' && pending.source === 'skill') {
        // ヤンキースキルのターゲット確定 → USE_SKILL に再転送
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

        // 攻撃カード → 防御リアクション
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
      if (!defCard) return state;

      // 防御カードがこの攻撃を防げるかチェック
      if (!canDefend(defCard.def.effectKey, attackCard.def.effectKey)) {
        return addLog(state, 'このカードでは防御できません', 'system');
      }

      let s: GameState = { ...state, pending: null };

      switch (defCard.def.effectKey) {
        case 'defense': {
          // 手札1枚トラッシュ
          const ps = removeCardFromHand(s.players, targetIdx, defCard.instanceId);
          s = { ...s, players: ps };
          s = addLog(s, `${ps[targetIdx].name}「防御」発動！手札1枚トラッシュが必要`, 'defense');
          s = { ...s, pendingCard: null };
          s = trashCard(s, defCard, targetIdx);
          // 攻撃カードをトラッシュ
          s = trashCard(s, attackCard, attackerIdx);
          return { ...s, phase: 'play', pending: { type: 'DISCARD', count: 1, cause: '防御コスト' } };
        }
        case 'super_defense': {
          const ps = removeCardFromHand(s.players, targetIdx, defCard.instanceId);
          s = { ...s, players: ps };
          s = addLog(s, `${ps[targetIdx].name}「超防御」発動！手札2枚トラッシュが必要`, 'defense');
          s = trashCard(s, defCard, targetIdx);
          s = trashCard(s, attackCard, attackerIdx);
          s = { ...s, pendingCard: null, phase: 'play' };
          return { ...s, pending: { type: 'DISCARD', count: 2, cause: '超防御コスト' } };
        }
        case 'ultra_defense': {
          const ps = removeCardFromHand(s.players, targetIdx, defCard.instanceId);
          s = { ...s, players: ps };
          s = addLog(s, `${ps[targetIdx].name}「超超防御」発動！攻撃無効→2枚引く→手札3枚トラッシュ`, 'defense');
          // 2枚引く
          const { drawn, deck, trash } = drawCards(s.deck, s.trash, 2);
          const ps2 = ps.map((p, i) => i === targetIdx ? { ...p, hand: [...p.hand, ...drawn] } : p);
          s = trashCard({ ...s, players: ps2, deck, trash }, defCard, targetIdx);
          s = trashCard(s, attackCard, attackerIdx);
          s = { ...s, pendingCard: null, phase: 'play' };
          return { ...s, pending: { type: 'DISCARD', count: 3, cause: '超超防御コスト' } };
        }
        default:
          return state;
      }
    }

    case 'SKIP_DEFENSE': {
      const pending = state.pending;
      if (!pending || pending.type !== 'DEFENSE_REACTION') return state;
      const { attackerIdx, targetIdx, attackCard } = pending;
      let s: GameState = { ...state, pending: null, phase: 'resolve' as const };
      s = applyAttack(s, attackerIdx, targetIdx, attackCard);
      const winner = checkWin(s.players);
      if (winner) return endGame(s, winner);
      s = trashCard(s, attackCard, attackerIdx);
      s = { ...s, pendingCard: null, pendingTargetIdx: null };
      return { ...s, phase: 'end_turn' };
    }

    // ===== インタラクション解決 =====
    case 'RESOLVE_VIEW_SELECT': {
      const cur = state.currentPlayerIndex;
      const pending = state.pending;
      if (!pending || pending.type !== 'VIEW_SELECT') return state;
      const { viewedCards, keepCount } = pending;
      const kept = viewedCards.filter(c => action.keptIds.includes(c.instanceId));
      const putBack = viewedCards.filter(c => !action.keptIds.includes(c.instanceId));
      if (kept.length !== keepCount) return state; // 不正な選択
      const players = state.players.map((p, i) =>
        i === cur ? { ...p, hand: [...p.hand, ...kept] } : p
      );
      const deck = [...state.deck, ...putBack];
      const card = state.pendingCard;
      let s = addLog({ ...state, players, deck, pending: null }, `${players[cur].name}「イマカノの妹」: 2枚手札に加えた`, 'info');
      if (card) s = trashCard(s, card, cur);
      return { ...s, pendingCard: null, phase: 'end_turn' };
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
      let s = addLog({ ...state, players, deck, pending: null }, `${players[cur].name}「イマカノの手紙」: ${kept.length}枚の特殊札を手札に加えた`, 'info');
      if (card) s = trashCard(s, card, cur);
      return { ...s, pendingCard: null, phase: 'end_turn' };
    }

    case 'RESOLVE_DISCARD': {
      const pending = state.pending;
      if (!pending || pending.type !== 'DISCARD') return state;
      // ターゲットは現在の防御者（pendingTargetIdxが設定されている場合）
      // 防御コストは、pendingTargetIdx or currentPlayerIndex
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
      return { ...s, phase: 'end_turn' };
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
        const winner = checkWin(players);
        if (winner) return endGame(s, winner);
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
      return { ...s, pendingCard: null, pendingTargetIdx: null, phase: 'end_turn' };
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
      return { ...s, pendingCard: null, phase: 'end_turn' };
    }

    case 'SKIP_PLAY': {
      return { ...state, phase: 'end_turn' };
    }

    // ===== ターン終了 =====
    case 'END_TURN': {
      const n = state.players.length;
      const nextIdx = (state.currentPlayerIndex + 1) % n;
      const nextPlayer = state.players[nextIdx];
      const players = state.players.map((p, i) =>
        i === nextIdx ? { ...p, skillUsedThisTurn: false } : p
      );
      let s = addLog({ ...state, players }, `--- ${nextPlayer.name} のターン ---`, 'system');
      s = { ...s, currentPlayerIndex: nextIdx, pendingCard: null, pendingTargetIdx: null, turnNumber: state.turnNumber + 1 };
      return passDevice(s, nextIdx, `${nextPlayer.name} さんのターンです`);
    }

    default:
      return state;
  }
}

// ===== 内部ヘルパー =====

function resolveHappinessCard(state: GameState, playerIdx: number, delta: number): GameState {
  const card = state.pendingCard!;
  const players = adjustHappiness(state.players, playerIdx, delta);
  const winner = checkWin(players);
  let s = addLog({ ...state, players }, `${players[playerIdx].name}「${card.def.name}」: 幸せゲージ+${delta} → ${players[playerIdx].happiness}`, 'happiness');
  s = trashCard(s, card, playerIdx);
  s = { ...s, pendingCard: null, phase: 'end_turn' };
  if (winner) return endGame(s, winner);
  return s;
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

function canDefend(defKey: string, attackKey: string): boolean {
  if (defKey === 'defense') return attackKey === 'attack';
  if (defKey === 'super_defense') return ['attack', 'super_attack', 'spy', 'sister', 'bestfriend', 'father', 'letter', 'utsu_novel', 'ring', 'house', 'pet', 'disney'].includes(attackKey);
  if (defKey === 'ultra_defense') return ['attack', 'super_attack', 'ultra_attack'].includes(attackKey);
  return false;
}

function endGame(state: GameState, winner: PlayerState): GameState {
  const players = state.players.map(p => p.id === winner.id ? { ...p, isWinner: true } : p);
  let s = addLog({ ...state, players }, `🎊 ${winner.name} が結婚勝利！`, 'win');
  return { ...s, phase: 'finished', winner };
}
