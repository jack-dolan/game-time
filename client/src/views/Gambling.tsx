import { useState } from 'react';
import { SLOT_ODDS, type PDChoice, type RoomView } from '@letsgogaming/shared';

interface GamblingProps {
  room: RoomView;
  me: { id: string; coins: number } | null;
  onAbstain: () => void;
  onSlot: (bet: number) => void;
  onCoinflip: (bet: number, call: 'heads' | 'tails') => void;
  onPrisoners: (choice: PDChoice) => void;
}

function SlotPayoutInfo() {
  return (
    <div className="payout-info">
      <h3>Payouts</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Outcome</th>
            <th>Chance</th>
            <th>Effect</th>
          </tr>
        </thead>
        <tbody>
          {SLOT_ODDS.map((odd) => (
            <tr key={odd.outcome}>
              <td>{odd.label}</td>
              <td>{(odd.probability * 100).toFixed(0)}%</td>
              <td>
                {odd.multiplier > 0
                  ? `+${odd.multiplier}× bet`
                  : odd.multiplier === 0
                    ? 'No change'
                    : `${odd.multiplier}× bet`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CoinflipPayoutInfo() {
  return (
    <div className="payout-info">
      <h3>Payouts</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Result</th>
            <th>Effect</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Correct call</td>
            <td>+1× your bet</td>
          </tr>
          <tr>
            <td>Wrong call</td>
            <td>−1× your bet</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PrisonersPayoutInfo() {
  return (
    <div className="payout-info">
      <h3>Payoff Matrix</h3>
      <table className="table">
        <thead>
          <tr>
            <th>You</th>
            <th>Partner</th>
            <th>You get</th>
            <th>Partner gets</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cooperate</td>
            <td>Cooperate</td>
            <td>+15 coins</td>
            <td>+15 coins</td>
          </tr>
          <tr>
            <td>Cooperate</td>
            <td>Defect</td>
            <td>−15 coins</td>
            <td>+25 coins</td>
          </tr>
          <tr>
            <td>Defect</td>
            <td>Cooperate</td>
            <td>+25 coins</td>
            <td>−15 coins</td>
          </tr>
          <tr>
            <td>Defect</td>
            <td>Defect</td>
            <td>−5 coins</td>
            <td>−5 coins</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
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
            Bet (0–{maxCoins})
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
            <button type="button" onClick={onAbstain}>
              Abstain
            </button>
          </div>
          <SlotPayoutInfo />
        </div>
      ) : null}

      {!alreadySubmitted && gambling.gamblingGame === 'coinflip' ? (
        <div className="form-grid">
          <label>
            Bet (0–{maxCoins})
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
            <button type="button" onClick={onAbstain}>
              Abstain
            </button>
          </div>
          <CoinflipPayoutInfo />
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
          <PrisonersPayoutInfo />
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
