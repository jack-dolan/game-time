import { describe, expect, it } from 'vitest';
import { getGame, GAMES } from '@letsgogaming/shared';
import {
  sanitizeSettings,
  resetToLobby,
  startGame,
  submitRoundScore,
  hostAdvance,
} from '../src/gameLoop.js';
import { RoomManager } from '../src/rooms.js';
import type { RoomState } from '../src/types.js';

function submitValidScore(room: RoomState, playerId: string): void {
  const gameId = room.currentRound!.gameId;
  const game = getGame(gameId)!;
  const scoreKind = game.scoreKind;
  if (scoreKind.kind === 'guesses-or-fail') {
    submitRoundScore(room, playerId, { kind: 'guesses-or-fail', guesses: 3 });
  } else if (scoreKind.kind === 'integer-range') {
    submitRoundScore(room, playerId, { kind: 'integer-range', value: scoreKind.min });
  } else if (scoreKind.kind === 'mistakes-or-fail') {
    submitRoundScore(room, playerId, { kind: 'mistakes-or-fail', mistakes: 0 });
  } else {
    submitRoundScore(room, playerId, { kind: 'ratio', a: 50, b: 50 });
  }
}

describe('sanitizeSettings', () => {
  const base = {
    selectedGameIds: GAMES.map((g) => g.id),
    maxGamingRounds: 6,
  };

  it('filters out invalid game ids, keeps valid ones', () => {
    const result = sanitizeSettings(base, { selectedGameIds: ['wordle', 'not-a-real-game'] });
    expect(result.selectedGameIds).toEqual(['wordle']);
  });

  it('keeps existing selectedGameIds when all provided ids are invalid', () => {
    const result = sanitizeSettings(base, { selectedGameIds: ['fake-1', 'fake-2'] });
    expect(result.selectedGameIds).toEqual(base.selectedGameIds);
  });

  it('keeps existing selectedGameIds when an empty array is provided', () => {
    const result = sanitizeSettings(base, { selectedGameIds: [] });
    expect(result.selectedGameIds).toEqual(base.selectedGameIds);
  });

  it('deduplicates game ids', () => {
    const result = sanitizeSettings(base, {
      selectedGameIds: ['wordle', 'wordle', 'connections'],
    });
    expect(result.selectedGameIds).toEqual(['wordle', 'connections']);
  });

  it('clamps maxGamingRounds to minimum 1 when given 0', () => {
    const result = sanitizeSettings(base, { maxGamingRounds: 0 });
    expect(result.maxGamingRounds).toBe(1);
  });

  it('clamps maxGamingRounds to minimum 1 when given a negative number', () => {
    const result = sanitizeSettings(base, { maxGamingRounds: -5 });
    expect(result.maxGamingRounds).toBe(1);
  });

  it('clamps maxGamingRounds to maximum 50', () => {
    const result = sanitizeSettings(base, { maxGamingRounds: 51 });
    expect(result.maxGamingRounds).toBe(50);
  });

  it('accepts maxGamingRounds within valid range', () => {
    const result = sanitizeSettings(base, { maxGamingRounds: 10 });
    expect(result.maxGamingRounds).toBe(10);
  });

  it('ignores non-integer maxGamingRounds and keeps existing', () => {
    const result = sanitizeSettings(base, { maxGamingRounds: 3.7 });
    expect(result.maxGamingRounds).toBe(base.maxGamingRounds);
  });
});

describe('resetToLobby', () => {
  it('zeroes all player coins and gamingCoinsEarnedTotal', () => {
    const manager = new RoomManager();
    const { room, player: host } = manager.createRoom('Host');
    const { player: guest } = manager.joinRoom(room.code, 'Guest');

    host.coins = 50;
    host.gamingCoinsEarnedTotal = 50;
    guest.coins = 75;
    guest.gamingCoinsEarnedTotal = 75;

    resetToLobby(room);

    expect(host.coins).toBe(0);
    expect(host.gamingCoinsEarnedTotal).toBe(0);
    expect(guest.coins).toBe(0);
    expect(guest.gamingCoinsEarnedTotal).toBe(0);
  });

  it('resets phase to lobby and clears round history and counters', () => {
    const manager = new RoomManager();
    const { room, player: host } = manager.createRoom('Host');

    room.settings.selectedGameIds = ['wordle'];
    room.settings.maxGamingRounds = 1;
    startGame(room);
    // Submit to finalize the round and populate roundHistory
    submitRoundScore(room, host.id, { kind: 'guesses-or-fail', guesses: 3 });

    expect(room.roundHistory).toHaveLength(1);
    expect(host.coins).toBeGreaterThan(0);
    expect(room.completedGamingRounds).toBe(1);

    resetToLobby(room);

    expect(room.phase).toBe('lobby');
    expect(room.roundHistory).toHaveLength(0);
    expect(room.completedGamingRounds).toBe(0);
    expect(host.coins).toBe(0);
  });
});

describe('round history', () => {
  it('appends to roundHistory after each finalizeCurrentRound', () => {
    const manager = new RoomManager();
    const { room, player: host } = manager.createRoom('Host');

    room.settings.selectedGameIds = ['wordle'];
    room.settings.maxGamingRounds = 1;

    startGame(room);
    expect(room.roundHistory).toHaveLength(0);

    submitRoundScore(room, host.id, { kind: 'guesses-or-fail', guesses: 3 });

    expect(room.roundHistory).toHaveLength(1);
    expect(room.roundHistory[0].gameId).toBe('wordle');
    expect(room.roundHistory[0].roundNumber).toBe(1);
    expect(room.roundHistory[0].results).toHaveLength(1);
    expect(room.roundHistory[0].results[0].playerId).toBe(host.id);
    expect(room.roundHistory[0].results[0].coinsEarned).toBeGreaterThan(0);
  });

  it('roundHistory grows by one entry per round and records correct round numbers', () => {
    const manager = new RoomManager();
    const { room, player: host } = manager.createRoom('Host');

    // Two games; maxGamingRounds=2 so shouldEndSession fires after round 2 (no gambling)
    room.settings.selectedGameIds = ['wordle', 'connections'];
    room.settings.maxGamingRounds = 2;

    startGame(room);

    submitValidScore(room, host.id);
    expect(room.roundHistory).toHaveLength(1);
    expect(room.roundHistory[0].roundNumber).toBe(1);

    hostAdvance(room); // completedGamingRounds=1 (odd) → next gaming round, no gambling

    submitValidScore(room, host.id);
    expect(room.roundHistory).toHaveLength(2);
    expect(room.roundHistory[1].roundNumber).toBe(2);
  });

  it('roundHistory results contain the correct gameId for each round', () => {
    const manager = new RoomManager();
    const { room, player: host } = manager.createRoom('Host');

    room.settings.selectedGameIds = ['wordle'];
    room.settings.maxGamingRounds = 1;
    startGame(room);

    submitRoundScore(room, host.id, { kind: 'guesses-or-fail', guesses: 1 });

    expect(room.roundHistory[0].gameId).toBe('wordle');
    // Best score (1 guess) should yield MAX_COINS
    expect(room.roundHistory[0].results[0].coinsEarned).toBe(100);
  });
});
