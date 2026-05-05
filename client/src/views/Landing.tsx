import { useEffect, useState } from 'react';
import { playLetsGoGambling } from '../audio.js';

interface LandingProps {
  defaultName: string;
  onCreate: (name: string) => void;
  onJoin: (name: string, code: string) => void;
  disabled?: boolean;
}

export function Landing({ defaultName, onCreate, onJoin, disabled = false }: LandingProps) {
  const [createName, setCreateName] = useState(defaultName);
  const [joinName, setJoinName] = useState(defaultName);
  const [code, setCode] = useState('');

  useEffect(() => {
    playLetsGoGambling();
  }, []);

  return (
    <section className="section landing">
      <div className="landing-pane">
        <p className="landing-pane-label">New Game</p>
        <div className="form-grid">
          <label>
            Name
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Your name"
              maxLength={24}
              autoComplete="off"
            />
          </label>
          <div className="button-row">
            <button type="button" onClick={() => onCreate(createName)} disabled={disabled}>
              Create Room
            </button>
          </div>
        </div>
      </div>

      <div className="landing-divider" aria-hidden="true">
        <span>or</span>
      </div>

      <div className="landing-pane">
        <p className="landing-pane-label">Join Game</p>
        <div className="form-grid">
          <label>
            Name
            <input
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              placeholder="Your name"
              maxLength={24}
              autoComplete="off"
            />
          </label>
          <label>
            Room Code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCDE"
              maxLength={5}
              autoComplete="off"
            />
          </label>
          <div className="button-row">
            <button type="button" onClick={() => onJoin(joinName, code)} disabled={disabled}>
              Join Room
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
