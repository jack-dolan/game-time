# AGENTS.md — Let's Go Gaming

Handoff document for the next agent working on this project. Read this top to bottom before touching anything.

---

## 1. Project goal

A self-hosted, multiplayer party-game website for the user's weekly team "game time" hour at work. Today, the team plays web-based games on one person's screen via screenshare. The user wants a site where everyone joins from their own browser, plays the same games independently, submits scores on the honor system, earns coins, and competes — with periodic gambling mini-games for chaos.

**Domain:** `letsgogaming.dolanjack.com` (user owns `dolanjack.com`).

**Vibe:** Minimal, text-based UI. Fun, approachable, simple. Not flashy.

---

## 2. Game flow

```
lobby
  → gaming_round (game 1)
  → gaming_results
  → gaming_round (game 2)
  → gaming_results
  → gambling_active
  → gambling_results
  → (repeat the cycle)
  → game_over → leaderboard
```

End condition: ran out of selected games OR host-set max gaming rounds reached.

The host is whoever creates the room. Players join via a 4-letter room code (or shareable link). Host advances phases by clicking a "Continue" button. Game order within the cycle is **random** from the host-selected subset.

Note: if the session ends mid-cycle (e.g., 5 rounds scheduled, so the last cycle has only 1 game), skip the trailing gambling round — go straight to game_over.

---

## 3. Games

Eight games supported. For each: name, URL, scoring rule, and how it converts to coins (10 = worst, 100 = perfect, every player always earns ≥10 per gaming round).

| ID                | Name                  | URL                                                | Score input                        | Coin conversion                                                          |
| ----------------- | --------------------- | -------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| `color-memory`    | Color Memory          | https://dialed.gg/                                 | integer 0–50 (higher better)       | linear: `10 + (score/50) * 90`                                           |
| `foodguessr`      | FoodGuessr            | https://www.foodguessr.com/game/daily              | integer 0–15,000 (higher better)   | linear: `10 + (score/15000) * 90`                                        |
| `guess-the-house` | Guess the House Price | https://guessthe.house/                            | guesses used 1–6, or X (failed)    | 7 states evenly spaced: `100, 85, 70, 55, 40, 25, 10`                    |
| `wordle`          | Wordle                | https://www.nytimes.com/games/wordle/index.html    | guesses used 1–6, or X (failed)    | same as Guess the House                                                  |
| `costcodle`       | COSTCODLE             | https://costcodle.com/                             | guesses used 1–6, or X (failed)    | same as Guess the House                                                  |
| `angle`           | Angle Guesser         | https://angle.wtf/                                 | guesses used 1–4, or X (failed)    | 5 states evenly spaced: `100, 78, 55, 33, 10` (rounded)                  |
| `cutle`           | Cutle                 | https://pfiffel.com/cutle/                         | ratio "A:B" (closer to 50:50 best) | normalize smaller side to 0–50, linear to 10–100. **`46:54` == `54:46`** |
| `connections`     | Connections           | https://www.nytimes.com/games/connections          | mistakes 0–3, or X (failed)        | 5 states evenly spaced: `100, 78, 55, 33, 10`                            |

**Honor system** for score submission. The score-to-coin logic lives in `shared/src/scoring.ts`.

---

## 4. Gambling mechanics

After every 2 gaming rounds, the **whole lobby** plays the **same** randomly-chosen gambling game (so everyone is in sync — no one is waiting). The 3 gambling games:

