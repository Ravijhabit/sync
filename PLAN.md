# Sync — Execution Plan

Each phase is independently verifiable before the next begins. Phases 1–2 are
infrastructure wrappers; all application code layers on top of them.

---

## Phase 0 — Project Scaffold

**Goal:** Runnable monorepo with both processes starting cleanly and talking to
a local database.

**Backend (`server/`)**
- Init Node.js project: TypeScript, `tsconfig.json` (`strict: true`, all
  enforced flags from system design), `ts-node-dev`
- Install: `express`, `jsonwebtoken`, `cookie-parser`, `cors`, `dotenv`,
  `pino`, `zod`, `@prisma/client`, `prisma`, `socket.io`, `express-rate-limit`
- Project structure: `routes/`, `services/`, `socket/`, `middleware/`,
  `validators/`, `utils/`, `prisma/`
- `AppError` class + global error handler middleware (consistent
  `{ error: { code, message } }` shape)
- `asyncHandler` wrapper for all route functions
- `.gitignore` — `.env`, `.env.*` excluded before any secrets exist in the
  project (a secret committed and reverted is still in git history)
- `.env.example` committed with placeholder values only
- `.claude/settings.json` — `denyTools` blocking Read on `**/.env*`
- Minimal `GET /api/health` → `{ status: "ok" }` to confirm the server starts

**Frontend (`client/`)**
- Init Vite + React + TypeScript project; same `tsconfig.json` flags
- Install: `@progress/kendo-react-*`, `axios`, `zustand`, `socket.io-client`,
  `react-router-dom`
- One KendoReact theme applied at app root — never overridden with inline styles
- Project structure: `pages/`, `components/`, `hooks/`, `services/`, `stores/`,
  `utils/`, `mocks/`, `__tests__/`
- Placeholder `<App />` renders "Sync is loading…"

**Database**
- Prisma schema with `User`, `Event`, and `UserEvent` models — `UserEvent` is
  required here because `POST /api/auth/join` in Phase 1 creates a UserEvent
  row; deferring it to Phase 4 would make Phase 1 fail at runtime
- `UserEvent` — `userId`, `eventId`, `status` (IDLE | ENGAGED | OFFLINE),
  `joinedAt`; unique constraint on `(userId, eventId)`
- `DATABASE_URL` and `DATABASE_URL_TEST` in `.env`
- First migration: `npx prisma migrate dev --name init`

**Verification checkpoint:**
```
curl http://localhost:4000/api/health   → { "status": "ok" }
npm run dev (client)                   → browser shows "Sync is loading…"
npx prisma studio                      → User, Event, UserEvent tables visible
```

---

## Phase 1 — JWT Authentication (System Wrapper)

JWT is built first because every subsequent service, route, and socket handler
depends on it. Nothing else is wired until auth works end-to-end.

**Backend**
- `POST /api/auth/join` — create User + UserEvent, issue JWT as `httpOnly`
  session cookie
  - Zod validator: `{ name, email, role, company, bio, interests[], eventId }`
  - On duplicate email return existing user (idempotent for demo context)
- `POST /api/auth/login` — look up user by email, issue JWT; 404 if not found
- JWT payload: `{ userId, sessionId (fresh UUID), iat, exp }` — `exp` set to
  24 h from issue time; matches event-day use case and closes the no-expiry
  security hole
- Cookie attributes: `HttpOnly; Secure; SameSite=Strict; Path=/`; no `Max-Age`
  (session cookie)
- `GET /api/users/me` — decode JWT from cookie, return user record; 401 if no
  cookie or invalid token
- `AuthMiddleware` — `middleware/auth.ts`; verifies JWT on every non-auth
  request; attaches `req.user = { userId, sessionId }` to request
- Rate-limit `/api/auth/*`: max 10 req / IP / minute (`express-rate-limit`)
- CORS: read allowed origin from `process.env.CLIENT_URL` only

**Verification checkpoint:**
```
POST /api/auth/join   { name, email, role, company, bio, interests, eventId }
  → 201, Set-Cookie: token=<jwt>; HttpOnly; ...

GET  /api/users/me    (cookie attached by browser/curl)
  → 200 { id, name, email, role, company, bio, interests, createdAt }

GET  /api/users/me    (no cookie)
  → 401 { error: { code: "UNAUTHORIZED" } }

POST /api/auth/login  { email: "unknown@example.com" }
  → 404

POST /api/auth/login  { email: "<existing>" }
  → 200, Set-Cookie refreshed
```
All subsequent phases assume this middleware is in place on every protected
route.

