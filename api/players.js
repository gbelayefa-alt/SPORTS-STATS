// Vercel Serverless Function: proxies requests to API-Football so the API key
// stays server-side. It also sets CDN cache headers so a repeat request (from
// any visitor) is answered by Vercel instead of spending the free-tier quota.

const API_BASE = "https://v3.football.api-sports.io";

// Only the endpoints KickStats actually uses. Without an allowlist this
// function is an open proxy: anyone could spend the quota on any endpoint.
const ALLOWED_PATHS = new Set([
  "/players",
  "/players/topscorers",
  "/players/topassists"
]);

const CACHE_OK = "public, s-maxage=86400, stale-while-revalidate=604800"; // real data: 1 day
const CACHE_EMPTY = "public, s-maxage=3600";                              // "no results": 1 hour
const NO_CACHE = "no-store";                                              // errors are never cached

function hasApiErrors(data) {
  const errors = data && data.errors;
  if (!errors) return false;
  return Array.isArray(errors) ? errors.length > 0 : Object.keys(errors).length > 0;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { endpoint } = req.query;
  if (!endpoint || typeof endpoint !== "string") {
    return res.status(400).json({ error: "Missing endpoint param" });
  }

  // Resolve the endpoint against the API base and make sure it can't point
  // anywhere else (for example "@evil.com/..." or "//evil.com/...").
  let target;
  try {
    target = new URL(endpoint, API_BASE);
  } catch (err) {
    return res.status(400).json({ error: "Invalid endpoint" });
  }
  if (target.origin !== API_BASE || !ALLOWED_PATHS.has(target.pathname)) {
    return res.status(400).json({ error: "Endpoint not allowed" });
  }

  let response;
  let data;
  try {
    response = await fetch(`${API_BASE}${target.pathname}${target.search}`, {
      headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY }
    });
    data = await response.json();
  } catch (err) {
    res.setHeader("Cache-Control", NO_CACHE);
    return res.status(502).json({
      errors: { server: "Could not reach the football data service." },
      results: 0,
      response: []
    });
  }

  // Only cache clean responses. API-Football reports the per-minute limit as a
  // normal 200 with an "errors" object in the body, so check the body too.
  if (response.ok && !hasApiErrors(data)) {
    res.setHeader("Cache-Control", data.results > 0 ? CACHE_OK : CACHE_EMPTY);
  } else {
    res.setHeader("Cache-Control", NO_CACHE);
  }

  // Forward the real status code so the frontend can tell a daily-limit
  // block (429) apart from a normal 200 response that contains a
  // per-minute rate limit message in its body.
  res.status(response.status).json(data);
}
