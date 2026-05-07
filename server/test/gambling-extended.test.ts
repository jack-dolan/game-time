import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitGamblingAction } from '../src/gambling.js';
import { RoomManager } from '../src/rooms.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('coinflip outcomes', () => {
  function makeCoinflipRoom() {
    const manager = new RoomManager();
    const { room, player } = manager.createRoom('Host');
    player.coins = 20;
    room.phase = 'gambling_active';
    room.gambling = { gamblingGame: 'coinflip', submissions: new Map() };
    return { room, player };
  }

  it('win: adds bet to coin total when call matches result', () => {
    const { room, player } = makeCoinflipRoom();
    // Math.random() < 0.5 → 'heads'
    vi.spyOn(Math, 'random').mockReturnValue(0.3);

    submitGamblingAction(room, player.id, { kind: 'coinflip', bet: 10, call: 'heads' });

    expect(room.phase).toBe('gambling_results');
    const outcome = room.lastGamblingResults!.outcomes[0];
    expect(outcome.coinflipWon).toBe(true);
    expect(outcome.delta).toBe(10);
    expect(outcome.coinsTotal).toBe(30);
  });

  it('loss: subtracts bet from coin total when call misses', () => {
    const { room, player } = makeCoinflipRoom();
    // Math.random() < 0.5 → 'heads', player called 'tails'
    vi.spyOn(Math, 'random').mockReturnValue(0.3);

    submitGamblingAction(room, player.id, { kind: 'coinflip', bet: 10, call: 'tails' });

    expect(room.phase).toBe('gambling_results');
    const outcome = room.lastGamblingResults!.outcomes[0];
    expect(outcome.coinflipWon).toBe(false);
    expect(outcome.delta).toBe(-10);
    expect(outcome.coinsTotal).toBe(10);
  });

  it('0-bet coinflip is treated as abstain with no coin change', () => {
    const { room, player } = makeCoinflipRoom();

    submitGamblingAction(room, player.id, { kind: 'coinflip', bet: 0, call: 'heads' });

    expect(room.phase).toBe('gambling_results');
    const outcome = room.lastGamblingResults!.outcomes[0];
    expect(outcome.abstained).toBe(true);
    expect(outcome.delta).toBe(0);
    expect(outcome.coinsTotal).toBe(20);
  });
});

describe("prisoner's dilemma outcomes", () => {
  function makePDRoom() {
    const manager = new RoomManager();
    const { room, player: p1 } = manager.createRoom('Alice');
    const { player: p2 } = manager.joinRoom(room.code, 'Bob');
    p1.coins = 20;
    p2.coins = 20;
    room.phase = 'gambling_active';
    room.gambling = {
      gamblingGame: 'prisoners',
      submissions: new Map(),
      pdPartners: new Map([
        [p1.id, p2.id],
        [p2.id, p1.id],
      ]),
    };
    return { room, p1, p2 };
  }

  it('cooperate/cooperate: both gain +15 coins', () => {
    const { room, p1, p2 } = makePDRoom();

    submitGamblingAction(room, p1.id, { kind: 'prisoners', choice: 'cooperate' });
    submitGamblingAction(room, p2.id, { kind: 'prisoners', choice: 'cooperate' });

    expect(room.phase).toBe('gambling_results');
    const outcomes = room.lastGamblingResults!.outcomes;
    const o1 = outcomes.find((o) => o.playerId === p1.id)!;
    const o2 = outcomes.find((o) => o.playerId === p2.id)!;

    expect(o1.abstained).toBe(false);
    expect(o1.delta).toBe(15);
    expect(o1.coinsTotal).toBe(35);
    expect(o2.abstained).toBe(false);
    expect(o2.delta).toBe(15);
    expect(o2.coinsTotal).toBe(35);
  });

  it('defect/defect: both lose -5 coins', () => {
    const { room, p1, p2 } = makePDRoom();

    submitGamblingAction(room, p1.id, { kind: 'prisoners', choice: 'defect' });
    submitGamblingAction(room, p2.id, { kind: 'prisoners', choice: 'defect' });

    expect(room.phase).toBe('gambling_results');
    const outcomes = room.lastGamblingResults!.outcomes;
    const o1 = outcomes.find((o) => o.playerId === p1.id)!;
    const o2 = outcomes.find((o) => o.playerId === p2.id)!;

    expect(o1.delta).toBe(-5);
    expect(o1.coinsTotal).toBe(15);
    expect(o2.delta).toBe(-5);
    expect(o2.coinsTotal).toBe(15);
  });

  it('cooperate vs defect: cooperator loses -15, defector gains +25', () => {
    const { room, p1, p2 } = makePDRoom();

    submitGamblingAction(room, p1.id, { kind: 'prisoners', choice: 'cooperate' });
    submitGamblingAction(room, p2.id, { kind: 'prisoners', choice: 'defect' });

    expect(room.phase).toBe('gambling_results');
    const outcomes = room.lastGamblingResults!.outcomes;
    const o1 = outcomes.find((o) => o.playerId === p1.id)!;
    const o2 = outcomes.find((o) => o.playerId === p2.id)!;

    expect(o1.delta).toBe(-15); // cooperator loses
    expect(o1.coinsTotal).toBe(5);
    expect(o2.delta).toBe(25);  // defector gains
    expect(o2.coinsTotal).toBe(45);
  });
});

