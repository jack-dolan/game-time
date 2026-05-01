import { describe, expect, it, vi, afterEach } from 'vitest';
import { getGame } from '@letsgogaming/shared';
import { hostAdvance, maybeFinalizeRoundAfterPresenceChange, startGame, submitRoundScore } from '../src/gameLoop.js';
import { maybeFinalizeGamblingAfterPresenceChange, submitGamblingAction } from '../src/gambling.js';
import { RoomManager } from '../src/rooms.js';
import type { RoomState } from '../src/types.js';

function assertRoundGame(room: RoomState): string {
  if (room.phase !== 'gaming_round' || !room.currentRound) {
    throw new Error(`Expected gaming_round, got ${room.phase}`);
  }
  return room.currentRound.gameId;
}

function submitValidGamingScore(room: RoomState, playerId: string): void {
  const gameId = assertRoundGame(room);
  const game = getGame(gameId);
  if (!game) throw new Error(`Unknown game ${gameId}`);

  const kind = game.scoreKind.kind;
  if (kind === 'guesses-or-fail') {
    submitRoundScore(room, playerId, { kind: 'guesses-or-fail', guesses: 3 });
    return;
  }
  if (kind === 'integer-range') {
    submitRoundScore(room, playerId, { kind: 'integer-range', value: game.scoreKind.min });
    return;
  }
  if (kind === 'mistakes-or-fail') {
    submitRoundScore(room, playerId, { kind: 'mistakes-or-fail', mistakes: 1 });
    return;
  }
  submitRoundScore(room, playerId, { kind: 'ratio', a: 50, b: 50 });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('game flow', () => {
  it('runs 3 gaming rounds and skips trailing gambling before game over', () => {
    const manager = new RoomManager();
    const { room, player: host } = manager.createRoom('Host');

    room.settings.selectedGameIds = ['wordle', 'guess-the-house', 'costcodle'];
    room.settings.maxGamingRounds = 3;

    startGame(room);
    expect(room.phase).toBe('gaming_round');

    submitValidGamingScore(room, host.id);
    expect(room.phase).toBe('gaming_results');
    hostAdvance(room);
    expect(room.phase).toBe('gaming_round');

    submitValidGamingScore(room, host.id);
    expect(room.phase).toBe('gaming_results');
    hostAdvance(room);
    expect(room.phase).toBe('gambling_active');

    submitGamblingAction(room, host.id, { kind: 'abstain' });
    expect(room.phase).toBe('gambling_results');
    hostAdvance(room);
    expect(room.phase).toBe('gaming_round');

    submitValidGamingScore(room, host.id);
    expect(room.phase).toBe('gaming_results');
    hostAdvance(room);
    expect(room.phase).toBe('game_over');
  });

  it('auto-finalizes gaming round on disconnect and gives floor coins to missing submission', () => {
    const manager = new RoomManager();
    const { room, player: host } = manager.createRoom('Host');
    const { player: guest } = manager.joinRoom(room.code, 'Guest');

    room.settings.selectedGameIds = ['wordle'];
    room.settings.maxGamingRounds = 1;
    startGame(room);

    submitRoundScore(room, host.id, { kind: 'guesses-or-fail', guesses: 2 });
    expect(room.phase).toBe('gaming_round');

    manager.markDisconnected(room.code, guest.id);
    maybeFinalizeRoundAfterPresenceChange(room);
    expect(room.phase).toBe('gaming_results');

    const results = room.lastRoundResults?.results ?? [];
    const guestResult = results.find((r) => r.playerId === guest.id);
    expect(guestResult).toBeDefined();
    expect(guestResult?.raw).toBeNull();
    expect(guestResult?.coinsEarned).toBe(10);
  });

  it('auto-finalizes gambling round on disconnect when remaining connected players already submitted', () => {
    const manager = new RoomManager();
    const { room, player: host } = manager.createRoom('Host');
    const { player: guest } = manager.joinRoom(room.code, 'Guest');

    room.phase = 'gambling_active';
    room.gambling = {
      gamblingGame: 'coinflip',
      submissions: new Map(),
    };

    submitGamblingAction(room, host.id, { kind: 'coinflip', bet: 0, call: 'heads' });
    expect(room.phase).toBe('gambling_active');

    manager.markDisconnected(room.code, guest.id);
    maybeFinalizeGamblingAfterPresenceChange(room);
    expect(room.phase).toBe('gambling_results');
  });
});
