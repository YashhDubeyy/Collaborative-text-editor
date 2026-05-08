# Real-Time Collaborative Editor — Implementation Plan

## Overview

We're building a production-grade, real-time collaborative text editor — the kind that powers Google Docs. Two or more users can edit the same document simultaneously, and changes reconcile correctly even when typed at the exact same position at the same time.

The conflict resolution algorithm we'll use is **Operational Transformation (OT)** — the industry standard used by Google Docs, which is both well-understood and portfolio-impressive.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   FRONTEND                       │
│  React + CodeMirror 6 (rich text editor)         │
│  • Optimistic local updates                      │
│  • OT client-side transform logic               │
│  • Socket.io client for real-time events        │
│  • Cursor & presence tracking UI                │
└────────────────┬────────────────────────────────┘
                 │  WebSocket (Socket.io)
┌────────────────▼────────────────────────────────┐
│               BACKEND (Node.js + TypeScript)     │
│  Express + Socket.io server                      │
│  • OT Sync Engine (transform & broadcast)        │
│  • Document room management                      │
│  • REST API for doc CRUD                        │
│  • Redis pub/sub for horizontal scaling          │
└──────┬───────────────────────┬──────────────────┘
       │                       │
┌──────▼──────┐       ┌────────▼───────┐
│   Redis     │       │  PostgreSQL     │
│  (hot cache)│       │  (persistence) │
│  op history │       │  documents,     │
│  sessions   │       │  users, history │
└─────────────┘       └────────────────┘
```

---

## Tech Stack Choices

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React 18 + Vite | Fast HMR, modern ecosystem |
| Editor | CodeMirror 6 | Structured ops, extensible, battle-tested |
| OT Library | `ot.js` (custom TextOperation) | Minimal, well-documented OT |
| Backend | Node.js + TypeScript + Express | Native async, great WS support |
| Real-time | Socket.io | Rooms, reconnection, fallback |
| Cache | Redis (via `ioredis`) | Fast pub/sub, op log storage |
| DB | PostgreSQL + Prisma ORM | Relational, typed, migrations |
| Auth | JWT + bcrypt (simple, stateless) | Good enough for portfolio |

---

## Project Structure

```
real-time-collab-editor/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Entry point
│   │   ├── socket/
│   │   │   ├── gateway.ts        # Socket.io setup & room management
│   │   │   └── handlers.ts       # join-doc, op, cursor events
│   │   ├── ot/
│   │   │   ├── TextOperation.ts  # OT core: compose, transform, apply
│   │   │   └── Server.ts         # OT server (revision tracking)
│   │   ├── services/
│   │   │   ├── documentService.ts
│   │   │   └── redisService.ts
│   │   ├── routes/
│   │   │   ├── documents.ts      # REST: CRUD for docs
│   │   │   └── auth.ts           # REST: register/login
│   │   ├── middleware/
│   │   │   └── auth.ts
│   │   └── prisma/
│   │       └── schema.prisma
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── pages/
    │   │   ├── LandingPage.tsx
    │   │   ├── EditorPage.tsx
    │   │   └── AuthPage.tsx
    │   ├── components/
    │   │   ├── Editor/
    │   │   │   ├── CollabEditor.tsx    # CodeMirror 6 component
    │   │   │   ├── CursorLayer.tsx     # Remote cursor overlays
    │   │   │   └── PresenceBar.tsx     # Online users list
    │   │   ├── DocumentList.tsx
    │   │   └── Navbar.tsx
    │   ├── hooks/
    │   │   ├── useCollabSocket.ts     # Socket.io + OT state machine
    │   │   └── useAuth.ts
    │   ├── ot/
    │   │   └── TextOperation.ts       # Shared OT logic (same as server)
    │   └── store/
    │       └── useEditorStore.ts      # Zustand global state
    ├── index.html
    ├── package.json
    └── vite.config.ts
