# BothSafe Docker Guide

## Overview

BothSafe project uses Docker for:
- **PostgreSQL** (`bothsafe-postgres`): Database
- **Redis** (`bothsafe-redis`): Cache/Session store
- **Backend API** (`bothsafe-backend`): NestJS server

Frontend runs via `npm run dev` on host (no Docker yet).

**Current ports** (as of setup):
- Backend: `http://localhost:3001`
- Postgres: `localhost:5432` → container 5432
- Redis: `localhost:6379` → container 6379

## 1. Database & Redis (docker compose)

### Start / Stop
```bash
cd bothsafe
docker compose up -d    # Start (uses ports 5432/6379 on host)
docker compose down     # Stop
docker compose down -v  # Stop and remove volumes
docker compose logs -f  # Live logs
```

**Note**: `docker-compose.yml` maps host `5432:5432` (Postgres) & `6379:6379` (Redis).  
If you have a port conflict (e.g., existing Postgres service), edit `ports:` in `docker-compose.yml`.

### Verify
```bash
docker ps | grep bothsafe
# Expected: bothsafe-postgres (healthy), bothsafe-redis (healthy)
```

### Reset Data (fresh DB)
```bash
cd bothsafe
docker compose down -v
docker volume prune -f
docker compose up -d
```

## 2. Backend API Container

### Pre-requisites
- Backend `.env` configured (create it in the `backend` directory):
  ```
  DATABASE_URL=postgresql://bothsafe:bothsafe@host.docker.internal:5432/bothsafe?schema=public
  REDIS_URL=redis://host.docker.internal:6379
  PORT=3001  # Matches docker -p
  ```
- Prisma migrations: Run `npx prisma migrate deploy` inside container or pre-build.

### Build Image
```bash
cd backend
# Create Dockerfile (if missing)
cat > Dockerfile << 'EOF'
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY prisma ./prisma
EXPOSE 3001
CMD ["npm", "run", "start:prod"]
EOF

docker build -t bothsafe-backend .
```

### Run Container
```bash
docker run -d --name bothsafe-backend \
  -p 3001:3001 \
  --env-file .env \
  --add-host=host.docker.internal:host-gateway \
  bothsafe-backend
```

**Inside container** (post-start):
```bash
docker exec -it bothsafe-backend npx prisma migrate deploy
docker exec -it bothsafe-backend npx prisma db seed  # If seed exists
```

### Logs & Management
```bash
docker logs -f bothsafe-backend      # Live backend logs
docker stop bothsafe-backend         # Stop
docker rm bothsafe-backend           # Remove
docker restart bothsafe-backend      # Restart
```

## 3. Full Stack Start (Script)
```bash
#!/bin/bash
# save as start.sh
cd bothsafe && docker compose up -d
cd ../backend
docker build -t bothsafe-backend . --no-cache  # If changes
docker run -d --name bothsafe-backend -p 3001:3001 --env-file .env --add-host=host.docker.internal:host-gateway bothsafe-backend
docker exec -it bothsafe-backend npx prisma migrate deploy
echo "✅ Backend: http://localhost:3001"
echo "✅ DB: localhost:5432, Redis: localhost:6379"
```

## 4. Frontend (Host)
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev  # http://localhost:3000
```

## Troubleshooting
- **Command Not Found**: Ensure you use `docker compose` instead of `docker-compose`. Modern Docker uses `docker compose`.
- **Port conflicts**: Change ports in `docker-compose.yml` or `-p` flags (e.g., `-p 3002:3001`).
- **DB Connection**: Use `host.docker.internal` in container `.env` when connecting to the host machine from within Docker.
- **Prisma**: Ensure `npx prisma generate` before build.
- **Health**: `docker ps` shows `(healthy)`.
- **Vols**: Persistent data in `bothsafe_postgres` volume.

See `tasks/backend_task.md` for API endpoints, `README.md` for full spec.
