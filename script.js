/* 
Author: Amanda Gbe
Date: August 2nd, 2026
Description: This is the JAVASCRIPT file for the SPORTS-STATS API website
*/

// ---------------------------------------------------------------------------
// API CACHING + THROTTLING
// The free API-Football plan allows 100 requests/day and 10 requests/minute,
// so every API response is cached (in localStorage, with an expiry) and every
// real network request goes through a sliding-window throttle. See fetchAPI().
// ---------------------------------------------------------------------------
const MIN_SEASON = 2022;  // the free plan only covers 2022-2024
const MAX_SEASON = 2024;

const CACHE_PREFIX = "kickstats:v1:";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // finished seasons don't change
const EMPTY_TTL_MS = 60 * 60 * 1000;          // "no results" expires sooner
const memoryCache = new Map();                // in-memory copy (also the fallback if localStorage is blocked)
const inFlight = new Map();                   // endpoint -> request in progress (stops double clicks double-spending)

const MAX_REQUESTS_PER_MINUTE = 9;            // free plan allows 10, keep one spare
const requestTimes = [];                      // timestamps of recent real requests

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function isValidSeason(value) {
  const n = Number(value);
  return /^\d{4}$/.test(value) && n >= MIN_SEASON && n <= MAX_SEASON;
}

function cacheKey(endpoint) {
  return CACHE_PREFIX + endpoint.toLowerCase();
}

function cacheGet(endpoint) {
  const key = cacheKey(endpoint);
  let entry = memoryCache.get(key);

  if (!entry) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) entry = JSON.parse(raw);
    } catch (err) {
      // localStorage blocked or the entry is corrupted: treat it as a cache miss
    }
  }

  if (!entry || Date.now() > entry.expires) {
    if (entry) cacheRemove(key);
    return null;
  }

  memoryCache.set(key, entry);
  return entry.data;
}

function cacheSet(endpoint, data, ttl) {
  const key = cacheKey(endpoint);
  const entry = { saved: Date.now(), expires: Date.now() + ttl, data };
  memoryCache.set(key, entry);

  const raw = JSON.stringify(entry);
  try {
    localStorage.setItem(key, raw);
  } catch (err) {
    // Most likely the storage quota is full: free some space and try once more
    pruneCache();
    try {
      localStorage.setItem(key, raw);
    } catch (err2) {
      // Still no room: the in-memory copy still works until the page is refreshed
    }
  }
}

function cacheRemove(key) {
  memoryCache.delete(key);
  try {
    localStorage.removeItem(key);
  } catch (err) {
    // ignore
  }
}

// Frees localStorage space: drops expired entries, or the oldest quarter if none expired
function pruneCache() {
  const entries = [];
  const now = Date.now();

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(CACHE_PREFIX)) continue;
      try {
        const entry = JSON.parse(localStorage.getItem(key));
        entries.push({ key, saved: entry.saved, expired: now > entry.expires });
      } catch (err) {
        entries.push({ key, saved: 0, expired: true }); // corrupted entry
      }
    }
  } catch (err) {
    return;
  }

  const expired = entries.filter(e => e.expired);
  expired.forEach(e => cacheRemove(e.key));

  if (expired.length === 0) {
    entries.sort((a, b) => a.saved - b.saved);
    entries
      .slice(0, Math.max(1, Math.ceil(entries.length / 4)))
      .forEach(e => cacheRemove(e.key));
  }
}

// Waits until a request slot is free (sliding 60-second window) and returns
// the timestamp it reserved. onWait(seconds) is called while waiting, and
// onWait(0) once the wait is over.
async function reserveRequestSlot(onWait) {
  let waited = false;

  while (true) {
    const now = Date.now();
    while (requestTimes.length && now - requestTimes[0] >= 60000) requestTimes.shift();

    if (requestTimes.length < MAX_REQUESTS_PER_MINUTE) {
      requestTimes.push(now);
      if (waited && onWait) onWait(0);
      return now;
    }

    waited = true;
    const waitMs = 60000 - (now - requestTimes[0]) + 50;
    if (onWait) onWait(Math.ceil(waitMs / 1000));
    await sleep(Math.min(waitMs, 1000));
  }
}

// Gives a slot back (used when a request never reached the API after all)
function releaseRequestSlot(stamp) {
  const i = requestTimes.indexOf(stamp);
  if (i !== -1) requestTimes.splice(i, 1);
}

