import { GAMES, type RoomView } from '@letsgogaming/shared';

interface LobbyProps {
  room: RoomView;
  isHost: boolean;
  onUpdateSettings: (patch: { selectedGameIds?: string[]; maxGamingRounds?: number }) => void;
  onStart: () => void;
}

export function Lobby({ room, isHost, onUpdateSettings, onStart }: LobbyProps) {
  const selected = new Set(room.settings.selectedGameIds);

  function toggleGame(gameId: string) {
    const next = new Set(selected);
    if (next.has(gameId)) next.delete(gameId);
    else next.add(gameId);
    onUpdateSettings({ selectedGameIds: [...next] });
  }

  return (
    <section className="section">
      <h2>Lobby</h2>
      <p className="code">Code: {room.code}</p>

      <h3>Players</h3>
      <ul className="list">
        {room.players.map((player) => (
          <li key={player.id}>
            {player.isHost ? '[HOST] ' : ''}
            {player.name} {!player.connected ? '(offline)' : ''}
          </li>
        ))}
      </ul>

      <h3>Game Settings</h3>
      <div className="checkbox-grid">
        {GAMES.map((game) => (
          <label key={game.id}>
            <input
              type="checkbox"
              checked={selected.has(game.id)}
              disabled={!isHost}
              onChange={() => toggleGame(game.id)}
            />
            <span>{game.name}</span>
          </label>
        ))}
      </div>

      <label className="max-rounds">
        Max gaming rounds
        <input
          type="number"
          min={1}
          max={50}
          value={room.settings.maxGamingRounds}
          disabled={!isHost}
          onChange={(e) => onUpdateSettings({ maxGamingRounds: Number(e.target.value) })}
        />
      </label>

      {isHost ? (
        <div className="button-row">
          <button type="button" onClick={onStart} disabled={room.settings.selectedGameIds.length === 0}>
            Start Game
          </button>
        </div>
      ) : (
        <p>Waiting for host to start.</p>
      )}
    </section>
  );
}