### Slot machine
- Bet: any amount from 0 to current coin total. (0 = effectively abstain. There's also an explicit Skip/Abstain button.)
- Outcomes (probabilities and bet multipliers):
  | Outcome   | Probability | Multiplier | Example (bet 20)   |
  | --------- | ----------- | ---------- | ------------------ |
  | Jackpot   | 5%          | +3x        | +60 coins          |
  | Win       | 25%         | +1x        | +20 coins          |
  | Push      | 25%         | 0          | 0                  |
  | Loss      | 30%         | -1x        | -20 coins          |
  | Bust      | 15%         | -1.5x      | -30 coins          |

### Coin flip
- Bet: any amount from 0 to current coin total.
- Player calls heads or tails. Win → +bet. Lose → -bet.

### Prisoner's Dilemma
- Players are paired up (random pairing each gambling round).
- If odd number of players: the leftover player is paired with **DeanBot**.
- **DeanBot always defects.**
- Both choose Cooperate or Defect simultaneously, then reveal.
- Payoffs:
  | You / Them              | Your coins | Their coins |
  | ----------------------- | ---------- | ----------- |
  | Cooperate / Cooperate   | +15        | +15         |
  | Defect / Cooperate      | +25        | -15         |
  | Cooperate / Defect      | -15        | +25         |
  | Defect / Defect         | -5         | -5          |

### Floors
- **Per gaming round:** every player earns at least 10 coins (built into the score-to-coin conversion).
- **After any gambling round:** total coins cannot drop below 0. (No negative balances.)
- During games, players can never run out of coins to gamble next time.

### Abstain
- Always available during any gambling round. Coin total unchanged.

---

## 5. Tech stack (chosen, no preference from user)

- **Frontend:** React + TypeScript, Vite. Plain CSS (minimal, text-based aesthetic). Mobile-friendly but optimized for laptop.
- **Backend:** Node.js + TypeScript, Express + Socket.io. WebSockets for real-time lobby/room sync.
- **State:** In-memory on the server. No database (sessions are ephemeral, per the user).
- **Repo layout:** npm workspaces monorepo with `shared/`, `server/`, `client/`.
- **Deployment:** Single Docker image (multi-stage: builds client, then server serves the built client static files alongside the Socket.io endpoint).

---

## 6. Deployment plan

The user's Mac Mini (M4, 16GB, macOS) is the production host. It already runs his other project (`mlops-model-platform`) and has:
- Docker
- **k3s** (lightweight Kubernetes)
- **Cloudflare Tunnel** for external access (no port-forwarding; SSL handled by Cloudflare)
- **GitHub Actions self-hosted runner**
- Image registry: **GitHub Container Registry (GHCR)**

**Reuse this exact pattern.** The deployment for `letsgogaming.dolanjack.com` should be:
1. GitHub Actions builds and pushes `ghcr.io/jack-dolan/letsgogaming` (multi-arch: arm64 for the Mac Mini, amd64 for completeness).
2. `kubectl apply` Kustomize manifests in `k8s/` to the k3s cluster (deployment + service).
3. Cloudflare Tunnel ingress maps `letsgogaming.dolanjack.com` → in-cluster service on port 80.

Reference repo for the user's existing setup: https://github.com/jack-dolan/mlops-model-platform

The user does **not** remember the Mac Mini's IP but can SSH to it (same LAN as his laptop). He'll get the IP when needed.

---

## 7. User profile & collaboration preferences

- Comfortable with SSH, GitHub Actions, Docker, k3s — has shipped a similar self-hosted project.
- No tech-stack preferences for this project; deferred to the agent's recommendation.
- Prefers UI to be **minimal, text-based, fun, approachable, simple**. Avoid heavy styling/animations.
- Wants plain confirmation before any large step; doesn't want to be peppered with questions.
- **Critical:** the previous agent (me) kept hanging mid-task. The user interrupted multiple times. The next agent should **write large batches of files in one go**, not narrate every step.

---

## 8. What's been built so far

Project root: `/home/jack/Documents/workspace/letsgogaming` (git initialized, no commits yet).

### Done
- `package.json` (root) — npm workspaces config, scripts for build/dev/start/typecheck.
- `tsconfig.base.json` — shared strict TS config.
- `.gitignore`, `.dockerignore`.
- `shared/` package — **fully written**:
  - `package.json`, `tsconfig.json`
  - `src/games.ts` — all 8 game definitions with score kinds.
  - `src/scoring.ts` — `scoreToCoins()`, `validateScoreInput()`, `parseRatio()`. Handles all 4 score-input kinds.
  - `src/gambling.ts` — slot odds table, PD payoff matrix, DeanBot strategy.
  - `src/state.ts` — Phase, RoomView, PublicPlayer, all view types passed over the wire.
  - `src/events.ts` — `ClientToServerEvents` and `ServerToClientEvents` typed Socket.io contracts.
  - `src/index.ts` — re-exports everything.
- `server/` package — **only scaffold so far**:
  - `package.json` — deps: express, socket.io, @letsgogaming/shared. devDeps: tsx, typescript, @types/node, @types/express.
  - `tsconfig.json` — references `../shared`.
  - **No source files yet.**
- `client/` — **not started**.
- Docker / k8s — **not started**.
- CLAUDE.md / README.md — **not started**.

### Sanity checks pending
- `npm install` and `tsc --build` have **not been run** — Node.js is not installed on the user's laptop. The next agent should either:
  1. Install Node 20+ on the laptop (`nvm install 20`), then `npm install && npm run build` to verify everything compiles, OR
  2. Build inside Docker (no host Node needed).

---

## 9. Next steps (in order)

1. **Server source files** (`server/src/`):
   - `index.ts` — Express + Socket.io bootstrap, serves `client/dist` static files in production, exposes `/healthz`.
   - `rooms.ts` — `RoomManager`: create room (4-letter code), join, leave, rejoin, lookup. In-memory `Map<code, Room>`. Auto-cleanup empty rooms after some grace period (e.g., 30 min idle).
   - `gameLoop.ts` — phase transitions, picks next random game from selected pool, decides when to enter gambling vs game_over, host-advance logic.
   - `gambling.ts` — runs slot/coinflip/PD; randomly picks the gambling game; pairs players for PD with DeanBot fallback for odd counts; computes outcomes; applies the 0-coin floor.
   - `handlers.ts` (or inlined in `index.ts`) — Socket.io event handlers using the typed contracts from `shared/events.ts`. After every state change, emit `room:state` to everyone in the room.
   - **Important constraint:** all real game state lives server-side. The client is a thin view that sends events and renders the latest `RoomView` from the server.

2. **Client** (`client/`):
   - Vite + React + TS scaffold (`package.json`, `vite.config.ts` with proxy to server in dev, `tsconfig.json` referencing `../shared`, `index.html`, `src/main.tsx`, `src/App.tsx`).
   - `src/socket.ts` — typed Socket.io client wrapper.
   - `src/styles.css` — minimal CSS. Monospace-ish, lots of whitespace, big buttons, no animations beyond what's free from the browser.
   - Views (one component each):
     - `Landing.tsx` — name input, [Create Room] / [Join Room with code].
     - `Lobby.tsx` — room code (large, copyable), player list, host-only controls: select games (checkboxes), set max gaming rounds, [Start].
     - `GameRound.tsx` — game name, link (open in new tab), description, score input (rendered per `scoreKind`), [Submit] button. Show who has/hasn't submitted.
     - `GameResults.tsx` — table of player → raw score → coins earned → coins total. Host sees [Continue].
     - `Gambling.tsx` — branches per `gamblingGame`: slot (bet input + Spin), coinflip (bet input + heads/tails), prisoners (cooperate/defect, shows your partner). Always an [Abstain] button.
     - `GamblingResults.tsx` — outcomes for each player. Host sees [Continue].
     - `GameOver.tsx` — final leaderboard. [New Game] returns everyone to lobby (or kicks them home; pick one).
   - Top-level `App.tsx` switches view based on `room.phase`. If no room yet, show Landing.

3. **Dockerfile + docker-compose.yml**:
   - Multi-stage: `node:20-alpine` builder builds `shared`, then `client` (`vite build`), then `server` (`tsc`). Runtime stage copies `server/dist`, `shared/dist`, `client/dist`, plus production `node_modules`. Exposes port 8080 (or whatever). Runs as non-root.
   - `docker-compose.yml` for local: single service, host port mapped, source mounted for hot reload (or just used to build and run).

4. **k8s manifests** (`k8s/`):
   - Mirror the structure from `mlops-model-platform`: `deployment.yaml`, `service.yaml`, `kustomization.yaml`. 1–2 replicas. Resource requests/limits modest (this is mostly idle WebSocket traffic). Liveness/readiness probes hitting `/healthz`.
   - **WebSocket gotcha:** if running >1 replica, sticky sessions or a shared adapter (e.g., Redis) are required for Socket.io. Recommend **start with 1 replica** for simplicity (a single team's lobby fits easily).
   - Add a `cloudflared-ingress.example.yaml` documenting the route to add in the user's existing Cloudflare Tunnel config.

5. **GitHub Actions CI/CD** (`.github/workflows/`):
   - Lint + typecheck + build on PR.
   - On push to main: build multi-arch image, push to GHCR, then `kubectl apply -k k8s/` via the self-hosted runner on the Mac Mini.

6. **CLAUDE.md** + **README.md**:
   - CLAUDE.md: architecture overview, dev commands (`npm run dev`, `npm run build`, `npm test` if tests exist, `docker compose up`), where each piece of state lives, how to add a new game (edit `shared/src/games.ts` + add scoring case if a new `ScoreKind`).
   - README: what it is, how to run locally, how it deploys.

---

## 10. Open questions / decisions deferred

These weren't asked because the user said "don't get stuck on prompts." Sensible defaults are noted; revisit if they don't match the user's intent.

- **End-of-game cleanup:** when game_over is reached, do players get bounced to Landing, or back to a fresh lobby with the same room code? **Default: back to lobby with reset state.**
- **Disconnect handling:** if a player disconnects mid-round, do we wait for them or auto-skip? **Default: their unsubmitted score = worst (10 coins). They can rejoin with the same name → re-link to their player slot.**
- **Room TTL:** abandoned rooms cleared after 30 min idle.
- **Max players per room:** soft cap at 12 (more would clutter the UI).
- **Room codes:** 4 uppercase letters, no vowels (avoid accidental words). E.g., `BKZX`.
- **Final leaderboard:** sorted by coin total. Ties broken by sum of raw coin gains (not gambling).
- **DeanBot personality:** always defects. (User confirmed.) Could be made configurable later (e.g., a "DeanBot mood" setting).

---

## 11. Key files to read first (in this order)

1. `shared/src/games.ts` — what games exist and how they're scored
2. `shared/src/scoring.ts` — coin math
3. `shared/src/gambling.ts` — slot odds, PD payoffs
4. `shared/src/state.ts` — the `RoomView` shape that the server pushes to all clients
5. `shared/src/events.ts` — the Socket.io message contract

Once those are clear, building the server is mostly: maintain a `Room` per code, route events into a state machine, and broadcast `room:state` after every change.

---

## 12. Things the user has explicitly confirmed (don't re-ask)

- All 8 games and their scoring rules (see §3).
- All 3 gambling games and exact payoffs (see §4).
- Floors: 10/round during gaming, 0 minimum after gambling.
- DeanBot for odd-numbered prisoner's dilemma rounds.
- Game flow: 2 games then 1 gamble, repeat.
- Host picks games (subset) and max rounds at lobby creation; order is random.
- Whole lobby plays the same gambling game simultaneously.
- Sessions are fully ephemeral (no DB, no cross-week history).
- Self-host on the Mac Mini using the same pattern as `mlops-model-platform`.
- Tech stack (Node + React + TS + Socket.io) is fine.
- UI should be minimal and text-based.
