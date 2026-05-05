import type { PDChoice } from './gambling.js';
import type { ScoreInput } from './scoring.js';
import type { DoodleView, RoomSettings, RoomView } from './state.js';

/** Events the client emits to the server. */
export interface ClientToServerEvents {
  'room:create': (
    payload: { name: string },
    ack: (res: { ok: true; code: string; playerId: string } | { ok: false; error: string }) => void,
  ) => void;
  'room:join': (
    payload: { code: string; name: string },
    ack: (res: { ok: true; playerId: string } | { ok: false; error: string }) => void,
  ) => void;
  'room:rejoin': (
    payload: { code: string; playerId: string },
    ack: (res: { ok: true } | { ok: false; error: string }) => void,
  ) => void;
  'room:update-settings': (payload: Partial<RoomSettings>) => void;
  'room:start-game': () => void;
  'round:submit-score': (payload: { score: ScoreInput }) => void;
  'host:advance': () => void;
  'gambling:slot': (payload: { bet: number }) => void;
  'gambling:coinflip': (payload: { bet: number; call: 'heads' | 'tails' }) => void;
  'gambling:prisoners': (payload: { choice: PDChoice }) => void;
  'gambling:abstain': () => void;
  'doodle:move': (payload: { dir: 'up' | 'down' | 'left' | 'right' }) => void;
}

/** Events the server emits to the client. */
export interface ServerToClientEvents {
  'room:state': (room: RoomView) => void;
  'error:message': (message: string) => void;
  'doodle:state': (view: DoodleView) => void;
}
