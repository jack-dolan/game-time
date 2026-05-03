import express from 'express';
import helmet from 'helmet';
import http from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ClientToServerEvents, ServerToClientEvents } from '@letsgogaming/shared';
import { Server } from 'socket.io';
import {
  hostAdvance,
  maybeFinalizeRoundAfterPresenceChange,
  startGame,
  submitRoundScore,
  updateRoomSettings,
} from './gameLoop.js';
import { maybeFinalizeGamblingAfterPresenceChange, submitGamblingAction } from './gambling.js';
import { ROOM_IDLE_TTL_MS, RoomManager } from './rooms.js';
import { buildRoomView } from './view.js';

interface SocketData {
  roomCode?: string;
  playerId?: string;
}

const MAX_EVENTS_PER_SECOND = 20;

export function createApp() {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:5173'];
  const app = express();
  app.use(helmet());
  const server = http.createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(server, {
    cors: { origin: allowedOrigins, credentials: true },
    maxHttpBufferSize: 1e4,
  });
  const rooms = new RoomManager();

  const thisFilePath = fileURLToPath(import.meta.url);
  const thisDirPath = path.dirname(thisFilePath);
  const clientDist = path.resolve(thisDirPath, '../../client/dist');

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('/{*path}', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  function emitRoomState(code: string): void {
    const room = rooms.getRoom(code);
    if (!room) return;

    for (const player of room.players.values()) {
      if (!player.socketId) continue;
      io.to(player.socketId).emit('room:state', buildRoomView(room, player.id));
    }
  }

  function sendSocketError(socketId: string, message: string): void {
    io.to(socketId).emit('error:message', message);
  }

  function bindSocketToRoom(socketData: SocketData, code: string, playerId: string): void {
    socketData.roomCode = code;
    socketData.playerId = playerId;
  }

  function getBoundRoomAndPlayer(socketData: SocketData) {
    const { roomCode, playerId } = socketData;
    if (!roomCode || !playerId) {
      throw new Error('You are not currently in a room.');
    }

    const room = rooms.getRoom(roomCode);
    if (!room) throw new Error('Room not found.');
    const player = room.players.get(playerId);
    if (!player) throw new Error('Player not found.');
    return { room, player };
  }

  io.on('connection', (socket) => {
    let eventCount = 0;
    let windowStart = Date.now();

    socket.use(([_event], next) => {
      const now = Date.now();
      if (now - windowStart > 1000) {
        eventCount = 0;
        windowStart = now;
      }
      if (++eventCount > MAX_EVENTS_PER_SECOND) {
        socket.disconnect(true);
        return;
      }
      next();
    });

    socket.on('room:create', (payload, ack) => {
      try {
        const { room, player } = rooms.createRoom(payload.name);
        rooms.attachSocket(room.code, player.id, socket.id);
        socket.join(room.code);
        bindSocketToRoom(socket.data, room.code, player.id);
        ack({ ok: true, code: room.code, playerId: player.id });
        emitRoomState(room.code);
      } catch (err) {
        ack({ ok: false, error: err instanceof Error ? err.message : 'Failed to create room.' });
      }
    });

    socket.on('room:join', (payload, ack) => {
      try {
        const code = payload.code.toUpperCase();
        const { room, player } = rooms.joinRoom(code, payload.name);
        rooms.attachSocket(room.code, player.id, socket.id);
        socket.join(room.code);
        bindSocketToRoom(socket.data, room.code, player.id);
        ack({ ok: true, playerId: player.id });
        emitRoomState(room.code);
      } catch (err) {
        ack({ ok: false, error: err instanceof Error ? err.message : 'Failed to join room.' });
      }
    });

    socket.on('room:rejoin', (payload, ack) => {
      try {
        const code = payload.code.toUpperCase();
        const { room, player } = rooms.rejoinRoom(code, payload.playerId);
        rooms.attachSocket(room.code, player.id, socket.id);
        socket.join(room.code);
        bindSocketToRoom(socket.data, room.code, player.id);
        ack({ ok: true });
        emitRoomState(room.code);
      } catch (err) {
        ack({ ok: false, error: err instanceof Error ? err.message : 'Failed to rejoin room.' });
      }
    });

    socket.on('room:update-settings', (payload) => {
      try {
        const { room, player } = getBoundRoomAndPlayer(socket.data);
        if (room.phase !== 'lobby') throw new Error('Settings can only be changed in lobby.');
        if (room.hostId !== player.id) throw new Error('Only host can update settings.');
        updateRoomSettings(room, payload);
        rooms.touch(room);
        emitRoomState(room.code);
      } catch (err) {
        sendSocketError(socket.id, err instanceof Error ? err.message : 'Failed to update settings.');
      }
    });

    socket.on('room:start-game', () => {
      try {
        const { room, player } = getBoundRoomAndPlayer(socket.data);
        if (room.hostId !== player.id) throw new Error('Only host can start the game.');
        startGame(room);
        rooms.touch(room);
        emitRoomState(room.code);
      } catch (err) {
        sendSocketError(socket.id, err instanceof Error ? err.message : 'Failed to start game.');
      }
    });

    socket.on('round:submit-score', (payload) => {
      try {
        const { room, player } = getBoundRoomAndPlayer(socket.data);
        submitRoundScore(room, player.id, payload.score);
        rooms.touch(room);
        emitRoomState(room.code);
      } catch (err) {
        sendSocketError(socket.id, err instanceof Error ? err.message : 'Failed to submit score.');
      }
    });

    socket.on('host:advance', () => {
      try {
        const { room, player } = getBoundRoomAndPlayer(socket.data);
        if (room.hostId !== player.id) throw new Error('Only host can advance.');
        hostAdvance(room);
        rooms.touch(room);
        emitRoomState(room.code);
      } catch (err) {
        sendSocketError(socket.id, err instanceof Error ? err.message : 'Failed to advance phase.');
      }
    });

    socket.on('gambling:slot', (payload) => {
      try {
        const { room, player } = getBoundRoomAndPlayer(socket.data);
        submitGamblingAction(room, player.id, { kind: 'slot', bet: payload.bet });
        rooms.touch(room);
        emitRoomState(room.code);
      } catch (err) {
        sendSocketError(
          socket.id,
          err instanceof Error ? err.message : 'Failed to submit slot action.',
        );
      }
    });

    socket.on('gambling:coinflip', (payload) => {
      try {
        const { room, player } = getBoundRoomAndPlayer(socket.data);
        submitGamblingAction(room, player.id, {
          kind: 'coinflip',
          bet: payload.bet,
          call: payload.call,
        });
        rooms.touch(room);
        emitRoomState(room.code);
      } catch (err) {
        sendSocketError(
          socket.id,
          err instanceof Error ? err.message : 'Failed to submit coin flip action.',
        );
      }
    });

    socket.on('gambling:prisoners', (payload) => {
      try {
        const { room, player } = getBoundRoomAndPlayer(socket.data);
        submitGamblingAction(room, player.id, { kind: 'prisoners', choice: payload.choice });
        rooms.touch(room);
        emitRoomState(room.code);
      } catch (err) {
        sendSocketError(
          socket.id,
          err instanceof Error ? err.message : "Failed to submit prisoner's dilemma action.",
        );
      }
    });

    socket.on('gambling:abstain', () => {
      try {
        const { room, player } = getBoundRoomAndPlayer(socket.data);
        submitGamblingAction(room, player.id, { kind: 'abstain' });
        rooms.touch(room);
        emitRoomState(room.code);
      } catch (err) {
        sendSocketError(
          socket.id,
          err instanceof Error ? err.message : 'Failed to submit abstain action.',
        );
      }
    });

    socket.on('disconnect', () => {
      const { roomCode, playerId } = socket.data;
      if (!roomCode || !playerId) return;
      const room = rooms.markDisconnected(roomCode, playerId);
      if (!room) return;
      maybeFinalizeRoundAfterPresenceChange(room);
      maybeFinalizeGamblingAfterPresenceChange(room);
      emitRoomState(room.code);
    });
  });

  setInterval(() => {
    rooms.cleanupStaleRooms();
  }, Math.floor(ROOM_IDLE_TTL_MS / 2)).unref();

  return { server, io };
}