// Builds an onWait callback that shows a countdown inside `el` while the
// throttle is waiting, then puts the normal message back.
function waitNotice(el, normalHTML, format = (msg) => msg) {
  return (secs) => {
    el.innerHTML = secs > 0
      ? format(`Free API limit reached. Continuing in ${secs}s...`)
      : normalHTML;
  };
}

//SLIDESHOW
const slides = document.querySelectorAll(".slide");
const dots = document.querySelectorAll(".dot");
let currentSlide = 0;

function goToSlide(index) {
    slides[currentSlide].classList.remove("active");
    dots[currentSlide].classList.remove("active");
    currentSlide = index;
    slides[currentSlide].classList.add("active");
    dots[currentSlide].classList.add("active");
}

// Clicking a dot navigates to the corresponding slide
dots.forEach(dot => {
    dot.addEventListener("click", () => {
        goToSlide(parseInt(dot.dataset.index));
    });
});

//Auto-advance slides every 4 seconds
setInterval(() => {
    const next = (currentSlide + 1) % slides.length;
    goToSlide(next);
}, 4000);

//VIEW SWITCHING
const views = {
    home: document.getElementById("home-view"),
    player: document.getElementById("player-view"),
    compare: document.getElementById("compare-view"),
    league: document.getElementById("league-view")
};

function showView(viewName) {
    Object.values(views).forEach(v => v.classList.add("hidden"));
    views[viewName].classList.remove("hidden");
}

//Logo click -> home 
document.getElementById("nav-logo").addEventListener("click", () => {
    showView("home");
});

//Compare button -> compare view 
document.getElementById("compare-btn").addEventListener("click", () => {
    showView("compare");
});

//League dropdown toggle
const leagueBtn = document.getElementById("league-btn");
const leagueMenu = document.getElementById("league-menu");

leagueBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent the click from bubbling up to the document
    leagueMenu.classList.toggle("hidden");
});

// Close dropdown if clicking anywhere else 
//document.addEventListener("click", () => {
    //leagueMenu.classList.add("hidden"); });

//League item click -> league view
document.querySelectorAll("#league-menu li").forEach(item => {
    item.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent the click from bubbling up to the document
        selectedLeagueId = item.dataset.league;
        selectedLeagueName = item.textContent;
        leagueMenu.classList.add("hidden");
        showView("league");
        loadLeagueHeader();
    });
});

let selectedLeagueId = null;
let selectedLeagueName = "";

//SEARCH 
function normalizeQuery(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

document.getElementById("search-btn").addEventListener("click", handleSearch);
document.getElementById("search-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSearch();
});

async function handleSearch() {
  const rawQuery = document.getElementById("search-input").value.trim();
  const season = document.getElementById("season-input").value.trim();
  if (!season) {
    document.getElementById("player-info-bar").innerHTML =
      `<div class="error-msg">Please enter a season between ${MIN_SEASON} and ${MAX_SEASON} before searching.</div>`;
    showView("player");
    return;
  }
  if (!rawQuery) return;

  if (!isValidSeason(season)) {
    document.getElementById("player-info-bar").innerHTML =
      `<div class="error-msg">Please enter a season between ${MIN_SEASON} and ${MAX_SEASON}.</div>`;
    showView("player");
    return;
  }

  const seasonNum = parseInt(season);

  const searchBtn = document.getElementById("search-btn");
  searchBtn.disabled = true;

  try {
    await runSearch(rawQuery, season, seasonNum);
  } finally {
    searchBtn.disabled = false;
  }
}