**Tests (write alongside implementation):**
- `POST /api/auth/join` — 201 happy path, 400 missing fields, idempotent on
  duplicate email
- `POST /api/auth/login` — 200 happy path, 404 unknown email
- `GET /api/users/me` — 200 with valid cookie, 401 with no cookie, 401 with
  tampered token
- Auth middleware: every protected route returns 401 when no cookie is present

---

## Phase 2 — Telemetry & Observability (Service Wrapper)

Telemetry is built second because it wraps every service function. Services
written in Phase 3 onward all use `withTelemetry` from day one.

**Backend**
- Install `pino-pretty` (dev only — `pino` already installed in Phase 0)
- `utils/logger.ts` — Pino instance, structured JSON, log levels: info/warn/error
- `utils/sanitizeForLog.ts` — strips PII fields (`name`, `email`, `company`,
  `bio`, `interests`, `content`, `justification`, `feedback`) from any object
  before it reaches the logger
- `utils/withTelemetry.ts` — wraps a service function:
  - generates `operationId` UUID
  - reads `sessionId` + `userId` from caller context
  - emits `service_start` log (sanitized payload)
  - calls `fn()`, measures wall-clock duration
  - emits `service_end` log (status, durationMs, error if thrown)
  - re-throws so the calling route still handles the error
- `POST /api/telemetry` — protected endpoint; accepts frontend telemetry
  events; validates schema (allowed fields only, unknown fields dropped silently)
- Telemetry endpoint never echoes payload back; logs it at info level

**Frontend**
- `hooks/useTelemetry.ts` — exposes `trackStart(service, method, payload)` and
  `trackEnd(operationId, status, durationMs, error?)` helpers
- Both helpers POST to `/api/telemetry` fire-and-forget (errors are swallowed
  — telemetry must never break the user flow)
- `sessionId` is read once from `GET /api/users/me` response and stored in
  `useUserStore`; never from cookies or localStorage

**Verification checkpoint:**
```
# Wrap a no-op function and call it — check stdout
withTelemetry('TestService', 'testMethod', { eventId: 'uuid' }, async () => {
  return { ok: true }
})

# Expect two log lines on stdout:
{ type: "service_start", operationId: "uuid", service: "TestService", ... }
{ type: "service_end",   operationId: "uuid", durationMs: <n>, status: "success" }

POST /api/telemetry  { type: "service_start", sessionId: "uuid", ... }
  (requires valid auth cookie from Phase 1 — endpoint is protected)
  → 204 (no content)
```

---

## Phase 3 — Google OAuth (SSO)

Builds on Phase 1's JWT issue logic. Both auth paths produce an identical JWT
and cookie — downstream code is identical.

**Backend**
- Install `passport`, `passport-google-oauth20`
- `GET /api/auth/google` — redirect to Google consent screen
- `GET /api/auth/google/callback` — exchange code; look up or create User by
  email; issue same JWT + httpOnly cookie; redirect to `/` (client root —
  the app's boot sequence handles navigation via `GET /api/users/me`; redirecting
  to `/dashboard` would 404 because the dashboard route is not built until Phase 6)
- First login: create User from Google profile (`name`, `email`, `avatarUrl`)
- Return login: fetch existing User; update `avatarUrl` if changed
- Mock `passport-google-oauth20` in tests — no real Google calls

**Frontend**
- `SSOButton` component — `<a href="/api/auth/google">Sign in with Google</a>`;
  no JS redirect logic needed; browser follows the redirect chain

**Verification checkpoint:**
```
# In test environment with mocked passport strategy:
GET /api/auth/google/callback?code=mock
  → 302 to /, Set-Cookie: token=<jwt>

GET /api/users/me (with that cookie)
  → 200 { id, name, email, avatarUrl, ... }
```

---

## Phase 4 — Full Prisma Schema + Seed Data

All remaining models added. No application logic yet — just migrations and
seed.

