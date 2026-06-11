# Sync — System Design

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                        Client                           │
│              React + KendoReact (SPA)                   │
│   REST + JWT ──────────────────────── Socket.io client  │
│                          (token in handshake auth)      │
└───────────────────┬─────────────────────────┬───────────┘
                    │ HTTPS                    │ WSS
┌───────────────────▼─────────────────────────▼───────────┐
│                    API Server                            │
│              Node.js + Express                          │
│   ┌──────────────────────────────────────────────────┐  │
│   │  AuthMiddleware (JWT verify on every request)    │  │
│   └──────┬────────────────────────────────┬──────────┘  │
│   ┌──────▼──────────┐   ┌─────────────────▼──────────┐  │
│   │   REST Router   │   │    Socket.io Server        │  │
│   └──────┬──────────┘   └─────────────────┬──────────┘  │
│          │                                │             │
│   ┌──────▼────────────────────────────────▼──────────┐  │
│   │                  Service Layer                    │  │
│   │  UserService   MatchingEngine  PromptSelectionSvc │  │
│   │  LearningService  LeaderboardService              │  │
│   │  EventTimerService  TelemetryService             │  │
│   └──────────────────────┬────────────────────────────┘  │
│                           │                              │
│   ┌───────────────────────▼────────────────────────┐     │
│   │                  Prisma ORM                     │     │
│   └───────────────────────┬────────────────────────┘     │
└───────────────────────────┼──────────────────────────────┘
                            │
                ┌───────────▼───────────┐
                │      PostgreSQL        │
                └───────────────────────┘
