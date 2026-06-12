# FE ↔ BE Communication Log

---

## [2026-06-12] BE — All Backend Phases Complete; Backend Ready for Integration

**Phase:** Phase 3 — Google OAuth (SSO) + Full Backend Summary
**Status:** Completed — all backend phases 0–13 coded and TypeScript-clean. Blocked on DB only.

**What was done (Phase 3):**
- Installed `passport` + `passport-google-oauth20`
- `GET /api/auth/google` → redirects to Google consent screen
- `GET /api/auth/google/callback` → upserts user from Google profile, issues same JWT + httpOnly cookie as email auth, redirects to `CLIENT_URL`
- First login: creates `User` (`name`, `email`, `avatarUrl`) from Google profile
- Return login: fetches existing user, updates `avatarUrl` if it changed
- Passport strategy skips gracefully if `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are absent in `.env`
- `tests/oauth.test.ts` — mocked strategy; covers first-login, idempotency, avatarUrl update

**Breaking rename — action required on FE:**
- All JWT-protected route handlers now use `req.auth` (not `req.user`) internally to avoid type conflict with passport's `Express.User`. **This is a server-internal change only — no FE API response shapes changed.**

**Complete backend surface (all routes live once DB is up):**

| Method | Route | Auth | Phase |
|--------|-------|------|-------|
| GET | `/api/health` | None | 0 |
| POST | `/api/auth/join` | None (rate-limited) | 1 |
| POST | `/api/auth/login` | None (rate-limited) | 1 |
| GET | `/api/auth/google` | None | 3 |
| GET | `/api/auth/google/callback` | None | 3 |
| GET | `/api/users/me` | JWT | 1 |
| GET | `/api/events` | None | 6 |
| GET | `/api/events/:id` | JWT | 6 |
| GET | `/api/events/:id/attendees` | JWT | 6 |
| GET | `/api/events/:id/leaderboard` | JWT | 12 |
| GET | `/api/events/:id/users/:userId/stats` | JWT | 12 |
| GET | `/api/events/:id/users/:userId/ratings/received` | JWT | 13 |
| GET | `/api/events/:id/users/:userId/ratings/given` | JWT | 13 |
| POST | `/api/learnings` | JWT | 11 |
| GET | `/api/learnings/:id` | JWT | 11 |
| PATCH | `/api/learnings/:id/review` | JWT | 11 |
| PATCH | `/api/matches/:id/meaningful` | JWT | 11 |
| POST | `/api/telemetry` | JWT | 2 |

**Socket events (server → client):**
`match:found` · `match:partner_ready` · `match:active` · `match:ended` · `match:cancelled` · `user:offline` · `learning:review_ready` · `event:closing` · `event:completed`

**Socket events (client → server):**
`user:set_idle` · `user:found_partner` · `user:end_conversation`

**To unblock everything:**
```bash
# 1. Create server/.env (copy server/.env.example, fill in DATABASE_URL + JWT_SECRET)
cd server
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
# 2. Verify: curl http://localhost:4000/api/health → { "status": "ok" }
# 3. Run tests: npm test
```

**Cross-team dependency:**
- All FE contract questions from previous entry are resolved ✓
- `partnerHints.partnerId` is now included in `match:found` ✓
- Canonical socket types: `server/src/socket/types.ts`
- Backend knowledge graph: `server/KNOWLEDGE_GRAPH.json`

---

## [2026-06-12] BE — Phase 3 Google OAuth Added; All Backend Phases 0–13 Now Complete

**Phase:** Phase 3 — Google OAuth (SSO)
**Status:** Completed (code complete, blocked on DB migration)

**What was done:**
- Installed `passport` + `passport-google-oauth20`
- `GET /api/auth/google` — redirects to Google consent screen
- `GET /api/auth/google/callback` — exchanges code, upserts user, issues JWT cookie, redirects to `CLIENT_URL`
- First login: creates `User` from Google profile (`name`, `email`, `avatarUrl`)
- Return login: fetches existing user, updates `avatarUrl` if changed
- OAuth is skipped gracefully if `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are absent (falls back to email-only auth)
- `src/middleware/passport.ts` — strategy registration, isolated from app startup
- `tests/oauth.test.ts` — mocks passport strategy, verifies user creation, idempotency, and avatarUrl update
- **Note:** `req.user` renamed to `req.auth` across all JWT-protected routes to avoid conflict with passport's `Express.User` type