**Schema additions**
- `UserEvent` was moved to Phase 0 (auth depends on it at Phase 1 runtime)
- `Match` — `eventId` (direct, not derived), `user1Id`, `user2Id`, `status`
  (PENDING | ACTIVE | COMPLETED | CANCELLED), `promptId`, `user1Meaningful`,
  `user2Meaningful`, `createdAt`, `startedAt`, `completedAt`
- `ConversationPrompt` — `text`, `followUp`, `category`, `depth`, `energy`,
  `audience`, `tags[]`
- `Learning` — `matchId`, `learnerId`, `targetId`, `content`, `justification`,
  `rating`, `feedback`, `isCorrect`, `submittedAt`, `reviewedAt`; unique on
  `(matchId, learnerId)`
- All five indexes from system design
- `Event.status` enum: UPCOMING | ONGOING | CLOSING | COMPLETED

**Seed**
- `prisma/seed.ts` — inserts ≥ 64 `ConversationPrompt` rows, distributed
  40% SURFACE / 40% MID / 20% DEEP, all 8 categories, all quality guidelines
  checked
- At least 2 test `Event` rows (one UPCOMING, one ONGOING) so the UI has data

**Verification checkpoint:**
```
npx prisma migrate dev    → all migrations apply cleanly
npx prisma db seed        → "Seeded 64 prompts, 2 events"
npx prisma studio         → all tables and rows visible
```

---

## Phase 5 — Auth UI (New User / Returning User)

First visible user-facing code. Verifiable in the browser.

**Pages and components**
- `EventList` page — `GET /api/events` (UPCOMING + ONGOING); renders one
  `EventCard` per event (KendoReact Card: name, venue, date, status badge)
- `AuthScreen` page — rendered when user taps an EventCard without a session
  - `SSOButton` — "Sign in with Google"
  - `JoinForm` (new user) — KendoReact Form: name, email, role
    (DropDownList), company, bio, interests (MultiSelect) → `POST /api/auth/join`
  - `LoginForm` (returning user) — email only → `POST /api/auth/login`
  - Toggle between Join and Login views
- `GET /api/events` route on the backend (stub returning seeded events)

**State**
- `useUserStore` — `{ user, sessionId, setUser, clearUser }`
- On app load: `GET /api/users/me`; if 200 → setUser + route to dashboard; if
  401 → route to EventList
- On any downstream 401: clear all stores, redirect to EventList

**Verification checkpoint (browser):**
```
1. Open app → EventList shows seeded events
2. Click an event → AuthScreen appears
3. Fill JoinForm → submit → dashboard placeholder visible, user cookie set
4. Refresh page → auto-login via /api/users/me, stays on dashboard
5. Open in new tab → LoginForm with existing email → same session
```

---

## Phase 6 — Event Dashboard Shell

Wires real event data to the dashboard layout. No real-time or matching yet.

**Backend routes**
- `GET /api/events/:id` — event detail + current status
- `GET /api/events/:id/attendees` — paginated (page, limit)

**Components**
- `EventDashboard` page — layout wrapper; error boundary mounted here
- `Header` — user avatar, event name, status badge (driven by `useEventStore`)
- `useEventStore` — `{ event, eventStatus, setEvent, setEventStatus }`
- Placeholder sections for RandomConnect, PostConversation, Leaderboard (empty
  divs with labels — wired in later phases)

**Verification checkpoint (browser):**
```
After auth → EventDashboard shows:
- Header with logged-in user avatar + event name
- Status badge matches event.status from API
- Attendee count rendered from GET /api/events/:id/attendees
```

---

## Phase 7 — Socket.io Infrastructure

Real-time layer. All match and event lifecycle events flow through here.

**Backend**
- Socket.io server attached to the Express HTTP server
- JWT auth on every socket connection: read httpOnly cookie from handshake
  request headers; verify JWT; attach `socket.data.userId` and
  `socket.data.sessionId`; reject with `disconnect` if invalid
- On connect: query `UserEvent` for this `userId` where `status != OFFLINE` to
  resolve `eventId` server-side (the JWT contains no `eventId` — client-supplied
  eventId must not be trusted); store resolved `eventId` in `socket.data.eventId`;
  join `event:<eventId>` (shared event room for broadcast) and `user:<userId>`
  (personal room for targeted emits such as `learning:review_ready`)
