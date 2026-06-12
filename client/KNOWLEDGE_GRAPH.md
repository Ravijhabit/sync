# Frontend Knowledge Graph — Sync Client

Quick-traversal reference for the `client/src` codebase. Each section is a traversal lens; follow the one that matches your current task.

---

## 1. Directory Map

```
src/
├── main.tsx                    # React DOM root — mounts <App />, imports Kendo theme CSS
├── App.tsx                     # Root: ErrorBoundary → BrowserRouter → SocketProvider → NotificationLayer → AppRoutes
├── App.css / index.css         # Global styles
│
├── pages/                      # One folder per route
│   ├── EventList/              # Route: /
│   ├── AuthScreen/             # Route: /auth
│   ├── EventDashboard/         # Route: /dashboard[/:eventId]  (auth-guarded)
│   └── EventSummary/           # Route: /summary               (auth-guarded)
│
├── components/                 # Reusable UI units
│   ├── ErrorBoundary/          # Class component; wraps subtrees; logs via telemetryApi
│   ├── Header/                 # Top bar: logo, event name, status badge, user avatar
│   ├── NotificationLayer/      # Kendo Notification sink; reads useNotificationStore
│   ├── EventCard/              # Card shown in EventList
│   ├── JoinForm/               # Sign-up form (name, email, role, company, bio, interests)
│   ├── LoginForm/              # Email login form
│   ├── SSOButton/              # Links to /api/auth/google
│   ├── RandomConnect/          # Match lifecycle orchestrator + sub-cards
│   │   ├── RandomConnect.tsx   # Listens to match:* socket events; switches between sub-cards
│   │   ├── StatusToggle.tsx    # "Find a match" button → emits user:set_idle
│   │   ├── MatchCard.tsx       # Shows partner hints; confirm → emits user:found_partner
│   │   └── PromptCard.tsx      # Conversation prompt + follow-up nudge; end → emits user:end_conversation
│   ├── PostConversation/       # Post-match flow
│   │   ├── PostConversation.tsx    # Coordinates the three sub-steps
│   │   ├── LearningSubmit.tsx      # Submits what you learned about partner → learningsApi.submit
│   │   ├── LearningReview.tsx      # Triggered by learning:review_ready; rates partner's entry
│   │   └── MeaningfulFlag.tsx      # Meaningful / Casual toggle → matchesApi.markMeaningful
│   ├── Leaderboard/            # Kendo Grid; row click opens stats dialog
│   ├── LeaderboardReveal/      # Wraps Leaderboard with countdown banner; shown on event:closing
│   └── CountdownBanner/        # Timer display (seconds remaining)
│
├── hooks/
│   ├── SocketContext.tsx       # SocketProvider + useSocket() — initialises socket.io
│   ├── useCurrentUser.ts       # Fetches /users/me on mount; returns { user, loading }
│   ├── useTelemetry.ts         # trackStart / trackEnd / trackError helpers → telemetryApi
│   └── types.ts                # Hook-level type definitions
│
├── stores/                     # Zustand slices
│   ├── types.ts                # All store interfaces + domain enums (re-exported)
│   ├── useUserStore.ts         # { user, sessionId } + setUser / clearUser
│   ├── useEventStore.ts        # { event, eventStatus } + setEvent / setEventStatus
│   ├── useMatchStore.ts        # { matchId, partnerId, partnerHints, prompt, matchStatus } + mutations
│   └── useNotificationStore.ts # { notifications[] } + addNotification / removeNotification
│
├── services/
│   ├── types.ts                # All REST data models and request-body shapes
│   └── api.ts                  # Axios instance + authApi / eventsApi / matchesApi / learningsApi / telemetryApi
│
├── socket/
│   └── types.ts                # ServerToClientEvents + ClientToServerEvents typed interfaces
│
├── utils/
│   └── cn.ts                   # className combiner (filters falsy values)
│
├── mocks/                      # MSW test infrastructure
│   ├── handlers.ts             # API mock handlers
│   ├── fixtures.ts             # Sample data
│   └── server.ts               # MSW server setup
│
├── __mocks__/
│   └── socket.ts               # EventEmitter-based Socket.io mock for unit tests
│
└── test/
    ├── setup.ts                # Vitest global setup
    ├── renderWithProviders.tsx # Custom render with all providers
    └── integration.test.tsx    # End-to-end integration tests
```

---

## 2. Import Dependency Graph

Arrows show "imports from". Only production code; test files omitted.