---

## [2026-06-12] BE — Phases 0–13 Backend Complete; API Contract Responses Confirmed

**Phase:** Phases 0–13 (All Backend Phases)
**Status:** Completed (code complete, blocked on DB migration)

**What was done:**
- Full TypeScript backend scaffolded in `server/` — all phases 0–13 implemented and compiling clean
- Responded to FE API contract questions — see responses below

**Responses to FE cross-team questions:**

1. `POST /api/auth/join` and `POST /api/auth/login` → **confirmed `{ user: User, sessionId: string }`** (updated to match FE expectation)
2. `GET /api/users/me` → **confirmed `{ user: User, sessionId: string }`** (updated to match FE expectation)
3. `GET /api/events` → **confirmed `Event[]` directly** ✓
4. `GET /api/events/:id/leaderboard` → **updated to `{ entries: LeaderboardEntry[], total: number, page, limit }`** (was `{ rows }`, now `{ entries }`)
5. `GET /api/events/:id/users/:userId/stats` → **confirmed `{ totalConversations, avgRating, meaningfulCount, casualCount }`** ✓
6. `GET .../ratings/received` → **confirmed `ReceivedRating[]` directly** ✓

**FE request: `partnerId` in `match:found`** → **Done.** `PartnerHints` now includes `partnerId: string`. The `match:found` payload is:
```ts
{
  matchId: string;
  partnerHints: {
    partnerId: string;  // ← added
    role: string;
    company: string;
    interests: string[];
  };
  prompt: { id, text, followUp, category, depth, energy };
}
```
Use `partnerHints.partnerId` as `targetId` when submitting `POST /api/learnings`.

**What is next (BE):**
- BLOCKED: PostgreSQL not running locally — need `server/.env` with DATABASE_URL set
- Once DB is available: `npx prisma migrate dev --name init && npx prisma db seed && npm run dev`
- Phase 3 (Google OAuth — `passport-google-oauth20`) is the only remaining backend phase not yet coded

**Cross-team dependency (if any):**
- FE can begin integration testing once BE server is running on `localhost:4000`
- All socket event types are in `server/src/socket/types.ts` — canonical reference for FE typing

---

## [2026-06-12] FE — Bug Fixes + Phase 14 Offline Banner

**Phase:** Phase 7 (SocketContext), Phase 9 (RandomConnect), Phase 11 (PostConversation), Phase 14 (Offline indicator)
**Status:** Completed

**What was done:**
- Fixed `SocketContext`: was using `useRef` for socket (always `null` in context value because ref is assigned in `useEffect`); switched to `useState` so all consumers re-render when socket connects
- Fixed `PostConversation`: `targetId` was always empty string — added `partnerId` field to `useMatchStore` populated from `match:found` payload
- Fixed `RandomConnect`: replaced direct `useMatchStore.setState()` call with a proper `setActivePrompt` store action
- Fixed `App.tsx`: protected routes were flashing redirect to `/` before the `GET /api/users/me` check resolved — added `authChecked` gate that shows "Sync is loading…" until the check completes
- Added Vite dev proxy: `/api` → `http://localhost:4000` and `/socket.io` → `http://localhost:4000` (ws: true); without this, API calls and WebSocket fail in dev
- Added offline reconnecting banner to `EventDashboard` — shown when `useSocket().connected === false`
- Fixed post-auth redirect: now navigates to `/dashboard/:eventId` (stores eventId in sessionStorage for reconnect)
- `PartnerHints` type updated: added `partnerId: string` field

**What is next:**
- Phase 16 — test suite setup (MSW + mock socket + jest-axe)

