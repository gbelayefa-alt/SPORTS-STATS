# KickStats

A football (soccer) player stats web app that pulls live data from an external API and displays player profiles, head-to-head comparisons, and league leaderboards.

**Live site:** https://sports-stats-pi.vercel.app

## How to use
- Search for a player using their last name and a season between 2022 and 2024
- View their profile and season stats broken down by competition
- Use H2H to compare two players' stats side by side for different seasons
- Pick a league from the dropdown to see the top 10 scorers and top 10 assists for a given season

## What this project practices
- Fetching and parsing JSON data from a real, external API
- Handling API rate limits (per-minute and daily) with a request throttle and a three-layer cache (see below)
- Securing an API key server-side using a Vercel Serverless Function, instead of exposing it in client-side code
- Building a multi-view single-page app with no frameworks
- Designing clean, readable UI states for loading, errors, and empty results

## Technologies used
- HTML, CSS, JavaScript (vanilla, no frameworks)
- [API-Football](https://www.api-football.com/) by API-Sports
- Vercel (deployment + serverless function for API key security)

## How I handle the API rate limits
The free API-Football plan allows 100 requests/day and 10 requests/minute, and a single player search checks 7 leagues, so a handful of searches could use up the whole day. I fixed that in layers:

1. **Browser cache (localStorage).** Every successful API response is saved with an expiry (7 days for real data, 1 hour for "no results", since finished seasons don't change). Each league lookup is cached on its own, so repeat searches cost 0 requests, a search cut off by a rate limit picks up where it stopped, and the main search and H2H share results. Errors and rate-limit messages are never cached. If localStorage is full or blocked, it prunes old entries or falls back to memory.
2. **Throttle.** All real requests go through a sliding 60-second window (max 9 per minute), so the app waits and shows a countdown instead of failing. Identical requests that are already in flight are shared.
3. **Edge cache (Vercel).** The serverless function sends `Cache-Control` headers on clean responses, so Vercel answers repeat requests from any visitor without touching the API quota. Errors are sent with `no-store`.

The serverless function also only forwards the three endpoints the app uses (`/players`, `/players/topscorers`, `/players/topassists`), so it can't be used as an open proxy for the API key.

## Notes
- Free-tier API limits apply (100 requests/day, 10 requests/minute) and the free plan only covers the 2022-2024 seasons.
