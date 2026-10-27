<p align="center">
  <img src="client/public/favicon.svg" width="72" alt="Tiebreak logo" />
</p>

<h1 align="center">Tiebreak</h1>

<p align="center"><strong>Group decisions, settled fairly with ranked-choice voting.</strong><br/>
Nominate options · drag-to-rank ballots · instant-runoff elimination you can replay round by round.</p>

<p align="center">
  <a href="#live-demo">Live demo</a> ·
  <a href="#local-setup">Local setup</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#the-voting-engine">Voting engine</a> ·
  <a href="#api">API</a>
</p>

---

## Problem Statement

Every group chat has the same thread: *"Where should we eat?"*, *"Which film?"*, *"What do we name the project?"*
Twenty messages later, someone runs a plain poll. Plain polls are broken for groups:

- **Spoiler effect.** Two similar options split the vote and the option most people *dislike* wins with 35%.
- **No second choices.** If your favourite loses, your opinion stops counting.
- **Lost in chat.** Options get added after people voted, nobody knows if it's closed, and the "result" is whoever scrolled last.

## Target Users

Friend groups, flatmates, student clubs, hackathon teams and small workplace teams: any group of roughly 3 to 50 people who need to settle a choice between several options without a long argument.

## Solution

Tiebreak is a web app that runs a proper **ranked-choice (instant-runoff) election** for a group, with the whole lifecycle managed:

```
Host creates a decision ──► Group nominates options ──► Host opens voting
        │                                                        │
        │                                   Everyone ranks options (one ballot each,
        │                                   editable until the deadline)
        │                                                        │
        └──────────────► Deadline passes or host closes ◄────────┘
                                      │
                      Instant-runoff computed round by round
                                      │
                      Winner + replayable rounds + head-to-head matrix
```

Each person gets one ballot. If their first choice is eliminated, their vote transfers to their next choice. The winner is the option with a **majority of the ballots still counting**, never a plurality sneaking through.

## Key Features

| Workflow | What the user can do |
|---|---|
| **Create a decision** | Title, context, initial options, deadline, quorum, and rules (open nominations, anonymous ballots, live results). Choose to collect nominations first or start voting immediately. |
| **Invite & join** | Every decision gets a 6-letter share code (unambiguous alphabet, no 0/O or 1/I) and a link. Joining is explicit, so the host can see who is in. |
| **Nominate** | During the nomination phase, participants add up to 5 options each; duplicates are rejected; people can remove their own nominations; the host can remove any. The option list locks when voting opens. |
| **Rank & vote** | Drag-and-drop (or arrow buttons / keyboard) ballot builder. Partial rankings allowed. One ballot per person, editable or withdrawable until the vote closes. Ballot revisions are tracked. |
| **Run the runoff** | Deadline-driven auto-close or host-triggered close. Results show the winner, every elimination round with animated tallies and the majority line, a replay button, exhausted ballots, tie-break explanations, a Condorcet (head-to-head) check, final standings, and (unless anonymous) each ballot. |
| **Host controls** | Open voting, close & reveal, reopen, set/extend/remove the deadline, toggle rules mid-flight, delete. All guarded with confirmations and server-side authorization. |
| **Dashboard** | "Needs your vote", "In progress" and "Decided" groupings with live countdowns and vote status. |

Everything above is implemented and working; there are no mocked screens.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React 18 + Vite**, React Router 6, framer-motion, dnd-kit | Fast dev loop, small bundle; dnd-kit gives accessible drag-and-drop (pointer, touch, keyboard). |
| Backend | **Node + Express 4**, running as a **Netlify Function** via `serverless-http` | One Express app serves both local dev (`server/local.js`) and production (bundled by Netlify). No separate server to host. |
| Database | **MongoDB Atlas** via Mongoose 8 | Documents fit the data (decisions embed their options; ballots are separate for atomic one-per-voter upserts). Connection is cached across warm function invocations. |
| Auth | JWT (7-day) + bcrypt (cost 12) | Stateless, works in serverless; no sessions to store. |
| Validation | zod | Single source of truth for request shapes; errors map to per-field messages in the UI. |
| Hosting | **Netlify** (static site + Functions) from GitHub | Zero-config CI/CD on push; `/api/*` is rewritten to the function. |