async function runSearch(rawQuery, season, seasonNum) {
  const query = normalizeQuery(rawQuery);
  const infoBar = document.getElementById("player-info-bar");

  // Show loading state
  const searchingHTML = `<div class="loading">Searching for "${rawQuery}"...</div>`;
  infoBar.innerHTML = searchingHTML;
  document.getElementById("player-stats").innerHTML = "";
  showView("player");

  // Shows a countdown if the throttle has to wait for a free API slot
  const onWait = waitNotice(infoBar, searchingHTML, (msg) => `<div class="loading">${msg}</div>`);

  // API-Football search works best with a league specified
  // Try top leagues in sequence until we find the player
  const leaguesToTry = [
    39,   // Premier League
    140,  // La Liga
    78,   // Bundesliga
    135,  // Serie A
    61,   // Ligue 1
    253,  // MLS
    307,  // Saudi Pro League
  ];

  //Collect all matching players across leagues
  // Each league lookup is cached on its own (see fetchAPI), so a repeat search
  // costs no API requests, and a search that was cut off by a rate limit picks
  // up where it stopped instead of starting over.
  const allPlayers = [];
  const seenIds = new Set();

  for (const leagueId of leaguesToTry) {
    try {
      const playerData = await fetchAPI(
        `/players?search=${encodeURIComponent(query)}&league=${leagueId}&season=${season}`,
        { onWait }
      );

      const errorMsg = getApiErrorMessage(playerData);
      if (errorMsg) {
        infoBar.innerHTML = `<div class="error-msg">${errorMsg}</div>`;
        return;
      }

      if (playerData.results > 0) {
        playerData.response.forEach(item => {
          if (!seenIds.has(item.player.id)) {
              seenIds.add(item.player.id);
              allPlayers.push(item);
          }
        });
      }

      // Small delay between real requests (skipped when the answer came from a cache)
      if (!playerData.__fromCache) await sleep(300);

    } catch (err) {
      infoBar.innerHTML =
        `<div class="error-msg">Connection error. Check your internet and try again.</div>`;
      return;
    }
  }

  //If only one result load directly
  if (allPlayers.length === 1) {
    try {
      const playerId = allPlayers[0].player.id;
      const fullData = await fetchAPI(`/players?id=${playerId}&season=${season}`, { onWait });

      const errorMsg = getApiErrorMessage(fullData);
      if (errorMsg) {
        infoBar.innerHTML = `<div class="error-msg">${errorMsg}</div>`;
        return;
      }

      displayPlayerStats(fullData.results > 0 ? fullData.response[0] : allPlayers[0], season);
    } catch (err) {
      infoBar.innerHTML =
        `<div class="error-msg">Connection error. Check your internet and try again.</div>`;
    }
    return;
  }

  //Multiple results shows dropdown
  if (allPlayers.length > 1) {
    showDropdown(allPlayers, season);
    infoBar.innerHTML =
      `<div class="loading">Select a player from the dropdown.</div>`;
    return;
  }

  // Nothing found anywhere
  infoBar.innerHTML =
      `<div class="error-msg">
        No results found for "${rawQuery}" in the ${season}/${seasonNum + 1} season.<br><br>
        Tips: Check the spelling. Use just the player's last name. Season must be between ${MIN_SEASON}-${MAX_SEASON}
      </div>`;
}

//SEARCH DROPDOWN 
function showDropdown (players, season) {
  const dropdown = document.getElementById("search-dropdown");

  dropdown.innerHTML = players.map(item => { 
    const p = item.player;
    const club = item.statistics[0]?.team?.name || "Unknown club";
    return `
    <div class="dropdown-item" data-id="${p.id}">
      <img src="${p.photo}" alt="${p.name}"
        onerror="this.src='img/placeholder.webp'" />
      <div class="dropdown-item-info">
        <span class="dropdown-item-name">${p.name}</span>
        <span class="dropdown-item-club">${club}</span>
      </div>
    </div>
    `;
  }).join("");

  dropdown.classList.remove("hidden");

  //Click player from dropdown 
  dropdown.querySelectorAll(".dropdown-item").forEach(item => {
    item.addEventListener("click", async () => {
      dropdown.classList.add("hidden");
      const playerId = item.dataset.id;
      const season = document.getElementById("season-input").value.trim();
      const infoBar = document.getElementById("player-info-bar");

      const loadingHTML = `<div class="loading">Loading player stats...</div>`;
      infoBar.innerHTML = loadingHTML;
      document.getElementById("player-stats").innerHTML = "";

      try {
        const data = await fetchAPI(`/players?id=${playerId}&season=${season}`, {
          onWait: waitNotice(infoBar, loadingHTML, (msg) => `<div class="loading">${msg}</div>`)
        });

        const errorMsg = getApiErrorMessage(data);
        if (errorMsg) {
          infoBar.innerHTML = `<div class="error-msg">${errorMsg}</div>`;
          return;
        }

        if (data.results > 0) {
          displayPlayerStats(data.response[0], season);
        } else {
          infoBar.innerHTML =
            `<div class="error-msg">Stats not available for this player in ${season}. </div>`;
        }
      } catch (err) {
        infoBar.innerHTML =
          `<div class="error-msg">Connection error. Check your internet and try again.</div>`;
      }
    });
  });
}

//Close dropdown when clicking outside 
document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("search-dropdown");
  const wrapper = document.getElementById("search-wrapper");
  if (wrapper && !wrapper.contains(e.target)) {
    dropdown.classList.add("hidden");
  }
  leagueMenu.classList.add("hidden");
});

