import { CardInstance } from './types';

export type AnimPosition = 'south' | 'north' | 'east' | 'west';

export type AnimEventPayload =
  | { type: 'PLAY_CARD_REVEAL'; card: CardInstance; fromPosition: AnimPosition }
  | { type: 'DAMAGE';           targetPosition: AnimPosition; amount: number }
  | { type: 'HEAL';             targetPosition: AnimPosition; amount: number }
  | { type: 'BLOCK';            targetPosition: AnimPosition }
  | { type: 'WIN_MARRIAGE';     playerName: string; imakanoName: string };

export type AnimationEvent = AnimEventPayload & { id: number };
