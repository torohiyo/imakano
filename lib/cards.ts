import { CardDef, CardInstance } from './types';

export const CARD_DEFS: CardDef[] = [
  // ===== 攻撃札 =====
  {
    id: 'attack',
    name: '攻撃',
    type: 'attack',
    effectKey: 'attack',
    effectText: '相手1人のイマカノの幸せゲージを -1',
    count: 11,
  },
  {
    id: 'super_attack',
    name: '超攻撃',
    type: 'attack',
    effectKey: 'super_attack',
    effectText: '相手1人の幸せゲージ -2。自分の幸せゲージ -1',
    count: 6,
  },
  {
    id: 'ultra_attack',
    name: '超超攻撃',
    type: 'attack',
    effectKey: 'ultra_attack',
    effectText: '相手1人の幸せゲージ -3。自分の幸せゲージ -2',
    count: 3,
  },
  // ===== 防御札 =====
  {
    id: 'defense',
    name: '防御',
    type: 'defense',
    effectKey: 'defense',
    effectText: '手札1枚トラッシュ → 「攻撃」を無効化',
    count: 9,
  },
  {
    id: 'super_defense',
    name: '超防御',
    type: 'defense',
    effectKey: 'super_defense',
    effectText: '手札2枚トラッシュ → 攻撃・超攻撃・特殊札を無効化',
    count: 5,
  },
  {
    id: 'ultra_defense',
    name: '超超防御',
    type: 'defense',
    effectKey: 'ultra_defense',
    effectText: '攻撃札を無効化 → 2枚引く → 手札3枚トラッシュ',
    count: 2,
  },
  // ===== 特殊札 =====
  {
    id: 'sister',
    name: 'イマカノの妹',
    type: 'special',
    effectKey: 'sister',
    effectText: '山札上4枚を見て2枚手札に加え、残り2枚を山札下へ',
    count: 3,
  },
  {
    id: 'bestfriend',
    name: 'イマカノの親友',
    type: 'special',
    effectKey: 'bestfriend',
    effectText: '山札から3枚引く',
    count: 3,
  },
  {
    id: 'father',
    name: 'イマカノの父親',
    type: 'special',
    effectKey: 'father',
    effectText: '自分の幸せゲージが7以上なら5枚引く',
    count: 2,
  },
  {
    id: 'letter',
    name: 'イマカノの手紙',
    type: 'special',
    effectKey: 'letter',
    effectText: '山札上7枚を見て特殊札を好きなだけ手札に加える',
    count: 2,
  },
  {
    id: 'utsu_novel',
    name: '鬱小説',
    type: 'special',
    effectKey: 'utsu_novel',
    effectText: '全員の幸せゲージ -1。自分の幸せゲージ -2 で手札に戻せる',
    count: 2,
  },
  {
    id: 'spy',
    name: 'スパイ',
    type: 'special',
    effectKey: 'spy',
    effectText: '相手の手札を見て防御札1枚をトラッシュ',
    count: 3,
  },
  {
    id: 'ring',
    name: '婚約指輪',
    type: 'special',
    effectKey: 'ring',
    effectText: '自分の幸せゲージ +4',
    count: 2,
  },
  {
    id: 'house',
    name: '3LDK',
    type: 'special',
    effectKey: 'house',
    effectText: '自分の幸せゲージ +3',
    count: 2,
  },
  {
    id: 'pet',
    name: 'ペット',
    type: 'special',
    effectKey: 'pet',
    effectText: '自分の幸せゲージ +2',
    count: 3,
  },
  {
    id: 'disney',
    name: 'ディズニーランド',
    type: 'special',
    effectKey: 'disney',
    effectText: '自分の幸せゲージ +1',
    count: 2,
  },
  {
    id: 'marriage',
    name: '婚姻届',
    type: 'special',
    effectKey: 'marriage',
    effectText: '幸せゲージが10以上の時にプレイすると結婚勝利',
    count: 3,
  },
];

let _instanceCounter = 0;

function makeInstance(def: CardDef): CardInstance {
  return { instanceId: `${def.id}-${_instanceCounter++}`, def };
}

export function buildDeck(): CardInstance[] {
  const deck: CardInstance[] = [];
  for (const def of CARD_DEFS) {
    for (let i = 0; i < def.count; i++) {
      deck.push(makeInstance(def));
    }
  }
  return shuffle(deck);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
