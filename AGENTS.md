# AGENTS.md — Let's Go Gaming

Design reference for anyone — human or agent — working on this project. It records what the game is and why it behaves the way it does. For architecture and dev commands, read CLAUDE.md.

---

## 1. Project goal

A self-hosted, multiplayer party-game website for the user's weekly team "game time" hour at work. Today, the team plays web-based games on one person's screen via screenshare. The user wants a site where everyone joins from their own browser, plays the same games independently, submits scores on the honor system, earns coins, and competes — with periodic gambling mini-games for chaos.

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

The host is whoever creates the room. Players join via a 5-letter room code (or shareable link). Host advances phases by clicking a "Continue" button. Game order within the cycle is **random** from the host-selected subset.

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

## 6. Deployment

Pushes to `main` are built and deployed automatically by a self-hosted
[Dokploy](https://dokploy.com) instance. It clones this repository, builds the
root `Dockerfile` on the host, and runs the resulting image. There is no deploy
job in this repository and no deployment credential stored here — the platform
pulls, this repository does not push.

The domain and the three runtime environment variables (`NODE_ENV`, `PORT`,
`ALLOWED_ORIGINS`) are configured in the platform, never in a committed file.

**One replica, always.** Room state lives in the server process's memory, so a
second replica would serve a second independent set of rooms and split players
between them invisibly.

Rollback is: revert the commit on `main` and push.

An earlier revision of this project deployed to a self-hosted k3s cluster via a
GitHub Actions self-hosted runner and `kubectl apply`. That cluster was retired
in August 2026 and its manifests were removed; they remain in git history if
anyone wants them.

---

## 7. Key files to read first (in this order)

1. `shared/src/games.ts` — what games exist and how they're scored
2. `shared/src/scoring.ts` — coin math
3. `shared/src/gambling.ts` — slot odds, PD payoffs
4. `shared/src/state.ts` — the `RoomView` shape that the server pushes to all clients
5. `shared/src/events.ts` — the Socket.io message contract

Once those are clear, building the server is mostly: maintain a `Room` per code, route events into a state machine, and broadcast `room:state` after every change.

---

## 8. Design decisions already settled (don't re-ask)

- All 8 games and their scoring rules (see §3).
- All 3 gambling games and exact payoffs (see §4).
- Floors: 10/round during gaming, 0 minimum after gambling.
- DeanBot for odd-numbered prisoner's dilemma rounds.
- Game flow: 2 games then 1 gamble, repeat.
- Host picks games (subset) and max rounds at lobby creation; order is random.
- Whole lobby plays the same gambling game simultaneously.
- Sessions are fully ephemeral (no DB, no cross-week history).
- Tech stack (Node + React + TS + Socket.io) is fine.
- UI should be minimal and text-based.
