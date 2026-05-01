import type { RoomView } from '@letsgogaming/shared';

interface GameOverProps {
  room: RoomView;
  isHost: boolean;
  onNewGame: () => void;
}

export function GameOver({ room, isHost, onNewGame }: GameOverProps) {
  const leaderboard = room.finalLeaderboard ?? [];
  return (
    <section className="section">
      <h2>Final Leaderboard</h2>
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
