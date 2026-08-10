export default async function handler(req, res) {
  const { endpoint } = req.query;
  if (!endpoint) {
    return res.status(400).json({ error: "Missing endpoint param" });
  }

  const response = await fetch(`https://v3.football.api-sports.io${endpoint}`, {
    headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY }
  });

  const data = await response.json();
  res.status(200).json(data);
}