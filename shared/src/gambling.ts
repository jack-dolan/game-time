export type GamblingGame = 'slot' | 'coinflip' | 'prisoners';

export const GAMBLING_GAMES: GamblingGame[] = ['slot', 'coinflip', 'prisoners'];

export type SlotOutcome = 'jackpot' | 'win' | 'push' | 'loss' | 'bust';

export interface SlotOdds {
  outcome: SlotOutcome;
  probability: number;
  multiplier: number; // applied to bet; +ve means coins gained, -ve means lost
  label: string;
}

export const SLOT_ODDS: SlotOdds[] = [
  { outcome: 'jackpot', probability: 0.05, multiplier: 3, label: '🎰 JACKPOT (+3x)' },
  { outcome: 'win', probability: 0.25, multiplier: 1, label: 'Win (+1x)' },
  { outcome: 'push', probability: 0.25, multiplier: 0, label: 'Push (0x)' },
  { outcome: 'loss', probability: 0.3, multiplier: -1, label: 'Loss (-1x)' },
  { outcome: 'bust', probability: 0.15, multiplier: -1.5, label: 'Bust (-1.5x)' },
];

export type PDChoice = 'cooperate' | 'defect';

export interface PDPayoff {
  you: number;
  them: number;
}

/** Symmetric payoff matrix for prisoner's dilemma in coin terms. */
export function pdPayoff(yours: PDChoice, theirs: PDChoice): PDPayoff {
  if (yours === 'cooperate' && theirs === 'cooperate') return { you: 15, them: 15 };
  if (yours === 'defect' && theirs === 'cooperate') return { you: 25, them: -15 };
  if (yours === 'cooperate' && theirs === 'defect') return { you: -15, them: 25 };
  return { you: -5, them: -5 };
}

/** DeanBot strategy: always defects. */
export const DEANBOT_NAME = 'DeanBot';
export function deanBotChoice(): PDChoice {
  return 'defect';
}

/** Floor for total coins after any gambling round. */
export const GAMBLING_COIN_FLOOR = 0;
