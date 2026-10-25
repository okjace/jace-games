// A local stand-in for Jace's OAuth + scores API, for testing sign-in and
// score sync before Jace ships the scores endpoints. Not used in production.
//
//   node scripts/mock-jace.mjs            # listens on http://localhost:4000
//   JACE_URL=http://localhost:4000 npm run dev
//
// /oauth/authorize shows a picker: sign in as "oldplayer" (who already has
// Snake and Memory Match scores "from the old Jace site") or "friend", a
// second account for trying multiplayer. No passwords. Open the app on
// localhost and 127.0.0.1 to be signed in as both at once. Set MOCK_SCORES=off to answer 404 for the scores endpoints, like
// Jace does today.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT || 4000);
const SCORES_ON = process.env.MOCK_SCORES !== "off";
const USER = { sub: "u-oldplayer", username: "oldplayer", picture: null, banned: process.env.MOCK_BANNED === "1", muted: false };
const FRIEND = { sub: "u-friend", username: "friend", picture: null, banned: false, muted: false };
const ACCOUNTS = { oldplayer: USER, friend: FRIEND };
const OTHERS = [
  { user_id: "u-ada", username: "ada", picture: null },
  { user_id: "u-linus", username: "linus", picture: null },
];
const scores = [
  { id: "old-1", user_id: USER.sub, game: "snake", score: 23, created_at: "2025-03-02T18:00:00.000Z" },
  { id: "old-2", user_id: USER.sub, game: "snake", score: 31, created_at: "2025-04-11T18:00:00.000Z" },
  { id: "old-3", user_id: USER.sub, game: "memory", score: 18, created_at: "2025-05-20T18:00:00.000Z" },
  { id: "o-1", user_id: "u-ada", game: "snake", score: 57, created_at: "2025-06-01T10:00:00.000Z" },
  { id: "o-2", user_id: "u-linus", game: "memory", score: 12, created_at: "2025-06-02T10:00:00.000Z" },
];
const invites = [];
const presence = {};
const SOCIAL_UUIDS = { "u-oldplayer": "00000000-0000-4000-8000-000000000001", "u-friend": "00000000-0000-4000-8000-000000000002" };
const friendCard = (a, extra = {}) => ({ uuid: SOCIAL_UUIDS[a.sub], name: a.username, handle: a.username, picture: null, status: "online", activity: null, jace_sub: a.sub, jace_username: a.username, ...extra });
const MC_ONLY = { uuid: "00000000-0000-4000-8000-00000000beef", name: "Steve", handle: "steve", picture: null, status: "offline", activity: null, jace_sub: null, jace_username: null };
const SOCIAL_FRIENDS = {
  "u-oldplayer": [friendCard(FRIEND), MC_ONLY],
  "u-friend": [friendCard(USER, { status: "idle" })],
};
const externalIds = new Set();
const codes = new Map(); // code -> account
const tokens = new Map([["mock-access-token", USER], ["mock-access-token-friend", FRIEND]]);

