# Sync — Architecture Review

**Reviewed by:** Senior Architect (Claude Sonnet 4.6)
**Last updated:** 2026-06-12 (v6 — final validation)
**Scale context:** 100–120 users per event on a single Node.js instance

---

## Final Validation Result

**All 16 previously open issues are resolved.** Four minor new observations below — none are blockers.

---

## Full Resolved Changelog

| # | Item | Resolution |
|---|---|---|
| 1 | No auth layer | JWT on all REST + Socket.io handshake; `AuthMiddleware` in diagram |
| 2 | No DB indexes | 5 indexes defined with comments per query path |
| 3 | No OFFLINE status | `UserEvent` has `IDLE \| ENGAGED \| OFFLINE`; 2-min inactivity timeout documented |
| 4 | `User.eventId` breaks multi-event | `UserEvent` join table with `unique(userId, eventId)` |
| 5 | `Match` missing `eventId` + `createdAt` | Both added; semantics documented inline |
| 6 | `Learning` missing unique constraint | `unique(matchId, learnerId)` added with explanatory comment |
| 7 | Leaderboard — no event filter | Scoped via `user_events` join on `:eventId` |
| 8 | Leaderboard — `avatarUrl` missing | `u.avatar_url` in SELECT |
| 9 | Leaderboard — raw average unfair | Bayesian scoring CTE with worked example in Key Design Decisions |
| 10 | Re-match prevention | Step 3 in algorithm + `idx_matches_user_pair` index |
| 11 | Socket reconnection unaddressed | Full reconnection flow in Matching Engine — 5 states covered |
| 12 | `status:changed` O(n²) broadcast | Removed; rationale note inline in socket table |
| 13 | Missing auth endpoints + `/api/events` | All added; `/api/users/me` present |
| 14 | No pagination | `?page=&limit=` on attendees + leaderboard |
| 15 | No auth/login screen | `AuthScreen` with `JoinForm`, `LoginForm`, `SSOButton` |
| 16 | No notification component | `NotificationLayer` + `ToastNotification` (always mounted) |
| 17 | Email-only login — no verification | Google OAuth added; email-only retained as demo fallback with production warning |
| 18 | Matching engine "intelligent" vs random | Step 5 now has inline clarification — random is intentional for "Random Connect"; intelligence is in `PromptSelectionService` |
| 19 | `prisma.$transaction` rollback incorrect | Backend Rule 1 corrected — TRUNCATE in `afterEach` with explanation |
| 20 | No Socket.io testing approach | Backend Rule 6 — `socket.io-client` against real test server with full example |
| 21 | No test data factory rule | Backend Rule 2 — factories in `tests/factories/`, examples for `createTestUser` + `createTestMatch` |
| 22 | Timer cleanup missing | Backend Rule 7 — `jest.useRealTimers()` in `afterEach` explicitly required |
| 23 | Route coverage lines-only | Coverage table updated — routes now require lines + branches; note added explaining why |
| 24 | No `NotificationLayer` testing rule | Frontend Rule 10 — explicit rule with code example |
| 25 | Claude Code must not read `.env` | Backend Rule 12 — `denyTools` config with `**/.env*` pattern |
| 26 | No transaction policy | Backend Rule 3 — any multi-table write must use `prisma.$transaction` |
| 27 | Socket handlers no guardrail | Backend Rule 2 — mirrors Route Rule 1; correct + incorrect examples shown |
| 28 | No rate limiting rule | Backend Rule 10 — `express-rate-limit`, max 10 req/IP/min on `/api/auth/*` |
| 29 | No CORS rule | Backend Rule 11 — `CLIENT_URL` env var; `*` forbidden |
| 30 | JWT storage unspecified | Frontend Rule 6 — upgraded to httpOnly cookie (not localStorage); frontend never touches JWT directly |
| 31 | No ErrorBoundary placement rule | Frontend Rule 7 — three mandatory levels defined |
| 32 | Socket connection lifecycle | Frontend Rule 2 — created once in `SocketContext`; direct `io()` calls banned |
| 33 | TypeScript `strict` not mandated | Full `tsconfig.json` for both layers; `strict: true` + 4 additional flags; rules on `@ts-ignore` and double-cast |
| 34 | Socket.io horizontal scaling | N/A — 100–120 users fits single process |
| 35 | Redis cache layer | N/A — query over ~100 rows is lightweight; CDN cache headers sufficient |

