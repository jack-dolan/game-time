import type { PublicPlayer, RoomView } from '@letsgogaming/shared';
import { DEANBOT_NAME } from '@letsgogaming/shared';
import type { PlayerState, RoomState } from './types.js';

function toPublicPlayer(
  player: PlayerState,
  hasSubmitted: boolean,
): PublicPlayer {
  return {
    id: player.id,
    name: player.name,
    isHost: player.isHost,
    connected: player.connected,
    coins: player.coins,
    hasSubmitted,
  };
}

function sortPlayersForView(a: PlayerState, b: PlayerState): number {
  if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
  return a.joinedAt - b.joinedAt;
}

export function buildRoomView(room: RoomState, viewerPlayerId?: string): RoomView {
  const players = [...room.players.values()].sort(sortPlayersForView);

  const submittedIds = new Set<string>();
  if (room.phase === 'gaming_round' && room.currentRound) {
    for (const id of room.currentRound.submissions.keys()) submittedIds.add(id);
  }
  if (room.phase === 'gambling_active' && room.gambling) {
    for (const id of room.gambling.submissions.keys()) submittedIds.add(id);
  }

  const view: RoomView = {
    code: room.code,
    phase: room.phase,
    hostId: room.hostId,
    settings: room.settings,
    players: players.map((player) => toPublicPlayer(player, submittedIds.has(player.id))),
  };

  if (room.phase === 'gaming_round' && room.currentRound) {
    view.currentRound = {
      roundNumber: room.currentRound.roundNumber,
      totalGamingRounds: room.settings.maxGamingRounds,
      gameId: room.currentRound.gameId,
    };
  }

  if (room.phase === 'gaming_results' && room.lastRoundResults) {
    view.lastRoundResults = room.lastRoundResults;
  }

  if (room.phase === 'gambling_active' && room.gambling) {
    view.gambling = {
      gamblingGame: room.gambling.gamblingGame,
    };

    if (room.gambling.gamblingGame === 'prisoners' && viewerPlayerId && room.gambling.pdPartners) {
      const partner = room.gambling.pdPartners.get(viewerPlayerId);
      if (partner) {
        if (partner === 'DEANBOT') {
          view.gambling.partner = { id: 'DEANBOT', name: DEANBOT_NAME, isBot: true };
        } else {
          const partnerPlayer = room.players.get(partner);
          if (partnerPlayer) {
            view.gambling.partner = {
              id: partnerPlayer.id,
              name: partnerPlayer.name,
              isBot: false,
            };
          }
        }
      }
    }
  }

  if (room.phase === 'gambling_results' && room.lastGamblingResults) {
    view.lastGamblingResults = room.lastGamblingResults;
  }

  if (room.phase === 'game_over') {
    const leaderboardSource = room.finalLeaderboard ?? players;
    view.finalLeaderboard = leaderboardSource.map((player) => ({
      id: player.id,
      name: player.name,
      isHost: player.isHost,
      connected: player.connected,
      coins: player.coins,
      hasSubmitted: false,
    }));
    view.roundHistory = room.roundHistory;
  }

  return view;
}