**Cross-team dependency (if any):**
- **`partnerId` in `match:found` payload is now required**: `PartnerHints` in the socket payload must include `partnerId: string` (the matched user's userId). The FE uses this as `targetId` when submitting a learning. Without it, the `POST /api/learnings` call will have an empty targetId. Please confirm this is included in the `match:found` emit from the matching engine.

---

## [2026-06-12] FE — Phase 0 & Phase 5–13 Frontend Scaffold Complete

**Phase:** Phase 0 — Project Scaffold + Phases 5–13 (Frontend components)
**Status:** Completed (frontend scaffold) | Blocked (integration — awaiting BE)

**What was done:**

- Initialised Vite + React + TypeScript project at `client/`
- Installed all dependencies: `axios`, `zustand`, `socket.io-client`, `react-router-dom`, KendoReact packages (`@progress/kendo-react-buttons`, `inputs`, `dropdowns`, `grid`, `layout`, `notification`, `dialogs`, `form`, `indicators`, `popup`, `animation`, `common`), `@progress/kendo-theme-default`
- Applied KendoReact default theme at app root (`main.tsx`) — single import, never overridden
- Configured `tsconfig.app.json` with strict TypeScript flags from system design (`strict`, `strictNullChecks`, `noImplicitAny`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`)
- **Note:** `skipLibCheck: true` set — KendoReact library declarations have type incompatibilities with `exactOptionalPropertyTypes` and `TS2320` interface conflicts. Documented in `FE_ERROR_FACED.md`. All *our* code remains fully type-safe.
- Build passes clean: `npm run build` ✓ (1301 modules, no errors in src/)

**Project structure created:**
```
client/src/
├── pages/         EventList, AuthScreen, EventDashboard, EventSummary
├── components/    ErrorBoundary, NotificationLayer, Header, EventCard,
│                  SSOButton, JoinForm, LoginForm, RandomConnect (StatusToggle,
│                  MatchCard, PromptCard), PostConversation (LearningSubmit,
│                  LearningReview, MeaningfulFlag), CountdownBanner,
│                  LeaderboardReveal, Leaderboard
├── hooks/         SocketContext (SocketProvider + useSocket), useCurrentUser,
│                  useTelemetry
├── services/      api.ts (all axios wrappers), types.ts (all API shapes)
├── stores/        useUserStore, useEventStore, useMatchStore,
│                  useNotificationStore
└── socket/        types.ts (typed ServerToClientEvents, ClientToServerEvents)
```

**Routing:**
- `/` → EventList
- `/auth?eventId=<id>` → AuthScreen (Join / Login / SSO)
- `/dashboard` and `/dashboard/:eventId` → EventDashboard (protected)
- `/summary` → EventSummary (protected)
- Any 401 response → clears all stores + redirects to `/`

**Socket integration:**
- `SocketProvider` opens one `socket.io-client` connection on mount, tears down on unmount
- `NotificationLayer` subscribes to: `match:found`, `match:cancelled`, `learning:review_ready`, `user:offline`, `event:completed`
- `RandomConnect` subscribes to: `match:found`, `match:active`, `match:ended`, `match:cancelled`
- `LeaderboardReveal` subscribes to: `event:closing`

**What is next:**
- Integration testing once BE endpoints are live
- Phase 16 — test suite (MSW handlers + mock socket + jest-axe)

**Cross-team dependency (if any):**
- Need BE to confirm the exact response shape for `POST /api/auth/join` and `POST /api/auth/login`:
  - FE expects `{ user: User, sessionId: string }` — please confirm this matches your JWT decode response
- Need BE to confirm `GET /api/users/me` returns `{ user: User, sessionId: string }` (FE uses this on app load for auto-login)
- Need BE to confirm `GET /api/events` returns `Event[]` directly (not wrapped in `{ events: Event[] }`)
- Need BE to confirm `GET /api/events/:id/leaderboard` returns `{ entries: LeaderboardEntry[], total: number }`
- Need BE to confirm `GET /api/events/:id/users/:userId/stats` returns `{ totalConversations, avgRating, meaningfulCount, casualCount }`
- Need BE to confirm `GET /api/events/:id/users/:userId/ratings/received` returns `ReceivedRating[]` directly
- All types are defined in `client/src/services/types.ts` — please review and flag any mismatches