- Reconnection handler — on connect, check current state and re-emit:
  - PENDING match → `match:found`
  - ACTIVE match → `match:active`
  - Event CLOSING → `event:closing` with recalculated `secondsRemaining`
  - Event COMPLETED → `event:completed`
  - UserEvent OFFLINE (set while disconnected) → `user:offline`

**Frontend**
- `SocketContext` — opens one connection on mount, tears it down on unmount;
  passes socket via context
- `useSocket()` hook — returns socket from context; never calls `io()` directly
- No component or hook imports from `socket.io-client` directly
- `NotificationLayer` — always-mounted global overlay; subscribes to
  `match:found`, `match:cancelled`, `learning:review_ready` and renders
  KendoReact `Notification` toasts
- `useNotificationStore` — `{ notifications, addNotification, removeNotification }`

**Verification checkpoint:**
```
1. Auth → dashboard → browser DevTools Network tab shows WSS connection
2. Server log shows: socket connected, userId=<uuid>, sessionId=<uuid>
3. Manually emit from server → toast appears in NotificationLayer
4. Disconnect and reconnect → server re-emits correct state
```

---

## Phase 8 — Matching Engine (Backend)

Core algorithm. Fully server-side — no UI changes needed to verify.

**Services**
- `UserService.setIdle(userId, eventId)` — set UserEvent.status = IDLE;
  trigger MatchingEngine
- `MatchingEngine.handleIdle(userId, eventId)`:
  1. Check `event.status` — reject if CLOSING or COMPLETED
  2. Fetch all IDLE UserEvents for this event, excluding current user
  3. Exclude pairs with an existing non-CANCELLED Match in this event
  4. If no candidates: return null (user waits)
  5. Pick random candidate from remaining pool
  6. Wrap steps 5–8 in `prisma.$transaction`
  7. Call `PromptSelectionService.select(userA, userB, eventId)` inside
     transaction
  8. Create Match record (status: PENDING, createdAt: now)
  9. Emit `match:found { matchId, partnerHints, prompt }` to both users
- `PromptSelectionService.select(userA, userB, eventId)`:
  - Filter by audience compatibility (TECHNICAL / NON_TECHNICAL / ANY)
  - Filter by depth eligibility (based on lower completed conversation count)
  - Score by interest-tag overlap
  - Exclude already-used promptIds for either user
  - Sort descending, pick randomly from top 3; fallback to ANY/SURFACE
- `MatchService.confirmMatch(matchId, userId)`:
  - Record confirmation; if both confirmed → set Match.status = ACTIVE,
    Match.startedAt = now, both UserEvents ENGAGED
  - Emit `match:partner_ready` on first confirmation; `match:active` when both
    confirm
- `MatchService.endConversation(matchId, userId)`:
  - Set Match.status = COMPLETED, Match.completedAt = now
  - Set both UserEvents IDLE
  - Emit `match:ended { matchId }`
- Inactivity timeout: if UserEvent stays IDLE with no socket activity for 2+
  minutes → set OFFLINE; emit `user:offline`

**Socket handlers (thin — one service call each)**
- `user:set_idle` → `MatchingEngine.handleIdle`
- `user:found_partner` → `MatchService.confirmMatch`
- `user:end_conversation` → `MatchService.endConversation`
- Disconnection while ENGAGED → `MatchService.cancelMatch`; partner notified
  via `match:cancelled`; partner set IDLE

**Verification checkpoint (integration test, no UI):**
```ts
// Two socket clients connected with valid JWTs, same eventId
socketA.emit('user:set_idle', { userId: userA.id })
// Both clients receive match:found with matchId, partnerHints, prompt

socketA.emit('user:found_partner', { matchId })
// socketB receives match:partner_ready

socketB.emit('user:found_partner', { matchId })
// Both receive match:active

socketA.emit('user:end_conversation', { matchId })
// Both receive match:ended; both UserEvents → IDLE in DB

// Disconnect socketA while ENGAGED → socketB receives match:cancelled
```

**Tests (write alongside implementation):**
- Unit: `MatchingEngine.handleIdle` — happy path creates Match + emits
  `match:found`; CLOSING gate rejects; no-candidates returns null; re-match
  prevention excludes prior pairs (all against real test DB)