const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
  });

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const bearer = (req.headers.authorization || "").replace(/^Bearer /, "");
  const me = tokens.get(bearer) ?? null;
  const authed = !!me;
  console.log(req.method, url.pathname + url.search);

  if (url.pathname === "/oauth/authorize") {
    const as = url.searchParams.get("as");
    if (!as || !ACCOUNTS[as]) {
      const links = Object.keys(ACCOUNTS)
        .map((name) => {
          const u = new URL(url);
          u.searchParams.set("as", name);
          return `<p><a href="${u.pathname + u.search}" style="font-size:20px">Sign in as ${name}</a></p>`;
        })
        .join("");
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(`<!doctype html><title>Mock Jace</title><body style="font-family:sans-serif;padding:40px"><h1>Mock Jace</h1>${links}</body>`);
    }
    const code = randomUUID();
    codes.set(code, ACCOUNTS[as]);
    const back = new URL(url.searchParams.get("redirect_uri"));
    back.searchParams.set("code", code);
    back.searchParams.set("state", url.searchParams.get("state"));
    res.writeHead(302, { Location: back.toString() });
    return res.end();
  }
  if (url.pathname === "/api/oauth/token" && req.method === "POST") {
    const form = new URLSearchParams(await readBody(req));
    const account = codes.get(form.get("code"));
    if (!account) return json(res, 400, { error: "invalid_grant" });
    codes.delete(form.get("code"));
    const token = [...tokens].find(([, a]) => a === account)[0];
    return json(res, 200, { access_token: token, token_type: "Bearer", expires_in: 365 * 86400, scope: "profile scores" });
  }
  // Mock of Jace Social's Jace Games integration (jace_social/server
  // /api/v1/integrations/games): set JACE_SOCIAL_URL to this server and
  // JACE_SOCIAL_APP_KEY to "dev-app-key". GET /_invites lists what was sent.
  if (url.pathname === "/_invites") return json(res, 200, { invites, presence });
  if (url.pathname.startsWith("/api/v1/integrations/games/")) {
    if (req.headers["x-jace-app-key"] !== "dev-app-key") return json(res, 401, { error: "invalid_app_key" });
    if (!authed) return json(res, 401, { error: "invalid_token" });
    const what = url.pathname.split("/").pop();
    const friends = SOCIAL_FRIENDS[me.sub] ?? [];
    if (what === "friends") return json(res, 200, { linked: true, friends });
    const body = JSON.parse((await readBody(req)) || "{}");
    if (what === "invite") {
      if (!friends.some((f) => f.uuid === body.to)) return json(res, 403, { error: "not_friends" });
      if (!/^[A-Z0-9]{4,8}$/.test(body.code ?? "") || !/\/r\//.test(body.url ?? "")) return json(res, 400, { error: "invalid_request", error_description: "bad invite" });
      invites.push({ from: me.username, ...body, at: new Date().toISOString() });
      return json(res, 200, { ok: true });
    }
    if (what === "presence") {
      presence[me.username] = body.activity ?? null;
      return json(res, 200, { ok: true });
    }
  }
  if (!authed) return json(res, 401, { error: "invalid_token" });
  if (url.pathname === "/api/oauth/userinfo") return json(res, 200, me);
  if (!SCORES_ON) return json(res, 404, { error: "not_found" });

  if (url.pathname === "/api/oauth/scores" && req.method === "GET") {
    const game = url.searchParams.get("game");
    const mine = scores
      .filter((s) => s.user_id === me.sub && (!game || s.game === game))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(({ id, game, score, created_at }) => ({ id, game, score, created_at }));
    return json(res, 200, { scores: mine });
  }
  if (url.pathname === "/api/oauth/scores" && req.method === "POST") {
    const body = JSON.parse((await readBody(req)) || "{}");
    const list = body.scores ?? [{ game: body.game, score: body.score, created_at: new Date().toISOString() }];
    let imported = 0;
    let skipped = 0;
    for (const s of list) {
      if (s.external_id && externalIds.has(s.external_id)) {
        skipped++;
        continue;
      }
      if (s.external_id) externalIds.add(s.external_id);
      scores.push({ id: randomUUID(), user_id: me.sub, game: s.game, score: s.score, created_at: s.created_at });
      imported++;
    }
    return json(res, 200, { imported, skipped });
  }
  if (url.pathname === "/api/oauth/leaderboard") {
    const game = url.searchParams.get("game");
    const asc = url.searchParams.get("order") === "asc";
    const limit = Number(url.searchParams.get("limit") || 50);
    const bestBy = new Map();
    for (const s of scores.filter((x) => x.game === game)) {
      const prev = bestBy.get(s.user_id);
      if (!prev || (asc ? s.score < prev.score : s.score > prev.score)) bestBy.set(s.user_id, s);
    }
    const people = [
      { user_id: USER.sub, username: USER.username, picture: null },
      { user_id: FRIEND.sub, username: FRIEND.username, picture: null },
      ...OTHERS,
    ];
    const rows = [...bestBy.values()]
      .sort((a, b) => (asc ? a.score - b.score : b.score - a.score))
      .slice(0, limit)
      .map((s) => ({ ...people.find((p) => p.user_id === s.user_id), score: s.score, created_at: s.created_at }));
    return json(res, 200, { scores: rows });
  }
  json(res, 404, { error: "not_found" });
}).listen(PORT, () => console.log(`Mock Jace on http://localhost:${PORT} (scores ${SCORES_ON ? "on" : "off"})`));
