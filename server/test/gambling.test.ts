import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitGamblingAction } from '../src/gambling.js';
import { RoomManager } from '../src/rooms.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('gambling payouts', () => {
  it('enforces the 0-coin floor for slot bust losses', () => {
    const manager = new RoomManager();
    const { room, player } = manager.createRoom('Host');
    player.coins = 10;

    room.phase = 'gambling_active';
    room.gambling = {
      gamblingGame: 'slot',
      submissions: new Map(),
    };

    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    submitGamblingAction(room, player.id, { kind: 'slot', bet: 10 });

    expect(room.phase).toBe('gambling_results');
    const outcome = room.lastGamblingResults?.outcomes[0];
    expect(outcome?.slotOutcome).toBe('bust');
    expect(outcome?.delta).toBe(-10);
    expect(outcome?.coinsTotal).toBe(0);
  });

  it('pairs odd prisoner with DeanBot and applies always-defect strategy', () => {
    const manager = new RoomManager();
    const { room, player } = manager.createRoom('Host');
    player.coins = 5;

    room.phase = 'gambling_active';
    room.gambling = {
      gamblingGame: 'prisoners',
      submissions: new Map(),
      pdPartners: new Map([[player.id, 'DEANBOT']]),
    };

    submitGamblingAction(room, player.id, { kind: 'prisoners', choice: 'cooperate' });

    expect(room.phase).toBe('gambling_results');
    const outcome = room.lastGamblingResults?.outcomes[0];
    expect(outcome?.pdPartnerName).toBe('DeanBot');
    expect(outcome?.pdPartnerChoice).toBe('defect');
    expect(outcome?.delta).toBe(-5);
    expect(outcome?.coinsTotal).toBe(0);
  });

  it('rejects bets above player coin balance', () => {
    const manager = new RoomManager();
    const { room, player } = manager.createRoom('Host');
    player.coins = 7;
    room.phase = 'gambling_active';
    room.gambling = {
      gamblingGame: 'coinflip',
      submissions: new Map(),
    };

    expect(() =>
      submitGamblingAction(room, player.id, { kind: 'coinflip', bet: 8, call: 'heads' }),
    ).toThrow('Bet cannot exceed your coin total.');
  });
});
