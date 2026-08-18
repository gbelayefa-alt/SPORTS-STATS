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
- Handling API rate limits (per-minute and daily) with request throttling and caching
- Securing an API key server-side using a Vercel Serverless Function, instead of exposing it in client-side code
- Building a multi-view single-page app with vanilla JavaScript (no frameworks)
- Designing clean, readable UI states for loading, errors, and empty results

## Technologies used
- HTML, CSS, JavaScript (vanilla, no frameworks)
- [API-Football](https://www.api-football.com/) by API-Sports
- Vercel (deployment + serverless function for API key security)

## Notes
- Free-tier API limits apply (100 requests/day, 10 requests/minute), so search results are cached client-side and requests are throttled to avoid hitting these limits during normal use.