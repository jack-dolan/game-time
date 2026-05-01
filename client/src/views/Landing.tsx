import { useState } from 'react';

interface LandingProps {
  defaultName: string;
  onCreate: (name: string) => void;
  onJoin: (name: string, code: string) => void;
  disabled?: boolean;
}

export function Landing({ defaultName, onCreate, onJoin, disabled = false }: LandingProps) {
  const [name, setName] = useState(defaultName);
  const [code, setCode] = useState('');

  return (
    <section className="section">
      <h2>Join Game Night</h2>
      <div className="form-grid">
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={24}
          />
        </label>
        <div className="button-row">
          <button type="button" onClick={() => onCreate(name)} disabled={disabled}>
            Create Room
          </button>
        </div>
      </div>

      <div className="divider" />

      <div className="form-grid">
        <label>
          Room Code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD"
            maxLength={4}
          />
        </label>
        <div className="button-row">
          <button type="button" onClick={() => onJoin(name, code)} disabled={disabled}>
            Join Room
          </button>
        </div>
      </div>
    </section>
  );
}