//API HELPER
// Lookup order for every call: 1) cache  2) identical request already running
// 3) real network request (throttled). Only clean responses are cached, never
// errors or rate-limit messages. Responses carry two extra fields for the
// callers: __httpStatus, and __fromCache (true if no API request was spent).
async function fetchAPI(endpoint, opts = {}) {
  const cached = cacheGet(endpoint);
  if (cached) {
    return { ...cached, __httpStatus: 200, __fromCache: true };
  }

  if (inFlight.has(endpoint)) {
    const shared = await inFlight.get(endpoint);
    return { ...shared, __fromCache: true };
  }

  const request = fetchFromNetwork(endpoint, opts).finally(() => inFlight.delete(endpoint));
  inFlight.set(endpoint, request);
  return request;
}

async function fetchFromNetwork(endpoint, opts) {
  const slot = await reserveRequestSlot(opts.onWait);

  let response;
  try {
    response = await fetch(`/api/players?endpoint=${encodeURIComponent(endpoint)}`, {
      method: "GET"
    });
  } catch (err) {
    releaseRequestSlot(slot); // never reached the API, so don't count it
    throw err;
  }

  // If Vercel's CDN answered, the request didn't count against the API quota
  const cdnStatus = response.headers.get("x-vercel-cache");
  const servedByCdn = cdnStatus === "HIT" || cdnStatus === "STALE";
  if (servedByCdn) releaseRequestSlot(slot);

  let data;
  try {
    data = await response.json();
  } catch (err) {
    data = { errors: { server: "Invalid response" }, results: 0, response: [] };
  }
  data.__httpStatus = response.status;
  data.__fromCache = servedByCdn;

  if (getApiErrorMessage(data) === null && Array.isArray(data.response)) {
    const { __httpStatus, __fromCache, ...clean } = data;
    cacheSet(endpoint, clean, data.results > 0 ? CACHE_TTL_MS : EMPTY_TTL_MS);
  }

  return data;
}

// Returns a user-facing message if the response is an error (rate limit, plan
// limit, server problem), or null if it's fine
function getApiErrorMessage(data) {
  const status = data.__httpStatus;
  const errors = data.errors || {};
  const keys = Array.isArray(errors) ? [] : Object.keys(errors);
  const hasErrors = Array.isArray(errors) ? errors.length > 0 : keys.length > 0;

  if (status === 429 || keys.includes("requests")) {
    return "You've reached your daily limit. Please try again tomorrow.";
  }
  if (keys.includes("rateLimit")) {
    return "You've reached your limit per minute. Please try again in a moment.";
  }
  if (keys.includes("plan")) {
    return `The free API plan only covers seasons ${MIN_SEASON} to ${MAX_SEASON}.`;
  }
  if (hasErrors || status >= 400) {
    return "Something went wrong getting the data. Please try again in a moment.";
  }
  return null;
}

