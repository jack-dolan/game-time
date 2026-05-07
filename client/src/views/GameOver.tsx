import { useState } from 'react';
import { getGame, type RoomView } from '@letsgogaming/shared';

interface GameOverProps {
  room: RoomView;
  isHost: boolean;
  onNewGame: () => void;
}

export function GameOver({ room, isHost, onNewGame }: GameOverProps) {
  const [tab, setTab] = useState<'leaderboard' | 'history'>('leaderboard');
  const leaderboard = room.finalLeaderboard ?? [];
  const roundHistory = room.roundHistory ?? [];

  return (
    <section className="section">
      <h2>Game Over</h2>

      <div className="tab-row">
        <button
          type="button"
          className={tab === 'leaderboard' ? 'tab tab-active' : 'tab'}
          onClick={() => setTab('leaderboard')}
        >
          Final Standings
        </button>
        <button
          type="button"
          className={tab === 'history' ? 'tab tab-active' : 'tab'}
          onClick={() => setTab('history')}
        >
          Round History
        </button>
      </div>

      {tab === 'leaderboard' && (
        <table className="table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Coins</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((player, idx) => (
              <tr key={player.id}>
                <td>{idx + 1}</td>
                <td>
                  {player.name} {player.isHost ? '(Host)' : ''}
                </td>
                <td>{player.coins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'history' && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Player</th>
                {roundHistory.map((round) => {
                  const game = getGame(round.gameId);
                  return (
                    <th key={round.roundNumber}>
                      {game?.name ?? round.gameId}
                    </th>
                  );
                })}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((player) => {
                let total = 0;
                return (
                  <tr key={player.id}>
                    <td>{player.name}</td>
                    {roundHistory.map((round) => {
                      const result = round.results.find((r) => r.playerId === player.id);
                      const coins = result?.coinsEarned ?? 0;
                      total += coins;
                      return <td key={round.roundNumber}>+{coins}</td>;
                    })}
                    <td>{player.coins}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isHost ? (
        <div className="button-row">
          <button type="button" onClick={onNewGame}>
            New Game
          </button>
        </div>
      ) : (
        <p>Waiting for host to reset to lobby.</p>
      )}
    </section>
  );
}
