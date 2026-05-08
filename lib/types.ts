// ===== カード =====

export type CardType = 'attack' | 'defense' | 'special';

export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  effectText: string;
  effectKey: string;
  count: number;
}

export interface CardInstance {
  instanceId: string;
  def: CardDef;
}

// ===== イマカノ =====

export interface ImakanoDef {
  id: string;
  name: string;
  initialHappiness: number;
  skillName: string | null;
  skillText: string | null;
  skillKey: string | null;
  isRental?: boolean;
}

// ===== プレイヤー =====

export interface PlayerState {
  id: string;
  name: string;
  imakano: ImakanoDef;
  happiness: number;
  hand: CardInstance[];
  skillUsedThisTurn: boolean;
  isWinner: boolean;
  isDefeated: boolean;
}

// ===== 保留中のインタラクション =====

export type Pending =
  | { type: 'SELECT_TARGET'; source: 'card'; cardInstanceId: string }
  | { type: 'SELECT_TARGET'; source: 'skill'; skillKey: string }
  | { type: 'VIEW_SELECT'; viewedCards: CardInstance[]; keepCount: number; label: string }
  | { type: 'VIEW_SELECT_SPECIALS'; viewedCards: CardInstance[] }
  | { type: 'DISCARD'; count: number; cause: string }
  | { type: 'PEEK_STEAL'; targetIdx: number; peekedCards: CardInstance[] }
  | { type: 'PEEK_TRASH'; targetIdx: number; peekedCards: CardInstance[] }
  | { type: 'UTSU_NOVEL_CHOICE' }
  | { type: 'DEFENSE_REACTION'; attackerIdx: number; targetIdx: number; attackCard: CardInstance }
  | { type: 'PASS_DEVICE'; toPlayerIdx: number; reason: string }
  | { type: 'IMAKANO_KANOJO_INAL_DECLARATION' };

// ===== ゲームフェーズ =====

export type GamePhase =
  | 'setup'
  | 'pass_device'   // デバイスを次プレイヤーへ渡す
  | 'draw'
  | 'skill'
  | 'play'
  | 'defense'       // 防御リアクション待ち
  | 'resolve'
  | 'end_turn'
  | 'finished';

// ===== ゲームログ =====

export interface GameLog {
  id: number;
  text: string;
  type: 'info' | 'attack' | 'defense' | 'happiness' | 'skill' | 'system' | 'win';
}

// ===== ゲーム状態 =====

export interface GameState {
  phase: GamePhase;
  players: PlayerState[];
  deck: CardInstance[];
  trash: CardInstance[];
  currentPlayerIndex: number;
  pendingCard: CardInstance | null;       // プレイ済みで解決待ちのカード
  pendingTargetIdx: number | null;        // 攻撃対象
  pending: Pending | null;               // インタラクション待ち
  log: GameLog[];
  logSeq: number;
  winner: PlayerState | null;
  turnNumber: number;
  specialPlaysThisTurn: number;
  attackPlaysThisTurn: number;
}
