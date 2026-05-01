# CLAUDE.md

## Project architecture

Monorepo workspaces:
- `shared/`: game definitions, score conversion, gambling constants, room/event wire types.
- `server/`: authoritative game state machine + Socket.io handlers + static hosting.
- `client/`: thin UI that renders `RoomView` and emits typed events.

All authoritative state lives server-side in memory:
- Room lifecycle and membership: `server/src/rooms.ts`
- Game phase transitions: `server/src/gameLoop.ts`
- Gambling resolution: `server/src/gambling.ts`
- View projection per socket: `server/src/view.ts`

## Dev commands

From repo root:

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

Host controls phase advance from results screens.

## State model summary

`RoomState` (server internal) tracks:
- players (connected/disconnected, host, coin totals)
- settings (selected games + max rounds)
- remaining randomized game queue
- current round submissions
- gambling submissions/pairings

`RoomView` (shared wire model) is derived from `RoomState` and emitted after every mutation.

## Adding a new game

1. Add game metadata in `shared/src/games.ts`:
   - `id`, `name`, `url`, `description`, `scoreKind`, `scoreInputHint`
2. If new scoring shape is needed, extend `ScoreInput` and logic in `shared/src/scoring.ts`:
   - `validateScoreInput()`
   - `scoreToCoins()`
3. Update client input rendering/parsing in `client/src/views/GameRound.tsx`.
