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

### Multiplayer

Every game can be played with friends, in one of three ways:

| Mode | Games | How it works |
| ---- | ----- | ------------ |
| Race | 2048, Minesweeper, Word Guess, Typing, Reaction, Flappy, Breakout, Block Stacker (with garbage attacks) | Everyone plays the same seeded board at once, sees each other's live score, and the server ranks the results. Timed races count your score when time runs out. |
| Turns | Memory Match, Connect Four, Chess, Checkers, Battleship, Dots and Boxes, Draw & Guess | The server referees every move with a rules module in [`lib/multiplayer/rules`](lib/multiplayer/rules) and only sends each player what they may see. Also playable by passing one device around (except Draw & Guess). |
| Live | Pong, Snake (2–4 player arena) | The host's browser runs the game and broadcasts it about 30 times a second; the others send their input. |

Create a room with **Play with friends** on a game page, then share the link (`/r/<code>`), the code, or invite Jace Social friends from the lobby. Wins are kept per game (the "Most wins" leaderboards and the profile); they don't go to Jace's single-player leaderboards. Rooms expire after a day.

Every game page also has a **Fullscreen** button (or press F). Where the browser can't go fullscreen (iPhone), it covers the page instead.

### Adding a game

1. Add an entry to `GAMES` in [`lib/games.ts`](lib/games.ts): id, name, description, icon, `better` (`"higher"` or `"lower"`), how to format the score, `addedAt` (shows a "New" badge for a month), and `limits` for server-side validation.
2. Write the component in `components/games/`. It receives `{ onFinish(score, durationMs), best }` and calls `onFinish` once when a game ends.
3. Register it in [`components/games/index.ts`](components/games/index.ts).

For multiplayer, add `multiplayer: { mode, min, max }` to the entry. A race needs nothing else as long as the game uses `useGameRandom(seed)` for randomness and calls `onProgress`/`onFail`. A turn-based game needs a rules module (registered in [`lib/multiplayer/registry.ts`](lib/multiplayer/registry.ts), with tests in [`tests/rules.test.ts`](tests/rules.test.ts)) and a board in `components/multi`. A live game needs a component in [`components/multi/live.ts`](components/multi/live.ts).

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
| `SUPABASE_URL`       | yes*     | The Jace Games Supabase project URL. Rooms, match results and community games live there. |
| `SUPABASE_SECRET_KEY` | yes*    | That project's **secret** key (server only). |
| `NEXT_PUBLIC_SUPABASE_URL` | yes* | The same project URL, for Realtime in the browser. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes* | That project's **publishable** key, for Realtime in the browser. |
| `JACE_SOCIAL_URL`    | no       | Defaults to `https://jace-social.vercel.app`. |
| `JACE_SOCIAL_APP_KEY` | no      | Shared secret with Jace Social (its `JACE_GAMES_APP_KEY`). Without it, friend invites show "coming soon". |
| `CRON_SECRET`        | no       | Vercel sends it to the daily room cleanup cron; set it so nobody else can call that route. |
| `SITE_OWNER_JACE_ID` | no       | The Jace user id (the `sub` from userinfo) of the site owner. That account can take community games down and put them back, and sees reports. Without it nobody can. |

\* Required in production for multiplayer and the Game Studio. In development without them, rooms use an in-memory store and a local live relay ([`lib/realtime/devBus.ts`](lib/realtime/devBus.ts)), so everything can be tried locally.

Put the same variables in Vercel → Project → Settings → Environment Variables. Only the two `NEXT_PUBLIC_SUPABASE_*` values reach the browser, and both are safe to expose; every secret stays on the server. `.env*` files are gitignored (except `.env.example`).

### Setting up Supabase

1. Create a project named "jace-games" (Data API on, "Automatically expose new tables" off, automatic RLS on). Realtime's public channel access must be allowed, which is the default.
2. Run the SQL files in [`supabase/migrations`](supabase/migrations) in order (SQL editor, or `supabase db push`). Every table has row-level security on and no policies, so only the server's secret key can read or write.
3. Copy the project URL, publishable key and secret key into the env vars above.

Live channels are named with an unguessable per-room secret that only room members get. Anything that matters (moves, results, wins) goes through the server; the channels only carry "something changed" pings, live scores, drawing strokes and live game frames.

### Jace Social friends

The lobby lists your Jace Social friends and sends invites as Jace Social DMs, through Jace Social's server-to-server API (`/api/v1/integrations/games/{friends,invite,presence}`, see its README). Jace Games calls it from the server with the player's Jace token and `JACE_SOCIAL_APP_KEY`. While you're in a game, your friends see "Playing <game> on Jace Games".

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

The mock's authorize endpoint lets you pick one of two accounts, "oldplayer" or "friend". To be both at once, open the app on `localhost` in one tab and `127.0.0.1` in another (they keep separate cookies). The mock also stands in for Jace Social's friends API: set `JACE_SOCIAL_URL` to the mock and `JACE_SOCIAL_APP_KEY=dev-app-key`. Start it with `MOCK_SCORES=off` to behave like Jace before its scores API shipped (scores endpoints return 404), or `MOCK_BANNED=1` to test the banned path.

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
- `npm test`: tests for the turn-based rules modules

## Links

[Jace](https://jaceo.vercel.app) · [Terms of Service](https://jaceo.vercel.app/forums/7b1b592b-ae13-4094-be3c-b18f95d1d347/7a9f0277-e85e-44f2-91da-353a1b3b3451) · [Privacy Policy](https://jaceo.vercel.app/forums/7b1b592b-ae13-4094-be3c-b18f95d1d347/3e462dc4-1734-400a-8ca6-66a80ff32ac7)
