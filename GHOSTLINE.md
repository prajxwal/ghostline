# 👻 Ghostline

> **Truly anonymous chat. No signup. No IP logs. No traces. Just chat.**

Ghostline is a privacy-first, ephemeral chat application where conversations vanish and identities never exist. There are no accounts, no emails, no phone numbers — and the server intentionally forgets everything.

---

## 🎯 Core Philosophy

| Principle | Implementation |
|---|---|
| **No Identity** | No signup, no login, no accounts — ever |
| **No Tracking** | Zero IP logging, no fingerprinting, no analytics |
| **Ephemeral** | Messages exist only in memory, never written to disk |
| **Minimal Trust** | Server knows nothing about who you are |
| **End-to-End** | Messages encrypted client-side before transmission |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                  │
│                                                     │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  UI Layer  │  │  Crypto Layer │  │  WS Client   │ │
│  │ (Vanilla)  │  │ (Web Crypto)  │  │  (Socket.io) │ │
│  └───────────┘  └──────────────┘  └──────────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │ WebSocket (WSS)
                       │ (encrypted payloads only)
┌──────────────────────▼──────────────────────────────┐
│                   SERVER (Node.js)                   │
│                                                     │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Express   │  │  Socket.io   │  │  Room Mgr    │ │
│  │  (Static)  │  │  (Relay)     │  │  (In-Memory) │ │
│  └───────────┘  └──────────────┘  └──────────────┘ │
│                                                     │
│  ⛔ NO DATABASE  ⛔ NO LOGS  ⛔ NO IP STORAGE       │
└─────────────────────────────────────────────────────┘
```

**Tech Stack:** Node.js + Express + Socket.io (server) · Vanilla HTML/CSS/JS + Web Crypto API (client)

---

## 📁 Full Project File Structure

```
ghostline/
│
├── GHOSTLINE.md               # This file — project overview & spec
├── README.md                  # Quick start & usage guide
├── package.json               # Node.js dependencies & scripts
├── .gitignore                 # Ignore node_modules, env files
├── .env.example               # Example env config (PORT only)
│
├── server/
│   ├── index.js               # Entry point — Express + Socket.io server
│   ├── socket.js              # WebSocket event handlers (join, msg, leave)
│   └── rooms.js               # In-memory room manager (create, join, destroy)
│
├── public/                    # Static files served to the browser
│   ├── index.html             # Landing page — create or join a room
│   ├── chat.html              # Chat room page
│   │
│   ├── css/
│   │   ├── global.css         # CSS reset, variables, typography
│   │   ├── landing.css        # Landing page styles
│   │   └── chat.css           # Chat room styles
│   │
│   ├── js/
│   │   ├── landing.js         # Landing page logic (create/join room)
│   │   ├── chat.js            # Chat room logic (send/receive messages)
│   │   ├── crypto.js          # E2E encryption (Web Crypto API wrappers)
│   │   ├── socket.js          # Socket.io client connection manager
│   │   └── utils.js           # Random name generator, helpers
│   │
│   └── assets/
│       ├── favicon.svg        # Ghost icon favicon
│       └── ghost-logo.svg     # Ghostline logo
│
└── docs/
    └── PRIVACY.md             # Privacy policy — what we collect (nothing)
```

---

## 📄 File-by-File Breakdown

### Root Files

#### `package.json`
- **Dependencies:** `express`, `socket.io`, `dotenv`
- **Scripts:** `start` (production), `dev` (nodemon for development)
- No database drivers. No auth libraries. Nothing that stores data.

#### `.env.example`
```env
PORT=3000
```
Only config is the port. That's it.

---

### Server (`server/`)

#### `server/index.js` — Entry Point
- Creates Express app and HTTP server
- Serves static files from `public/`
- Initializes Socket.io with CORS config
- **Explicitly disables all logging middleware** — no morgan, no access logs
- Strips `x-powered-by` header
- Does **NOT** read or store `req.ip` anywhere

#### `server/rooms.js` — In-Memory Room Manager
- `Map<roomId, { users: Set, createdAt, passHash? }>` — rooms live only in memory
- `createRoom(id, password?)` — generate a room, optionally password-protected
- `joinRoom(id, password?)` — add a user to a room
- `leaveRoom(id, userId)` — remove user; auto-destroy room if empty
- `getRoomInfo(id)` — returns user count only (no user identifiers)
- Rooms auto-expire after 24h of inactivity
- **On server restart, everything is gone.** By design.

#### `server/socket.js` — WebSocket Event Handlers
- `connection` — assigns a random ephemeral ID (UUID v4), no IP stored
- `join-room` — validates room exists, adds user
- `chat-message` — relays encrypted payload to room (server cannot read it)
- `typing` — broadcast typing indicator
- `disconnect` — remove user, cleanup empty rooms
- **Server never decrypts messages.** It's a dumb relay.

---

### Client — Landing (`public/index.html` + `landing.js`)

#### `public/index.html` — Landing Page
- Hero section with Ghostline branding and tagline
- Two actions: **Create Room** / **Join Room**
- Create: generates a unique room code, optional password
- Join: enter a room code (+ password if required)
- Auto-generates a random anonymous alias (e.g., `ShadowFox`, `GhostPine`)
- Dark, minimal, premium UI with subtle ghost-themed animations

#### `public/js/landing.js`
- Room creation → generates 6-char alphanumeric room code
- Room join → validates code format, connects via WebSocket
- Sends user to `chat.html?room=XXXXXX` on success
- Generates a random display name from adjective + noun wordlists

---

### Client — Chat Room (`public/chat.html` + `chat.js`)

#### `public/chat.html` — Chat Room Page
- Top bar: room code (click to copy), user count, leave button
- Message feed: scrollable, auto-scroll on new messages
- Message input: text field + send button, Enter to send
- System messages for join/leave events
- Typing indicator
- "Messages are ephemeral" reminder in the UI

#### `public/js/chat.js`
- Connects to Socket.io room on page load
- Encrypts outgoing messages with room key via `crypto.js`
- Decrypts incoming messages client-side
- Renders messages with: alias, timestamp (local only), content
- Handles typing indicators with debounce
- Handles disconnect/reconnect gracefully
- **No message history.** Refresh = messages gone.

---

### Client — Crypto (`public/js/crypto.js`)

#### Encryption Flow
```
[User types message]
       ↓
