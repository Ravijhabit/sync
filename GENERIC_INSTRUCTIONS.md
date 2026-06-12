# Developer Instructions

This document defines how the frontend (FE) and backend (BE) developers communicate progress and log errors. Follow these conventions exactly — the lead reviews these files to validate execution and issue resolutions.

---

## Files and Ownership

| File | Owner | Purpose |
|---|---|---|
| `FE_BE_Communication.md` | Both devs + lead | Progress updates, cross-team contracts, API agreements, lead sign-offs |
| `FE_ERROR_FACED.md` | FE developer | Frontend errors — bugs, build failures, integration issues |
| `BE_ERROR_FACED.md` | BE developer | Backend errors — server errors, DB issues, service failures |

---

## Progress Updates — `FE_BE_Communication.md`

Post an update here when you:
- Complete a phase or a meaningful sub-task within a phase
- Need the other developer to unblock you (e.g. API contract not matching)
- Have a question that affects both sides

**Format:**
```
## [YYYY-MM-DD] [FE | BE] — <Short title>

**Phase:** Phase N — <Phase name from PLAN.md>
**Status:** In Progress | Completed | Blocked

**What was done:**
- <bullet point summary of work completed>

**What is next:**
- <next step or what you are waiting on>

**Cross-team dependency (if any):**
- <what you need from the other developer before you can continue>
```

---

## Error Logging — `FE_ERROR_FACED.md` / `BE_ERROR_FACED.md`

Log every error you cannot resolve within 15 minutes. Do not spend more time guessing — log it and wait for the lead's resolution directive.

**Format:**
```
## [YYYY-MM-DD] — <Short description of the error>

**Phase:** Phase N — <Phase name from PLAN.md>
**Error:**
<exact error message or stack trace — do not paraphrase>

**Context:**
<what you were doing when the error occurred — file name, function name, step in the flow>

**Already tried:**
- <approach 1>
- <approach 2>

**Status:** Open
```

Once the lead provides a resolution, update the entry:
```
**Resolution:** <summary of the fix applied>
**Status:** Resolved
```

---

## General Rules

- Always reference the **Phase number and name** from `PLAN.md` in every entry. This lets the lead cross-check against the execution plan immediately.
- **Never paraphrase error messages.** Paste the exact output. A summarised error hides the detail the lead needs to diagnose it.
- **One entry per error.** Do not append a new error to an existing open entry — create a new `##` section.
- **Date format:** `YYYY-MM-DD` (e.g. `2026-06-12`).
- After the lead posts a resolution directive in the communication file, the developer who owns the error applies the fix and updates the entry status to `Resolved`.
- Do not mark a phase `Completed` in `FE_BE_Communication.md` until the **verification checkpoint** for that phase (defined in `PLAN.md`) passes.
