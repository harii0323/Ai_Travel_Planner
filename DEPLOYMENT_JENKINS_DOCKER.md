# Jenkins and Docker Deployment

This project now runs as two Docker services:

- `backend`: Node/Express API on port `5000`
- `frontend`: nginx serving the React build on port `80`, with `/api` proxied to the backend container

## Local Docker Run

1. Copy `backend/.env.docker.example` to `backend/.env.docker` and put real backend secrets there.
2. Start the stack:

```bash
docker compose up --build -d
```

3. Open `http://localhost`.

Optional port overrides:

```bash
FRONTEND_PORT=3000 BACKEND_PORT=5000 docker compose up --build -d
```

## Jenkins Setup

Install these Jenkins tools/plugins on the build agent:

- Docker and Docker Compose plugin or Docker Compose CLI
- Node.js is optional for Docker-only deployments, but the pipeline uses `npm ci`, so Node 20 is recommended
- Git plugin

Create these Jenkins secret text credentials:

- `ai-travel-frontend-url`
- `ai-travel-mongodb-uri`
- `ai-travel-jwt-secret`
- `ai-travel-google-maps-api-key`

Create a Pipeline job from SCM and point it at this repository. The included `Jenkinsfile` will:

1. Install backend and frontend dependencies
2. Run backend checks and build the frontend
3. Build Docker images
4. Deploy with `docker compose up -d` when the branch is `main`

## Production Notes

- Do not commit `backend/.env` or `backend/.env.docker`.
- Docker Compose env files must be UTF-8. If your IDE saved `backend/.env` as UTF-16, use `backend/.env.docker` for Docker instead.
- Rotate any credentials that were ever pasted into chat, logs, or Git.
- The frontend calls relative `/api` URLs in Docker, so nginx can route API traffic internally.
- For a public domain, set `FRONTEND_URL` to the exact frontend URL so backend CORS allows it.
