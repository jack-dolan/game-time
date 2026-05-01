import { getGame, type RoomView, type ScoreInput } from '@letsgogaming/shared';

interface GameResultsProps {
  room: RoomView;
  isHost: boolean;
  onContinue: () => void;
}

function formatRaw(raw: ScoreInput | null): string {
  if (!raw) return '(no submission)';
  if (raw.kind === 'integer-range') return String(raw.value);
  if (raw.kind === 'guesses-or-fail') return String(raw.guesses);
  if (raw.kind === 'mistakes-or-fail') return String(raw.mistakes);
  return `${raw.a}:${raw.b}`;
}

export function GameResults({ room, isHost, onContinue }: GameResultsProps) {
  const results = room.lastRoundResults;
  if (!results) return null;
  const game = getGame(results.gameId);

  return (
    <section className="section">
      <h2>Round Results</h2>
      <p>{game ? game.name : results.gameId}</p>
      <table className="table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Raw</th>
            <th>Round Coins</th>
            <th>Total Coins</th>
          </tr>
        </thead>
        <tbody>
          {results.results.map((row) => (
            <tr key={row.playerId}>
              <td>{row.playerName}</td>
              <td>{formatRaw(row.raw)}</td>
              <td>+{row.coinsEarned}</td>
              <td>{row.coinsTotal}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {isHost ? (
        <div className="button-row">
          <button type="button" onClick={onContinue}>
            Continue
          </button>
        </div>
      ) : (
        <p>Waiting for host to continue.</p>
      )}
    </section>
  );
}