// PLAYER STATS
function displayPlayerStats(playerObj, season) {
  const p = playerObj.player;
  const stats = playerObj.statistics;

  // Clear the search bar so the next search doesn't require deleting the old query
  document.getElementById("search-input").value = "";
  document.getElementById("season-input").value = "";

  const seasonLabel = `${season}/${String(parseInt(season) + 1).slice(-2)}`;

  //----INFO BAR ---
  const countryCode = getCountryCode(p.nationality);

  document.getElementById("player-info-bar").innerHTML = `
    <div id="player-info">
      <div class="player-info-photo">
          <img
            src="${p.photo}"
            alt="${p.name}"
            onerror="this.src='img/placeholder.webp'"
          />
      </div>

      <div class="player-info-details">
        <div class="player-info-name">${p.name}</div>
        <div class="player-info-meta">
          <span> 
            <img src="https://flagcdn.com/16x12/${countryCode}.png"
            onerror="this.style.display='none'" />
            ${p.nationality}
          </span>
          <span>Date of Birth: ${p.birth?.date || "N/A"}</span>
          <span>Age: ${p.age || "N/A"}</span>
          <span>Weight: ${p.weight || "N/A"}</span>
          <span>Height: ${p.height || "N/A"}</span>
          <span>Position: ${stats[0]?.games?.position || "N/A"}</span>
        </div>
        <div class="player-info-season">Season: ${seasonLabel}</div>
      </div>
    </div>
    `;

    //---STATS PER COMPETITION---
    if (!stats || stats.length == 0) {
      document.getElementById("player-stats").innerHTML = 
        `<div class="error-msg">No stats available for ${p.name} in the ${seasonLabel} season.</div>`;
      return;
    }

    const statsHTML = stats.map(s => {
      const goals = s.goals?.total ?? 0; 
      const assists = s.goals?.assists ?? 0;
      const apps = s.games?.appearences ?? 0;
      const minutes = s.games?.minutes ?? 0;
      const rating = s.games?.rating ? parseFloat(s.games.rating).toFixed(1) : "N/A";
      const yellowCards = s.cards?.yellow ?? 0;
      const redCards = s.cards?.red ?? 0;
      const shots = s.shots?.total ?? 0;
      const shotsOn = s.shots?.on ?? 0;
      const passes = s.passes?.total ?? 0;
      const foulsCommitted = s.fouls?.committed ?? 0;
      const foulsDrawn = s.fouls?.drawn ?? 0;
      const tackles = s.tackles?.total ?? 0;

      const dribbles = s.dribbles?.success ?? 0;

      return `
        <div class="stats-competition">
          <div class="stats-comp-header">
            <img 
            src="${s.league?.logo}"
            alt="${s.league?.name}"
            class="stats-comp-logo"
            onerror="this.style.display='none'" 
          />
          <div>
            <div class="stats-comp-name">${s.league?.name || "Unknown League"}</div>
            <div class="stats-comp-country">${s.league?.country || ""} . ${s.team?.name || ""}</div>
          </div>
        </div>
        
        <div class="stats-grid">
          <div class="stat-box">
            <span class="stat-value">${apps}</span>
            <span class="stat-label">Appearances</span>
          </div>
          <div class="stat-box">
            <span class="stat-value">${minutes}</span>
            <span class="stat-label">Minutes</span>
          </div>
          <div class="stat-box">
            <span class="stat-value">${goals}</span>
            <span class="stat-label">Goals</span>
          </div>
          <div class="stat-box">
            <span class="stat-value">${assists}</span>
            <span class="stat-label">Assists</span>
          </div>
          <div class="stat-box">
            <span class="stat-value">${rating}</span>
            <span class="stat-label">Rating</span>
          </div>
          <div class="stat-box">
            <span class="stat-value">${shots}</span>
            <span class="stat-label">Shots</span>
          </div>
          <div class="stat-box">
            <span class="stat-value">${shotsOn}</span>
            <span class="stat-label">Shots On Target</span>
          </div>
          <div class="stat-box">
            <span class="stat-value">${passes}</span>
            <span class="stat-label">Passes</span>
          </div>
          <div class="stat-box">
            <span class="stat-value">${foulsCommitted}</span>
            <span class="stat-label">Fouls Committed</span>
          </div>
          <div class="stat-box">
            <span class="stat-value">${foulsDrawn}</span>
            <span class="stat-label">Fouls Drawn</span>
          </div>
          <div class="stat-box">
            <span class="stat-value">${dribbles}</span>
            <span class="stat-label">Successful Dribbles</span>
          </div>
          <div class="stat-box">
            <span class="stat-value">${tackles}</span>
            <span class="stat-label">Tackles</span>
          </div>
          <div class="stat-box">
            <span class="stat-value" style="color:#f5c518">${yellowCards}</span>
            <span class="stat-label">Yellow Cards</span>
          </div>
          <div class="stat-box">
            <span class="stat-value" style="color:var(--red)">${redCards}</span>
            <span class="stat-label">Red Cards</span>
          </div>
        </div> 
      </div>
    `;       
    }).join("");

  document.getElementById("player-stats").innerHTML = statsHTML;
}

//LEAGUE PAGE 
function loadLeagueHeader() {
  document.getElementById("league-header").innerHTML = `
    <h2>${selectedLeagueName}</h2>
  `;
  document.getElementById("top-scorers").innerHTML = "";
  document.getElementById("top-assists").innerHTML = "";
}

document.getElementById("league-season-btn").addEventListener("click", loadLeagueStats);

