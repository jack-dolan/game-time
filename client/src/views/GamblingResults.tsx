import type { GamblingPlayerOutcome, RoomView } from '@letsgogaming/shared';

interface GamblingResultsProps {
  room: RoomView;
  isHost: boolean;
  onContinue: () => void;
}

function describe(outcome: GamblingPlayerOutcome): string {
  if (outcome.abstained) return 'Abstained';
  if (outcome.slotOutcome) return `Slot: ${outcome.slotOutcome} (${outcome.slotMultiplier}x)`;
  if (outcome.coinflipResult) {
    return `Coinflip: called ${outcome.coinflipCalled}, got ${outcome.coinflipResult}`;
  }
  if (outcome.pdChoice) {
    return `PD: ${outcome.pdChoice} vs ${outcome.pdPartnerName} (${outcome.pdPartnerChoice ?? 'n/a'})`;
  }
  return 'No action';
}

export function GamblingResults({ room, isHost, onContinue }: GamblingResultsProps) {
  const results = room.lastGamblingResults;
  if (!results) return null;

  return (
    <section className="section">
      <h2>Gambling Results</h2>
      <p>Mode: {results.gamblingGame}</p>

      <table className="table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Outcome</th>
            <th>Delta</th>
            <th>Total Coins</th>
          </tr>
        </thead>
        <tbody>
          {results.outcomes.map((outcome) => (
            <tr key={outcome.playerId}>
              <td>{outcome.playerName}</td>
              <td>{describe(outcome)}</td>
              <td>{outcome.delta > 0 ? `+${outcome.delta}` : outcome.delta}</td>
              <td>{outcome.coinsTotal}</td>
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
