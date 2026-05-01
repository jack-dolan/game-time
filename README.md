# Let's Go Gaming

Self-hosted multiplayer party-game room for weekly team game time.

Players join a 4-letter room, play external web games in sync, submit scores on honor system, earn coins, then run periodic gambling rounds.

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

## Kubernetes deploy

```bash
kubectl apply -k k8s
```

Cloudflare Tunnel ingress example is in `k8s/cloudflared-ingress.example.yaml`.

## CI/CD

GitHub Actions workflow:
- PR: install, typecheck, build
- `main`: multi-arch image push to GHCR + `kubectl apply -k k8s`