describe('input validation — coinflip', () => {
  it('rejects invalid call value', () => {
    const manager = new RoomManager();
    const { room, player } = manager.createRoom('Host');
    player.coins = 20;
    room.phase = 'gambling_active';
    room.gambling = { gamblingGame: 'coinflip', submissions: new Map() };

    expect(() =>
      submitGamblingAction(room, player.id, {
        kind: 'coinflip',
        bet: 10,
        call: 'edge' as 'heads',
      }),
    ).toThrow("Call must be 'heads' or 'tails'.");
  });
});

describe("input validation — prisoner's dilemma", () => {
  it('rejects invalid choice value', () => {
    const manager = new RoomManager();
    const { room, player } = manager.createRoom('Host');
    player.coins = 20;
    room.phase = 'gambling_active';
    room.gambling = {
      gamblingGame: 'prisoners',
      submissions: new Map(),
      pdPartners: new Map([[player.id, 'DEANBOT']]),
    };

    expect(() =>
      submitGamblingAction(room, player.id, {
        kind: 'prisoners',
        choice: 'betray' as 'cooperate',
      }),
    ).toThrow("Choice must be 'cooperate' or 'defect'.");

    expect(player.coins).toBe(20);
  });
});

describe('slot machine multiplier outcomes', () => {
  function makeSlotRoom(coins = 20) {
    const manager = new RoomManager();
    const { room, player } = manager.createRoom('Host');
    player.coins = coins;
    room.phase = 'gambling_active';
    room.gambling = { gamblingGame: 'slot', submissions: new Map() };
    return { room, player };
  }

  it('jackpot: gains 3x bet (r < 0.05)', () => {
    const { room, player } = makeSlotRoom();
    vi.spyOn(Math, 'random').mockReturnValue(0.01);

    submitGamblingAction(room, player.id, { kind: 'slot', bet: 10 });

    const outcome = room.lastGamblingResults!.outcomes[0];
    expect(outcome.slotOutcome).toBe('jackpot');
    expect(outcome.slotMultiplier).toBe(3);
    expect(outcome.delta).toBe(30);
    expect(outcome.coinsTotal).toBe(50);
  });

  it('win: gains 1x bet (r in (0.05, 0.30])', () => {
    const { room, player } = makeSlotRoom();
    vi.spyOn(Math, 'random').mockReturnValue(0.1);

    submitGamblingAction(room, player.id, { kind: 'slot', bet: 10 });

    const outcome = room.lastGamblingResults!.outcomes[0];
    expect(outcome.slotOutcome).toBe('win');
    expect(outcome.slotMultiplier).toBe(1);
    expect(outcome.delta).toBe(10);
    expect(outcome.coinsTotal).toBe(30);
  });

  it('push: no coin change (r in (0.30, 0.55])', () => {
    const { room, player } = makeSlotRoom();
    vi.spyOn(Math, 'random').mockReturnValue(0.4);

    submitGamblingAction(room, player.id, { kind: 'slot', bet: 10 });

    const outcome = room.lastGamblingResults!.outcomes[0];
    expect(outcome.slotOutcome).toBe('push');
    expect(outcome.slotMultiplier).toBe(0);
    expect(outcome.delta).toBe(0);
    expect(outcome.coinsTotal).toBe(20);
  });
});
