import {
  GAMES,
  MIN_COINS_PER_ROUND,
  getGame,
  scoreToCoins,
  validateScoreInput,
  type ScoreInput,
} from '@letsgogaming/shared';
import type { RoomSettings } from '@letsgogaming/shared';
import { startGamblingRound } from './gambling.js';
import type { PlayerState, RoomState } from './types.js';

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function playerSort(a: PlayerState, b: PlayerState): number {
  if (a.coins !== b.coins) return b.coins - a.coins;
  if (a.gamingCoinsEarnedTotal !== b.gamingCoinsEarnedTotal) {
    return b.gamingCoinsEarnedTotal - a.gamingCoinsEarnedTotal;
  }
  return a.name.localeCompare(b.name);
}

function allConnectedPlayersSubmitted(room: RoomState, submittedIds: Set<string>): boolean {
  for (const player of room.players.values()) {
    if (player.connected && !submittedIds.has(player.id)) return false;
  }
  return true;
}

function makeLeaderboard(room: RoomState): PlayerState[] {
  return [...room.players.values()].sort(playerSort);
}

export function sanitizeSettings(
  current: RoomSettings,
  partial: Partial<RoomSettings>,
): RoomSettings {
  const validIds = new Set(GAMES.map((g) => g.id));
  const selectedFromPayload = partial.selectedGameIds;
  let selectedGameIds = current.selectedGameIds;

  if (selectedFromPayload) {
    const deduped = [...new Set(selectedFromPayload)].filter((id) => validIds.has(id));
    if (deduped.length > 0) {
      selectedGameIds = deduped;
    }
  }

  let maxGamingRounds = current.maxGamingRounds;
  if (partial.maxGamingRounds !== undefined) {
    if (Number.isInteger(partial.maxGamingRounds)) {
      maxGamingRounds = Math.max(1, Math.min(50, partial.maxGamingRounds));
    }
  }

  return { selectedGameIds, maxGamingRounds };
}

function startNextGamingRound(room: RoomState): void {
  const nextGameId = room.remainingGameIds.shift();
  if (!nextGameId) {
    enterGameOver(room);
    return;
  }

  room.phase = 'gaming_round';
  room.currentRound = {
    roundNumber: room.completedGamingRounds + 1,
    gameId: nextGameId,
    submissions: new Map(),
  };
  room.lastRoundResults = undefined;
  room.gambling = undefined;
  room.lastGamblingResults = undefined;
  room.finalLeaderboard = undefined;
}

function finalizeCurrentRound(room: RoomState): void {
  const round = room.currentRound;
  if (!round) {
    throw new Error('No active round to finalize.');
  }

  const game = getGame(round.gameId);
  if (!game) {
    throw new Error(`Unknown game id: ${round.gameId}`);
  }

  const results = [...room.players.values()]
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((player) => {
      const raw = round.submissions.get(player.id) ?? null;
      const coinsEarned = raw ? scoreToCoins(game, raw) : MIN_COINS_PER_ROUND;
      player.coins += coinsEarned;
      player.gamingCoinsEarnedTotal += coinsEarned;
      return {
        playerId: player.id,
        playerName: player.name,
        raw,
        coinsEarned,
        coinsTotal: player.coins,
      };
    });

  room.completedGamingRounds += 1;
  room.phase = 'gaming_results';
  room.lastRoundResults = {
    gameId: round.gameId,
    roundNumber: round.roundNumber,
    results,
  };
  room.currentRound = undefined;
}

function connectedSubmissionCount(room: RoomState): { connected: number; submitted: number } {
  if (!room.currentRound) return { connected: 0, submitted: 0 };
  let connected = 0;
  let submitted = 0;
  for (const player of room.players.values()) {
    if (!player.connected) continue;
    connected += 1;
    if (room.currentRound.submissions.has(player.id)) submitted += 1;
  }
  return { connected, submitted };
}

function shouldEndSession(room: RoomState): boolean {
  if (room.completedGamingRounds >= room.settings.maxGamingRounds) return true;
  if (room.remainingGameIds.length === 0) return true;
  return false;
}

export function enterGameOver(room: RoomState): void {
  room.phase = 'game_over';
  room.currentRound = undefined;
  room.gambling = undefined;
  room.lastRoundResults = undefined;
  room.lastGamblingResults = undefined;
  room.finalLeaderboard = makeLeaderboard(room);
}

export function resetToLobby(room: RoomState): void {
  room.phase = 'lobby';
  room.remainingGameIds = [];
  room.completedGamingRounds = 0;
  room.currentRound = undefined;
  room.lastRoundResults = undefined;
  room.gambling = undefined;
  room.lastGamblingResults = undefined;
  room.finalLeaderboard = undefined;

  for (const player of room.players.values()) {
    player.coins = 0;
    player.gamingCoinsEarnedTotal = 0;
  }
}

export function startGame(room: RoomState): void {
  if (room.phase !== 'lobby') {
    throw new Error('Game can only be started from lobby.');
  }
  if (room.settings.selectedGameIds.length === 0) {
    throw new Error('Select at least one game before starting.');
  }

  room.remainingGameIds = shuffle(room.settings.selectedGameIds);
  room.completedGamingRounds = 0;
  room.lastRoundResults = undefined;
  room.lastGamblingResults = undefined;
  room.finalLeaderboard = undefined;

  for (const player of room.players.values()) {
    player.coins = 0;
    player.gamingCoinsEarnedTotal = 0;
  }

  startNextGamingRound(room);
}

export function submitRoundScore(room: RoomState, playerId: string, score: ScoreInput): void {
  if (room.phase !== 'gaming_round' || !room.currentRound) {
    throw new Error('Not accepting game scores right now.');
  }

  const round = room.currentRound;
  const player = room.players.get(playerId);
  if (!player) throw new Error('Player not found.');

  const game = getGame(round.gameId);
  if (!game) throw new Error(`Unknown game id: ${round.gameId}`);

  const validationError = validateScoreInput(game, score);
  if (validationError) throw new Error(validationError);

  round.submissions.set(playerId, score);

  const submitted = new Set(round.submissions.keys());
  if (allConnectedPlayersSubmitted(room, submitted)) {
    finalizeCurrentRound(room);
  }
}

export function maybeFinalizeRoundAfterPresenceChange(room: RoomState): void {
  if (room.phase !== 'gaming_round' || !room.currentRound) return;
  const { connected, submitted } = connectedSubmissionCount(room);
  if (connected === submitted) {
    finalizeCurrentRound(room);
  }
}

export function updateRoomSettings(room: RoomState, partial: Partial<RoomSettings>): void {
  room.settings = sanitizeSettings(room.settings, partial);
}

export function hostAdvance(room: RoomState): void {
  if (room.phase === 'gaming_results') {
    if (shouldEndSession(room)) {
      enterGameOver(room);
      return;
    }

    if (room.completedGamingRounds % 2 === 0) {
      startGamblingRound(room);
      return;
    }

    startNextGamingRound(room);
    return;
  }

  if (room.phase === 'gambling_results') {
    if (shouldEndSession(room)) {
      enterGameOver(room);
      return;
    }
    startNextGamingRound(room);
    return;
  }

  if (room.phase === 'game_over') {
    resetToLobby(room);
    return;
  }

  throw new Error('Nothing to advance from this phase.');
}