```
main.tsx
  └─► App.tsx
        ├─► services/api.ts  (authApi)
        ├─► stores/useUserStore.ts
        ├─► hooks/SocketContext.tsx
        ├─► components/NotificationLayer/NotificationLayer.tsx
        ├─► components/ErrorBoundary/ErrorBoundary.tsx
        ├─► pages/EventList/EventList.tsx
        ├─► pages/AuthScreen/AuthScreen.tsx
        ├─► pages/EventDashboard/EventDashboard.tsx
        └─► pages/EventSummary/EventSummary.tsx

pages/EventList/EventList.tsx
  └─► services/api.ts  (eventsApi)
  └─► components/EventCard/EventCard.tsx

pages/AuthScreen/AuthScreen.tsx
  └─► stores/useUserStore.ts
  └─► components/JoinForm/JoinForm.tsx
  └─► components/LoginForm/LoginForm.tsx
  └─► components/SSOButton/SSOButton.tsx

pages/EventDashboard/EventDashboard.tsx
  ├─► services/api.ts  (eventsApi)
  ├─► stores/useUserStore.ts
  ├─► stores/useEventStore.ts
  ├─► hooks/SocketContext.tsx  (useSocket)
  ├─► components/Header/Header.tsx
  ├─► components/RandomConnect/RandomConnect.tsx
  ├─► components/PostConversation/PostConversation.tsx
  └─► components/LeaderboardReveal/LeaderboardReveal.tsx

pages/EventSummary/EventSummary.tsx
  ├─► services/api.ts  (eventsApi)
  ├─► stores/useUserStore.ts
  ├─► stores/useEventStore.ts
  └─► components/Leaderboard/Leaderboard.tsx

components/RandomConnect/RandomConnect.tsx
  ├─► hooks/SocketContext.tsx  (useSocket)
  ├─► stores/useUserStore.ts
  ├─► stores/useMatchStore.ts
  ├─► components/RandomConnect/StatusToggle.tsx
  ├─► components/RandomConnect/MatchCard.tsx
  └─► components/RandomConnect/PromptCard.tsx

components/RandomConnect/StatusToggle.tsx
  ├─► hooks/SocketContext.tsx  (useSocket)
  └─► stores/useUserStore.ts

components/RandomConnect/MatchCard.tsx
  ├─► hooks/SocketContext.tsx  (useSocket)
  └─► stores/useMatchStore.ts

components/RandomConnect/PromptCard.tsx
  ├─► hooks/SocketContext.tsx  (useSocket)
  └─► stores/useMatchStore.ts

components/PostConversation/PostConversation.tsx
  ├─► stores/useMatchStore.ts
  ├─► components/PostConversation/LearningSubmit.tsx
  ├─► components/PostConversation/LearningReview.tsx
  └─► components/PostConversation/MeaningfulFlag.tsx

components/PostConversation/LearningSubmit.tsx
  ├─► services/api.ts  (learningsApi)
  ├─► stores/useUserStore.ts
  └─► stores/useMatchStore.ts

components/PostConversation/LearningReview.tsx
  ├─► services/api.ts  (learningsApi)
  ├─► hooks/SocketContext.tsx  (useSocket)
  └─► stores/useNotificationStore.ts

components/PostConversation/MeaningfulFlag.tsx
  ├─► services/api.ts  (matchesApi)
  └─► stores/useMatchStore.ts

components/Leaderboard/Leaderboard.tsx
  ├─► services/api.ts  (eventsApi)
  └─► stores/useEventStore.ts

components/LeaderboardReveal/LeaderboardReveal.tsx
  ├─► hooks/SocketContext.tsx  (useSocket)
  ├─► stores/useEventStore.ts
  ├─► components/CountdownBanner/CountdownBanner.tsx
  └─► components/Leaderboard/Leaderboard.tsx

components/NotificationLayer/NotificationLayer.tsx
  ├─► hooks/SocketContext.tsx  (useSocket)
  ├─► stores/useNotificationStore.ts
  └─► stores/useUserStore.ts

components/Header/Header.tsx
  ├─► stores/useUserStore.ts
  └─► stores/useEventStore.ts

services/api.ts
  ├─► services/types.ts
  ├─► stores/useUserStore.ts   (clearUser on 401)
  ├─► stores/useEventStore.ts  (setEvent(null) on 401)
  └─► stores/useMatchStore.ts  (clearMatch on 401)

stores/types.ts
  └─► services/types.ts  (User, Event, ConversationPrompt, PartnerHints)

socket/types.ts
  └─► services/types.ts  (ConversationPrompt, PartnerHints)
```

