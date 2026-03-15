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
- `POST /api/scans/analyze` with `Authorization: Bearer <token>`
- `GET /api/scans/history`
- `GET /api/scans/:id`
- `DELETE /api/scans/:id`

## Notes

- The backend now checks `DATABASE_URL` and `JWT_SECRET` during startup.
- Prisma connects before the server starts listening, so database issues fail fast.
- Uploaded scan images are stored on disk under `backend-node/uploads/scan-images/`.
