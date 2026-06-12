## [2026-06-12] — PostgreSQL not reachable at localhost:5432

**Phase:** Phase 0 — Project Scaffold

**Error:**
```
Error: P1001: Can't reach database server at `localhost:5432`
Please make sure your database server is running at `localhost:5432`
```

**Context:**
Running `npx prisma migrate dev --name init` from `server/` directory.
No `.env` file exists; tried with `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sync_dev`.
No PostgreSQL process or service detected on the machine.

**Already tried:**
- `Get-Process postgres*` → no results
- `Get-Service postgresql*` → no results
- Default credential attempt with `postgres:postgres@localhost:5432`

**Status:** Open

**Resolution needed:** Please either:
1. Start a local PostgreSQL instance and create a `.env` file in `server/` with `DATABASE_URL` and `DATABASE_URL_TEST` (see `.env.example`), then run `npm run prisma:migrate` from the `server/` directory; OR
2. Provide a remote/Docker PostgreSQL connection string.
Once the DB is reachable, all migrations and seeds will run without further changes.
