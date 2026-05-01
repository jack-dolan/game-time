import { useState } from 'react';
import { getGame, parseRatio, type RoomView, type ScoreInput } from '@letsgogaming/shared';

interface GameRoundProps {
  room: RoomView;
  me: { id: string } | null;
  onSubmit: (score: ScoreInput) => void;
}

function parseRoundInput(raw: string, room: RoomView): { score?: ScoreInput; error?: string } {
  const round = room.currentRound;
  if (!round) return { error: 'Round not available.' };
  const game = getGame(round.gameId);
  if (!game) return { error: 'Game metadata unavailable.' };

  const value = raw.trim();
  const kind = game.scoreKind;

  if (kind.kind === 'integer-range') {
    const num = Number(value);
    if (!Number.isInteger(num)) return { error: 'Enter a whole number.' };
    return { score: { kind: 'integer-range', value: num } };
  }
  if (kind.kind === 'guesses-or-fail') {
    if (value.toUpperCase() === 'X') return { score: { kind: 'guesses-or-fail', guesses: 'X' } };
    const num = Number(value);
    if (!Number.isInteger(num)) return { error: 'Enter a whole number or X.' };
    return { score: { kind: 'guesses-or-fail', guesses: num } };
  }
  if (kind.kind === 'mistakes-or-fail') {
    if (value.toUpperCase() === 'X') return { score: { kind: 'mistakes-or-fail', mistakes: 'X' } };
    const num = Number(value);
    if (!Number.isInteger(num)) return { error: 'Enter a whole number or X.' };
    return { score: { kind: 'mistakes-or-fail', mistakes: num } };
  }

  const ratio = parseRatio(value);
  if (!ratio) return { error: 'Enter ratio like 46:54.' };
  return { score: { kind: 'ratio', a: ratio.a, b: ratio.b } };
}

export function GameRound({ room, me, onSubmit }: GameRoundProps) {
  const round = room.currentRound;
  if (!round) return null;

  const game = getGame(round.gameId);
  if (!game) return <p>Missing game data.</p>;

  const myState = me ? room.players.find((p) => p.id === me.id) : undefined;
  const alreadySubmitted = !!myState?.hasSubmitted;

  return (
    <section className="section">
      <h2>
        Round {round.roundNumber} / {round.totalGamingRounds}
      </h2>
      <h3>{game.name}</h3>
      <p>{game.description}</p>
      <p>
        <a href={game.url} target="_blank" rel="noreferrer">
          Open game in new tab
        </a>
      </p>

      {alreadySubmitted ? (
        <p>Submitted. Waiting for others.</p>
      ) : (
        <RoundInputForm
          hint={game.scoreInputHint}
          onSubmit={(raw) => {
            const parsed = parseRoundInput(raw, room);
            if (parsed.error || !parsed.score) {
              window.alert(parsed.error ?? 'Invalid score.');
              return;
            }
            onSubmit(parsed.score);
          }}
        />
      )}

      <h3>Submission status</h3>
      <ul className="list">
        {room.players.map((player) => (
          <li key={player.id}>
            {player.name}: {player.hasSubmitted ? 'submitted' : 'pending'}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RoundInputForm({
  hint,
  onSubmit,
}: {
  hint: string;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <div className="form-grid">
      <label>
        {hint}
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Enter score" />
      </label>
      <div className="button-row">
        <button type="button" onClick={() => onSubmit(value)}>
          Submit
        </button>
      </div>
    </div>
  );
}