---

## Minor Observations (Non-Blockers)

These are small gaps that won't cause failures but should be addressed before the project scales.

---

### 1. `withTelemetry` Wrapper Has No Enforcement Rule

The Telemetry section defines a `withTelemetry(service, method, payload, fn)` wrapper and shows it in use for `MatchingEngine.createMatch`. But the Backend Development Standards have no rule mandating that all service methods use it. Without a rule, some services will be instrumented and some won't, making the `service_start/end` traces incomplete.

**Suggested addition to Backend Standards:**
*"All public service methods wrap their implementation in `withTelemetry`. A method that does not call `withTelemetry` produces no telemetry and will be invisible in the log trace."*

---

### 2. Frontend Telemetry Has No Sanitization Utility

The backend has `sanitizeForLog()` enforced by an explicit rule. The frontend sends telemetry payloads to `POST /api/telemetry` including `payload` fields. The backend endpoint drops disallowed fields silently — which is a backstop, not a guardrail. A frontend developer constructing a telemetry payload has no utility function to call before sending, making it easy to accidentally include PII in `payload`.

**Suggested addition to Frontend Standards:**
*"Use `sanitizeForTelemetry(payload)` from `utils/telemetry.ts` before constructing any telemetry event. It mirrors the backend's `sanitizeForLog` — strips all PII keys. The backend endpoint drops unknown fields as a backstop, not as the primary defence."*

---

### 3. `UserEvent` Initial Status on Join Not Specified

`POST /api/auth/join` creates a `User` and a `UserEvent`, but the initial `UserEvent.status` is not documented. The User Journey shows the user sets status to `IDLE` from the dashboard, which implies the initial value is `OFFLINE`. However, if the service creates the `UserEvent` without an explicit initial status, the default depends on whatever Prisma or the DB sets — which may vary.

**Suggested addition to `UserEvent` model docs:**
*"On join, `UserEvent.status` defaults to `OFFLINE`. The user transitions to `IDLE` by tapping the `StatusToggle` on the dashboard."*

---

### 4. Review Item #12 Stale Text (Internal)

The previous version of this review listed "JWT stored in `localStorage` under key `sync_token`" as the missing rule. The design correctly upgraded to an httpOnly cookie — which is more secure and eliminates XSS token theft risk entirely. The old suggestion is now moot. The current design's approach (httpOnly + SameSite=Strict + no Max-Age) is the right production pattern, not just a fix.

---

## What's Good

The final design is production-quality in its architecture and guardrails. Specific strengths worth calling out:

- **httpOnly cookie for JWT** — the upgrade from localStorage to an httpOnly session cookie is the right call. It eliminates the XSS token-theft vector entirely and the `SameSite=Strict` attribute handles CSRF without a separate token. This is not a common pattern in hackathon-level designs and shows strong security thinking.
- **`withTelemetry` wrapper pattern** — auto-logging `service_start/end` with a shared `operationId` is a clean way to get distributed-trace-style logs without a full observability stack. The pattern is correct and the implementation detail (wrapper generates UUID, logs both bookends) is implementable in an afternoon.
- **Zustand over Context** — the decision is well-reasoned in the Key Design Decisions section. Context re-renders all subscribers on every state change; Zustand's selector-based subscriptions isolate re-renders correctly for fast-moving socket-driven state.
- **TypeScript configuration** — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `noImplicitReturns` on top of `strict: true` is a mature configuration. Most projects only set `strict: true` and leave the rest off.
- **`sanitizeForLog` enforced at the service layer** — the PII scrubbing policy has both a utility function and a backend-endpoint backstop. Belt and braces.
- **PromptSelectionService algorithm** — audience filter → depth eligibility → interest-tag scoring → deduplication → top-3 random pick is a complete, thoughtful design.
- **EventTimerService restart-resilience** — recalculates delay from `now` on boot; missed transitions are skipped cleanly. This is the kind of detail that prevents a server restart mid-event from corrupting the event lifecycle.
- **Key metrics table with alert thresholds** — match latency, confirmation rate, learning submission rate, and rating submission rate are exactly the right funnel metrics for this product.
