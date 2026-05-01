import { useState } from 'react';
import type { PDChoice, RoomView } from '@letsgogaming/shared';

interface GamblingProps {
  room: RoomView;
  me: { id: string; coins: number } | null;
  onAbstain: () => void;
  onSlot: (bet: number) => void;
  onCoinflip: (bet: number, call: 'heads' | 'tails') => void;
  onPrisoners: (choice: PDChoice) => void;
}

export function Gambling({
  room,
  me,
  onAbstain,
  onSlot,
  onCoinflip,
  onPrisoners,
}: GamblingProps) {
  const gambling = room.gambling;
  const [betText, setBetText] = useState('0');
  const [coinCall, setCoinCall] = useState<'heads' | 'tails'>('heads');
  if (!gambling) return null;

  const myState = me ? room.players.find((p) => p.id === me.id) : undefined;
  const alreadySubmitted = !!myState?.hasSubmitted;
  const bet = Number(betText);
  const maxCoins = me?.coins ?? 0;

  return (
    <section className="section">
      <h2>Gambling Round</h2>
      <p>Mode: {gambling.gamblingGame}</p>

      {alreadySubmitted ? <p>Submitted. Waiting for others.</p> : null}

      {!alreadySubmitted && gambling.gamblingGame === 'slot' ? (
        <div className="form-grid">
          <label>
            Bet (0-{maxCoins})
            <input
              type="number"
              min={0}
              max={maxCoins}
              value={betText}
              onChange={(e) => setBetText(e.target.value)}
            />
          </label>
          <div className="button-row">
            <button type="button" onClick={() => onSlot(Number.isFinite(bet) ? Math.max(0, bet) : 0)}>
              Spin
            </button>
          </div>
        </div>
      ) : null}

      {!alreadySubmitted && gambling.gamblingGame === 'coinflip' ? (
        <div className="form-grid">
          <label>
            Bet (0-{maxCoins})
            <input
              type="number"
              min={0}
              max={maxCoins}
              value={betText}
              onChange={(e) => setBetText(e.target.value)}
            />
          </label>
          <label>
            Call
            <select
              value={coinCall}
              onChange={(e) => setCoinCall(e.target.value as 'heads' | 'tails')}
            >
              <option value="heads">Heads</option>
              <option value="tails">Tails</option>
            </select>
          </label>
          <div className="button-row">
            <button
              type="button"
              onClick={() => onCoinflip(Number.isFinite(bet) ? Math.max(0, bet) : 0, coinCall)}
            >
              Flip
            </button>
          </div>
        </div>
      ) : null}

      {!alreadySubmitted && gambling.gamblingGame === 'prisoners' ? (
        <div className="form-grid">
          <p>
            Partner:{' '}
            {gambling.partner
              ? `${gambling.partner.name}${gambling.partner.isBot ? ' (bot)' : ''}`
              : 'Unknown'}
          </p>
          <div className="button-row">
            <button type="button" onClick={() => onPrisoners('cooperate')}>
              Cooperate
            </button>
            <button type="button" onClick={() => onPrisoners('defect')}>
              Defect
            </button>
          </div>
        </div>
      ) : null}

      {!alreadySubmitted ? (
        <div className="button-row">
          <button type="button" onClick={onAbstain}>
            Abstain
          </button>
        </div>
      ) : null}

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
