# Jace Games

Quick browser games from [Jace](https://jaceo.vercel.app). Sign in with your Jace account to keep your scores, including the Snake and Memory Match scores from the old Jace site, and compete on leaderboards shared across Jace.

Next.js 16 (App Router), TypeScript and Tailwind 4, deployed on Vercel.

## Games

| id            | Game           | Score                  | Better |
| ------------- | -------------- | ---------------------- | ------ |
| `snake`       | Snake          | Food eaten             | Higher |
| `memory`      | Memory Match   | Moves to clear         | Lower  |
| `2048`        | 2048           | Points                 | Higher |
| `tetris`      | Block Stacker  | Points                 | Higher |
| `minesweeper` | Minesweeper    | Seconds (9×9, 10 mines) | Lower  |
| `flappy`      | Flappy Jace    | Pipes passed           | Higher |
| `breakout`    | Breakout       | Points                 | Higher |
| `wordle`      | Word Guess     | Guesses used (wins only) | Lower |
| `reaction`    | Reaction Time  | Average of 5, in ms    | Lower  |
| `typing`      | Typing Speed   | WPM over 30 s          | Higher |

`snake` and `memory` keep the ids the original Jace site used, so old scores carry over. Never change an existing id.

Every game works with a keyboard (arrow keys/WASD, Enter to restart) and on a touchscreen (swipes, taps, on-screen pads).

### Adding a game

1. Add an entry to `GAMES` in [`lib/games.ts`](lib/games.ts): id, name, description, icon, `better` (`"higher"` or `"lower"`), how to format the score, `addedAt` (shows a "New" badge for a month), and `limits` for server-side validation.
2. Write the component in `components/games/`. It receives `{ onFinish(score, durationMs), best }` and calls `onFinish` once when a game ends.
3. Register it in [`components/games/index.ts`](components/games/index.ts).

## Setup

You need Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`, then run `npm run dev` and open http://localhost:3000.

### Environment variables

| Name                 | Required | What it is |
| -------------------- | -------- | ---------- |
| `JACE_CLIENT_ID`     | yes      | The OAuth client id from Jace. |
| `JACE_CLIENT_SECRET` | yes      | The OAuth client secret from Jace. Server only, never sent to the browser. |
| `SESSION_SECRET`     | yes      | 32+ random characters used to encrypt the session cookie. Generate with `openssl rand -base64 32`. Changing it signs everyone out. |
| `APP_URL`            | no       | This app's public URL, used to build the redirect URI `<APP_URL>/api/auth/callback`. Defaults to the URL of the incoming request. Set it in production if you use more than one domain. |
| `JACE_URL`           | no       | The Jace base URL. Defaults to `https://jaceo.vercel.app`. |
| `SITE_OWNER_JACE_ID` | no       | The Jace user id (the `sub` from userinfo) of the site owner. That account can take community games down and put them back, and sees reports. Without it nobody can. |

Put the same variables in Vercel → Project → Settings → Environment Variables. None of them use the `NEXT_PUBLIC_` prefix, so none reach the client bundle. `.env*` files are gitignored (except `.env.example`).

### Registering Jace Games in Jace

1. Sign in to https://jaceo.vercel.app as the **site owner** (this makes it an official app, which skips the consent screen and can use the `scores` scope).
2. Go to profile → Manage account → Developer and register an app named "Jace Games".
3. Add the redirect URIs, which must match exactly:
   - `https://<your-vercel-domain>/api/auth/callback`
   - `http://localhost:3000/api/auth/callback` (for local development)
4. Copy the client id and secret into `JACE_CLIENT_ID` and `JACE_CLIENT_SECRET`.

## How it works

### Sign in with Jace

Plain OAuth 2.0 authorization code flow (no OIDC):

1. `/api/auth/signin` stores a random `state` in a short-lived encrypted cookie and redirects to `GET /oauth/authorize?scope=profile scores`.
2. `/api/auth/callback` checks `state`, exchanges the code at `POST /api/oauth/token` with the client secret (on the server), and calls `GET /api/oauth/userinfo`.
3. The access token and profile go into one HTTP-only, AES-256-GCM-encrypted cookie (`jg_session`). See [`lib/session.ts`](lib/session.ts).

Every page load re-checks userinfo through `/api/session`. If Jace says `banned`, the person is signed out and sees "This Jace account is banned." A `401` from any Jace call also signs them out.

### Scores

- Every finished game is saved to `localStorage` first, with a UUID as its `external_id` ([`lib/localScores.ts`](lib/localScores.ts)).
- When signed in, pending scores go to `POST /api/scores`. The server validates each score against the game's `limits` (whole number, in range, and a plausible game length) before forwarding it to Jace's import endpoint. Because `external_id` makes the import idempotent, retries never create duplicates.
- Failed uploads stay pending and retry when the browser comes back online, when the tab becomes visible, and every minute ([`components/ScoresProvider.tsx`](components/ScoresProvider.tsx)).
- On sign-in, the player's Jace scores for every game (including old-site ones) are fetched and merged with local ones, deduplicated by id or by game, score and time.
- Scores played signed out are kept on the device. After signing in, the app offers to upload them to the Jace account.
- Leaderboards come from Jace (`/api/leaderboard` → `GET /api/oauth/leaderboard`, `order=asc` for lower-is-better games). Jace's API needs a user token, so signed-out players see their own device's best instead.

### Before Jace ships the scores API

The `scores` scope and the `/api/oauth/scores` and `/api/oauth/leaderboard` endpoints are a contract Jace hasn't shipped yet. Until it does, those calls return 404, the app shows "Sync with Jace is coming soon", and scores stay on the device as pending. They upload on their own once the endpoints are live. If someone signed in before Jace accepted the `scores` scope (Jace answers `403 insufficient_scope`), the app asks them to sign in again.

### Testing against a mock Jace

[`scripts/mock-jace.mjs`](scripts/mock-jace.mjs) implements the whole contract locally, with an account ("oldplayer") that already has old Snake and Memory Match scores:

```bash
node scripts/mock-jace.mjs
```

```bash
JACE_URL=http://localhost:4000 npm run dev
```

The mock's authorize endpoint signs you in straight away. Start it with `MOCK_SCORES=off` to behave like Jace today (scores endpoints return 404), or `MOCK_BANNED=1` to test the banned path.

## Game Studio

People make their own games at `/studio`, with a code editor (CodeMirror, HTML with inline JavaScript and CSS) or Scratch-style blocks (Blockly 13.3.0, the same version Jace Social's bot editor uses). Published games are listed at `/community`, and multiplayer ones can be played in rooms like the built-in games. Data lives in Supabase ([`supabase/migrations/002_studio.sql`](supabase/migrations/002_studio.sql)): row-level security on with no policies, so only the server (secret key) can read or write. Without Supabase, development falls back to memory.

- **Templates**: Dodge (arcade), Lights Out (puzzle), Cookie Rush (clicker), Paddle Duel (2 players, live) and Blank, in code. Dodge, Cookie Rush, a 2-player tap race and Blank also come as blocks.
- **Blocks** compile to JavaScript that runs on a small engine ([`lib/studio/blockRuntime.ts`](lib/studio/blockRuntime.ts)): a 480×360 canvas, emoji or shape sprites with position, size and speed, events (start, keys, taps, every frame, timers, messages), score and game over. "Convert to code" turns a blocks game into a code game (one way).
- **Versions**: every save that changes the code keeps a version (the last 30); the editor can restore any of them. Publishing copies the draft to what players get, so saving a draft never breaks the published game.
- **Moderation**: banned or muted Jace accounts can't publish (Jace's userinfo is asked again on every publish). Signed-in players can report a game; the site owner (`SITE_OWNER_JACE_ID`) sees reports on the game's page and can take it down.

### The game SDK

Every game gets `window.jace`:

| | |
| --- | --- |
| `jace.player.name` | Who's playing. |
| `jace.submitScore(n)` | A whole-number score, higher is better. Solo, the player's best goes on the game's leaderboard (labelled unverified). In a race, it's the player's live score. |
| `jace.gameOver()` | The round is over. In a race, the last submitted score becomes the result (none = did not finish). |
| `jace.onReady(cb)` | Calls `cb` once the page is ready. |
| `jace.seed`, `jace.random()` | A seed and a seeded random function; everyone in a room gets the same ones. |
| `jace.room` | `null` when playing alone. In a room: `mode` (`"race"` or `"live"`), `isHost`, `mySeat`, `players` (`{ seat, name, you, host }`). |
| `jace.room.send(event, data)` | Sends to the other players over the room's channel. |
| `jace.room.on(event, (data, fromSeat) => …)` | Hears them. Returns an unsubscribe function. |
| `jace.gameOver({ winners: [seat] })` | Live games: the host ends the game and names the winners. |

In **race** rooms everyone plays their own copy and the highest result wins. In **live** rooms the game shares its own state with `jace.room` (usually the host runs the game and sends it out); only the host's `gameOver` counts.

### Sandbox

Community games are untrusted code, so they run in `<iframe sandbox="allow-scripts allow-pointer-lock" srcdoc>` ([`components/studio/GameFrame.tsx`](components/studio/GameFrame.tsx)):

- No `allow-same-origin`: the game runs on an opaque origin, so `document.cookie`, `localStorage` and IndexedDB throw, and it can't touch this site's pages or cookies. No `allow-top-navigation`, `allow-popups`, `allow-forms` or `allow-modals`.
- The document starts with a Content-Security-Policy (`default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'`), so `fetch`, XHR, WebSocket, EventSource and loading anything from another site all fail. Images, sounds and fonts go in the game as `data:` URLs.
- The SDK talks to the page with `postMessage` only. The page accepts messages only when `event.source` is its own iframe, and checks every one: scores must be finite numbers (at most one a second); room messages need an event name matching `[A-Za-z0-9_:.-]{1,32}` and JSON data up to 8 KB, at most 20 a second.
- If a game navigates its frame to another page (which would leave the CSP behind), the page notices the second load and stops it.

### Limits

- 256 KB per game (HTML plus blocks), 60-character names, 500-character descriptions.
- 20 new games an hour and 100 games per person.
- Scores: whole numbers within ±1,000,000,000; 10 a minute per game per player (in-memory per server instance, a speed bump rather than a guarantee).
- 10 reports an hour per person, one per game.
- Plays are counted once per person per game every 30 minutes.
- Rooms for community games: 2 to 8 players.

## Scripts

- `npm run dev`: development server
- `npm run build`: production build
- `npm run lint`: ESLint
- `npm run typecheck`: TypeScript

## Links

[Jace](https://jaceo.vercel.app) · [Terms of Service](https://jaceo.vercel.app/forums/7b1b592b-ae13-4094-be3c-b18f95d1d347/7a9f0277-e85e-44f2-91da-353a1b3b3451) · [Privacy Policy](https://jaceo.vercel.app/forums/7b1b592b-ae13-4094-be3c-b18f95d1d347/3e462dc4-1734-400a-8ca6-66a80ff32ac7)