- Unit: `PromptSelectionService.select` — correct depth eligibility per
  conversation count, correct audience filter per role pairing, fallback when
  pool exhausted
- Integration: two real socket.io-client connections → `user:set_idle` ×2 →
  both receive `match:found` → `user:found_partner` ×2 → both receive
  `match:active` → `user:end_conversation` → both receive `match:ended`;
  assert DB state at each step
- Integration: socketA disconnects while ENGAGED → socketB receives
  `match:cancelled`; DB Match.status = CANCELLED

---

## Phase 9 — Random Connect UI

Wires Phase 8's matching engine to the browser.

**Components**
- `RandomConnect` — shown inside EventDashboard when event is ONGOING; hidden
  when CLOSING
- `StatusToggle` — KendoReact Button; "Set Myself as Available" → emits
  `user:set_idle`; shows spinner while waiting
- `MatchCard` — appears on `match:found`: partner hints (role, company,
  interests tags), "We Found Each Other" CTA → emits `user:found_partner`
- `PromptCard` — appears on `match:active`: main prompt text, follow-up nudge;
  "End Conversation" button → emits `user:end_conversation`
- `useMatchStore` — `{ match, prompt, matchStatus, setMatch, clearMatch }`
- All socket events from Phase 8 drive store updates which drive component
  visibility

**Verification checkpoint (browser, two tabs):**
```
1. Tab A and Tab B both logged in, same event, dashboard open
2. Tab A clicks "Set Myself as Available" → spinner
3. Tab B clicks "Set Myself as Available"
4. Both tabs show MatchCard with partner hints and prompt within < 1s
5. Both click "We Found Each Other" → PromptCard appears with conversation starter
6. One clicks "End Conversation" → both return to StatusToggle
```

---

## Phase 10 — EventTimerService

Event lifecycle transitions and CLOSING countdown.

**Backend service**
- On server start: query all non-COMPLETED events; schedule timers:
  - `status = UPCOMING` and `startTime > now` → timer at startTime → set
    ONGOING
  - `status in (UPCOMING, ONGOING)` and `endTime - 2min > now` → timer at
    T-2min → set CLOSING + emit `event:closing { eventId, secondsRemaining: 120 }`
  - `status in (UPCOMING, ONGOING, CLOSING)` and `endTime > now` → timer at
    endTime → set COMPLETED + emit `event:completed { eventId }`
- Resilient to restarts: recalculate delay from `now` on boot
- CLOSING transition: MatchingEngine rejects all new match requests (step 1
  check already handles this)
- COMPLETED transition: service layer returns 403 for any Learning/Match write

**Frontend**
- `useEventStore` updated when `event:closing` or `event:completed` socket
  event received
- `CountdownBanner` — rendered in EventDashboard when eventStatus = CLOSING;
  live countdown from 120s using `setInterval`; `LeaderboardReveal` animates
  in alongside
- On `event:completed`: navigate to `EventSummary` page

**Verification checkpoint (fake timers in tests):**
```ts
jest.useFakeTimers()
const now = Date.now()
const event = await createTestEvent({
  startTime: new Date(now + 1_000),    // starts in 1 s
  endTime:   new Date(now + 200_000),  // ends in ~3.3 min — T-2min fires at now+80_000
})
// EventTimerService schedules three timers on boot

jest.advanceTimersByTime(1_000)    // startTime fires
// DB: event.status === 'ONGOING'

jest.advanceTimersByTime(79_000)   // T-2min fires (endTime - 120_000 - startTime = 79_000 ms later)
// DB: event.status === 'CLOSING'; socket room receives event:closing { secondsRemaining: 120 }

jest.advanceTimersByTime(120_000)  // endTime fires
// DB: event.status === 'COMPLETED'; socket room receives event:completed
```

**Tests (write alongside implementation):**
- All three timer transitions verified with `jest.useFakeTimers()` as shown above;
  `jest.useRealTimers()` restored in `afterEach` — leaking fake timers breaks
  every subsequent test file
- Server restart resilience: seed an ONGOING event with `endTime` 60 s in the
  future; instantiate `EventTimerService` mid-lifecycle; confirm CLOSING and
  COMPLETED timers still fire at the correct wall-clock offsets

