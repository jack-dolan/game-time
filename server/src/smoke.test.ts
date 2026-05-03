import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import type { ClientToServerEvents, ServerToClientEvents } from '@letsgogaming/shared';
import { createApp } from './app.js';

type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

describe('smoke', () => {
  let port: number;
  let teardown: () => Promise<void>;

  beforeAll(async () => {
    const { server, io } = createApp();
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });
    teardown = () =>
      new Promise<void>((resolve) => {
        io.close(() => server.close(() => resolve()));
      });
  });

  afterAll(() => teardown());

  function connect(): TestSocket {
    return ioClient(`http://localhost:${port}`, { forceNew: true });
  }

  it('accepts a socket connection', () =>
    new Promise<void>((resolve, reject) => {
      const client = connect();
      client.on('connect', () => {
        client.disconnect();
        resolve();
      });
      client.on('connect_error', reject);
    }));

  it('creates a room and returns a valid code and playerId', () =>
    new Promise<void>((resolve, reject) => {
      const client = connect();
      client.emit('room:create', { name: 'TestHost' }, (res) => {
        try {
          expect(res.ok).toBe(true);
          if (!res.ok) throw new Error(res.error);
          expect(res.code).toMatch(/^[BCDFGHJKLMNPQRSTVWXYZ]{5}$/);
          expect(res.playerId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
          );
          client.disconnect();
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    }));

  it('allows a second player to join and both receive a lobby room:state', () =>
    new Promise<void>((resolve, reject) => {
      const host = connect();
      host.emit('room:create', { name: 'Host' }, (createRes) => {
        if (!createRes.ok) return reject(new Error(createRes.error));
        const { code } = createRes;

        const guest = connect();
        guest.on('room:state', (state) => {
          try {
            expect(state.phase).toBe('lobby');
            expect(state.players.some((p) => p.name === 'Host')).toBe(true);
            expect(state.players.some((p) => p.name === 'Guest')).toBe(true);
            host.disconnect();
            guest.disconnect();
            resolve();
          } catch (err) {
            reject(err);
          }
        });
        guest.emit('room:join', { name: 'Guest', code }, (joinRes) => {
          if (!joinRes.ok) reject(new Error(joinRes.error));
        });
      });
    }));

  it('rejects a name longer than 25 characters', () =>
    new Promise<void>((resolve, reject) => {
      const client = connect();
      client.emit('room:create', { name: 'A'.repeat(26) }, (res) => {
        try {
          expect(res.ok).toBe(false);
          if (res.ok) throw new Error('Expected failure but got success');
          expect(res.error).toContain('25');
          client.disconnect();
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    }));
});