---

## 3. Route → Component Tree

```
/ → EventList
      └── EventCard[]

/auth → AuthScreen
          ├── JoinForm
          ├── LoginForm
          └── SSOButton

/dashboard[/:eventId] → EventDashboard  (requires user in store)
                          ├── Header
                          ├── RandomConnect
                          │     ├── StatusToggle
                          │     ├── MatchCard      (shown when matchStatus = PENDING)
                          │     └── PromptCard     (shown when matchStatus = ACTIVE)
                          ├── PostConversation     (shown when matchStatus = COMPLETED)
                          │     ├── LearningSubmit
                          │     ├── LearningReview
                          │     └── MeaningfulFlag
                          └── LeaderboardReveal    (shown when eventStatus = CLOSING)
                                ├── CountdownBanner
                                └── Leaderboard

/summary → EventSummary  (requires user in store)
              └── Leaderboard
```

---

## 4. State Store Reference

| Store | Key State | Key Actions | Who Reads | Who Writes |
|-------|-----------|-------------|-----------|------------|
| `useUserStore` | `user`, `sessionId` | `setUser`, `clearUser` | App, Header, StatusToggle, LearningSubmit, NotificationLayer, AuthScreen pages | App (authApi.me), JoinForm, LoginForm, api.ts 401 handler |
| `useEventStore` | `event`, `eventStatus` | `setEvent`, `setEventStatus` | EventDashboard, Leaderboard, Header, EventSummary, LeaderboardReveal | EventDashboard (on fetch), LeaderboardReveal (on event:closing), api.ts 401 |
| `useMatchStore` | `matchId`, `partnerId`, `partnerHints`, `prompt`, `matchStatus` | `setMatch`, `setMatchStatus`, `setActivePrompt`, `clearMatch` | RandomConnect, PostConversation, MatchCard, PromptCard, LearningSubmit, MeaningfulFlag | RandomConnect (on socket events), api.ts 401 |
| `useNotificationStore` | `notifications[]` | `addNotification`, `removeNotification` | NotificationLayer | NotificationLayer (on socket events), LearningReview |

---

## 5. Socket Event Map

### Server → Client (listen with `socket.on(...)`)

| Event | Payload | Handler Location | What it does |
|-------|---------|-----------------|--------------|
| `match:found` | `{ matchId, partnerHints, prompt }` | RandomConnect | `setMatch()` → shows MatchCard |
| `match:partner_ready` | `{ matchId }` | RandomConnect | Updates UI to signal partner confirmed |
| `match:active` | `{ matchId, prompt }` | RandomConnect | `setActivePrompt()` → shows PromptCard |
| `match:ended` | `{ matchId }` | RandomConnect | `setMatchStatus('COMPLETED')` → shows PostConversation |
| `match:cancelled` | `{ matchId }` | RandomConnect + NotificationLayer | `clearMatch()` + warning toast |
| `user:offline` | `{ userId }` | NotificationLayer | Warning toast ("You went offline") |
| `learning:review_ready` | `{ learningId }` | NotificationLayer + LearningReview | Info toast with learningId; triggers review fetch |
| `event:closing` | `{ eventId, secondsRemaining }` | LeaderboardReveal | `setEventStatus('CLOSING')`; starts countdown |
| `event:completed` | `{ eventId }` | NotificationLayer | Redirects to `/summary` |

### Client → Server (emit with `socket.emit(...)`)

| Event | Payload | Emitted From | When |
|-------|---------|-------------|------|
| `user:set_idle` | `{ userId }` | StatusToggle | User clicks "Find a match" |
| `user:found_partner` | `{ matchId }` | MatchCard | User confirms found partner |
| `user:end_conversation` | `{ matchId }` | PromptCard | User clicks "End conversation" |

---

## 6. REST API Reference

Base URL: `/api` · Axios instance with `withCredentials: true`

