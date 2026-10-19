// A local stand-in for Jace's OAuth + scores API, for testing sign-in and
// score sync before Jace ships the scores endpoints. Not used in production.
//
//   node scripts/mock-jace.mjs            # listens on http://localhost:4000
//   JACE_URL=http://localhost:4000 npm run dev
//
// /oauth/authorize signs you in as "oldplayer" immediately (no password).
// That account already has Snake and Memory Match scores "from the old Jace
// site". Set MOCK_SCORES=off to answer 404 for the scores endpoints, like
// Jace does today.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT || 4000);
const SCORES_ON = process.env.MOCK_SCORES !== "off";
const USER = { sub: "u-oldplayer", username: "oldplayer", picture: null, banned: process.env.MOCK_BANNED === "1", muted: false };
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
const externalIds = new Set();
const codes = new Set();
const TOKEN = "mock-access-token";

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
  const authed = req.headers.authorization === `Bearer ${TOKEN}`;
  console.log(req.method, url.pathname + url.search);

  if (url.pathname === "/oauth/authorize") {
    const code = randomUUID();
    codes.add(code);
    const back = new URL(url.searchParams.get("redirect_uri"));
    back.searchParams.set("code", code);
    back.searchParams.set("state", url.searchParams.get("state"));
    res.writeHead(302, { Location: back.toString() });
    return res.end();
  }
  if (url.pathname === "/api/oauth/token" && req.method === "POST") {
    const form = new URLSearchParams(await readBody(req));
    if (!codes.delete(form.get("code"))) return json(res, 400, { error: "invalid_grant" });
    return json(res, 200, { access_token: TOKEN, token_type: "Bearer", expires_in: 365 * 86400, scope: "profile scores" });
  }
  if (!authed) return json(res, 401, { error: "invalid_token" });
  if (url.pathname === "/api/oauth/userinfo") return json(res, 200, USER);
  if (!SCORES_ON) return json(res, 404, { error: "not_found" });

  if (url.pathname === "/api/oauth/scores" && req.method === "GET") {
    const game = url.searchParams.get("game");
    const mine = scores
      .filter((s) => s.user_id === USER.sub && (!game || s.game === game))
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
      scores.push({ id: randomUUID(), user_id: USER.sub, game: s.game, score: s.score, created_at: s.created_at });
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
    const people = [{ user_id: USER.sub, username: USER.username, picture: null }, ...OTHERS];
    const rows = [...bestBy.values()]
      .sort((a, b) => (asc ? a.score - b.score : b.score - a.score))
      .slice(0, limit)
      .map((s) => ({ ...people.find((p) => p.user_id === s.user_id), score: s.score, created_at: s.created_at }));
    return json(res, 200, { scores: rows });
  }
  json(res, 404, { error: "not_found" });
}).listen(PORT, () => console.log(`Mock Jace on http://localhost:${PORT} (scores ${SCORES_ON ? "on" : "off"})`));
