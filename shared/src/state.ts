import type { GamblingGame, PDChoice, SlotOutcome } from './gambling.js';
import type { ScoreInput } from './scoring.js';

export type Phase =
  | 'lobby'
  | 'gaming_round'
  | 'gaming_results'
  | 'gambling_active'
  | 'gambling_results'
  | 'game_over';

export interface PublicPlayer {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  coins: number;
  /** Has this player submitted for the current round/gamble? */
  hasSubmitted: boolean;
}

export interface GameRoundView {
  roundNumber: number; // 1-indexed across all gaming rounds in the session
  totalGamingRounds: number; // configured max for the session
  gameId: string; // current game's id (look up in GAMES)
}

export interface PlayerScoreResult {
  playerId: string;
  playerName: string;
  raw: ScoreInput | null; // null if they never submitted
  coinsEarned: number; // coins added this round
  coinsTotal: number; // running total after this round
}

export interface GameRoundResultView {
  gameId: string;
  roundNumber: number;
  results: PlayerScoreResult[];
}

export interface GamblingActiveView {
  gamblingGame: GamblingGame;
  /** For prisoner's dilemma: who you're paired with (player id, or DeanBot). */
  partner?: { id: string; name: string; isBot: boolean };
}

export interface GamblingPlayerOutcome {
  playerId: string;
  playerName: string;
  abstained: boolean;
  // Slot:
  bet?: number;
  slotOutcome?: SlotOutcome;
  slotMultiplier?: number;
  // Coinflip:
  coinflipBet?: number;
  coinflipResult?: 'heads' | 'tails';
  coinflipCalled?: 'heads' | 'tails';
  coinflipWon?: boolean;
  // PD:
  pdChoice?: PDChoice;
  pdPartnerName?: string;
  pdPartnerChoice?: PDChoice;
  // Common:
  delta: number;
  coinsTotal: number;
}

export interface GamblingResultsView {
  gamblingGame: GamblingGame;
  outcomes: GamblingPlayerOutcome[];
}

export interface DoodlePlayer {
  id: string;
  name: string;
  color: string;
  /** Index into the grid's value space (0‥n-1). */
  index: number;
  x: number;
  y: number;
}

export interface DoodleView {
  width: number;
  height: number;
  /** Flat row-major array; -1 = empty, >=0 = player index. */
  grid: number[];
  players: DoodlePlayer[];
}

export interface RoomSettings {
  /** Subset of game ids the host enabled. */
  selectedGameIds: string[];
  /** Maximum number of gaming rounds this session. */
  maxGamingRounds: number;
}

export interface RoomView {
  code: string;
  phase: Phase;
  players: PublicPlayer[];
  hostId: string;
  settings: RoomSettings;
  /** Set when phase = gaming_round. */
  currentRound?: GameRoundView;
  /** Set when phase = gaming_results. */
  lastRoundResults?: GameRoundResultView;
  /** Set when phase = gambling_active. */
  gambling?: GamblingActiveView;
  /** Set when phase = gambling_results. */
  lastGamblingResults?: GamblingResultsView;
  /** Set when phase = game_over. */
  finalLeaderboard?: PublicPlayer[];
  /** Set when phase = game_over. */
  roundHistory?: GameRoundResultView[];
}