| Namespace | Method | Endpoint | Used By |
|-----------|--------|----------|---------|
| `authApi.join` | POST | `/auth/join` | JoinForm |
| `authApi.login` | POST | `/auth/login` | LoginForm |
| `authApi.me` | GET | `/users/me` | App.tsx (auth check on mount) |
| `eventsApi.list` | GET | `/events` | EventList |
| `eventsApi.get` | GET | `/events/:id` | EventDashboard |
| `eventsApi.attendees` | GET | `/events/:id/attendees` | (available, currently unused in UI) |
| `eventsApi.leaderboard` | GET | `/events/:id/leaderboard` | Leaderboard |
| `eventsApi.userStats` | GET | `/events/:id/users/:userId/stats` | Leaderboard (stats dialog) |
| `eventsApi.receivedRatings` | GET | `/events/:id/users/:userId/ratings/received` | EventSummary |
| `matchesApi.get` | GET | `/matches/:id` | (available) |
| `matchesApi.markMeaningful` | PATCH | `/matches/:id/meaningful` | MeaningfulFlag |
| `learningsApi.submit` | POST | `/learnings` | LearningSubmit |
| `learningsApi.get` | GET | `/learnings/:id` | LearningReview |
| `learningsApi.review` | PATCH | `/learnings/:id/review` | LearningReview |
| `telemetryApi.track` | POST | `/telemetry` | useTelemetry hook |

**401 interceptor** (in `api.ts`): clears all three stores → `window.location.href = '/'`

---

## 7. Domain Type Reference

All types live in `src/services/types.ts`. Store-specific interfaces are in `src/stores/types.ts`.

### Core Entities

| Type | Key Fields | Notes |
|------|-----------|-------|
| `User` | id, name, email, role, company, bio, interests[], avatarUrl | Stored in `useUserStore` |
| `Event` | id, name, venue, startTime, endTime, status | Stored in `useEventStore` |
| `Match` | id, eventId, user1Id, user2Id, status, promptId | status: PENDING → ACTIVE → COMPLETED \| CANCELLED |
| `Learning` | id, matchId, learnerId, targetId, content, justification, rating, isCorrect | Submitted then reviewed |
| `ConversationPrompt` | id, text, followUp, category, depth, energy, tags | depth: SURFACE \| MID \| DEEP |
| `PartnerHints` | partnerId, role, company, interests[] | Sent with match:found (not full User) |
| `LeaderboardEntry` | id, name, role, company, bayesianScore, avgRating, totalConversations | Shown in Leaderboard grid |
| `ReceivedRating` | learningId, content, rating, reviewerName, matchDate | Shown in EventSummary |

### Enums (in `stores/types.ts`)

```ts
EventStatus  = 'UPCOMING' | 'ONGOING' | 'CLOSING' | 'COMPLETED'
MatchStatus  = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | null
NotificationType = 'success' | 'info' | 'warning' | 'error'
```

---

## 8. Authentication & Guard Flow

```
1. App mounts → authApi.me()
      ├─ success → setUser(user, sessionId)
      │             if on / or /auth → navigate('/dashboard')
      └─ failure → clearUser()

2. Route guards in AppRoutes:
      /dashboard  → user ? <EventDashboard /> : <Navigate to="/" />
      /summary    → user ? <EventSummary />   : <Navigate to="/" />

3. Any 401 from Axios interceptor:
      clearUser() + setEvent(null) + clearMatch() + window.location.href = '/'
```

---

## 9. Key Conventions

| Convention | Detail |
|------------|--------|
| CSS Modules | Every component has a `*.module.css` sibling; classes accessed via `styles.foo` |
| `cn()` util | `src/utils/cn.ts` — joins class strings, drops falsy values |
| Co-located types | Each component folder may have its own `types.ts` for props/local types |
| Test files | `*.test.tsx` files live alongside the component they test |
| Kendo components | Kendo React is the primary UI library — buttons, grids, dialogs, notifications, dropdowns, multiselect |
| Socket init | Single socket created in `SocketProvider`; shared via `useSocket()` context hook |
| Store access outside React | `useUserStore.getState()` pattern used in `api.ts` 401 handler |

---

## 10. Build & Dev Configuration

| Config | File | Key settings |
|--------|------|-------------|
| Dev server | `vite.config.ts` | Port 5173; proxies `/api` and `/socket.io` → `http://localhost:4000` |
| TypeScript | `tsconfig.app.json` | ES2022 target; strict mode; react-jsx |
| Tests | `vite.config.ts` (test section) | jsdom environment; 90% coverage threshold on lines & branches |
| Linting | `eslint.config.js` | Standard React + TypeScript rules |

### Scripts (`package.json`)

```
npm run dev       # Start Vite dev server
npm run build     # Production build
npm run preview   # Preview production build
npm run test      # Run Vitest
npm run coverage  # Run tests with coverage report
npm run lint      # ESLint check
```