MERN end to end: **M**ongoDB, **E**xpress, **R**eact, **N**ode.

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  Browser  (React SPA, built by Vite → dist/)                       │
│  pages/ ─ Landing · Auth · Dashboard · NewDecision · Join · Room   │
│  components/ ─ RankBallot (dnd-kit) · ResultsView · HostPanel …    │
│  lib/api.js ─ fetch wrapper, JWT header, typed ApiError            │
│  hooks/usePolling ─ 5-6 s polling while a tab is visible           │
└───────────────┬────────────────────────────────────────────────────┘
                │  /api/*   (netlify.toml redirect → /.netlify/functions/api)
┌───────────────▼────────────────────────────────────────────────────┐
│  Netlify Function  netlify/functions/api.mjs  = serverless(Express) │
│  server/app.js                                                     │
│    middleware: cors · json · path normaliser · lazy connectDB      │
│    routes/auth.js       register · login · me                      │
│    routes/decisions.js  CRUD · join · options · phase · ballot ·   │
│                         results                                    │
│    lib/irv.js           pure voting engine (unit-tested)           │
│    lib/validate.js      zod schemas                                │
│    lib/errors.js        ApiError + central error handler           │
│    models/              User · Decision (embeds options) · Ballot  │
└───────────────┬────────────────────────────────────────────────────┘
                │  Mongoose (cached connection)
┌───────────────▼────────────────────────────────────────────────────┐
│  MongoDB Atlas                                                     │
│  users · decisions · ballots (unique index on {decision, voter})   │
└────────────────────────────────────────────────────────────────────┘
```

### Notable engineering decisions

- **Decision lifecycle is a server-side state machine** (`nominating → voting → closed`, with `reopen`). Every transition is validated: you cannot open voting with fewer than two options, cannot change options once voting started, cannot vote before it opens or after it closes, cannot join a closed decision.
- **Deadlines without cron.** Serverless hosting has no always-on process, so deadlines are enforced lazily: every read of a decision runs `applyDeadline()`, which flips it to `closed` if the deadline has passed. The client countdown triggers a refetch at zero, so users see the flip immediately.
- **One ballot per voter** is guaranteed by a unique compound index, not just application logic. Re-submitting updates the ballot and bumps its `revision`.
- **Authorization is per-resource.** Host-only actions check `decision.host === req.user`; nomination removal checks ownership; results visibility depends on phase, the `liveResults` setting and host status; voter identities are withheld when ballots are anonymous.
- **The engine is pure.** `server/lib/irv.js` has no database or HTTP dependencies, which is why it has a proper unit-test suite (`npm test`, Node's built-in runner).
- **Serverless-friendly DB access.** The Mongoose connection promise is cached on `globalThis` so warm invocations skip the TLS handshake; `bufferCommands` is off so a dead connection fails fast with a 503 instead of hanging.
- **Polling instead of websockets.** Netlify Functions can't hold sockets. Rooms poll every 6 s (results every 5 s) only while the tab is visible. Cheap, and good enough for a group vote.
- **Error handling is layered.** zod errors → 400 with field map; duplicate keys → 409; bad ObjectIds → 400; DB unreachable → 503; everything else → 500 with the stack logged, never leaked. The client maps `details` onto form fields and everything else onto toasts; a 401 anywhere logs the user out.

## The voting engine

Implemented in [`server/lib/irv.js`](server/lib/irv.js).

**Instant-runoff (IRV):**
1. Count each ballot's highest-ranked option that is still active.
2. If an option holds a strict majority of the non-exhausted ballots, it wins.
3. Otherwise eliminate the option with the fewest votes and repeat. A ballot whose ranked options have all been eliminated is *exhausted* and leaves the count.

**Deterministic elimination tie-break** (lowest first):
1. fewest votes this round
2. lowest Borda score (sum of `n − position` over all ballots)
3. fewest ballots that ranked the option at all
4. most recently nominated option

The UI explains which rule was used whenever a tie-break happened.

**Extras computed for every result:** pairwise (head-to-head) matrix, Condorcet winner (an option that beats every other option one-on-one) with a badge when it differs from the IRV winner, first-choice counts, final standings in reverse elimination order, quorum check.

Run the tests:

```bash
npm test
```

## Local Setup

Prerequisites: Node 18+ and a MongoDB connection string (a free MongoDB Atlas cluster, or a local `mongod`).

```bash
git clone https://github.com/<you>/tiebreak.git
cd tiebreak
npm install
cp .env.example .env        # then fill in MONGODB_URI and JWT_SECRET
npm run dev                 # API on :5050, Vite on :5173 (proxying /api)
```

Open http://localhost:5173.

Optional: load demo data (a host account, seven friends, and three decisions in different phases):

```bash
npm run seed
```

Then sign in as **demo@tiebreak.app / demo1234** and open codes `DEMO01` (decided), `DEMO02` (voting) and `DEMO03` (collecting options).

Other scripts:

| Script | Purpose |
|---|---|
| `npm run dev:api` | API only (`node --watch`) |
| `npm run dev:web` | Vite only |
| `npm run build` | Production build of the SPA into `dist/` |
| `npm test` | Unit tests for the voting engine |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB connection string. |
| `JWT_SECRET` | yes | Long random string used to sign access tokens. Generate one with `openssl rand -hex 32`. |
| `PORT` | no | Local API port (default `5050`). Not used on Netlify. |
| `CORS_ORIGIN` | no | Comma-separated allowed origins. Leave unset to allow any origin (fine when the SPA and API share a domain, as on Netlify). |

Never commit `.env`. It is git-ignored; `.env.example` documents the shape.

## Deployment

### Live demo

**App:** `https://<your-site>.netlify.app`  ← replace after deploying
**Demo login:** demo@tiebreak.app / demo1234 (after running `npm run seed` against the production database)

### Deploy to Netlify from GitHub

1. Push this repository to GitHub.
2. Create a free **MongoDB Atlas** cluster, create a database user, and allow access from anywhere (`0.0.0.0/0`, Netlify Functions have no fixed IP). Copy the connection string.
3. In Netlify: **Add new site → Import an existing project → GitHub → pick the repo.** The build settings are read from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
4. Under **Site configuration → Environment variables**, add `MONGODB_URI` and `JWT_SECRET`.
5. Deploy. Netlify builds the SPA, bundles `netlify/functions/api.mjs` (which wraps the Express app), and the redirect in `netlify.toml` sends `/api/*` to it.
6. Verify: `https://<your-site>.netlify.app/api/health` should return `{"ok":true,…}`.
7. Optional: seed demo data against production from your machine:

   ```bash
   MONGODB_URI="<atlas uri>" npm run seed
   ```

Every push to the main branch redeploys automatically.

## API

All routes are under `/api`. Authenticated routes expect `Authorization: Bearer <token>`.

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | – | Liveness check |
| POST | `/auth/register` | – | Create account → `{ token, user }` |
| POST | `/auth/login` | – | Sign in → `{ token, user }` |
| GET | `/auth/me` | ✓ | Current user |
| GET | `/decisions` | ✓ | Decisions I host or joined |
| POST | `/decisions` | ✓ | Create a decision |
| GET | `/decisions/:code` | ✓ | Decision + viewer flags + participants (+ voters unless anonymous) |
| POST | `/decisions/:code/join` | ✓ | Join as participant |
| PATCH | `/decisions/:code` | host | Edit title/description/deadline/settings |
| POST | `/decisions/:code/options` | ✓ | Nominate an option |
| DELETE | `/decisions/:code/options/:id` | owner/host | Remove an option (nomination phase only) |
| POST | `/decisions/:code/phase` | host | `open_voting` · `close` · `reopen_voting` |
| PUT | `/decisions/:code/ballot` | ✓ | Cast or replace my ballot |
| DELETE | `/decisions/:code/ballot` | ✓ | Withdraw my ballot |
| GET | `/decisions/:code/results` | ✓* | Computed runoff (*closed, or live results enabled, or host) |
| DELETE | `/decisions/:code` | host | Delete decision and its ballots |

Errors are always JSON: `{ "error": "message", "details": { field: "message" } }` with meaningful HTTP status codes (400, 401, 403, 404, 409, 503, 500).

## Project Structure

```
tiebreak/
├── client/                 # React SPA (Vite root)
│   ├── index.html
│   ├── public/             # favicon, _redirects
│   └── src/
│       ├── App.jsx         # routes
│       ├── styles.css      # design system
│       ├── lib/            # api client, auth context, toasts, formatters
│       ├── hooks/          # usePolling
│       ├── components/     # Layout, RankBallot, ResultsView, HostPanel, …
│       └── pages/          # Landing, AuthPage, Dashboard, NewDecision, Join, DecisionRoom
├── server/                 # Express API (shared by local dev and the function)
│   ├── app.js              # createApp()
│   ├── local.js            # local dev entry
│   ├── seed.js             # demo data
│   ├── lib/                # db, errors, validate, irv (+ irv.test.js)
│   ├── middleware/auth.js
│   ├── models/             # User, Decision, Ballot
│   └── routes/             # auth, decisions
├── netlify/functions/api.mjs  # serverless-http wrapper
├── netlify.toml
├── vite.config.js
├── .env.example
└── package.json
```

## Security notes

- Passwords are hashed with bcrypt (cost 12); login returns the same error for unknown email and wrong password.
- JWTs are signed with `JWT_SECRET` from the environment and expire after 7 days; the client drops the token on any 401.
- All input is validated with zod before touching the database; request bodies are capped at 64 KB.
- Share codes are random and 32⁶ ≈ 1 billion possibilities; every decision route also requires a signed-in user and checks membership/host status.
- No secrets in the repository. `.env` is ignored and `.env.example` holds placeholders only.

## Originality

Built from scratch for this project. Open-source libraries used are listed in `package.json`; no existing application was forked or templated.

## Submission details

```
Project Name:      Tiebreak
Problem Statement: Group decisions made in chats and plain polls are slow, vulnerable to vote-splitting, and never clearly "closed". Tiebreak runs a managed ranked-choice (instant-runoff) election for a group: nominate, rank, auto-close, and a replayable result.
GitHub Repository: https://github.com/<you>/tiebreak
Deployed App:      https://<your-site>.netlify.app
Tech Stack:        React 18, Vite, React Router, framer-motion, dnd-kit · Node, Express, serverless-http (Netlify Functions) · MongoDB Atlas, Mongoose · JWT, bcrypt, zod
Major Features:    Auth · decision lifecycle state machine (nominate → vote → closed) · share codes & join · participant nominations with limits · drag-and-drop ranked ballots (one per voter, editable, withdrawable) · deadline auto-close & quorum · instant-runoff engine with Borda tie-breaks, Condorcet check, pairwise matrix, round-by-round replay · host controls · dashboard · polling live updates
```