---

## Phase 11 — Post-Conversation Flow

Learning submission and peer review — the core accountability loop.

**Backend routes + services**
- `POST /api/learnings` — create Learning; 403 if `event.status = COMPLETED`;
  emit `learning:review_ready { learningId }` to `user:<targetId>` room
  (personal room joined in Phase 7 connect handler — not the event broadcast room)
- `GET /api/learnings/:id` — fetch single learning
- `PATCH /api/learnings/:id/review` — submit rating (1–10), feedback,
  isCorrect; 403 if COMPLETED; unique on `(matchId, learnerId)` enforced at DB
- `PATCH /api/matches/:id/meaningful` — set `user1Meaningful` or
  `user2Meaningful`; 403 if COMPLETED

**Frontend**
- `PostConversation` component — appears after `match:ended`; error boundary
  mounted here (failure must not affect dashboard)
- `LearningSubmit` — KendoReact TextArea for content + justification; "Submit
  Learning" button; `POST /api/learnings`
- `LearningReview` — shown when `learning:review_ready` toast is tapped; renders
  partner's learning text; KendoReact Rating (1–10); feedback TextArea; correct
  toggle; `PATCH /api/learnings/:id/review`
- `MeaningfulFlag` — "Meaningful / Casual" toggle; `PATCH
  /api/matches/:id/meaningful`
- All loading states use KendoReact Button `disabled` + spinner
- All errors route through `useNotification` → `NotificationLayer`

**Verification checkpoint (browser, two tabs):**
```
1. Complete a match flow (Phase 9 checkpoint)
2. Tab A → PostConversation → fill LearningSubmit → submit
3. Tab B → NotificationLayer shows "Your partner submitted a learning — review it"
4. Tab B → LearningReview opens; rate 8, add feedback, mark correct → submit
5. DB: Learning.rating = 8, Learning.isCorrect = true, Learning.reviewedAt set
6. Tab A → MeaningfulFlag → tap "Meaningful" → DB: user1Meaningful = true
```

**Tests (write alongside implementation):**
- `POST /api/learnings` — 201 happy path, 403 when event COMPLETED, 400
  missing fields, duplicate submission returns 409 (unique constraint)
- `PATCH /api/learnings/:id/review` — 200 happy path, 403 when event COMPLETED,
  403 when reviewer is not the target of the learning
- `PATCH /api/matches/:id/meaningful` — 200, 403 when COMPLETED
- Socket: `learning:review_ready` emitted only to the target user's personal
  room, not broadcast to the whole event room

---

## Phase 12 — Leaderboard

Ranking that becomes visible at CLOSING and finalises at COMPLETED.

**Backend**
- `LeaderboardService.getRanked(eventId)` — Bayesian score SQL query (isolated
  in this service; only raw SQL allowed here)
  ```
  bayesian_score = (C × m + Σ ratings) / (C + n)   C = 3
  ```
- `LeaderboardService.getUserStats(userId, eventId)` — personal stats in this
  event (total conversations, avg rating, meaningful/casual breakdown)
- `GET /api/events/:eventId/leaderboard` — paginated; hidden until CLOSING
  (returns 403 if ONGOING)
- `GET /api/events/:eventId/users/:userId/stats`

**Frontend**
- `Leaderboard` component — KendoReact Grid; columns: rank, avatar, name, role,
  bayesian score, avg rating, total conversations
- KendoReact Dialog — user stats on row click (GET .../stats)
- `LeaderboardReveal` — renders `CountdownBanner` + `Leaderboard`; shown in
  EventDashboard when eventStatus = CLOSING
- Same `Leaderboard` component reused in `EventSummary`

**Verification checkpoint:**
```
# Seed: 5 users with ratings [10] / [9, 9, 9] / [6] / [6] / [6]
# Global mean = (10+9+9+9+6+6+6)/7 = 55/7 ≈ 7.86,  C = 3
# User A — 1 review  @ 10: (3×7.86 + 10) / (3+1) = 8.39
# User B — 3 reviews @ 9:  (3×7.86 + 27) / (3+3) = 8.43
GET /api/events/:id/leaderboard  (with event CLOSING)
  → ordered by bayesian_score desc:
      user with 9×3 (score 8.43) outranks user with 10×1 (score 8.39) ✓

GET /api/events/:id/leaderboard  (with event ONGOING)
  → 403
```

