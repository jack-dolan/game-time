import { useEffect, useMemo, useRef, useState } from 'react';
import type { DoodleView, RoomView, ScoreInput } from '@letsgogaming/shared';
import { playDangit, playLetsGoGambling, playWin } from './audio.js';
import { socket } from './socket.js';
import { Doodle } from './views/Doodle.js';
import { Gambling } from './views/Gambling.js';
import { GamblingResults } from './views/GamblingResults.js';
import { GameOver } from './views/GameOver.js';
import { GameResults } from './views/GameResults.js';
import { GameRound } from './views/GameRound.js';
import { Landing } from './views/Landing.js';
import { Lobby } from './views/Lobby.js';

const STORAGE_KEY = 'letsgogaming_session_v1';

interface StoredSession {
  code: string;
  playerId: string;
  name: string;
}

function readSession(): StoredSession | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.code || !parsed.playerId || !parsed.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(session: StoredSession | null) {
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function App() {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [doodleView, setDoodleView] = useState<DoodleView | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    socket.connect();

    const stored = readSession();
    if (stored) {
      setName(stored.name);
      setPlayerId(stored.playerId);
      setConnecting(true);
      socket.emit('room:rejoin', { code: stored.code, playerId: stored.playerId }, (res) => {
        setConnecting(false);
        if (!res.ok) {
          writeSession(null);
          setPlayerId(null);
          // Silently discard stale sessions (room expired or server restarted)
        }
      });
    }

    const onRoomState = (next: RoomView) => setRoom(next);
    const onDoodleState = (next: DoodleView) => setDoodleView(next);
    const onError = (message: string) => setErrorMessage(message);

    socket.on('room:state', onRoomState);
    socket.on('doodle:state', onDoodleState);
    socket.on('error:message', onError);

    return () => {
      socket.off('room:state', onRoomState);
      socket.off('doodle:state', onDoodleState);
      socket.off('error:message', onError);
      socket.disconnect();
    };
  }, []);

  const me = useMemo(() => {
    if (!room || !playerId) return null;
    return room.players.find((p) => p.id === playerId) ?? null;
  }, [room, playerId]);
  const isHost = !!(room && playerId && room.hostId === playerId);

  const prevPhaseRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const phase = room?.phase ?? null;
    if (phase === prevPhaseRef.current) return;
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (prevPhase === undefined) return;

    if (phase === 'gambling_active') {
      playLetsGoGambling();
    } else if (phase === 'gambling_results') {
      const results = room?.lastGamblingResults;
      const myOutcome = results?.outcomes.find((o) => o.playerId === playerId);
      if (myOutcome && !myOutcome.abstained) {
        if (results?.gamblingGame === 'slot') {
          if (myOutcome.slotOutcome === 'jackpot' || myOutcome.slotOutcome === 'win') {
            playWin();
          } else if (myOutcome.slotOutcome === 'loss' || myOutcome.slotOutcome === 'bust') {
            playDangit();
          }
        } else if (results?.gamblingGame === 'coinflip') {
          if (myOutcome.coinflipWon) {
            playWin();
          } else if (myOutcome.coinflipWon === false) {
            playDangit();
          }
        }
      }
    } else if (phase === 'game_over') {
      const leaderboard = room?.finalLeaderboard ?? [];
      if (leaderboard.length > 0 && leaderboard[0].id === playerId) {
        playWin();
      }
    }
  }, [room, playerId]);

  function handleCreateRoom(nextName: string) {
    const cleanName = nextName.trim();
    if (!cleanName) {
      setErrorMessage('Name is required.');
      return;
    }
    setErrorMessage('');
    setConnecting(true);
    socket.emit('room:create', { name: cleanName }, (res) => {
      setConnecting(false);
      if (!res.ok) {
        setErrorMessage(res.error);
        return;
      }
      setName(cleanName);
      setPlayerId(res.playerId);
      writeSession({ code: res.code, playerId: res.playerId, name: cleanName });
    });
  }

  function handleJoinRoom(nextName: string, code: string) {
    const cleanName = nextName.trim();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanName) {
      setErrorMessage('Name is required.');
      return;
    }
    if (!cleanCode) {
      setErrorMessage('Room code is required.');
      return;
    }
    setErrorMessage('');
    setConnecting(true);
    socket.emit('room:join', { name: cleanName, code: cleanCode }, (res) => {
      setConnecting(false);
      if (!res.ok) {
        setErrorMessage(res.error);
        return;
      }
      setName(cleanName);
      setPlayerId(res.playerId);
      writeSession({ code: cleanCode, playerId: res.playerId, name: cleanName });
    });
  }

  function handleUpdateSettings(patch: { selectedGameIds?: string[]; maxGamingRounds?: number }) {
    socket.emit('room:update-settings', patch);
  }

  function handleSubmitScore(score: ScoreInput) {
    socket.emit('round:submit-score', { score });
  }

  function clearError() {
    if (errorMessage) setErrorMessage('');
  }

  return (
    <div className="app-shell" onClick={clearError}>
      <main className="main-panel">
        <header className="top">
          <h1>Let&apos;s Go Gaming</h1>
          <div className="meta-row">
            <span>{name ? `Player: ${name}` : 'Not in a room'}</span>
            {room ? <span>Room: {room.code}</span> : null}
            {me ? <span>Coins: {me.coins}</span> : null}
          </div>
        </header>

        {errorMessage ? <div className="error">{errorMessage}</div> : null}
        {connecting ? <p>Connecting...</p> : null}

        {!room ? (
          <Landing
            defaultName={name}
            onCreate={handleCreateRoom}
            onJoin={handleJoinRoom}
            disabled={connecting}
          />
        ) : null}

        {room?.phase === 'lobby' ? (
          <Lobby
            room={room}
            isHost={isHost}
            onUpdateSettings={handleUpdateSettings}
            onStart={() => socket.emit('room:start-game')}
          />
        ) : null}

        {room?.phase === 'gaming_round' ? (
          <GameRound room={room} me={me} onSubmit={handleSubmitScore} />
        ) : null}

        {room?.phase === 'gaming_results' ? (
          <GameResults room={room} isHost={isHost} onContinue={() => socket.emit('host:advance')} />
        ) : null}

        {((room?.phase === 'gaming_round' && me?.hasSubmitted) || room?.phase === 'gaming_results') && doodleView ? (
          <Doodle view={doodleView} myId={playerId} />
        ) : null}

        {room?.phase === 'gambling_active' ? (
          <Gambling
            room={room}
            me={me}
            onAbstain={() => socket.emit('gambling:abstain')}
            onSlot={(bet) => socket.emit('gambling:slot', { bet })}
            onCoinflip={(bet, call) => socket.emit('gambling:coinflip', { bet, call })}
            onPrisoners={(choice) => socket.emit('gambling:prisoners', { choice })}
          />
        ) : null}

        {room?.phase === 'gambling_results' ? (
          <GamblingResults
            room={room}
            isHost={isHost}
            onContinue={() => socket.emit('host:advance')}
          />
        ) : null}

        {room?.phase === 'game_over' ? (
          <GameOver room={room} isHost={isHost} onNewGame={() => socket.emit('host:advance')} />
        ) : null}
      </main>
    </div>
  );
}
