# Let's Go Gaming — architecture

The README covers what the game is and how to run it. This file covers how the code fits together, for contributors and coding agents.

## Project architecture

npm workspaces monorepo:

- `shared/`: game definitions, score-to-coin conversion, gambling constants, room/event wire types.
- `server/`: authoritative game state machine, Socket.io handlers, static file hosting.
- `client/`: thin UI that renders `RoomView` and emits typed events.

All authoritative state lives server-side in memory. No database. Key modules:

- Room lifecycle and membership: `server/src/rooms.ts`
- Game phase transitions: `server/src/gameLoop.ts`
- Gambling resolution: `server/src/gambling.ts`
- View projection per socket: `server/src/view.ts`

## Dev commands

From the repo root:

```bash
npm ci
npm run dev
npm run build
npm run typecheck
npm run test
docker compose up --build
```

## Phase flow

`lobby -> gaming_round -> gaming_results -> (after every 2 rounds) gambling_active -> gambling_results -> ... -> game_over`

If the session's remaining rounds run out mid-cycle, the trailing gambling round is skipped and the session goes straight to `game_over`.

The host advances phases from the results screens. Game order within the cycle is random, drawn from the games the host selected.

## State model

`RoomState` (server-internal) tracks:

- players: connected/disconnected, host flag, coin totals
- settings: selected games and max rounds
- the remaining randomized game queue
- current round submissions
- gambling submissions and pairings

`RoomView` (`shared/src/state.ts`) is derived from `RoomState` and emitted to all clients after every mutation. The events contract is `shared/src/events.ts`.

## Coin rules

- Every gaming round pays at least 10 coins, built into the score conversion in `shared/src/scoring.ts`.
- After any gambling round a coin total cannot drop below zero.
- Gambling odds and payoffs: `shared/src/gambling.ts`.

## Adding a new game

1. Add game metadata in `shared/src/games.ts`: `id`, `name`, `url`, `description`, `scoreKind`, `scoreInputHint`.
2. If it needs a new score shape, extend `ScoreInput` and the logic in `shared/src/scoring.ts`: `validateScoreInput()` and `scoreToCoins()`.
3. Update the client input rendering and parsing in `client/src/views/GameRound.tsx`.