[AES-GCM encrypt with room key]
       ↓
[Send encrypted blob via WebSocket]
       ↓
[Server relays blob (can't read it)]
       ↓
[Other clients decrypt with same room key]
       ↓
[Display plaintext message]
```

- **Key Derivation:** Room password → PBKDF2 → AES-256-GCM key
- **No password?** A random AES key is generated and shared via the room URL fragment (`#key=...`) — the fragment is never sent to the server
- Uses the **Web Crypto API** (built into all modern browsers)
- Each message gets a unique IV (initialization vector)
- No key escrow. Server never sees the key. Period.

---

### Client — Utilities (`public/js/utils.js`)

- `generateAlias()` — random anonymous name from curated wordlists
- `generateRoomCode()` — 6-char alphanumeric code
- `formatTime(date)` — local-only timestamp formatting
- `copyToClipboard(text)` — room code sharing
- `sanitizeHTML(str)` — XSS prevention for displayed messages

---

### Client — Styles (`public/css/`)

#### `global.css`
- CSS custom properties (dark theme tokens)
- Font imports (Inter / JetBrains Mono)
- CSS reset and base styles
- Utility classes and animations

#### `landing.css`
- Full-viewport hero layout
- Glassmorphism cards for create/join forms
- Ghost-themed floating particle animation
- Responsive breakpoints

#### `chat.css`
- Chat layout (flexbox, sticky input)
- Message bubbles (own vs. others)
- System message styling
- Typing indicator animation
- Scrollbar customization

---

### Design System

| Token | Value |
|---|---|
| `--bg-primary` | `#0a0a0f` (near-black) |
| `--bg-secondary` | `#12121a` (dark navy) |
| `--bg-card` | `rgba(255, 255, 255, 0.03)` |
| `--accent` | `#7c5cfc` (spectral purple) |
| `--accent-glow` | `#a78bfa` (light purple) |
| `--text-primary` | `#e4e4e7` |
| `--text-muted` | `#71717a` |
| `--border` | `rgba(255, 255, 255, 0.06)` |
| `--danger` | `#ef4444` |
| `--font-body` | `'Inter', sans-serif` |
| `--font-mono` | `'JetBrains Mono', monospace` |

---

## 🔒 Privacy Guarantees

1. **No database.** Not SQLite, not Redis, not a JSON file. Nothing.
2. **No IP logging.** Express access logs are disabled. Socket.io connection IPs are never read.
3. **No cookies.** No session cookies, no tracking cookies, no cookies at all.
4. **No analytics.** No Google Analytics, no Mixpanel, no telemetry.
5. **No message persistence.** Messages live in RAM. Server restart = clean slate.
6. **No user accounts.** No signup, no login, no OAuth, no SSO.
7. **E2E encryption.** Server relays ciphertext. It physically cannot read your messages.
8. **Ephemeral rooms.** Empty rooms are destroyed. Inactive rooms expire in 24 hours.

---

## 🚀 How It Works (User Flow)

```
1. Visit ghostline → See landing page
2. Click "Create Room" → Get a room code (e.g., X7K2M9)
3. Share the code with your friend (via any channel)
4. Friend visits ghostline → "Join Room" → Enters code
5. Both are in. Chat is encrypted. Server can't read it.
6. Close the tab → You're gone. No trace.
7. Room empties → Room is destroyed. Forever.
```

---

## 🛠️ Quick Start

```bash
# Clone
git clone https://github.com/yourname/ghostline.git
cd ghostline

# Install
npm install

# Run
npm run dev

# Open
http://localhost:3000
```

---

> *"The most private message is the one that never existed."*
> — Ghostline
