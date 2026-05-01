/**
 * Score input "kinds" describe how a player enters their score for a game.
 * The client renders an input control based on the kind; the server uses it to
 * parse and validate the submission.
 */
export type ScoreKind =
  | { kind: 'integer-range'; min: number; max: number; perfect: 'min' | 'max' }
  | { kind: 'guesses-or-fail'; maxGuesses: number; perfectIsLow: true }
  | { kind: 'mistakes-or-fail'; maxMistakes: number }
  | { kind: 'ratio' };

export interface GameDef {
  id: string;
  name: string;
  url: string;
  description: string;
  scoreKind: ScoreKind;
  /** Short hint shown next to the score input, e.g. "Guesses used (or X if you failed)". */
  scoreInputHint: string;
}

export const GAMES: GameDef[] = [
  {
    id: 'color-memory',
    name: 'Color Memory',
    url: 'https://dialed.gg/',
    description: 'Memorize colors and reproduce the sequence. Higher score is better.',
    scoreKind: { kind: 'integer-range', min: 0, max: 50, perfect: 'max' },
    scoreInputHint: 'Your score (0–50)',
  },
  {
    id: 'foodguessr',
    name: 'FoodGuessr',
    url: 'https://www.foodguessr.com/game/daily',
    description: 'Guess where a dish is from. Higher score is better.',
    scoreKind: { kind: 'integer-range', min: 0, max: 15000, perfect: 'max' },
    scoreInputHint: 'Your score (0–15,000)',
  },
  {
    id: 'guess-the-house',
    name: 'Guess the House Price',
    url: 'https://guessthe.house/',
    description: 'Guess the price of the house. Fewer guesses = better.',
    scoreKind: { kind: 'guesses-or-fail', maxGuesses: 6, perfectIsLow: true },
    scoreInputHint: 'Guesses used (or X if you failed)',
  },
  {
    id: 'wordle',
    name: 'Wordle',
    url: 'https://www.nytimes.com/games/wordle/index.html',
    description: 'Guess the 5-letter word. Fewer guesses = better.',
    scoreKind: { kind: 'guesses-or-fail', maxGuesses: 6, perfectIsLow: true },
    scoreInputHint: 'Guesses used (or X if you failed)',
  },
  {
    id: 'costcodle',
    name: 'COSTCODLE',
    url: 'https://costcodle.com/',
    description: 'Guess the Costco product price. Fewer guesses = better.',
    scoreKind: { kind: 'guesses-or-fail', maxGuesses: 6, perfectIsLow: true },
    scoreInputHint: 'Guesses used (or X if you failed)',
  },
  {
    id: 'angle',
    name: 'Angle Guesser',
    url: 'https://angle.wtf/',
    description: 'Guess the angle. Fewer guesses = better.',
    scoreKind: { kind: 'guesses-or-fail', maxGuesses: 4, perfectIsLow: true },
    scoreInputHint: 'Guesses used (or X if you failed)',
  },
  {
    id: 'cutle',
    name: 'Cutle',
    url: 'https://pfiffel.com/cutle/',
    description: 'Cut a shape in half. Closer to 50:50 = better.',
    scoreKind: { kind: 'ratio' },
    scoreInputHint: 'Your ratio (e.g. 46:54)',
  },
  {
    id: 'connections',
    name: 'Connections',
    url: 'https://www.nytimes.com/games/connections',
    description: 'Group 16 words into 4 categories. Fewer mistakes = better.',
    scoreKind: { kind: 'mistakes-or-fail', maxMistakes: 4 },
    scoreInputHint: 'Mistakes made (0–3, or X if you failed)',
  },
];

export function getGame(id: string): GameDef | undefined {
  return GAMES.find((g) => g.id === id);
}
