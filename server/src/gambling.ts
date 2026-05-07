import {
  DEANBOT_NAME,
  GAMBLING_COIN_FLOOR,
  GAMBLING_GAMES,
  SLOT_ODDS,
  deanBotChoice,
  pdPayoff,
  type GamblingPlayerOutcome,
  type SlotOdds,
} from '@letsgogaming/shared';
import type { GamblingSubmission, PlayerState, PrisonersPartner, RoomState } from './types.js';

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function nextGamblingGame(room: RoomState) {
  if (room.remainingGamblingGames.length === 0) {
    room.remainingGamblingGames = shuffle([...GAMBLING_GAMES]);
  }
  return room.remainingGamblingGames.shift()!;
}

function rollSlot(odds: SlotOdds[]) {
  const r = Math.random();
  let cumulative = 0;
  for (const entry of odds) {
    cumulative += entry.probability;
    if (r <= cumulative) return entry;
  }
  return odds[odds.length - 1];
}

function allConnectedPlayersSubmitted(room: RoomState): boolean {
  const submissions = room.gambling?.submissions;
  if (!submissions) return false;
  for (const player of room.players.values()) {
    if (player.connected && !submissions.has(player.id)) return false;
  }
  return true;
}

function connectedSubmissionCount(room: RoomState): { connected: number; submitted: number } {
  const submissions = room.gambling?.submissions;
  if (!submissions) return { connected: 0, submitted: 0 };

  let connected = 0;
  let submitted = 0;
  for (const player of room.players.values()) {
    if (!player.connected) continue;
    connected += 1;
    if (submissions.has(player.id)) submitted += 1;
  }
  return { connected, submitted };
}

function applyDeltaWithFloor(player: PlayerState, delta: number): number {
  const before = player.coins;
  const after = Math.max(GAMBLING_COIN_FLOOR, before + delta);
  player.coins = after;
  return after - before;
}

function buildPrisonersPairs(room: RoomState): Map<string, PrisonersPartner> {
  const ids = shuffle([...room.players.keys()]);
  const pairs = new Map<string, PrisonersPartner>();

  while (ids.length >= 2) {
    const a = ids.pop() as string;
    const b = ids.pop() as string;
    pairs.set(a, b);
    pairs.set(b, a);
  }

  if (ids.length === 1) {
    const leftover = ids.pop() as string;
    pairs.set(leftover, 'DEANBOT');
  }

  return pairs;
}

export function startGamblingRound(room: RoomState): void {
  const gamblingGame = nextGamblingGame(room);
  room.phase = 'gambling_active';
  room.currentRound = undefined;
  room.lastRoundResults = undefined;
  room.lastGamblingResults = undefined;
  room.finalLeaderboard = undefined;
  room.gambling = {
    gamblingGame,
    submissions: new Map(),
    pdPartners: gamblingGame === 'prisoners' ? buildPrisonersPairs(room) : undefined,
  };
}

