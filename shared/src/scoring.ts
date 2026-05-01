import type { GameDef } from './games.js';

export const MIN_COINS_PER_ROUND = 10;
export const MAX_COINS_PER_ROUND = 100;

/**
 * Raw score input as it comes off the wire from the client.
 * - integer-range: { value: number }
 * - guesses-or-fail: { guesses: number | 'X' }   (1..maxGuesses, or 'X' = failed)
 * - mistakes-or-fail: { mistakes: number | 'X' } (0..maxMistakes-1, or 'X' = failed)
 * - ratio: { a: number; b: number }
 */
export type ScoreInput =
  | { kind: 'integer-range'; value: number }
  | { kind: 'guesses-or-fail'; guesses: number | 'X' }
  | { kind: 'mistakes-or-fail'; mistakes: number | 'X' }
  | { kind: 'ratio'; a: number; b: number };

/** Linearly interpolate `t` in [0,1] to coins in [MIN, MAX]. */
function lerpCoins(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return Math.round(MIN_COINS_PER_ROUND + clamped * (MAX_COINS_PER_ROUND - MIN_COINS_PER_ROUND));
}

/**
 * Convert a parsed score input to coins (10..100) for the given game.
 * Throws if the input shape doesn't match the game's score kind.
 */
export function scoreToCoins(game: GameDef, input: ScoreInput): number {
  const kind = game.scoreKind;

  if (kind.kind === 'integer-range' && input.kind === 'integer-range') {
    const span = kind.max - kind.min;
    const normalized = span === 0 ? 1 : (input.value - kind.min) / span;
    const t = kind.perfect === 'max' ? normalized : 1 - normalized;
    return lerpCoins(t);
  }

  if (kind.kind === 'guesses-or-fail' && input.kind === 'guesses-or-fail') {
    // States: 1 guess (perfect) ... maxGuesses guesses ... fail. That's maxGuesses+1 states total.
    // Equal steps from 100 (1 guess) down to 10 (fail).
    const states = kind.maxGuesses + 1;
    const stateIndex = input.guesses === 'X' ? states - 1 : input.guesses - 1;
    const t = 1 - stateIndex / (states - 1);
    return lerpCoins(t);
  }

  if (kind.kind === 'mistakes-or-fail' && input.kind === 'mistakes-or-fail') {
    // States: 0 mistakes (perfect) ... maxMistakes-1 mistakes ... fail. That's maxMistakes+1 states.
    const states = kind.maxMistakes + 1;
    const stateIndex = input.mistakes === 'X' ? states - 1 : input.mistakes;
    const t = 1 - stateIndex / (states - 1);
    return lerpCoins(t);
  }

  if (kind.kind === 'ratio' && input.kind === 'ratio') {
    const total = input.a + input.b;
    if (total <= 0) return MIN_COINS_PER_ROUND;
    const smaller = Math.min(input.a, input.b);
    const smallerPct = (smaller / total) * 100; // 50 = perfect, ~0 = worst
    // Map [0..50] → [10..100]. (0:100 would give 10, 50:50 gives 100.)
    const t = smallerPct / 50;
    return lerpCoins(t);
  }

  throw new Error(`Score input kind ${input.kind} doesn't match game ${game.id} (${kind.kind})`);
}

/** Validate a raw score input and return a friendly error message, or null if OK. */
export function validateScoreInput(game: GameDef, input: ScoreInput): string | null {
  const kind = game.scoreKind;
  if (kind.kind !== input.kind) return `Wrong input type for ${game.name}.`;

  if (kind.kind === 'integer-range' && input.kind === 'integer-range') {
    if (!Number.isInteger(input.value)) return 'Score must be a whole number.';
    if (input.value < kind.min || input.value > kind.max) {
      return `Score must be between ${kind.min} and ${kind.max}.`;
    }
  }
  if (kind.kind === 'guesses-or-fail' && input.kind === 'guesses-or-fail') {
    if (input.guesses === 'X') return null;
    if (!Number.isInteger(input.guesses) || input.guesses < 1 || input.guesses > kind.maxGuesses) {
      return `Guesses must be 1–${kind.maxGuesses} or X.`;
    }
  }
  if (kind.kind === 'mistakes-or-fail' && input.kind === 'mistakes-or-fail') {
    if (input.mistakes === 'X') return null;
    if (
      !Number.isInteger(input.mistakes) ||
      input.mistakes < 0 ||
      input.mistakes >= kind.maxMistakes
    ) {
      return `Mistakes must be 0–${kind.maxMistakes - 1} or X.`;
    }
  }
  if (kind.kind === 'ratio' && input.kind === 'ratio') {
    if (!Number.isFinite(input.a) || !Number.isFinite(input.b) || input.a < 0 || input.b < 0) {
      return 'Ratio must be two non-negative numbers like 46:54.';
    }
    if (input.a + input.b <= 0) return 'Ratio total must be greater than zero.';
  }
  return null;
}

/** Parse a "46:54" style string into a ratio input. Returns null if unparseable. */
export function parseRatio(text: string): { a: number; b: number } | null {
  const match = text.trim().match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { a, b };
}
