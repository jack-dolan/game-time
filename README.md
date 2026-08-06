# Let's Go Gaming

Self-hosted multiplayer party-game room for weekly team game time.

Players join a 5-letter room, play external web games in sync, submit scores on honor system, earn coins, then run periodic gambling rounds.

## Stack

- Client: React + TypeScript + Vite
- Server: Express + Socket.io + TypeScript
- Shared contracts: `shared/` package
- Runtime state: in-memory only (no database)

## Local development

```bash
npm ci
npm run dev
npm run test
```

Apps:
- Client: `http://localhost:5173`
- Server health: `http://localhost:8080/healthz`

## Build

```bash
npm run build
```

## Docker

```bash
docker compose up --build
```

App will be available at `http://localhost:8080`.

## Configuration

The server reads three environment variables:

| Variable | Purpose | Example |
| --- | --- | --- |
| `NODE_ENV` | Node environment | `production` |
| `PORT` | Port the server listens on | `8080` |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist that Socket.io checks the browser's origin against | `https://games.example.com` |

`ALLOWED_ORIGINS` must match the origin in the address bar exactly — scheme,
host, no trailing slash. If it does not, the page loads normally and the game
silently never connects. When unset it defaults to `http://localhost:5173`.

## CI

`.github/workflows/ci-cd.yml` runs on every pull request and every push to
`main`:

- `validate` — install, `npm audit`, typecheck, test, build.
- `image-scan` — builds the Docker image and scans it with Trivy for HIGH and
  CRITICAL OS-level vulnerabilities. **The image is never published**; it is
  built only so it can be scanned.

Every action is pinned by full commit SHA and the scanner is pinned by image
digest.

## Deployment

Pushes to `main` are built and deployed automatically by a self-hosted
[Dokploy](https://dokploy.com) instance, which clones this repository, builds
the root `Dockerfile` on the host, and runs the resulting image. There is no
deploy job in this repository and no deployment credential stored here — the
platform pulls, this repository does not push.

Runtime configuration (the domain and the environment variables above) lives in
the platform, not in this repository.

**The application runs as exactly one replica, and must continue to.** Game
rooms are held in the server process's memory. A second replica would create a
second independent set of rooms, and players would be split between them with no
way to see each other.

### Rollback

Revert the offending commit on `main` and push. That rebuilds and redeploys the
previous known-good code through the same path as any other change.

The platform also keeps a deployment history recording the commit behind each
build, which is the fastest way to identify *which* commit to revert to.
