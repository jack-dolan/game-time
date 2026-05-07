import { describe, expect, it } from 'vitest';
import {
  RoomManager,
  MAX_PLAYERS_PER_ROOM,
  ROOM_IDLE_TTL_MS,
  ROOM_MAX_LIFETIME_MS,
} from '../src/rooms.js';

describe('RoomManager.joinRoom', () => {
  it('rejects a name already used in the room (exact match)', () => {
    const manager = new RoomManager();
    const { room } = manager.createRoom('Alice');

    expect(() => manager.joinRoom(room.code, 'Alice')).toThrow(
      'That name is already in use in this room.',
    );
  });

  it('rejects a name already used in the room (case-insensitive)', () => {
    const manager = new RoomManager();
    const { room } = manager.createRoom('Alice');

    expect(() => manager.joinRoom(room.code, 'alice')).toThrow(
      'That name is already in use in this room.',
    );
    expect(() => manager.joinRoom(room.code, 'ALICE')).toThrow(
      'That name is already in use in this room.',
    );
  });

  it('allows exactly MAX_PLAYERS_PER_ROOM players', () => {
    const manager = new RoomManager();
    const { room } = manager.createRoom('Player1');

    for (let i = 2; i <= MAX_PLAYERS_PER_ROOM; i++) {
      manager.joinRoom(room.code, `Player${i}`);
    }

    expect(room.players.size).toBe(MAX_PLAYERS_PER_ROOM);
  });

  it('rejects a join when room is at MAX_PLAYERS_PER_ROOM', () => {
    const manager = new RoomManager();
    const { room } = manager.createRoom('Player1');

    for (let i = 2; i <= MAX_PLAYERS_PER_ROOM; i++) {
      manager.joinRoom(room.code, `Player${i}`);
    }

    expect(() => manager.joinRoom(room.code, 'Overflow')).toThrow(
      `Room is full (max ${MAX_PLAYERS_PER_ROOM} players).`,
    );
  });
});

describe('RoomManager.cleanupStaleRooms', () => {
  it('removes a room with no connected players past ROOM_IDLE_TTL_MS', () => {
    const manager = new RoomManager();
    const { room, player: host } = manager.createRoom('Host');

    manager.markDisconnected(room.code, host.id);
    // room.lastActiveAt was updated by markDisconnected's touch() call
    const staleNow = room.lastActiveAt + ROOM_IDLE_TTL_MS + 1;

    const removed = manager.cleanupStaleRooms(staleNow);

    expect(removed).toBe(1);
    expect(manager.getRoom(room.code)).toBeUndefined();
  });

  it('does not remove a room with no connected players that is not yet past ROOM_IDLE_TTL_MS', () => {
    const manager = new RoomManager();
    const { room, player: host } = manager.createRoom('Host');

    manager.markDisconnected(room.code, host.id);
    const notYetStaleNow = room.lastActiveAt + ROOM_IDLE_TTL_MS - 1;

    const removed = manager.cleanupStaleRooms(notYetStaleNow);

    expect(removed).toBe(0);
    expect(manager.getRoom(room.code)).toBeDefined();
  });

  it('removes a room past ROOM_MAX_LIFETIME_MS regardless of activity', () => {
    const manager = new RoomManager();
    const { room } = manager.createRoom('Host');
    // Host is still connected — max lifetime fires anyway
    const expiredNow = room.createdAt + ROOM_MAX_LIFETIME_MS + 1;

    const removed = manager.cleanupStaleRooms(expiredNow);

    expect(removed).toBe(1);
    expect(manager.getRoom(room.code)).toBeUndefined();
  });

  it('does not remove an active room with a connected player', () => {
    const manager = new RoomManager();
    const { room } = manager.createRoom('Host');
    // Room is fresh and has a connected player
    const removed = manager.cleanupStaleRooms(Date.now());

    expect(removed).toBe(0);
    expect(manager.getRoom(room.code)).toBeDefined();
  });
});

describe('RoomManager.markDisconnected', () => {
  it('transfers host to the next connected player when host disconnects', () => {
    const manager = new RoomManager();
    const { room, player: host } = manager.createRoom('Host');
    const { player: guest } = manager.joinRoom(room.code, 'Guest');

    expect(host.isHost).toBe(true);
    expect(guest.isHost).toBe(false);

    manager.markDisconnected(room.code, host.id);

    expect(host.connected).toBe(false);
    expect(host.isHost).toBe(false);
    expect(guest.isHost).toBe(true);
    expect(room.hostId).toBe(guest.id);
  });

  it('picks the earliest-joined connected player as new host', () => {
    const manager = new RoomManager();
    const { room, player: host } = manager.createRoom('Host');
    const { player: guest1 } = manager.joinRoom(room.code, 'Guest1');
    const { player: guest2 } = manager.joinRoom(room.code, 'Guest2');

    // guest2 is disconnected, so guest1 (earlier joinedAt among connected) becomes host
    manager.markDisconnected(room.code, guest2.id);
    manager.markDisconnected(room.code, host.id);

    expect(guest1.isHost).toBe(true);
    expect(guest2.isHost).toBe(false);
    expect(room.hostId).toBe(guest1.id);
  });

  it('does not transfer host when no connected players remain', () => {
    const manager = new RoomManager();
    const { room, player: host } = manager.createRoom('Host');

    manager.markDisconnected(room.code, host.id);

    expect(host.connected).toBe(false);
    // no one to transfer to, so hostId is unchanged
    expect(room.hostId).toBe(host.id);
  });
});
