import { describe, expect, it } from 'vitest';
import {
  scoreToCoins,
  validateScoreInput,
  MIN_COINS_PER_ROUND,
  MAX_COINS_PER_ROUND,
  getGame,
} from '@letsgogaming/shared';
import type { GameDef } from '@letsgogaming/shared';

const colorMemory = getGame('color-memory')!; // integer-range, min=0, max=50, perfect='max'
const wordle = getGame('wordle')!;            // guesses-or-fail, maxGuesses=6
const connections = getGame('connections')!;  // mistakes-or-fail, maxMistakes=4
const cutle = getGame('cutle')!;             // ratio

const minPerfectGame: GameDef = {
  id: 'test-min',
  name: 'Test Min',
  url: '',
  description: '',
  scoreKind: { kind: 'integer-range', min: 0, max: 10, perfect: 'min' },
  scoreInputHint: '',
};

describe('scoreToCoins', () => {
  describe('integer-range (perfect=max)', () => {
    it('min value earns MIN_COINS', () => {
      expect(scoreToCoins(colorMemory, { kind: 'integer-range', value: 0 })).toBe(MIN_COINS_PER_ROUND);
    });

    it('max value earns MAX_COINS', () => {
      expect(scoreToCoins(colorMemory, { kind: 'integer-range', value: 50 })).toBe(MAX_COINS_PER_ROUND);
    });

    it('midpoint earns 55 coins', () => {
      // normalized=0.5, lerpCoins(0.5) = round(10 + 0.5*90) = 55
      expect(scoreToCoins(colorMemory, { kind: 'integer-range', value: 25 })).toBe(55);
    });
  });

  describe('integer-range (perfect=min)', () => {
    it('min value (best) earns MAX_COINS', () => {
      expect(scoreToCoins(minPerfectGame, { kind: 'integer-range', value: 0 })).toBe(MAX_COINS_PER_ROUND);
    });

    it('max value (worst) earns MIN_COINS', () => {
      expect(scoreToCoins(minPerfectGame, { kind: 'integer-range', value: 10 })).toBe(MIN_COINS_PER_ROUND);
    });
  });

  describe('guesses-or-fail (maxGuesses=6)', () => {
    it('1 guess (best) earns MAX_COINS', () => {
      expect(scoreToCoins(wordle, { kind: 'guesses-or-fail', guesses: 1 })).toBe(MAX_COINS_PER_ROUND);
    });

    it('6 guesses earns 25 coins', () => {
      // states=7, stateIndex=5, t=1-5/6=1/6, round(10+15)=25
      expect(scoreToCoins(wordle, { kind: 'guesses-or-fail', guesses: 6 })).toBe(25);
    });

    it('X (fail) earns MIN_COINS', () => {
      expect(scoreToCoins(wordle, { kind: 'guesses-or-fail', guesses: 'X' })).toBe(MIN_COINS_PER_ROUND);
    });
  });

  describe('mistakes-or-fail (maxMistakes=4)', () => {
    it('0 mistakes (best) earns MAX_COINS', () => {
      expect(scoreToCoins(connections, { kind: 'mistakes-or-fail', mistakes: 0 })).toBe(MAX_COINS_PER_ROUND);
    });

    it('maxMistakes-1 (3 mistakes) earns 33 coins', () => {
      // states=5, stateIndex=3, t=1-3/4=0.25, round(10+22.5)=33
      expect(scoreToCoins(connections, { kind: 'mistakes-or-fail', mistakes: 3 })).toBe(33);
    });

    it('X (fail) earns MIN_COINS', () => {
      expect(scoreToCoins(connections, { kind: 'mistakes-or-fail', mistakes: 'X' })).toBe(MIN_COINS_PER_ROUND);
    });
  });

  describe('ratio', () => {
    it('perfect 50:50 earns MAX_COINS', () => {
      expect(scoreToCoins(cutle, { kind: 'ratio', a: 50, b: 50 })).toBe(MAX_COINS_PER_ROUND);
    });

    it('46:54 earns 93 coins', () => {
      // smaller=46, smallerPct=46, t=0.92, round(10+82.8)=93
      expect(scoreToCoins(cutle, { kind: 'ratio', a: 46, b: 54 })).toBe(93);
    });

    it('0:100 (worst) earns MIN_COINS', () => {
      expect(scoreToCoins(cutle, { kind: 'ratio', a: 0, b: 100 })).toBe(MIN_COINS_PER_ROUND);
    });

    it('zero total returns MIN_COINS directly', () => {
      expect(scoreToCoins(cutle, { kind: 'ratio', a: 0, b: 0 })).toBe(MIN_COINS_PER_ROUND);
    });
  });

  it('throws when input kind does not match game score kind', () => {
    expect(() =>
      scoreToCoins(colorMemory, { kind: 'guesses-or-fail', guesses: 3 }),
    ).toThrow();
  });
});

