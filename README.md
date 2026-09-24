# Let's Go Gaming

A self-hosted multiplayer party-game site for a regular team game hour. Everyone joins a room from their own browser, plays the same short web games, types in their score on the honor system, and earns coins. Every two rounds the whole room plays a random gambling mini-game for chaos. A leaderboard decides the winner.

Built as a single Docker image, with real-time room sync over WebSockets.

## How a session runs

1. One person creates a room and picks which games to play and how many rounds.
2. Players join with the 5-letter room code.
3. Each round, everyone plays the external game at its own site, then enters their result. Every player earns at least 10 coins per round, up to 100 for a perfect score.
4. After every two rounds, everyone plays one of three gambling games: a slot machine, a coin flip, or prisoner's dilemma against another player. Bets can drop a coin total to zero, but no further.
5. The session ends after the configured number of rounds and shows the final leaderboard.

## The games

| Game | Score entered |
| --- | --- |
| Color Memory | Sequence score, 0-50 |
| FoodGuessr | Points, 0-15,000 |
| Guess the House Price | Guesses used (1-6) or X |
| Wordle | Guesses used (1-6) or X |
| COSTCODLE | Guesses used (1-6) or X |
| Angle Guesser | Guesses used (1-4) or X |
| Cutle | Cut ratio, e.g. 46:54 |
| Connections | Mistakes (0-3) or X |

Scores convert linearly to coins: a perfect entry earns 100, the worst earns 10. Guess-based games split the range evenly across states. Cutle measures how close the cut is to 50:50, so `46:54` and `54:46` score the same.

## Stack

- Client: React + TypeScript + Vite
- Server: Express + Socket.io + TypeScript
- Shared contracts: `shared/` package
- State: in-memory only, no database

## Configuration

The server reads three environment variables:

| Variable | Purpose | Example |
| --- | --- | --- |
| `NODE_ENV` | Node environment | `production` |
| `PORT` | Port the server listens on | `8080` |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist that Socket.io checks the browser's origin against | `https://games.example.com` |

`ALLOWED_ORIGINS` must match the origin in the address bar exactly: scheme, host, no trailing slash. If it does not, the page loads normally and the game silently never connects. When unset it defaults to `http://localhost:5173`.

## Deployment

Deploy the image however you run containers. It builds the client and serves the built files alongside the Socket.io endpoint from one Node process.

**Run exactly one replica.** Rooms live in the server process's memory. A second replica would create a second independent set of rooms, and players would be split between them with no way to see each other.

Set `ALLOWED_ORIGINS` to the public origin and expose port 8080 (or set `PORT`).

## Local development

```bash
npm ci
npm run dev
```

Client at `http://localhost:5173`, server health at `http://localhost:8080/healthz`. Or run the full image locally:

```bash
docker compose up --build
```

The app is then at `http://localhost:8080`.

## Tests and checks

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```
