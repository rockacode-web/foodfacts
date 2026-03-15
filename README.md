# FoodFacts

Authenticated food label scanning with saved analysis history, healthier alternatives, and a daily intake workspace.

## Project structure

- `frontend/`: Vite + React authenticated client
- `backend-node/`: Express + Prisma + PostgreSQL API

## Local development

### Backend

From [backend-node](/c:/Users/Dell/Desktop/FoodFacts/backend-node):

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Required backend environment variables:

```env
PORT=5000
DATABASE_URL=postgresql://...
JWT_SECRET=change_me
OPENAI_API_KEY=your_openai_api_key
FRONTEND_URL=http://localhost:5173
```

### Frontend

From [frontend](/c:/Users/Dell/Desktop/FoodFacts/frontend):

```bash
npm install
npm run dev
```

Required frontend environment variables:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## Deployment

### Frontend: Vercel

- Deploy `frontend/` as a Vite app.
- Set `VITE_API_BASE_URL` to your deployed backend API origin, for example `https://your-backend.onrender.com/api`.

### Backend: Render or Railway

- Deploy `backend-node/` as a Node service.
- Install command: `npm install`
- Start command: `npm start`
- Environment variables:
  - `PORT`
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `OPENAI_API_KEY`
  - `FRONTEND_URL`
- Health checks can target `/api/health` or `/`.

### Database: Supabase Postgres or Railway Postgres

- Provision a PostgreSQL database.
- Set `DATABASE_URL`.
- Run Prisma deploy migrations:

```bash
npm run prisma:generate
npm run prisma:deploy
```

## Notes

- Food scans are authenticated and persisted.
- Daily intake logging now uses the backend intake API:
  - `POST /api/intake`
  - `GET /api/intake/today`
  - `DELETE /api/intake/:id`
- Rotate any API key that has ever been committed or exposed.