**Tests (write alongside implementation):**
- DB test: `LeaderboardService.getRanked` with the seed above returns rows in
  correct Bayesian order — this is the only way to verify the raw SQL is correct
- `GET /api/events/:id/leaderboard` — 200 when CLOSING or COMPLETED, 403 when
  ONGOING, pagination params respected

---

## Phase 13 — EventSummary

Post-event reveal page. Ratings and final leaderboard.

**Backend routes**
- `GET /api/events/:eventId/users/:userId/ratings/received` — 403 if ONGOING
  or CLOSING; returns: learning content, justification, rating, feedback,
  isCorrect, reviewer name/role/company, match date
- `GET /api/events/:eventId/users/:userId/ratings/given` — available any time
  (backend only)

**Frontend**
- `EventSummary` page — error boundary mounted here
- `Header` — event name + "Event has ended"
- `ReceivedRatings` — fetched from `/ratings/received`; one KendoReact Card per
  reviewer: their learning about you, score, feedback, isCorrect badge, date
- `Leaderboard` — final rankings (same component as Phase 12)
- Navigation: `event:completed` socket event → Zustand setEventStatus →
  React Router navigate to EventSummary

**Verification checkpoint (browser):**
```
1. Manually set event.status = COMPLETED in DB
2. Emit event:completed from server console
3. All connected clients navigate to EventSummary
4. ReceivedRatings shows cards with correct reviewer info and scores
5. Leaderboard shows final Bayesian-ranked table
6. POST /api/learnings  → 403
7. PATCH /api/learnings/:id/review → 403
```

---

## Phase 14 — Offline & Disconnect Handling

Edge cases in the real-time layer.

**Backend**
- `UserService.handleDisconnect(socketId)`:
  - If UserEvent.status = ENGAGED → `MatchService.cancelMatch`; partner gets
    `match:cancelled` and set IDLE
  - If UserEvent.status = IDLE → schedule 2-minute timer; if socket has not
    reconnected by then → set OFFLINE, emit `user:offline`
- `socket.on('disconnect')` handler calls `UserService.handleDisconnect`
- Reconnect: `socket.on('connect')` on server calls reconnection handler
  (Phase 7) and cancels any pending offline timer for this user

**Frontend**
- `useSocket` exposes a `connected` boolean
- Offline banner shown while `connected = false`
- On `user:offline` event: clear match state, show "You were marked offline"
  notification, StatusToggle reset to available

**Verification checkpoint (integration test):**
```ts
// socketA ENGAGED, then disconnect
socketA.disconnect()
// Wait < 1s → socketB receives match:cancelled, UserEventB.status = IDLE

// socketA IDLE, then disconnect for 2+ minutes
jest.advanceTimersByTime(120_001)
// DB: UserEventA.status = OFFLINE

// socketA reconnects
// Server re-emits appropriate state; pending OFFLINE timer cancelled
```

---

## Phase 15 — Security Hardening

Final pre-test security and configuration pass.

**Backend**
- Confirm `express-rate-limit` is active on `/api/auth/*` (installed Phase 0,
  applied Phase 1) — verify 429 on the 11th request
- `cors` origin reads only from `process.env.CLIENT_URL`; `Access-Control-Allow-Origin: *`
  is not present in any response
- `helmet` for HTTP security headers
- Confirm all protected routes return 401 with no token and 403 with wrong-user
  token
- `sanitizeForLog` called before every logger call in every service

**Project config**
- Confirm `.claude/settings.json` `denyTools` rule is in place (set in Phase 0)
- Confirm `.gitignore` covers `.env`, `.env.*` (set in Phase 0)

**Verification checkpoint:**
```
POST /api/auth/join (11th request from same IP within 1 minute)
  → 429 Too Many Requests

GET /api/users/me (no cookie) → 401
GET /api/users/me (valid cookie for user B, requesting user A's data) → 403

Server stdout: no log line contains name, email, company, bio, or free text
```

---

## Phase 16 — Test Suite

Coverage enforced; CI fails below threshold.

