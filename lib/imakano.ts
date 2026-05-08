import { ImakanoDef } from './types';

export const IMAKANO_DEFS: ImakanoDef[] = [
  {
    id: 'musician',
    name: '音楽家',
    initialHappiness: 3,
    skillName: '演奏',
    skillKey: 'skill_musician',
    skillText: '自分と同じ幸せゲージのプレイヤー数だけ引く（最低1枚）。その後幸せゲージ +1',
  },
  {
    id: 'yankee',
    name: 'ヤンキー',
    initialHappiness: 3,
    skillName: 'カツアゲ',
    skillKey: 'skill_yankee',
    skillText: '相手1人の手札3枚を見る。その中の防御札を任意で奪う。奪えたら幸せゲージ +1',
  },
  {
    id: 'otaku',
    name: 'オタク',
    initialHappiness: 3,
    skillName: '推し活',
    skillKey: 'skill_otaku',
    skillText: '自分と同じ幸せゲージのプレイヤー数だけ引く（最低1枚）。その後幸せゲージ +1',
  },
  {
    id: 'jirai',
    name: '地雷',
    initialHappiness: 3,
    skillName: '地雷踏んだ',
    skillKey: 'skill_jirai',
    skillText: '右隣のプレイヤーの幸せゲージが自分より低ければ幸せゲージ +2',
  },
];