describe('validateScoreInput', () => {
  describe('integer-range', () => {
    it('returns null for value at min', () => {
      expect(validateScoreInput(colorMemory, { kind: 'integer-range', value: 0 })).toBeNull();
    });

    it('returns null for value at max', () => {
      expect(validateScoreInput(colorMemory, { kind: 'integer-range', value: 50 })).toBeNull();
    });

    it('rejects non-integer value', () => {
      expect(validateScoreInput(colorMemory, { kind: 'integer-range', value: 3.14 })).toBe(
        'Score must be a whole number.',
      );
    });

    it('rejects value below min', () => {
      expect(validateScoreInput(colorMemory, { kind: 'integer-range', value: -1 })).toBe(
        'Score must be between 0 and 50.',
      );
    });

    it('rejects value above max', () => {
      expect(validateScoreInput(colorMemory, { kind: 'integer-range', value: 51 })).toBe(
        'Score must be between 0 and 50.',
      );
    });
  });

  describe('guesses-or-fail', () => {
    it('returns null for 1 guess (min valid)', () => {
      expect(validateScoreInput(wordle, { kind: 'guesses-or-fail', guesses: 1 })).toBeNull();
    });

    it('returns null for maxGuesses (6)', () => {
      expect(validateScoreInput(wordle, { kind: 'guesses-or-fail', guesses: 6 })).toBeNull();
    });

    it('returns null for X (fail)', () => {
      expect(validateScoreInput(wordle, { kind: 'guesses-or-fail', guesses: 'X' })).toBeNull();
    });

    it('rejects 0 guesses', () => {
      expect(validateScoreInput(wordle, { kind: 'guesses-or-fail', guesses: 0 })).not.toBeNull();
    });

    it('rejects guesses above maxGuesses', () => {
      expect(validateScoreInput(wordle, { kind: 'guesses-or-fail', guesses: 7 })).not.toBeNull();
    });

    it('rejects non-integer guesses', () => {
      expect(validateScoreInput(wordle, { kind: 'guesses-or-fail', guesses: 1.5 })).not.toBeNull();
    });
  });

  describe('mistakes-or-fail', () => {
    it('returns null for 0 mistakes (best)', () => {
      expect(validateScoreInput(connections, { kind: 'mistakes-or-fail', mistakes: 0 })).toBeNull();
    });

    it('returns null for maxMistakes-1 (3 mistakes)', () => {
      expect(validateScoreInput(connections, { kind: 'mistakes-or-fail', mistakes: 3 })).toBeNull();
    });

    it('returns null for X (fail)', () => {
      expect(validateScoreInput(connections, { kind: 'mistakes-or-fail', mistakes: 'X' })).toBeNull();
    });

    it('rejects mistakes at maxMistakes (4)', () => {
      expect(
        validateScoreInput(connections, { kind: 'mistakes-or-fail', mistakes: 4 }),
      ).not.toBeNull();
    });

    it('rejects negative mistakes', () => {
      expect(
        validateScoreInput(connections, { kind: 'mistakes-or-fail', mistakes: -1 }),
      ).not.toBeNull();
    });
  });

  describe('ratio', () => {
    it('returns null for valid 46:54', () => {
      expect(validateScoreInput(cutle, { kind: 'ratio', a: 46, b: 54 })).toBeNull();
    });

    it('returns null for perfect 50:50', () => {
      expect(validateScoreInput(cutle, { kind: 'ratio', a: 50, b: 50 })).toBeNull();
    });

    it('rejects values not summing to 100', () => {
      expect(validateScoreInput(cutle, { kind: 'ratio', a: 46, b: 55 })).toBe(
        'Your two numbers must add up to 100 (e.g. 46:54).',
      );
    });

    it('rejects negative values', () => {
      expect(validateScoreInput(cutle, { kind: 'ratio', a: -1, b: 101 })).toBe(
        'Ratio must be two non-negative numbers like 46:54.',
      );
    });

    it('rejects zero total', () => {
      expect(validateScoreInput(cutle, { kind: 'ratio', a: 0, b: 0 })).toBe(
        'Ratio total must be greater than zero.',
      );
    });
  });

  describe('kind mismatch', () => {
    it('returns error when input kind does not match game score kind', () => {
      expect(validateScoreInput(colorMemory, { kind: 'guesses-or-fail', guesses: 3 })).toBe(
        'Wrong input type for Color Memory.',
      );
    });
  });
});
