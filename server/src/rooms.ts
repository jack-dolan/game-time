import { GAMES } from '@letsgogaming/shared';
import { randomUUID } from 'node:crypto';
import type { PlayerState, RoomState } from './types.js';

const ROOM_CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXYZ';
const ROOM_CODE_LENGTH = 5;
const MAX_CODE_ATTEMPTS = 500;
const MAX_NAME_LENGTH = 25;

export const MAX_PLAYERS_PER_ROOM = 12;
export const ROOM_IDLE_TTL_MS = 30 * 60 * 1000;

function normalizeName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (normalized.length > MAX_NAME_LENGTH) {
    throw new Error(`Name must be ${MAX_NAME_LENGTH} characters or fewer.`);
  }
  return normalized;
}

function randomRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    const idx = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET[idx];
  }
  return code;
}

function makeDefaultSettings() {
  return {
    selectedGameIds: GAMES.map((g) => g.id),
    maxGamingRounds: Math.min(6, GAMES.length),
  };
}

function makePlayer(name: string, isHost: boolean): PlayerState {
  return {
    id: randomUUID(),
    name: normalizeName(name),
    isHost,
    connected: true,
    socketId: null,
    joinedAt: Date.now(),
    coins: 0,
    gamingCoinsEarnedTotal: 0,
  };
}

export class RoomManager {
  private readonly rooms = new Map<string, RoomState>();

  createRoom(hostName: string): { room: RoomState; player: PlayerState } {
    const normalizedHostName = normalizeName(hostName);
    if (!normalizedHostName) {
      throw new Error('Name is required.');
    }

    const code = this.generateUniqueCode();
    const host = makePlayer(normalizedHostName, true);
    const now = Date.now();

    const room: RoomState = {
      code,
      createdAt: now,
      lastActiveAt: now,
      hostId: host.id,
      phase: 'lobby',
      settings: makeDefaultSettings(),
      players: new Map([[host.id, host]]),
      remainingGameIds: [],
      completedGamingRounds: 0,
    };

    this.rooms.set(code, room);
    return { room, player: host };
  }

  joinRoom(code: string, name: string): { room: RoomState; player: PlayerState } {
    const room = this.getRoomOrThrow(code);
    const normalizedName = normalizeName(name);
    if (!normalizedName) {
      throw new Error('Name is required.');
    }

    const existingByName = [...room.players.values()].find(
      (player) => player.name.toLowerCase() === normalizedName.toLowerCase(),
    );

    if (existingByName && existingByName.connected) {
      throw new Error('That name is already in use in this room.');
    }

    if (existingByName && !existingByName.connected) {
      existingByName.connected = true;
      this.touch(room);
      return { room, player: existingByName };
    }

    if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
      throw new Error(`Room is full (max ${MAX_PLAYERS_PER_ROOM} players).`);
    }

    const player = makePlayer(normalizedName, false);
    room.players.set(player.id, player);
    this.touch(room);
    return { room, player };
  }

  rejoinRoom(code: string, playerId: string): { room: RoomState; player: PlayerState } {
    const room = this.getRoomOrThrow(code);
    const player = room.players.get(playerId);
    if (!player) {
      throw new Error('Player not found in this room.');
    }

    player.connected = true;
    this.touch(room);
    return { room, player };
  }

  attachSocket(code: string, playerId: string, socketId: string): RoomState {
    const room = this.getRoomOrThrow(code);
    const player = room.players.get(playerId);
    if (!player) {
      throw new Error('Player not found in this room.');
    }

    player.socketId = socketId;
    player.connected = true;
    this.touch(room);
    return room;
  }

  markDisconnected(code: string, playerId: string): RoomState | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return null;

    const player = room.players.get(playerId);
    if (!player) return room;

    player.connected = false;
    player.socketId = null;
    this.touch(room);
    return room;
  }

  getRoom(code: string): RoomState | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  cleanupStaleRooms(now = Date.now()): number {
    let removed = 0;
    for (const [code, room] of this.rooms.entries()) {
      const connectedCount = [...room.players.values()].filter((p) => p.connected).length;
      const stale = now - room.lastActiveAt > ROOM_IDLE_TTL_MS;
      if (connectedCount === 0 && stale) {
        this.rooms.delete(code);
        removed += 1;
      }
    }
    return removed;
  }

  touch(room: RoomState): void {
    room.lastActiveAt = Date.now();
  }

  private generateUniqueCode(): string {
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i += 1) {
      const code = randomRoomCode();
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('Unable to allocate a room code. Try again.');
  }

  private getRoomOrThrow(code: string): RoomState {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) {
      throw new Error('Room not found.');
    }
    return room;
  }
}
