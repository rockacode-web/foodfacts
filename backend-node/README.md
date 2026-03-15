# backend-node local setup

## 1. Start PostgreSQL

From `backend-node/`:

```bash
docker compose up -d
```

## 2. Configure environment

The local development file is `backend-node/.env`.

Default local values:

```env
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/foodscanner?schema=public
JWT_SECRET=dev_jwt_secret_change_me
OPENAI_API_KEY=your_openai_api_key
FRONTEND_URL=http://localhost:5173
```

Set `OPENAI_API_KEY` before testing scan analysis.

## 3. Install dependencies

```bash
npm install
```

## 4. Generate Prisma client

```bash
npm run prisma:generate
```

## 5. Run migrations

```bash
npm run prisma:migrate
```

## 6. Start the backend

```bash
npm run dev
```

or

```bash
npm start
```

## 7. What to test

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` with `Authorization: Bearer <token>`
- `GET /api/profile`
- `PUT /api/profile`
- `POST /api/scans/analyze` with `Authorization: Bearer <token>`
- `GET /api/scans/history`
- `GET /api/scans/:id`
- `DELETE /api/scans/:id`
- `POST /api/intake`
- `GET /api/intake/today`
- `DELETE /api/intake/:id`

## Notes

- The backend now checks `DATABASE_URL` and `JWT_SECRET` during startup.
- Prisma connects before the server starts listening, so database issues fail fast.
- Uploaded scan images are stored on disk under `backend-node/uploads/scan-images/`.
- User profile data is stored separately from auth and scans so it can later inform personalized health-oriented scan messaging.

## Deployment

### Frontend: Vercel

- Set `VITE_API_BASE_URL` to your deployed backend API URL.
- Deploy the `frontend/` app as a Vite project.

### Backend: Render or Railway

- Deploy `backend-node/` as a Node service.
- Use `npm install` as the install command.
- Use `npm start` as the start command.
- Set these environment variables:
  - `PORT`
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `OPENAI_API_KEY`
  - `FRONTEND_URL`

### Database: Supabase Postgres or Railway Postgres

- Provision a PostgreSQL database.
- Copy its connection string into `DATABASE_URL`.
- Run:

```bash
npm run prisma:generate
npm run prisma:deploy
```

### Production Notes

- `FRONTEND_URL` should be the deployed frontend origin, for example `https://your-app.vercel.app`.
- The backend no longer assumes only localhost CORS traffic.
- Health checks can use `GET /api/health` or `GET /`.
- Rotate any API key that has ever been committed to git.
