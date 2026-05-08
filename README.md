# CollabEdit — Real-Time Collaborative Editor

A production-grade collaborative text editor built from scratch, tackling one of the hardest problems in distributed systems: **concurrent state synchronization over an unreliable network**.

Two (or more) users can type at the **exact same character position simultaneously**, and their edits will always converge to the same document — no conflicts, no data loss, ever.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   FRONTEND                       │
│  React 18 + Vite + CodeMirror 6                  │
│  • Optimistic local updates (instant keystrokes) │
│  • Client-side OT state machine                  │
│  • Socket.io for real-time events                │
│  • Remote cursor overlays (live colored carets)  │
│  • Presence bar + connection status              │
└────────────────┬────────────────────────────────┘
                 │  WebSocket (Socket.io)
┌────────────────▼────────────────────────────────┐
│          BACKEND (Node.js + TypeScript)          │
│  Express + Socket.io                             │
│  • OT Sync Engine (transform & broadcast)        │
│  • Document room management                      │
│  • REST API for document CRUD                    │
│  • JWT authentication                            │
│  • Debounced auto-save to SQLite                 │
└────────────────────────┬───────────────────────┘
                         │ Prisma ORM
                 ┌───────▼────────┐
                 │  SQLite (dev)  │
                 │  documents,    │
                 │  users         │
                 └────────────────┘
```

---

## The Core Algorithm: Operational Transformation (OT)

Every edit is represented as a `TextOperation` — a sequence of three primitives:

| Op | Meaning |
|----|---------|
| `retain(n)` | Skip over n characters unchanged |
| `insert(s)` | Insert string s at current position |
| `delete(n)` | Delete n characters at current position |

### How conflicts are resolved

When two users edit simultaneously, the server calls `TextOperation.transform(op1, op2)`:

```
Doc: "Hello"
User A types " World"  → op1: retain(5), insert(" World")
User B types "!"       → op2: retain(5), insert("!")

transform(op1, op2) →
  op1' = retain(5), insert(" World"), retain(1)   ← adjusted for B's "!"
  op2' = retain(11), insert("!")                  ← adjusted for A's " World"

Result for A: apply(apply("Hello", op1), op2') = "Hello World!"
Result for B: apply(apply("Hello", op2), op1') = "Hello World!"  ✓ Converged!
```

### Client State Machine

Each client runs a 3-state machine to handle network latency:

```
synchronized ──[local edit]──► awaiting_confirm ──[local edit]──► awaiting_with_buffer
      ▲                               │                                    │
      └──────────[server ack]─────────┘◄──────────[server ack]────────────┘
```

---

## Tech Stack

| Layer | Tech | Why |
|---|---|---|
| Frontend | React 18 + Vite | Fast HMR, modern ecosystem |
| Editor | CodeMirror 6 | Structured change events, extensible |
| OT | Custom `TextOperation` | No black boxes — fully understood |
| Realtime | Socket.io | Rooms, reconnection, auth middleware |
| Backend | Node.js + TypeScript + Express | Native async, great WS support |
| Auth | JWT + bcrypt | Stateless, simple |
| DB | SQLite + Prisma | Zero config for development |

---

## Project Structure

```
real-time-collab-editor/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express + HTTP server entry
│   │   ├── ot/
│   │   │   ├── TextOperation.ts  # retain/insert/delete, compose, transform
│   │   │   └── Server.ts         # Revision tracking + history replay
│   │   ├── socket/
│   │   │   ├── gateway.ts        # Socket.io setup + JWT auth middleware
│   │   │   └── handlers.ts       # join-doc, op, cursor, leave events
│   │   ├── services/
│   │   │   └── documentService.ts
│   │   ├── routes/
│   │   │   ├── documents.ts      # REST CRUD
│   │   │   └── auth.ts           # register / login
│   │   └── middleware/
│   │       └── auth.ts           # JWT verification
│   └── prisma/
│       └── schema.prisma
│
└── frontend/
    └── src/
        ├── ot/
        │   └── TextOperation.ts  # Same OT logic as server (shared)
        ├── hooks/
        │   ├── useCollabSocket.ts # Client OT state machine
        │   └── useAuth.ts
        ├── components/
        │   ├── Editor/
        │   │   ├── CollabEditor.tsx  # CodeMirror 6 + remote cursor decorations
        │   │   └── PresenceBar.tsx   # Live user avatars with tooltips
        │   ├── DocumentList.tsx
        │   └── Navbar.tsx
        ├── pages/
        │   ├── LandingPage.tsx
        │   ├── AuthPage.tsx
        │   ├── DocsPage.tsx
        │   └── EditorPage.tsx
        └── store/
            └── useEditorStore.ts  # Zustand (auth + editor state)
```

---

## Setup & Running

### Prerequisites

- Node.js 18+
- npm

### 1. Install dependencies

```powershell
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Initialize the database

```powershell
cd backend
npx prisma db push      # Creates dev.db and applies schema
npx prisma generate     # Generates Prisma client
```

### 3. Start the backend

```powershell
cd backend
npm run dev
# → REST API:  http://localhost:3001/api
# → WebSocket: ws://localhost:3001
```

### 4. Start the frontend (new terminal)

```powershell
cd frontend
npm run dev
# → http://localhost:5173
```

### 5. Test real-time collaboration

1. Open **two browser windows** at `http://localhost:5173`
2. Register two different accounts
3. Create a document in one window, copy the URL
4. Open that URL in the second window
5. Type simultaneously in both windows — watch the OT engine resolve conflicts

---

## Key Features

- ✅ **OT conflict resolution** — custom `transform()` handles all concurrent edit cases
- ✅ **Optimistic updates** — keystrokes render instantly, sync happens async
- ✅ **Remote cursors** — colored carets with name labels for each collaborator
- ✅ **Presence bar** — live avatars of who's editing the document
- ✅ **Auto-save** — debounced 3s write to SQLite after last keystroke
- ✅ **Reconnection handling** — Socket.io auto-reconnects; OT state machine resyncs
- ✅ **Offline banner** — red banner when connection drops
- ✅ **JWT auth** — register/login, 7-day tokens, per-user color assignment
- ✅ **Document sharing** — copy URL, send to anyone, they join the room
- ✅ **Title editing** — click the title in the toolbar to rename inline
- ✅ **Markdown editor** — CodeMirror 6 with markdown syntax highlighting

---

## API Reference

### Auth
| Method | Route | Body | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/register` | `{email, username, password}` | Register |
| POST | `/api/auth/login` | `{email, password}` | Login |

### Documents (all require `Authorization: Bearer <token>`)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/documents` | List all docs |
| GET | `/api/documents/:id` | Get one doc |
| POST | `/api/documents` | Create doc |
| PATCH | `/api/documents/:id/title` | Rename doc |
| DELETE | `/api/documents/:id` | Delete doc |

### WebSocket Events
| Event | Direction | Payload |
|-------|-----------|---------|
| `join-doc` | Client→Server | `{docId}` |
| `doc-init` | Server→Client | `{document, revision}` |
| `op` | Both | `{docId, revision, op}` |
| `op-ack` | Server→Client | `{revision}` |
| `cursor` | Both | `{docId, cursor}` |
| `presence-update` | Server→Client | `RemoteUser[]` |
| `user-joined` | Server→Client | `{socketId, username, color}` |
| `user-left` | Server→Client | `{socketId, username}` |
| `leave-doc` | Client→Server | `{docId}` |

---

## Health Check

```
GET http://localhost:3001/api/health
→ {"status":"ok","ts":"..."}
```

---

## License

MIT
