import type {
  GameRoundResultView,
  GamblingGame,
  GamblingPlayerOutcome,
  GamblingResultsView,
  RoomSettings,
} from '@letsgogaming/shared';
import type { PDChoice } from '@letsgogaming/shared';
import type { ScoreInput } from '@letsgogaming/shared';

export interface DoodleState {
  width: number;
  height: number;
  grid: number[];
  positions: Map<string, { x: number; y: number }>;
  colors: Map<string, string>;
  indices: Map<string, number>;
}

export interface PlayerState {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  socketId: string | null;
  joinedAt: number;
  coins: number;
  gamingCoinsEarnedTotal: number;
}

export type PrisonersPartner = string | 'DEANBOT';

export type GamblingSubmission =
  | { kind: 'abstain' }
  | { kind: 'slot'; bet: number }
  | { kind: 'coinflip'; bet: number; call: 'heads' | 'tails' }
  | { kind: 'prisoners'; choice: PDChoice };

export interface GameRoundState {
  roundNumber: number;
  gameId: string;
  submissions: Map<string, ScoreInput>;
}

export interface GamblingState {
  gamblingGame: GamblingGame;
  submissions: Map<string, GamblingSubmission>;
  pdPartners?: Map<string, PrisonersPartner>;
}

export interface RoomState {
  code: string;
  createdAt: number;
  lastActiveAt: number;
  hostId: string;
  phase: 'lobby' | 'gaming_round' | 'gaming_results' | 'gambling_active' | 'gambling_results' | 'game_over';
  settings: RoomSettings;
  players: Map<string, PlayerState>;
  remainingGameIds: string[];
  remainingGamblingGames: GamblingGame[];
  completedGamingRounds: number;
  currentRound?: GameRoundState;
  lastRoundResults?: GameRoundResultView;
  gambling?: GamblingState;
  lastGamblingResults?: GamblingResultsView;
  finalLeaderboard?: PlayerState[];
  latestGamblingOutcomes?: GamblingPlayerOutcome[];
  doodle?: DoodleState;
}