**Backend (Jest + Supertest + real test DB)**
- `tests/factories/index.ts` — `createTestUser`, `createTestEvent`,
  `createTestMatch`, `createTestLearning` factory functions using Prisma
- `afterEach` → `TRUNCATE learnings, matches, user_events, users, events CASCADE`
- Every protected route: test for 200, 400, 401, 403, 404
- Every service function: independent unit test covering happy path + each error
  code
- Socket handlers: real `socket.io-client` connection to test server
- `EventTimerService`: `jest.useFakeTimers()` + restore in afterEach
- Google OAuth: `passport-google-oauth20` strategy mocked, no real calls
- Coverage threshold: ≥ 80% lines + branches for services and routes

**Frontend (Jest + React Testing Library + MSW + mock socket)**
- `src/mocks/handlers.ts` — MSW request handlers for all API endpoints
- `src/__mocks__/socket.ts` — controllable EventEmitter substitute; tests call
  `mockSocket.emit('match:found', payload)` directly
- Every component: co-located `ComponentName.test.tsx`
- Every component tested in all states (no match / pending / active / cancelled)
- `jest-axe` on every rendered component: `expect(await axe(container)).toHaveNoViolations()`
- Integration test flows: join → dashboard, idle → match → conversation,
  post-conversation → leaderboard
- `NotificationLayer` integration: socket events produce correct toasts (explicit
  test per event type)
- No snapshot tests; no CSS class queries; no `component.state` access
- Coverage threshold: ≥ 90% lines + branches

**Verification checkpoint:**
```
npm run test          → all tests pass
npm run test:coverage → backend ≥ 80%, frontend ≥ 90%; CI passes
```

---

## Dependency Map

```
Phase 0  ← nothing (scaffold)
Phase 1  ← Phase 0  (JWT needs server)
Phase 2  ← Phase 1  (telemetry wraps services; services start in Phase 3)
Phase 3  ← Phase 1, Phase 2  (OAuth service must use withTelemetry; Phase 2 provides it)
Phase 4  ← Phase 0  (schema independent of auth logic)
Phase 5  ← Phase 1, Phase 3, Phase 4  (SSOButton needs /api/auth/google from Phase 3; EventList needs seeded events from Phase 4)
Phase 6  ← Phase 5  (dashboard needs auth working)
Phase 7  ← Phase 1, Phase 6  (socket needs JWT + dashboard shell)
Phase 8  ← Phase 2, Phase 4, Phase 7  (engine needs telemetry + schema + sockets)
Phase 9  ← Phase 7, Phase 8  (UI needs engine + socket infra)
Phase 10 ← Phase 7, Phase 8  (timers need socket room + engine gate)
Phase 11 ← Phase 8, Phase 9, Phase 10  (post-conv needs match complete + COMPLETED lock)
Phase 12 ← Phase 4, Phase 11  (leaderboard needs ratings from Phase 11)
Phase 13 ← Phase 10, Phase 12  (summary needs COMPLETED state + leaderboard)
Phase 14 ← Phase 7, Phase 8  (disconnect handling needs socket + engine)
Phase 15 ← all phases  (hardening pass over everything)
Phase 16 ← all phases  (tests cover the full built system)
```

---

## Parallel opportunities

Phases 0–7 are sequential — the dependency chain is too tight for meaningful
parallelism. Phases 4 → 5 → 6 → 7 must complete in order: Phase 5 depends on
Phase 4 (EventList needs seeded events), and Phase 6 depends on Phase 5.
Listing Phase 4 and Phase 5 as a parallel pair was incorrect.

True parallel opportunities begin after Phase 8 completes:

| Stream A (Backend logic)    | Stream B (Frontend UI)              |
|-----------------------------|-------------------------------------|
| Phase 10 (event timers)     | Phase 9 (random connect UI)         |
| Phase 11 backend            | Phase 11 frontend                   |
| Phase 12 backend            | Phase 12 frontend                   |
| Phase 13 backend            | Phase 13 frontend                   |
| Phase 14 (disconnect logic) | Phase 14 frontend indicators        |

Stream B can start each row only once Stream A's prerequisite for that row is
done (e.g. Phase 9 requires Phase 8 complete; Phase 11 FE requires Phase 11 BE
API endpoints deployed to the dev environment).