function finalizeGamblingRound(room: RoomState): void {
  const gambling = room.gambling;
  if (!gambling) throw new Error('No active gambling round.');

  const players = [...room.players.values()].sort((a, b) => a.joinedAt - b.joinedAt);
  const outcomesById = new Map<string, GamblingPlayerOutcome>();

  if (gambling.gamblingGame === 'slot') {
    for (const player of players) {
      const sub = gambling.submissions.get(player.id);
      if (!sub || sub.kind !== 'slot' || sub.bet <= 0) {
        outcomesById.set(player.id, {
          playerId: player.id,
          playerName: player.name,
          abstained: true,
          delta: 0,
          coinsTotal: player.coins,
        });
        continue;
      }

      const rolled = rollSlot(SLOT_ODDS);
      const intendedDelta = Math.round(sub.bet * rolled.multiplier);
      const appliedDelta = applyDeltaWithFloor(player, intendedDelta);

      outcomesById.set(player.id, {
        playerId: player.id,
        playerName: player.name,
        abstained: false,
        bet: sub.bet,
        slotOutcome: rolled.outcome,
        slotMultiplier: rolled.multiplier,
        delta: appliedDelta,
        coinsTotal: player.coins,
      });
    }
  }

  if (gambling.gamblingGame === 'coinflip') {
    for (const player of players) {
      const sub = gambling.submissions.get(player.id);
      if (!sub || sub.kind !== 'coinflip' || sub.bet <= 0) {
        outcomesById.set(player.id, {
          playerId: player.id,
          playerName: player.name,
          abstained: true,
          delta: 0,
          coinsTotal: player.coins,
        });
        continue;
      }

      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const won = sub.call === result;
      const intendedDelta = won ? sub.bet : -sub.bet;
      const appliedDelta = applyDeltaWithFloor(player, intendedDelta);

      outcomesById.set(player.id, {
        playerId: player.id,
        playerName: player.name,
        abstained: false,
        coinflipBet: sub.bet,
        coinflipCalled: sub.call,
        coinflipResult: result,
        coinflipWon: won,
        delta: appliedDelta,
        coinsTotal: player.coins,
      });
    }
  }

  if (gambling.gamblingGame === 'prisoners') {
    const pairings = gambling.pdPartners ?? new Map<string, PrisonersPartner>();
    const processed = new Set<string>();

    for (const player of players) {
      if (processed.has(player.id)) continue;

      const partner = pairings.get(player.id);
      if (!partner) {
        outcomesById.set(player.id, {
          playerId: player.id,
          playerName: player.name,
          abstained: true,
          delta: 0,
          coinsTotal: player.coins,
        });
        processed.add(player.id);
        continue;
      }

      if (partner === 'DEANBOT') {
        const sub = gambling.submissions.get(player.id);
        if (!sub || sub.kind !== 'prisoners') {
          outcomesById.set(player.id, {
            playerId: player.id,
            playerName: player.name,
            abstained: true,
            pdPartnerName: DEANBOT_NAME,
            delta: 0,
            coinsTotal: player.coins,
          });
        } else {
          const botChoice = deanBotChoice();
          const payoff = pdPayoff(sub.choice, botChoice);
          const appliedDelta = applyDeltaWithFloor(player, payoff.you);
          outcomesById.set(player.id, {
            playerId: player.id,
            playerName: player.name,
            abstained: false,
            pdChoice: sub.choice,
            pdPartnerName: DEANBOT_NAME,
            pdPartnerChoice: botChoice,
            delta: appliedDelta,
            coinsTotal: player.coins,
          });
        }
        processed.add(player.id);
        continue;
      }

      const partnerPlayer = room.players.get(partner);
      if (!partnerPlayer) {
        processed.add(player.id);
        continue;
      }

      const subA = gambling.submissions.get(player.id);
      const subB = gambling.submissions.get(partnerPlayer.id);

      if (subA && subA.kind === 'prisoners' && subB && subB.kind === 'prisoners') {
        const payoff = pdPayoff(subA.choice, subB.choice);
        const appliedDeltaA = applyDeltaWithFloor(player, payoff.you);
        const appliedDeltaB = applyDeltaWithFloor(partnerPlayer, payoff.them);

        outcomesById.set(player.id, {
          playerId: player.id,
          playerName: player.name,
          abstained: false,
          pdChoice: subA.choice,
          pdPartnerName: partnerPlayer.name,
          pdPartnerChoice: subB.choice,
          delta: appliedDeltaA,
          coinsTotal: player.coins,
        });
        outcomesById.set(partnerPlayer.id, {
          playerId: partnerPlayer.id,
          playerName: partnerPlayer.name,
          abstained: false,
          pdChoice: subB.choice,
          pdPartnerName: player.name,
          pdPartnerChoice: subA.choice,
          delta: appliedDeltaB,
          coinsTotal: partnerPlayer.coins,
        });
      } else {
        outcomesById.set(player.id, {
          playerId: player.id,
          playerName: player.name,
          abstained: true,
          pdPartnerName: partnerPlayer.name,
          delta: 0,
          coinsTotal: player.coins,
        });
        outcomesById.set(partnerPlayer.id, {
          playerId: partnerPlayer.id,
          playerName: partnerPlayer.name,
          abstained: true,
          pdPartnerName: player.name,
          delta: 0,
          coinsTotal: partnerPlayer.coins,
        });
      }

      processed.add(player.id);
      processed.add(partnerPlayer.id);
    }
  }

  const outcomes = players.map((player) => {
    const outcome = outcomesById.get(player.id);
    if (outcome) return outcome;
    return {
      playerId: player.id,
      playerName: player.name,
      abstained: true,
      delta: 0,
      coinsTotal: player.coins,
    };
  });

  room.phase = 'gambling_results';
  room.lastGamblingResults = {
    gamblingGame: gambling.gamblingGame,
    outcomes,
  };
  room.latestGamblingOutcomes = outcomes;
  room.gambling = undefined;
}

function validateBet(playerCoins: number, bet: number): void {
  if (!Number.isInteger(bet)) {
    throw new Error('Bet must be a whole number.');
  }
  if (bet < 0) throw new Error('Bet cannot be negative.');
  if (bet > playerCoins) throw new Error('Bet cannot exceed your coin total.');
}

export function submitGamblingAction(
  room: RoomState,
  playerId: string,
  submission: GamblingSubmission,
): void {
  if (room.phase !== 'gambling_active' || !room.gambling) {
    throw new Error('Not accepting gambling actions right now.');
  }

  const player = room.players.get(playerId);
  if (!player) throw new Error('Player not found.');

  const { gambling } = room;

  if (submission.kind === 'slot') {
    if (gambling.gamblingGame !== 'slot') throw new Error('Current gambling game is not slots.');
    validateBet(player.coins, submission.bet);
  }

  if (submission.kind === 'coinflip') {
    if (gambling.gamblingGame !== 'coinflip') {
      throw new Error('Current gambling game is not coin flip.');
    }
    if (submission.call !== 'heads' && submission.call !== 'tails') {
      throw new Error("Call must be 'heads' or 'tails'.");
    }
    validateBet(player.coins, submission.bet);
  }

  if (submission.kind === 'prisoners') {
    if (gambling.gamblingGame !== 'prisoners') {
      throw new Error("Current gambling game is not prisoner's dilemma.");
    }
    if (submission.choice !== 'cooperate' && submission.choice !== 'defect') {
      throw new Error("Choice must be 'cooperate' or 'defect'.");
    }
  }

  if (submission.kind === 'abstain') {
    gambling.submissions.set(playerId, submission);
  } else {
    gambling.submissions.set(playerId, submission);
  }

  if (allConnectedPlayersSubmitted(room)) {
    finalizeGamblingRound(room);
  }
}

export function maybeFinalizeGamblingAfterPresenceChange(room: RoomState): void {
  if (room.phase !== 'gambling_active' || !room.gambling) return;
  const { connected, submitted } = connectedSubmissionCount(room);
  if (connected === submitted) {
    finalizeGamblingRound(room);
  }
}
