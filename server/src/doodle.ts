import type { DoodlePlayer, DoodleView } from '@letsgogaming/shared';
import type { RoomState } from './types.js';

const GRID_WIDTH = 80;
const GRID_HEIGHT = 45;

const PLAYER_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#22c55e',
  '#eab308',
  '#a855f7',
  '#14b8a6',
  '#f97316',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f43f5e',
  '#64748b',
];

export function initDoodle(room: RoomState): void {
  const players = [...room.players.values()].sort((a, b) => a.joinedAt - b.joinedAt);
  const n = players.length;

  const positions = new Map<string, { x: number; y: number }>();
  const colors = new Map<string, string>();
  const indices = new Map<string, number>();
  const grid = new Array<number>(GRID_WIDTH * GRID_HEIGHT).fill(-1);

  players.forEach((player, i) => {
    const x = Math.round(((i + 1) * GRID_WIDTH) / (n + 1));
    const y = Math.round(GRID_HEIGHT / 2);
    positions.set(player.id, { x, y });
    colors.set(player.id, PLAYER_COLORS[i % PLAYER_COLORS.length]);
    indices.set(player.id, i);
    grid[y * GRID_WIDTH + x] = i;
  });

  room.doodle = { width: GRID_WIDTH, height: GRID_HEIGHT, grid, positions, colors, indices };
}

export function applyDoodleMove(
  room: RoomState,
  playerId: string,
  dir: 'up' | 'down' | 'left' | 'right',
): boolean {
  const doodle = room.doodle;
  if (!doodle) return false;

  const pos = doodle.positions.get(playerId);
  if (!pos) return false;

  const newX =
    dir === 'left'
      ? Math.max(0, pos.x - 1)
      : dir === 'right'
        ? Math.min(doodle.width - 1, pos.x + 1)
        : pos.x;
  const newY =
    dir === 'up'
      ? Math.max(0, pos.y - 1)
      : dir === 'down'
        ? Math.min(doodle.height - 1, pos.y + 1)
        : pos.y;

  if (newX === pos.x && newY === pos.y) return false;

  pos.x = newX;
  pos.y = newY;

  const idx = doodle.indices.get(playerId);
  if (idx !== undefined) {
    doodle.grid[newY * doodle.width + newX] = idx;
  }
  return true;
}

export function buildDoodleView(room: RoomState): DoodleView | null {
  const doodle = room.doodle;
  if (!doodle) return null;

  const players: DoodlePlayer[] = [];
  for (const [id, pos] of doodle.positions) {
    const player = room.players.get(id);
    const color = doodle.colors.get(id);
    const index = doodle.indices.get(id);
    if (!player || !color || index === undefined) continue;
    players.push({ id, name: player.name, color, index, x: pos.x, y: pos.y });
  }
  players.sort((a, b) => a.index - b.index);

  return { width: doodle.width, height: doodle.height, grid: doodle.grid, players };
}