```

---

## Core OT Algorithm

The `TextOperation` class implements these key methods:

- **`apply(doc)`** — Apply an op to a document string
- **`compose(op1, op2)`** — Merge two sequential ops into one
- **`transform(op1, op2)`** — The key function: given two concurrent ops, produce `op1'` and `op2'` such that `apply(apply(doc, op1), op2') == apply(apply(doc, op2), op1')`

The **Server OT state machine** tracks:
- `document`: current authoritative string
- `revision`: monotonically increasing integer
- `history`: array of past ops (for late-arriving clients)

---

## Key Features to Build

### Phase 1 — Core (the hard stuff)
- [x] OT `TextOperation` (retain, insert, delete primitives)
- [x] Server-side OT engine with revision tracking
- [x] Socket.io gateway with document rooms
- [x] Client-side OT state machine (pending/inflight/acknowledged)
- [x] CodeMirror 6 integration with OT ops

### Phase 2 — UX Polish
- [x] Remote cursor positions (with user colors and names)
- [x] Document list & creation (REST API)
- [x] User authentication (JWT)
- [x] Auto-save with debouncing to PostgreSQL
- [x] Connection status indicator (connected / reconnecting / offline)

### Phase 3 — Portfolio Polish
- [x] Beautiful dark-mode UI with animations
- [x] Online presence bar ("3 users editing")
- [x] Document sharing via link
- [x] Version history viewer

---

## Proposed Changes

### Backend

#### [NEW] backend/src/ot/TextOperation.ts
Core OT primitives. Implements retain/insert/delete operations, compose, and transform.

#### [NEW] backend/src/ot/Server.ts
Server-side OT engine. Tracks document revision, history, and transforms late operations.

#### [NEW] backend/src/socket/gateway.ts
Socket.io server setup with JWT auth middleware and room management.

#### [NEW] backend/src/socket/handlers.ts
Event handlers: `join-doc`, `op`, `cursor`, `leave-doc`.

#### [NEW] backend/src/services/documentService.ts
CRUD operations for documents via Prisma + PostgreSQL.

#### [NEW] backend/src/services/redisService.ts
Redis client for op caching and pub/sub (for multi-instance scaling).

#### [NEW] backend/prisma/schema.prisma
User, Document, and Operation models.

### Frontend

#### [NEW] frontend/src/ot/TextOperation.ts
Identical OT logic, shared between client and server (could also be a shared package).

#### [NEW] frontend/src/hooks/useCollabSocket.ts
The client-side OT state machine:
- States: `synchronized`, `awaiting_confirm`, `awaiting_with_buffer`
- Manages pending/inflight ops, transforms incoming server ops, applies to editor.

#### [NEW] frontend/src/components/Editor/CollabEditor.tsx
CodeMirror 6 component that converts CM6 change events to `TextOperation` and vice-versa.

#### [NEW] frontend/src/pages/EditorPage.tsx
Main editor page: combines `CollabEditor`, `CursorLayer`, `PresenceBar`.

#### [NEW] frontend/src/pages/LandingPage.tsx
Stunning landing page with animated demo.

---

## Verification Plan

### Automated
- Run both servers (`npm run dev` in backend + frontend)
- Open 3 browser tabs on the same document URL
- Type simultaneously in all 3 — verify convergence

### Manual checks
- [ ] Simultaneous edit at same cursor position resolves correctly
- [ ] Client disconnects and reconnects — document syncs back
- [ ] Cursor colors appear for each user
- [ ] Auto-save works (document persists on page refresh)
- [ ] Auth flow (register → login → create doc → share link)

---

## Open Questions

> [!IMPORTANT]
> **Database Setup**: This plan uses PostgreSQL + Redis. For simplicity during development, I can use SQLite (via Prisma) instead of PostgreSQL to avoid requiring a running Postgres server. Redis will still be used for pub/sub. Shall I proceed with SQLite for the DB, or do you have PostgreSQL available?

> [!NOTE]
> For this portfolio project, I'll use `ot.js`-style TextOperation from scratch (no external OT library) so the implementation is yours and fully understood by an interviewer.