async function loadLeagueStats() {
  const season = document.getElementById("league-season-input").value.trim();
  const scorersEl = document.getElementById("top-scorers");
  const assistsEl = document.getElementById("top-assists");

  if (!selectedLeagueId) return;

  if (!season) {
    scorersEl.innerHTML = `<div class="error-msg">Please enter a season.</div>`;
    assistsEl.innerHTML = "";
    return;
  }

  if (!isValidSeason(season)) {
    scorersEl.innerHTML = `<div class="error-msg">Please enter a season between ${MIN_SEASON} and ${MAX_SEASON}.</div>`;
    assistsEl.innerHTML = "";
    return;
  }

  const loadingHTML = (title, text) =>
    `<div class="league-list-title">${title}</div><div class="loading">${text}</div>`;

  scorersEl.innerHTML = loadingHTML("Top Scorers", "Loading top scorers...");
  assistsEl.innerHTML = loadingHTML("Top Assists", "Loading top assists...");

  try {
    const scorersData = await fetchAPI(
      `/players/topscorers?league=${selectedLeagueId}&season=${season}`,
      {
        onWait: waitNotice(
          scorersEl,
          loadingHTML("Top Scorers", "Loading top scorers..."),
          (msg) => loadingHTML("Top Scorers", msg)
        )
      }
    );

    const scorersErrorMsg = getApiErrorMessage(scorersData);
    if (scorersErrorMsg) {
      scorersEl.innerHTML = `<div class="league-list-title">Top Scorers</div>
        <div class="error-msg">${scorersErrorMsg}</div>`;
      assistsEl.innerHTML = "";
      return;
    }

    renderLeagueList(scorersEl, "Top Scorers", scorersData.response, "goals");

    // Small delay before the second request to stay under the per-minute limit
    // (skipped when the first answer came from a cache)
    if (!scorersData.__fromCache) await sleep(400);

    const assistsData = await fetchAPI(
      `/players/topassists?league=${selectedLeagueId}&season=${season}`,
      {
        onWait: waitNotice(
          assistsEl,
          loadingHTML("Top Assists", "Loading top assists..."),
          (msg) => loadingHTML("Top Assists", msg)
        )
      }
    );

    const assistsErrorMsg = getApiErrorMessage(assistsData);
    if (assistsErrorMsg) {
      assistsEl.innerHTML = `<div class="league-list-title">Top Assists</div>
        <div class="error-msg">${assistsErrorMsg}</div>`;
      return;
    }

    renderLeagueList(assistsEl, "Top Assists", assistsData.response, "assists");

    if (selectedLeagueId && scorersData.response.length > 0) {
      const leagueLogo = scorersData.response[0].statistics[0].league.logo;
      document.getElementById("league-header").innerHTML = `
        <img src="${leagueLogo}" alt="${selectedLeagueName} logo">
        <h2>${selectedLeagueName}</h2>
      `;
    }

  } catch (err) {
    scorersEl.innerHTML = `<div class="error-msg">Connection error. Check your internet and try again.</div>`;
    assistsEl.innerHTML = "";
  }
}

function renderLeagueList(container, title, players, statType) {
  if (!players || players.length === 0) {
    container.innerHTML = `<div class="league-list-title">${title}</div>
      <div class="error-msg">No data found for this season.</div>`;
    return;
  }

  const rows = players.slice(0, 10).map(item => {
    const p = item.player;
    const stats = item.statistics[0];
    const statValue = statType === "goals"
      ? (stats.goals.total ?? 0)
      : (stats.goals.assists ?? 0);

    return `
      <div class="league-player-row">
        <img src="${p.photo}" alt="${p.name}">
        <div class="league-player-info">
          <div class="league-player-name">${p.name}</div>
          <div class="league-player-team">${stats.team.name}</div>
        </div>
        <div class="league-player-stat">${statValue}</div>
      </div>
    `;
  }).join("");

  container.innerHTML = `<div class="league-list-title">${title}</div>${rows}`;
}



// COUNTRY CODE HELPER
function getCountryCode(nationality) {
    const map = {
        "Argentina": "ar", "Brazil": "br", "France": "fr", "England": "gb-eng",
        "Spain": "es", "Germany": "de", "Portugal": "pt", "Netherlands": "nl",
        "Belgium": "be", "Italy": "it", "Morocco": "ma", "Nigeria": "ng",
        "Senegal": "sn", "Ghana": "gh", "Egypt": "eg", "Ivory Coast": "ci",
        "Croatia": "hr", "Poland": "pl", "Uruguay": "uy", "Colombia": "co",
        "Mexico": "mx", "USA": "us", "Japan": "jp", "South Korea": "kr",
        "Denmark": "dk", "Sweden": "se", "Norway": "no", "Switzerland": "ch",
        "Austria": "at", "Turkey": "tr", "Serbia": "rs", "Algeria": "dz",
        "Cameroon": "cm", "Mali": "ml", "Guinea": "gn", "Canada": "ca"
    };
    return map[nationality] || "un";
}

//H2H COMPARE
let playerAData = null;
let playerBData = null;
let seasonA = null;
let seasonB = null;

document.getElementById("search-a-btn").addEventListener("click", () => handleCompareSearch("a"));
document.getElementById("search-b-btn").addEventListener("click", () => handleCompareSearch("b"));