```

---

## Data Models

### User
```
User {
  id          String   (uuid)
  name        String
  email       String   (unique)
  role        String   (e.g. "Backend Engineer", "PM", "Designer")
  company     String
  bio         String
  interests   String[] (tags: ["AI", "DevOps", "Startups", ...])
  avatarUrl   String?
  createdAt   DateTime
}
```

`User` holds identity only. Event participation and per-event status live in `UserEvent`.

### Event
```
Event {
  id          String
  name        String
  venue       String
  description String
  startTime   DateTime
  endTime     DateTime
  status      Enum     (UPCOMING | ONGOING | CLOSING | COMPLETED)
}
```

Event `status` is the master gate for matching, editability, and visibility:
- `UPCOMING`  — event exists, users can browse but matching not yet active
- `ONGOING`   — matching active, conversations happening, learnings editable, leaderboard hidden
- `CLOSING`   — final 2 minutes; no new matches created, leaderboard revealed with countdown
- `COMPLETED` — all editing locked, received ratings revealed, leaderboard finalised

### UserEvent
```
UserEvent {
  id        String
  userId    String   → User
  eventId   String   → Event
  status    Enum     (IDLE | ENGAGED | OFFLINE)
  joinedAt  DateTime

  ── unique(userId, eventId)
}
```

Replaces the single `User.eventId` foreign key. A user can join multiple events; each participation is a separate row. `status` is per-event:
- `IDLE`    — available for matching
- `ENGAGED` — in an active conversation
- `OFFLINE` — socket inactive for 2+ minutes while IDLE; removed from match pool. Client notified via `user:offline` socket event on reconnect if state changed while disconnected.

### Match
```
Match {
  id              String
  eventId         String   → Event  (direct scope — not derived through User)
  user1Id         String   → User
  user2Id         String   → User
  status          Enum     (PENDING | ACTIVE | COMPLETED | CANCELLED)
  promptId        String   → ConversationPrompt
  user1Meaningful Boolean? (persona signal)
  user2Meaningful Boolean? (persona signal)
  createdAt       DateTime (set when PENDING — match record created)
  startedAt       DateTime? (set when ACTIVE — both users confirmed)
  completedAt     DateTime?
}
```

### ConversationPrompt
```
ConversationPrompt {
  id          String
  text        String    (the main question — open-ended, invites a story)
  followUp    String    (a nudge served if the conversation stalls)
  category    Enum      (FAILURE | CONVICTION | SURPRISE | CRAFT | IMPACT | FUTURE | UNLEARNING | PEOPLE)
  depth       Enum      (SURFACE | MID | DEEP)
  energy      Enum      (REFLECTIVE | ENERGISING | PROVOCATIVE | COLLABORATIVE)
  audience    Enum      (ANY | TECHNICAL | NON_TECHNICAL | CROSS_FUNCTIONAL)
  tags        String[]  (topic tags matched against user interests)
}
```

### Learning
```
Learning {
  id            String
  matchId       String   → Match
  learnerId     String   → User  (person writing the reflection)
  targetId      String   → User  (person they learned about)
  content       String   (what I learned)
  justification String   (why it stood out)
  rating        Int?     (1–10, filled by targetId after reading)
  feedback      String?  (reviewer's written comment)
  isCorrect     Boolean?
  submittedAt   DateTime
  reviewedAt    DateTime?

  ── unique(matchId, learnerId)   ← prevents duplicate submissions per match
}
```

---

## Database Indexes

```sql
-- Matching engine: fetch IDLE users in an event (hits on every user:set_idle)
CREATE INDEX idx_userevents_event_status ON user_events (event_id, status);

-- Leaderboard join: ratings received by a user
CREATE INDEX idx_learnings_target_id ON learnings (target_id);

-- Leaderboard join: scope matches to event
CREATE INDEX idx_matches_event_id ON matches (event_id);

-- Re-match prevention: check prior matches between two users in an event
CREATE INDEX idx_matches_user_pair ON matches (event_id, user1_id, user2_id);

-- Learning lookup by match
CREATE INDEX idx_learnings_match_id ON learnings (match_id);
```

---

## Core Flow

### Event Lifecycle

```
Event created (status: UPCOMING)
        │
        ▼ (startTime reached — EventTimerService fires)
Event status → ONGOING
  ├── Matching active
  ├── Conversations allowed
  ├── Learnings and ratings editable
  └── Leaderboard hidden from all users
        │
        ▼ (endTime - 2 min — EventTimerService fires)
Event status → CLOSING
  ├── No new matches created
  ├── Active conversations may complete naturally
  ├── Leaderboard revealed to all users simultaneously
  ├── Socket event: event:closing  { eventId, secondsRemaining: 120 }
  └── Countdown shown on all connected clients
        │
        ▼ (endTime reached — EventTimerService fires)
Event status → COMPLETED
  ├── All Learning and Match writes locked (service layer returns 403)
  ├── Received ratings revealed in EventSummary
  ├── Socket event: event:completed  { eventId }
  └── All clients transition to EventSummary page
```

### User Journey — During Event (ONGOING)

```
User opens app → sees event list
        │
        ├── New user     → JoinScreen (name, email, role, interests) → JWT issued
        └── Returning user → LoginScreen (email only) → JWT issued
        │
        ▼
Event Dashboard shown
        │
        ▼
User sets status → IDLE
        │
        ▼
Matching Engine detects 2 IDLE users in same event
        │
        ▼
Match created (status: PENDING, createdAt set)
PromptSelectionService assigns a ConversationPrompt
Both users notified via Socket.io with partner hints
        │
        ▼
Both users tap "We Found Each Other"
        │
        ├── Match status → ACTIVE (startedAt set)
        ├── Both UserEvent.status → ENGAGED
        └── ConversationPrompt displayed to both
        │
        ▼
Conversation happens in person
        │
        ▼
Either user taps "End Conversation"
        │
        ├── Match status → COMPLETED
        └── Both UserEvent.status → IDLE (available for next match)
        │
        ▼
Post-conversation flow (editable while event is ONGOING):
  1. Submit Learning — what I learned about the other person + justification
  2. Review partner's Learning — rate 1–10 + written feedback + correct/incorrect
  3. Mark conversation Meaningful or Casual (persona signal)
```

### User Journey — After Event (COMPLETED)

```
Event status → COMPLETED
        │
        ▼
All Learning and Match records become read-only
        │
        ▼
EventSummary page unlocked:
  ├── Received Ratings revealed — each user sees ratings others gave them
  │     (hidden during event so they do not influence in-flight behaviour)
  └── Leaderboard shown with final scores
```

---

## Matching Engine

**Trigger:** Event-driven — fires when a `UserEvent.status` transitions to IDLE.

**Algorithm:**
1. Check `event.status` — if CLOSING or COMPLETED, reject immediately.
2. Fetch all IDLE `UserEvents` for this event, excluding the current user.
3. Exclude candidates where a non-CANCELLED Match between this pair already exists for this event (re-match prevention).
4. If no candidates remain, user waits; re-evaluated when next user goes idle.
5. Pick a random candidate from the remaining pool. (Selection is intentionally random — this feature is called "Random Connect". The intelligence lives in `PromptSelectionService`, which uses interest-tag overlap to assign the conversation starter after the pair is formed.)
6. Wrap steps 5–8 in a DB transaction to prevent double-matching.
7. Call PromptSelectionService to assign a ConversationPrompt.
8. Create a Match record (status: PENDING, createdAt: now).
9. Emit `match:found` to both users via Socket.io with partner hints.

**Reconnection flow:**
When a socket reconnects, the connect handler checks the user's current state and re-emits:
- Active PENDING match → re-emit `match:found`
- Active ACTIVE match → re-emit `match:active`
- Event is CLOSING → re-emit `event:closing` with recalculated `secondsRemaining`
- Event is COMPLETED → re-emit `event:completed`
- UserEvent.status changed to OFFLINE while disconnected → emit `user:offline`

**Edge cases:**
- User disconnects while IDLE → removed from pool. If idle for 2+ minutes without reconnecting, `UserEvent.status` set to OFFLINE.
- User disconnects while ENGAGED → match marked CANCELLED, partner notified via `match:cancelled` and returned to IDLE.
- Event transitions to CLOSING mid-algorithm → transaction will still complete; no new matches after.

---

## EventTimerService

Responsible for transitioning event status and emitting lifecycle socket events at the right moments.

**Startup behaviour:**
On server start, query all non-COMPLETED events and schedule timers for each:
```
for each event:
  if status = UPCOMING and startTime > now:
    schedule timer at startTime         → transition to ONGOING
  if status in (UPCOMING, ONGOING) and endTime - 2min > now:
    schedule timer at endTime - 2min    → transition to CLOSING + emit event:closing
  if status in (UPCOMING, ONGOING, CLOSING) and endTime > now:
    schedule timer at endTime           → transition to COMPLETED + emit event:completed
```

Resilient to server restarts — recalculates delay from `now` on boot so missed transitions are skipped and pending ones are rescheduled.

**On CLOSING transition:**
1. Set `event.status = CLOSING` in DB
2. Emit `event:closing { eventId, secondsRemaining: 120 }` to all users in the event room
3. Matching engine rejects all new match requests for this event

**On COMPLETED transition:**
1. Set `event.status = COMPLETED` in DB
2. Emit `event:completed { eventId }` to all users in the event room
3. All write endpoints for this event's Learnings and Matches return 403

---

## Leaderboard Calculation

Ranking uses a **Bayesian average** rather than a raw mean. A user with one 10/10 review should not rank above someone with 50 reviews averaging 9.8. The Bayesian formula injects a small number of prior votes at the event mean to pull low-volume outliers toward the centre.

```
bayesian_score = (C × m + Σ ratings) / (C + n)
```
- `n` = number of reviews for this user in this event
- `m` = global mean rating across all users in this event
- `C` = confidence threshold (default: 3, configurable)

```sql
WITH event_stats AS (
  SELECT
    AVG(l.rating)  AS global_mean,
    3              AS confidence_threshold
  FROM learnings l
  JOIN user_events ue ON ue.user_id = l.target_id AND ue.event_id = :eventId
  WHERE l.rating IS NOT NULL
)
SELECT
  u.id,
  u.name,
  u.role,
  u.company,
  u.avatar_url,
  ROUND(
    (es.confidence_threshold * es.global_mean + SUM(l.rating))
    / (es.confidence_threshold + COUNT(l.id)),
    2
  )                           AS bayesian_score,
  ROUND(AVG(l.rating), 1)    AS avg_rating,
  COUNT(l.id)                 AS total_reviews,
  COUNT(DISTINCT l.match_id)  AS total_conversations
FROM users u
JOIN user_events ue  ON ue.user_id = u.id AND ue.event_id = :eventId
JOIN learnings l     ON l.target_id = u.id
JOIN matches m       ON m.id = l.match_id AND m.event_id = :eventId
CROSS JOIN event_stats es
WHERE l.rating IS NOT NULL
GROUP BY u.id, u.name, u.role, u.company, u.avatar_url,
         es.global_mean, es.confidence_threshold
ORDER BY bayesian_score DESC, total_conversations DESC;
```

**Meaningful/casual analytics (separate query — per event, not used for ranking):**
```sql
SELECT
  u.id,
  COUNT(*) FILTER (WHERE m.user1_meaningful = TRUE OR m.user2_meaningful = TRUE)
    AS meaningful_count,
  COUNT(*) FILTER (WHERE m.user1_meaningful = FALSE AND m.user2_meaningful = FALSE)
    AS casual_count
FROM users u
JOIN user_events ue ON ue.user_id = u.id AND ue.event_id = :eventId
JOIN matches m ON (m.user1_id = u.id OR m.user2_id = u.id)
               AND m.event_id = :eventId
WHERE m.status = 'COMPLETED'
GROUP BY u.id;
```

---

## Real-Time Events (Socket.io)

All Socket.io connections require a valid JWT passed in the handshake `auth` object:
```js
socket = io(SERVER_URL, { auth: { token: jwt } })
```
The server verifies the token before allowing the connection.

### Server → Client

| Event | Payload | Trigger |
|---|---|---|
| `match:found` | `{ matchId, partnerHints, prompt }` | Matching engine pairs two idle users |
| `match:partner_ready` | `{ matchId }` | Partner tapped "We Found Each Other" |
| `match:active` | `{ matchId, prompt }` | Both confirmed → conversation starts |
| `match:ended` | `{ matchId }` | Either user ends the conversation |
| `match:cancelled` | `{ matchId }` | Partner disconnected mid-match |
| `user:offline` | `{ userId }` | User's status set to OFFLINE due to inactivity |
| `learning:review_ready` | `{ learningId }` | Partner submitted their learning |
| `event:closing` | `{ eventId, secondsRemaining: 120 }` | EventTimerService at T-2min |
| `event:completed` | `{ eventId }` | EventTimerService at endTime |

> `status:changed` removed — broadcasting every status flip to all event attendees is O(n²) traffic. The matching engine operates server-side and needs no broadcast. Status updates are reflected via match lifecycle events only.

### Client → Server

| Event | Payload | Action |
|---|---|---|
| `user:set_idle` | `{ userId }` | Triggers matching engine |
| `user:found_partner` | `{ matchId }` | Records confirmation, checks if both confirmed |
| `user:end_conversation` | `{ matchId }` | Ends match, resets both to IDLE |

---

## REST API Endpoints

All endpoints except `/api/auth/*` require `Authorization: Bearer <jwt>` header.

### Auth
```
POST  /api/auth/join    Create profile + join event → returns JWT
                        Body: { name, email, role, company, bio, interests[], eventId }

POST  /api/auth/login   Returning user email-only login → returns JWT
                        Body: { email }
                        Returns 404 if email not found
                        ⚠ No verification — acceptable for controlled demo only.
                        Production path: replace with magic link or OTP.

GET   /api/auth/google          Initiate Google OAuth flow (redirect to Google)
GET   /api/auth/google/callback Google OAuth callback → issues JWT → redirects to app
                                On first login: creates User record from Google profile
                                On return login: fetches existing User by email

GET   /api/users/me     Current user from JWT — used on app load / reconnect
```

### Events
```
GET   /api/events                 List all events (UPCOMING + ONGOING)
GET   /api/events/:id             Event detail + current status
GET   /api/events/:id/attendees   Paginated attendee list  ?page=&limit=
```

### Matches & Conversations
```
GET   /api/matches/:id            Match detail with prompt
POST  /api/matches/:id/confirm    Confirm "We found each other"
POST  /api/matches/:id/end        End conversation
PATCH /api/matches/:id/meaningful Mark meaningful or casual (persona signal)
```

### Learnings
```
POST  /api/learnings              Submit learning — 403 if event.status = COMPLETED
GET   /api/learnings/:id          Get a single learning entry
PATCH /api/learnings/:id/review   Submit rating (1–10) + feedback + isCorrect
                                  403 if event.status = COMPLETED
```

### Ratings (scoped to event — received gated until COMPLETED)
```
GET  /api/events/:eventId/users/:userId/ratings/received
     403 if event.status = ONGOING or CLOSING

GET  /api/events/:eventId/users/:userId/ratings/given
     Available any time (backend only — not consumed by frontend)
```

Each `/received` entry returns: Learning content + justification written about you, rating score, feedback, isCorrect, reviewer name/role/company, match date.

### Leaderboard (scoped to event)
```
GET  /api/events/:eventId/leaderboard             Paginated  ?page=&limit=
GET  /api/events/:eventId/users/:userId/stats     Personal stats within this event
```

---

## Frontend Component Map (KendoReact)

```
App
├── EventList                         ← entry point
│   └── EventCard (KendoReact Card)   — name, venue, date, status badge
│
├── AuthScreen                        ← triggered on selecting an event
│   ├── SSOButton                     — "Sign in with Google" → GET /api/auth/google
│   ├── JoinForm     (new user)        — KendoReact Form: name, email, role
│   │                                    (DropDownList), company, bio,
│   │                                    interests (MultiSelect)
│   └── LoginForm    (returning user)  — email only → POST /api/auth/login
│
├── NotificationLayer                 ← global overlay, always mounted
│   └── ToastNotification             — surfaces match:found, match:cancelled,
│       (KendoReact Notification)       learning:review_ready as toast alerts
│
├── EventDashboard  [event.status = ONGOING | CLOSING]
│   ├── Header              — user avatar, event name, status badge
│   ├── RandomConnect       [hidden during CLOSING]
│   │   ├── StatusToggle    — IDLE / ENGAGED (KendoReact Button)
│   │   ├── MatchCard       — partner hints, "We Found Each Other" CTA
│   │   ├── PromptCard      — conversation starter + follow-up nudge
│   │   └── EndConversation button
│   ├── PostConversation    (shown after match ends, editable while ONGOING)
│   │   ├── LearningSubmit  — content + justification (KendoReact TextArea)
│   │   ├── LearningReview  — partner's learning, rate (KendoReact Rating),
│   │   │                     feedback (TextArea), correct toggle
│   │   └── MeaningfulFlag  — Meaningful / Casual (persona signal)
│   └── LeaderboardReveal   [shown on event:closing]
│       ├── CountdownBanner — "Event ending in 2:00" (live countdown)
│       └── Leaderboard     — animates in alongside countdown
│
├── EventSummary  [event.status = COMPLETED]
│   ├── Header              — event name, "Event has ended"
│   ├── ReceivedRatings     — GET /api/events/:id/users/:id/ratings/received
│   │   └── RatingCard (KendoReact Card) — reviewer, their learning about you,
│   │                                      score, feedback, date
│   └── Leaderboard         — final rankings
│
└── Leaderboard  [used in both Dashboard and EventSummary]
    ├── KendoReact Grid   — rank, avatar, name, role, bayesian score, avg rating,
    │                       total conversations
    └── KendoReact Dialog — user stats on row click
```

---

## Conversation Prompt System

The prompt is the most important moment in the user journey. Every downstream feature — learning submission, peer rating, the leaderboard — depends on the conversation being worth having. A generic or closed question produces small talk. A well-chosen open question produces a story, a revelation, or a shift in perspective.

### Design Principles

- **Invite a story, not a status update.** "What are you working on?" is a status update. "What's a decision you made recently that you'd make differently?" is a story.
- **Create safe asymmetry.** The best questions let one person be vulnerable first, which signals safety for the other to reciprocate.
- **Avoid yes/no closure.** Every prompt must structurally require a multi-sentence answer.
- **Respect the context.** A question that works between two engineers may not land between an engineer and a product manager. Audience typing prevents this.
- **Have a fallback.** Every prompt ships with a follow-up nudge — a gentler re-entry if the first question lands awkwardly or the conversation runs dry.

---

### Category Taxonomy

| Category | Intent | Example |
|---|---|---|
| `FAILURE` | Surface lessons from mistakes — builds trust fast | "What's a failure you're glad happened?" |
| `CONVICTION` | Expose genuine beliefs — finds alignment or productive disagreement | "What do you believe about tech that most people here would push back on?" |
| `SURPRISE` | Reveal where reality diverged from expectation | "What assumption about your field turned out to be completely wrong?" |
| `CRAFT` | Focus on deliberate growth | "What are you actively getting better at right now, and why does it matter to you?" |
| `IMPACT` | Anchor on outcomes over activity | "What's the smallest change you've made that had the largest effect?" |
| `FUTURE` | Opens speculation — low stakes, energising | "What problem do you think is essentially solved that most people treat as unsolvable?" |
| `UNLEARNING` | Exposes intellectual honesty | "What did you recently have to unlearn, and what replaced it?" |
| `PEOPLE` | Surfaces influence and values indirectly | "Who changed how you think about your work, and what did they do?" |

---

### Prompt Depth Levels

| Depth | When to use | Typical feel |
|---|---|---|
| `SURFACE` | First conversation or fewer than 1 completed review | Low risk, easy to answer, good for warming up |
| `MID` | User has at least 1 completed and rated conversation | Requires reflection, slightly personal |
| `DEEP` | User has 3+ completed and rated conversations | Requires trust, high vulnerability, high reward |

---

### Prompt Selection Algorithm

Runs at match creation time. Inputs: User A, User B.

```
1. FILTER by audience compatibility
   — both technical roles  → exclude NON_TECHNICAL prompts
   — cross-functional pair → prefer CROSS_FUNCTIONAL or ANY

2. FILTER by depth eligibility
   — based on the lower of the two users' completed conversation counts
   — 0 completed   → SURFACE only
   — 1–2 completed → SURFACE or MID
   — 3+ completed  → any depth

3. SCORE by interest-tag overlap
   — for each eligible prompt, count tags in A.interests ∪ B.interests
   — higher overlap → higher score

4. EXCLUDE already-used prompts
   — filter out promptIds either user has received in a prior match

5. SELECT
   — sort by score descending
   — pick randomly from top 3 (prevents the same prompt dominating)
   — fall back to a random ANY/SURFACE prompt if pool is exhausted
```

---

### Follow-up Nudge

Every prompt has a `followUp` field — a lighter, more concrete version served as an in-app nudge if the conversation goes quiet.

| Main prompt | Follow-up nudge |
|---|---|
| "What's a failure you're glad happened?" | "Can you walk me through one specific moment where it went wrong?" |
| "What do you believe that most people here would push back on?" | "Has anyone ever changed your mind on this?" |
| "What are you actively getting better at right now?" | "What does good look like to you in that area?" |

---

### Prompt Quality Guidelines

A prompt is well-formed if it passes all of these:

- [ ] Cannot be answered in one sentence
- [ ] Does not begin with "Do you" or "Have you" (closed structure)
- [ ] Does not reference a specific technology or company
- [ ] Has an honest answer that could surprise the listener
- [ ] The follow-up makes the main prompt more specific, not more abstract

**Seed target:** 8 prompts × 8 categories = **64 prompts minimum**, distributed 40% SURFACE / 40% MID / 20% DEEP.

---

## Key Design Decisions

**Why email-only login with no verification?**
`POST /api/auth/login` accepts an email and returns a JWT with no OTP, magic link, or password check. This is a deliberate scope decision for the hackathon demo context: the event is in-person and controlled, attendees self-register with their own email at join time, and adding an email verification round-trip (SMTP, OTP expiry, retry flow) would require infrastructure and build time that is out of scope. The security gap is real — anyone who knows an attendee's email can impersonate them. The mitigation for production would be a magic link (email → tokenised URL → JWT issued) or a numeric OTP. This must be replaced before any public deployment.

**Why JWT in an httpOnly session cookie rather than localStorage?**
Storing a JWT in `localStorage` exposes it to any JavaScript running on the page — a single XSS vulnerability drains every active session. An `httpOnly` cookie is invisible to JavaScript entirely; the browser attaches it automatically to every request including the Socket.io handshake, so no manual token wiring is needed. `SameSite=Strict` blocks cross-site request forgery. A session cookie (no `Max-Age`) expires when the browser closes, which matches the event-day use case — users don't need multi-day persistence.

**Why Zustand over React Context for global state?**
React Context re-renders every subscriber on every state change. For fast-moving state like match status and socket events, this produces unnecessary renders throughout the tree. Zustand uses a subscription model — components only re-render when the slice of state they select actually changes. It also has no Provider wrapping requirement, making stores easier to access from hooks and service functions outside the component tree. `useState` remains the right choice for local UI state; Zustand is only used for state that genuinely needs to be shared across pages.

**Why a `UserEvent` join table instead of `User.eventId`?**
A single foreign key overwrites on each new event join, destroying a user's history from prior events. A join table gives each participation its own row — ratings, matches, and status are all queryable per user per event without data loss.

**Why `Match.eventId` directly instead of deriving scope through the user?**
The leaderboard and rating queries need to scope matches to an event. Deriving scope via `user.event_id` is a fragile two-hop join that breaks if a user's current event ever changes. A direct `Match.eventId` makes the scope explicit and index-friendly.

**Why Bayesian scoring on the leaderboard rather than raw average?**
A raw average lets a single 10/10 review outrank 50 reviews averaging 9.8. The Bayesian formula injects `C` prior votes at the event mean, dampening outliers naturally without an arbitrary review-count floor. With C=3 and a global mean of 7.5: one 10/10 review scores 8.13 vs 50 reviews at 9.8 scoring 9.67. Volume of credible signal is rewarded without excluding new participants entirely.

**Why remove the `status:changed` broadcast?**
Broadcasting every IDLE/ENGAGED flip to all event attendees is O(n²) WebSocket traffic — one status change at a 120-person event sends 120 frames, nearly all irrelevant to their recipients. The matching engine is server-side and needs no broadcast to function. Match lifecycle events (`match:found`, `match:ended`) carry all the state clients actually need.

**Why reveal the leaderboard 2 minutes before the event ends?**
The 2-minute window creates a shared closing moment — everyone sees the rankings simultaneously while still in the room together. Revealing at T-0 means the room is already emptying when rankings appear.

**Why are received ratings hidden during the event?**
Showing incoming ratings while the event runs would cause score anxiety and prompt optimisation over genuine conversation. The EventSummary reveal becomes a moment of reflection rather than a real-time chase.

**Why does `event.status` gate editability rather than per-record flags?**
A single status field on Event is the authoritative source. Any Learning or Match inherits the same lock state without individual `isLocked` flags on every row. The service layer checks `event.status !== COMPLETED` before every write.

**Why event-driven matching (not polling)?**
Triggering the engine on `user:set_idle` gives sub-second match latency and zero idle CPU load. A poll interval adds unnecessary lag and server overhead.

**Why is meaningful/casual a persona signal and not a leaderboard gate?**
The 1–10 rating is an objective measure of understanding. Whether a conversation felt "meaningful" is a subjective preference that varies by personality — two people can have a deeply insightful exchange and still describe it differently. The flag is preserved as analytics: it reveals a user's networking style without distorting their rank.

**Why separate Learning from Match?**
Each participant submits their own Learning independently. Separate rows allow async submission — one person can submit while the other hasn't yet — and make the review flow symmetric.

**Why offer SSO alongside email-only login?**
Google OAuth solves the verification gap in email-only login — Google has already verified the email address. For a tech event audience, Google sign-in is near-universal and faster than any form fill. The email-only path is retained as a day-of fallback for attendees who can't or won't use Google (corporate accounts, privacy preference). Both paths issue the same JWT format so downstream code is identical.

---

## SSO — Google OAuth Flow

```
User taps "Sign in with Google"
        │
        ▼
GET /api/auth/google
  └── Server redirects to Google OAuth consent screen
        │
        ▼
User approves → Google redirects to:
GET /api/auth/google/callback?code=...
  ├── Exchange code for Google profile (name, email, avatarUrl)
  ├── Look up User by email
  │     ├── Found     → update avatarUrl if changed, issue JWT
  │     └── Not found → create User record from Google profile, issue JWT
  └── Set httpOnly session cookie → redirect to /dashboard
        │
        ▼
Browser holds cookie automatically → GET /api/users/me (cookie sent by browser)
  └── If no event joined yet → route to EventList to pick an event
```

**JWT payload (stored in httpOnly session cookie, not localStorage):**
```json
{
  "userId": "uuid",
  "sessionId": "uuid",   ← fresh UUID generated on every login
  "iat": 1234567890,
  "exp": 1234567890
}
```

**Cookie attributes:**
```
Set-Cookie: token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/
```
- `HttpOnly` — not accessible via `document.cookie` or JS; eliminates XSS token theft
- `Secure` — transmitted over HTTPS only
- `SameSite=Strict` — not sent on cross-site requests; CSRF protection
- No `Max-Age` / no `Expires` — session cookie; expires when the browser closes

Socket.io reads the cookie automatically from the handshake request headers — no manual token passing required.

The `sessionId` is a new UUID generated at login time. It correlates all HTTP requests and socket events within that login session for telemetry purposes.

---

## Telemetry & Observability

### Session UUID

Every login (SSO or email) generates a `sessionId` UUID embedded in the JWT stored in the httpOnly session cookie. It propagates through:
- All HTTP requests — server reads `sessionId` from the verified JWT on every request
- All Socket.io connections — cookie is sent in the handshake; server extracts `sessionId` from JWT
- All server log entries
- All frontend telemetry events sent to `POST /api/telemetry`

This allows a complete trace of a user's session — HTTP calls, socket events, errors — to be reconstructed from logs using a single ID without exposing any PII. The `sessionId` is never written to `localStorage` or any JS-accessible storage.

---

### Service Start / End Events

Every service operation emits a `service_start` log entry when it begins and a `service_end` entry when it completes (success or error). The two entries are linked by a shared `operationId` UUID, enabling exact duration measurement even when other events interleave in the log stream.

**`service_start`**
```json
{
  "timestamp": "2026-06-12T10:23:45.081Z",
  "level": "info",
  "type": "service_start",
  "operationId": "uuid",
  "sessionId": "uuid",
  "userId": "uuid",
  "service": "MatchingEngine",
  "method": "createMatch",
  "payload": {
    "eventId": "uuid",
    "userId": "uuid"
  }
}
```

`payload` contains only the sanitized input to the service call — PII fields are stripped before the entry is written (see PII Scrubbing Policy).

**`service_end`**
```json
{
  "timestamp": "2026-06-12T10:23:45.123Z",
  "level": "info | error",
  "type": "service_end",
  "operationId": "uuid",
  "sessionId": "uuid",
  "service": "MatchingEngine",
  "method": "createMatch",
  "status": "success | error",
  "durationMs": 42,
  "error": { "code": "NO_IDLE_USERS", "message": "..." }
}
```

`error` is present only when `status = "error"`. Stack traces are included at `error` level only — never at `info` or `warn`.

**Tooling:** Pino (structured JSON logger, low overhead). The `operationId` is generated by a `withTelemetry(service, method, fn)` wrapper that services use:

```ts
async createMatch(eventId, userId) {
  return withTelemetry('MatchingEngine', 'createMatch', { eventId, userId }, async () => {
    // business logic
  })
}
```

`withTelemetry` handles `service_start`, `service_end`, duration measurement, and error capture automatically.

**Log levels:**
- `info`  — normal service start/end, event lifecycle transitions
- `warn`  — recoverable issues (empty prompt pool, re-match candidate excluded)
- `error` — exceptions, unhandled rejections, 5xx responses

---

### Frontend Telemetry

The frontend sends telemetry events to `POST /api/telemetry`. The same `service_start` / `service_end` pattern applies to frontend service calls:

**`service_start`** — emitted when an API call or socket action begins:
```json
{
  "sessionId": "uuid",
  "type": "service_start",
  "operationId": "uuid",
  "service": "MatchService",
  "method": "confirmMatch",
  "timestamp": "ISO",
  "payload": { "matchId": "uuid" }
}
```

**`service_end`** — emitted on completion:
```json
{
  "sessionId": "uuid",
  "type": "service_end",
  "operationId": "uuid",
  "service": "MatchService",
  "method": "confirmMatch",
  "status": "success | error",
  "durationMs": 87,
  "timestamp": "ISO",
  "error": { "code": "403", "message": "Event is closed" }
}
```

Additional frontend event types:
```json
{ "type": "error",       "errorMessage": "...", "component": "MatchCard" }
{ "type": "performance", "metric": "page_load", "durationMs": 1240 }
```

No component props, form field values, or user-visible text is ever included in any telemetry payload.

---

### PII Scrubbing Policy

**Never log or transmit in telemetry:**
| Field | Reason |
|---|---|
| `name` | Directly identifies a person |
| `email` | Directly identifies a person |
| `company` | Can identify a person in context |
| `bio` | Free text — may contain any personal detail |
| `interests[]` | Free text tags — may contain personal detail |
| `content` (Learning) | Free text — contains personal reflections |
| `justification` (Learning) | Free text — contains personal reflections |
| `feedback` (Learning) | Free text — contains personal opinions |

**Safe to log:**
- UUIDs: `userId`, `sessionId`, `matchId`, `eventId`, `learningId`
- Status enums: `IDLE`, `ENGAGED`, `PENDING`, `ACTIVE`, etc.
- Numeric values: `rating`, `durationMs`, `count`
- Timestamps
- Error codes and stack traces (after confirming no PII in message)

**Enforcement:**
- A `sanitizeForLog(obj)` utility function strips all PII keys before any object is passed to the logger. Services call this on all model objects before logging.
- The telemetry endpoint on the backend validates the incoming payload schema — any field not in the allowed list is dropped silently.

---

### Key Metrics to Monitor

| Metric | Source | Alert threshold |
|---|---|---|
| Match latency (idle → match:found) | Socket event timing | > 5s |
| Confirmation rate (match:found → match:active) | Match status funnel | < 50% |
| Learning submission rate (match:completed → learning submitted) | Learning funnel | < 60% |
| Rating submission rate (learning submitted → reviewed) | Learning funnel | < 60% |
| API error rate (5xx) | Backend logs | > 1% |
| Socket disconnect rate | Socket.io events | > 10% per event |

---

## TypeScript Configuration

Both frontend and backend are written in TypeScript with `strict: true`. This is non-negotiable — it catches null dereferences, implicit any types, and incorrect function signatures at compile time rather than at runtime in production.

### Backend `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": false,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Frontend `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "outDir": "./dist",
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": false,
    "forceConsistentCasingInFileNames": true,
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}
```

### Enforced flags explained

| Flag | Why it matters |
|---|---|
| `strict: true` | Enables the full strict family — `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization` |
| `noUncheckedIndexedAccess` | Array and object index access returns `T \| undefined` — forces null checks on any indexed read |
| `exactOptionalPropertyTypes` | Distinguishes `{ key?: string }` from `{ key: string \| undefined }` — prevents assigning `undefined` to optional fields |
| `noImplicitReturns` | All code paths in a function must return a value — catches silent `undefined` returns |
| `skipLibCheck: false` | Type errors in `node_modules` declarations are surfaced — prevents mismatched library versions hiding bugs |

### Rules (both layers)
- `@ts-ignore` and `@ts-expect-error` are banned except in test files with an explanatory comment.
- `as unknown as T` double-cast is banned — use a type guard instead.
- All Zod schemas (backend validators) must be inferred into TypeScript types: `type Body = z.infer<typeof schema>`. No duplicate manual type definitions.
- Prisma-generated types are used as the ground truth for DB entity shapes. Service return types extend or pick from Prisma types — they do not duplicate fields.

---

## Testing Standards

### Coverage Requirements

| Layer | Minimum coverage | Measurement |
|---|---|---|
| Frontend (React) | **> 90%** | Lines + branches (Jest `--coverage`) |
| Backend services | **> 80%** | Lines + branches |
| Backend routes | **> 80%** | Lines + branches |

Coverage is enforced in CI — builds fail if thresholds are not met.

> Routes must measure **branches**, not lines only. Routes contain conditional error paths (401, 403, 404, 400) that line coverage cannot verify — entire error branches can go untested while still hitting 80% line coverage.

---

### Frontend Testing Rules

**Tooling:** Jest + React Testing Library (RTL) + MSW (Mock Service Worker)

**Rules:**
1. **Test behaviour, not implementation.** Query by role, label, or text — never by CSS class or component internal state.
2. **Every component has a test file.** Co-located: `ComponentName.test.tsx` next to `ComponentName.tsx`.
3. **No snapshot tests.** They assert DOM structure, not user behaviour, and produce false confidence.
4. **Mock the network with MSW.** Never mock `fetch` or `axios` directly. Define request handlers in `src/mocks/handlers.ts` and use them across all tests.
5. **Mock Socket.io with a manual mock.** Create `src/__mocks__/socket.ts` — a controllable EventEmitter substitute. Tests fire socket events by calling `mockSocket.emit(...)` directly.
6. **Test all states a component can be in.** For a `MatchCard`: no match, match pending, both confirmed, cancelled. All branches covered.
7. **Test accessibility.** Run `jest-axe` on every rendered component. `expect(await axe(container)).toHaveNoViolations()`.
8. **Integration tests for user flows.** In addition to unit tests, one integration test file per major flow (join → dashboard, idle → match → conversation, post-conversation → leaderboard).
9. **No `act()` warnings allowed.** Async state updates must be awaited with `waitFor` or `findBy*`.
10. **Test `NotificationLayer` socket-driven flows.** Integration tests must explicitly verify that incoming socket events (`match:found`, `match:cancelled`, `learning:review_ready`) cause the correct toast to appear via `NotificationLayer`. This is the single channel for all async feedback — it must be covered.
    ```tsx
    it('shows toast when match is found', async () => {
      render(<App />)
      act(() => mockSocket.emit('match:found', { matchId: 'uuid', partnerHints: {...} }))
      expect(await screen.findByRole('alert', { name: /you've been matched/i })).toBeInTheDocument()
    })
    ```

**Forbidden patterns:**
```tsx
// ✗ implementation detail
expect(component.state.isLoading).toBe(true)

// ✗ DOM coupling
expect(container.querySelector('.match-card')).toBeInTheDocument()

// ✓ behaviour
expect(screen.getByRole('button', { name: /we found each other/i })).toBeEnabled()
```

---

### Backend Testing Rules

**Tooling:** Jest + Supertest + isolated test database (separate `DATABASE_URL_TEST` env var)

**Rules:**
1. **Use a real test database. Clean with TRUNCATE, not transaction rollback.** No mocking of Prisma or database calls. Seed in `beforeEach`. Clean in `afterEach` with a raw truncate — `prisma.$transaction` commits on success and cannot be used for rollback:
   ```ts
   afterEach(async () => {
     await prisma.$executeRaw`TRUNCATE learnings, matches, user_events, users, events CASCADE`;
   });
   ```
2. **All test data created via factory functions.** Define factories in `tests/factories/index.ts`. Factories use Prisma directly and accept partial overrides. This keeps tests concise and resilient to schema changes:
   ```ts
   export const createTestUser = (overrides = {}) =>
     prisma.user.create({ data: { id: uuid(), name: 'Test', email: `${uuid()}@test.com`, role: 'Engineer', company: 'ACME', bio: '', interests: [], ...overrides } });

   export const createTestMatch = (user1Id: string, user2Id: string, eventId: string, overrides = {}) =>
     prisma.match.create({ data: { eventId, user1Id, user2Id, status: 'PENDING', ...overrides } });
   ```
3. **Test every status code.** For each endpoint: 200/201 (happy path), 400 (bad input), 401 (missing token), 403 (wrong user or locked event), 404 (not found).
4. **Test auth middleware explicitly.** Every protected route must have a test that sends no token and asserts 401, and one that sends a token for a different user and asserts 403.
5. **Test service functions independently.** Route tests verify HTTP contract; service unit tests verify business logic. Both are required.
6. **Test socket event handlers with a real socket.io-client connection.** Supertest covers HTTP only. Socket handlers (`user:set_idle`, `user:found_partner`, `user:end_conversation`) must be tested by connecting a real socket client to the test server:
   ```ts
   import { io as clientIo } from 'socket.io-client';

   let server: Server, socket: Socket;
   beforeAll(async () => { server = await startTestServer(); });
   afterAll(async () => { await server.close(); });

   it('triggers matching engine on user:set_idle', async () => {
     socket = clientIo(`http://localhost:${port}`, { auth: { token: testJwt } });
     socket.emit('user:set_idle', { userId });
     const payload = await new Promise(r => socket.once('match:found', r));
     expect(payload).toHaveProperty('matchId');
   });
   ```
7. **Never use real timers. Always restore them.**
   ```ts
   beforeEach(() => jest.useFakeTimers());
   afterEach(() => jest.useRealTimers());   // ← must restore or timers leak across files
   ```
   Required for any test touching `EventTimerService` or inactivity timeout logic.
8. **Mock external OAuth.** `passport-google-oauth20` strategy must be mocked in tests — no real Google calls.
9. **One assertion per test where possible.** Multiple assertions are allowed when they describe a single behaviour (e.g. checking both response body and DB state after a write).

---

## Development Standards

### Backend Standards

**Project structure:**
```
server/src/
├── routes/        ← HTTP contract only: parse request, call service, return response
├── services/      ← all business logic lives here
├── socket/        ← Socket.io event handlers (call services, never DB directly)
├── middleware/    ← auth, telemetry, error handler
├── validators/    ← Zod schemas for all request bodies
├── utils/         ← sanitizeForLog, generateSessionId, etc.
└── prisma/        ← schema, migrations, seed
```

**Rules:**
1. **No business logic in route handlers.** Routes call one service function and return. Branching, DB queries, and side effects live in services.
2. **Socket handlers follow the same discipline as route handlers.** Socket handlers in `socket/` call one service function and emit the result. No DB calls, no conditional logic, no business rules directly in a handler.
   ```ts
   // ✓ correct
   socket.on('user:set_idle', async ({ userId }) => {
     const result = await matchingEngine.handleIdle(userId, socket.data.eventId);
     if (result) socket.emit('match:found', result);
   });

   // ✗ wrong — business logic in handler
   socket.on('user:set_idle', async ({ userId }) => {
     const users = await prisma.userEvent.findMany({ where: { status: 'IDLE' } });
     // ... matching logic here
   });
   ```
3. **Any service writing to more than one table uses `prisma.$transaction`.** A partial write that leaves the DB in an inconsistent state is never acceptable. If one write fails, the whole operation rolls back.
4. **Validate all inputs with Zod.** Every `POST`/`PATCH` body has a Zod schema in `validators/`. Invalid input returns `400 { error: { code: "VALIDATION_ERROR", fields: [...] } }`.
5. **Consistent error response shape:**
   ```json
   { "error": { "code": "MATCH_NOT_FOUND", "message": "Match abc123 does not exist" } }
   ```
   Use a central `AppError` class. The global error handler middleware maps it to HTTP status codes.
6. **Services return typed objects, not raw Prisma models.** Define a return type for each service function. This decouples routes from the ORM.
7. **PII never enters the logger.** Call `sanitizeForLog(entity)` before passing any model to `logger.info/warn/error`.
8. **All async route handlers wrapped in `asyncHandler`.** No unhandled promise rejections in routes.
9. **No raw SQL except the leaderboard query.** All other queries go through Prisma. The leaderboard query is isolated in `LeaderboardService.getRanked(eventId)`.
10. **Auth endpoints are rate-limited.** Apply `express-rate-limit` to all `/api/auth/*` routes: max 10 requests per IP per minute. These are unauthenticated endpoints — without limiting, a bad actor can flood them and generate junk user records.
11. **CORS allows only `CLIENT_URL`.** The `cors` middleware reads the allowed origin from `process.env.CLIENT_URL`. `Access-Control-Allow-Origin: *` is forbidden in all environments.
12. **Claude Code (and all dev tooling) must not read `.env` files.** `.env` contains `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`. Add to `.claude/settings.json`:
    ```json
    {
      "denyTools": [
        { "tool": "Read", "pathPattern": "**/.env*" }
      ]
    }
    ```
    This covers `.env`, `.env.local`, `.env.production`, and all variants. Secret rotation is meaningless if live credentials are readable in the development context.

---

### Frontend Standards

**Project structure:**
```
client/src/
├── pages/         ← route-level components (thin — compose from components)
├── components/    ← reusable UI components, one folder per component
├── hooks/         ← useSocket, useMatch, useCurrentUser, useTelemetry
├── services/      ← all API calls (axios wrappers) — no fetch in components
├── stores/        ← Zustand stores (see Global State below)
├── utils/         ← formatDate, truncate, etc.
├── mocks/         ← MSW handlers for tests
└── __tests__/     ← integration test flows
```

**Global State (Zustand):**

Zustand is the sole global state solution. React `useState` is fine for local UI state (a button being hovered, a form field). Anything shared across components or pages lives in a Zustand store.

```ts
// stores/useUserStore.ts
{ user, sessionId, setUser, clearUser }

