export default async function handler(req, res) {
  const { endpoint } = req.query;
  if (!endpoint) {
    return res.status(400).json({ error: "Missing endpoint param" });
  }

  const response = await fetch(`https://v3.football.api-sports.io${endpoint}`, {
    headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY }
  });

  const data = await response.json();

  // Forward the real status code so the frontend can tell a daily-limit
  // block (429) apart from a normal 200 response that contains a
  // per-minute rate limit message in its body.
  res.status(response.status).json(data);
}