async function handleCompareSearch(side) {
  const inputId = side === "a" ? "player-a-input" : "player-b-input";
  const seasonId = side === "a" ? "season-a-input" : "season-b-input";
  const dropdownId = side === "a" ? "dropdown-a" : "dropdown-b";
  const status = document.getElementById("compare-status");

  const rawQuery = document.getElementById(inputId).value.trim();
  const season = document.getElementById(seasonId).value.trim();

  if (!rawQuery) return;

  if (!season) {
    status.innerHTML =
      `<span style="color:var(--red)">Please enter a season for Player ${side.toUpperCase()}.</span>`;
    return;
  }

  if (!isValidSeason(season)) {
    status.innerHTML =
      `<span style="color:var(--red)">Season must be between ${MIN_SEASON} and ${MAX_SEASON}.</span>`;
    return;
  }

  const query = normalizeQuery(rawQuery);
  const searchingMsg = `Searching for Player ${side.toUpperCase()}...`;
  status.innerHTML = searchingMsg;
  const onWait = waitNotice(status, searchingMsg);

  const leaguesToTry = [39, 140, 78, 135, 61];
  const allPlayers = [];
  const seenIds = new Set();

  // These are the same per-league lookups the main search makes, so anything
  // already searched there is served from the cache here (and vice versa).
  for (const leagueId of leaguesToTry) {
    try {
      const data = await fetchAPI(
        `/players?search=${encodeURIComponent(query)}&league=${leagueId}&season=${season}`,
        { onWait }
      );
      const errorMsg = getApiErrorMessage(data);
      if (errorMsg) {
        status.innerHTML = `<span style="color:var(--red)">${errorMsg}</span>`;
        return;
      }
      if (data.results > 0) {
        data.response.forEach(item => {
          if (!seenIds.has(item.player.id)) {
            seenIds.add(item.player.id);
            allPlayers.push(item);
          }
        });
      }

      // Small delay between real requests (skipped when the answer came from a cache)
      if (!data.__fromCache) await sleep(300);
    } catch (err) {
      status.innerHTML =
        `<span style="color:var(--red)">Connection error. Check your internet and try again.</span>`;
      return;
    }
  }

  if (allPlayers.length === 0) {
    status.innerHTML =
      `<span style="color:var(--red)">No results for "${rawQuery}". Try just the last name or initials like L. Messi.</span>`;
    return;
  }

  if (allPlayers.length === 1) {
    // Load the full profile (like the main search does) so the totals cover
    // every competition, not just the league the search happened to match
    try {
      const fullData = await fetchAPI(`/players?id=${allPlayers[0].player.id}&season=${season}`, { onWait });
      const errorMsg = getApiErrorMessage(fullData);
      if (errorMsg) {
        status.innerHTML = `<span style="color:var(--red)">${errorMsg}</span>`;
        return;
      }
      await selectComparePlayer(side, fullData.results > 0 ? fullData.response[0] : allPlayers[0], season);
    } catch (err) {
      status.innerHTML =
        `<span style="color:var(--red)">Connection error. Check your internet and try again.</span>`;
    }
    return;
  }

  showCompareDropdown(side, allPlayers, season, dropdownId);
  status.innerHTML =
    `Select Player ${side.toUpperCase()} from the dropdown.`;
}

function showCompareDropdown(side, players, season, dropdownId) {
  const dropdown = document.getElementById(dropdownId);

  dropdown.innerHTML = players.map(item => {
    const p = item.player;
    const club = item.statistics[0]?.team?.name || "Unknown club";
    return `
      <div class="dropdown-item" data-id="${p.id}">
        <img src="${p.photo}" alt="${p.name}"
             onerror="this.src='img/placeholder.webp'" />
        <div class="dropdown-item-info">
          <span class="dropdown-item-name">${p.name}</span>
          <span class="dropdown-item-club">${club}</span>
        </div>
      </div>
    `;
  }).join("");

  dropdown.classList.remove("hidden");

  dropdown.querySelectorAll(".dropdown-item").forEach(item => {
    item.addEventListener("click", async () => {
      dropdown.classList.add("hidden");
      const playerId = item.dataset.id;
      const chosen = players.find(p => p.player.id == playerId);
      const status = document.getElementById("compare-status");

      const loadingMsg = `Loading Player ${side.toUpperCase()}...`;
      status.innerHTML = loadingMsg;

      try {
        const data = await fetchAPI(`/players?id=${playerId}&season=${season}`, {
          onWait: waitNotice(status, loadingMsg)
        });

        const errorMsg = getApiErrorMessage(data);
        if (errorMsg) {
          status.innerHTML = `<span style="color:var(--red)">${errorMsg}</span>`;
          return;
        }

        const finalData = data.results > 0 ? data.response[0] : chosen;
        await selectComparePlayer(side, finalData, season);
      } catch (err) {
        status.innerHTML =
          `<span style="color:var(--red)">Connection error. Check your internet and try again.</span>`;
      }
    });
  });
}