// stores/useEventStore.ts
{ event, eventStatus, setEvent, setEventStatus }

// stores/useMatchStore.ts
{ match, prompt, matchStatus, setMatch, clearMatch }

// stores/useNotificationStore.ts
{ notifications, addNotification, removeNotification }
```

**Rules:**
- Stores are the only place global state is written. Components read from stores and call store actions.
- No prop-drilling of user, match, or event data. Components access stores directly via hooks.
- Stores are reset on logout (`clearUser`, `clearMatch`, `setEvent(null)`).
- Do not put derived values in stores — compute them in the component or a selector.

**Rules:**
1. **No direct API calls in components.** All network calls go through `services/`. Components call hooks that call services.
2. **The Socket.io connection is created once and never re-created.** The connection is opened inside `SocketContext` on mount and torn down on unmount. `useSocket` returns the socket from context — it never calls `io()` directly. No component or hook may import from `socket.io-client` directly. A second connection would break socket room membership silently.
3. **One KendoReact theme, applied once.** Theme provider is mounted once at the app root. Never override KendoReact styles with inline styles or local CSS — use theme variables.
4. **All user-visible async actions show loading state.** KendoReact Button `disabled` + spinner while request is in flight. No silent loading.
5. **All errors surfaced via `NotificationLayer`.** Components do not render their own error text. They call `showNotification({ type: 'error', message })` from `useNotification` hook.
6. **JWT is never touched by frontend code.** The JWT lives in an httpOnly cookie set by the server. The frontend never reads `document.cookie` or `localStorage` for auth state. On app load, `GET /api/users/me` (cookie sent automatically by browser) returns the current user and `sessionId`. On any 401 response: clear all Zustand stores and redirect to `EventList`.
7. **ErrorBoundary placement is mandatory at three levels:**
   - App root — top-level fallback prevents a blank screen
   - Each page component (`EventDashboard`, `EventSummary`) — page failure must not crash the whole app
   - `PostConversation` — failure here must not lose the user's dashboard state
   Each boundary calls `POST /api/telemetry` before rendering its fallback UI.
8. **`tsconfig.json` must have `strict: true`.** This enables `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, and `strictPropertyInitialization`. PRs that weaken the TypeScript config (`"strict": false`, `"skipLibCheck": true` to suppress errors, or `@ts-ignore` comments) are rejected. All API response shapes are typed in `services/types.ts`. Socket event payloads are typed in `socket/types.ts`.
9. **Accessibility baseline.** All interactive elements must be keyboard-navigable. KendoReact handles most of this — custom components must add `role`, `aria-label`, and `tabIndex` explicitly.