async function selectComparePlayer(side, playerObj, season) {
  if (side === "a") {
    playerAData = playerObj;
    seasonA = season;
  } else {
    playerBData = playerObj;
    seasonB = season;
  }

  renderCompareBanner(side, playerObj, season);

  document.getElementById("compare-status").innerHTML =
    playerAData && playerBData
      ? ""
      : `Player ${side.toUpperCase()} loaded. Now search Player ${side === "a" ? "B" : "A"}.`;

  if (playerAData && playerBData) {
    buildH2HTable();
  }
}

function renderCompareBanner(side, playerObj, season) {
  const p = playerObj.player;
  const club = playerObj.statistics[0]?.team?.name || "Unknown";
  const seasonLabel = `${season}/${String(parseInt(season) + 1).slice(-2)}`;

  document.getElementById(`banner-${side}`).innerHTML = `
    <img src="${p.photo}" alt="${p.name}"
         onerror="this.src='img/placeholder.webp'" />
    <div class="banner-info">
      <div class="banner-name">${p.name}</div>
      <div class="banner-club">${club}</div>
      <div class="banner-season">Season: ${seasonLabel}</div>
    </div>
  `;

  document.getElementById("compare-banners").classList.remove("hidden");
}

function buildH2HTable() {
  const statsA = playerAData.statistics;
  const statsB = playerBData.statistics;

  // Aggregate totals across all competitions
  const total = (stats, key) => stats.reduce((sum, s) => {
    const keys = key.split(".");
    let val = s;
    for (const k of keys) val = val?.[k];
    return sum + (val ?? 0);
  }, 0);

  const avgRating = (stats) => {
    const ratings = stats
      .filter(s => s.games?.rating)
      .map(s => parseFloat(s.games.rating));
    if (ratings.length === 0) return "N/A";
    return (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
  };

  const metrics = [
    { label: "Appearances", a: total(statsA, "games.appearences"), b: total(statsB, "games.appearences") },
    { label: "Minutes", a: total(statsA, "games.minutes"), b: total(statsB, "games.minutes") },
    { label: "Goals", a: total(statsA, "goals.total"), b: total(statsB, "goals.total") },
    { label: "Assists", a: total(statsA, "goals.assists"), b: total(statsB, "goals.assists") },
    { label: "Avg Rating", a: avgRating(statsA), b: avgRating(statsB), noCompare: true },
    { label: "Shots", a: total(statsA, "shots.total"), b: total(statsB, "shots.total") },
    { label: "Shots on Target", a: total(statsA, "shots.on"), b: total(statsB, "shots.on") },
    { label: "Passes", a: total(statsA, "passes.total"), b: total(statsB, "passes.total") },
    { label: "Dribbles", a: total(statsA, "dribbles.success"), b: total(statsB, "dribbles.success") },
    { label: "Tackles", a: total(statsA, "tackles.total"), b: total(statsB, "tackles.total") },
    { label: "Fouls Committed", a: total(statsA, "fouls.committed"), b: total(statsB, "fouls.committed"), lower: true },
    { label: "Yellow Cards", a: total(statsA, "cards.yellow"), b: total(statsB, "cards.yellow"), lower: true },
    { label: "Red Cards", a: total(statsA, "cards.red"), b: total(statsB, "cards.red"), lower: true },
  ];

  const rows = metrics.map(m => {
    let aWins = false;
    let bWins = false;

    if (!m.noCompare && m.a !== "N/A" && m.b !== "N/A") {
      if (m.lower) {
        aWins = m.a < m.b;
        bWins = m.b < m.a;
      } else {
        aWins = m.a > m.b;
        bWins = m.b > m.a;
      }
    }

    return `
      <div class="h2h-stat-row">
        <div class="h2h-val h2h-val-a ${aWins ? "winner" : ""}">${m.a}</div>
        <div class="h2h-stat-label">${m.label}</div>
        <div class="h2h-val h2h-val-b ${bWins ? "winner" : ""}">${m.b}</div>
      </div>
    `;
  }).join("");

  document.getElementById("compare-table").innerHTML = rows;
  document.getElementById("compare-table").classList.remove("hidden");
  document.getElementById("compare-status").innerHTML = "";
}