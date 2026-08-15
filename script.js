/* 
Author: Amanda Gbe
Date: August 2nd, 2026
Description: This is the JAVASCRIPT file for the SPORTS-STATS API website
*/

// Caches player search results (by "name-season") so repeat searches
// don't re-call the API. Cleared on page refresh.

const searchCache = new Map();

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
      `<div class="error-msg">Please enter a season between 2022 and 2024 before searching.</div>`;
    showView("player");
    return;
  }
  if (!rawQuery) return;

  const seasonNum = parseInt(season);
  if (seasonNum < 2022 || seasonNum > 2024) {
    document.getElementById("player-info-bar").innerHTML = 
      `<div class="error-msg">Please enter a season between 2022 and 2024.</div>`;
      showView("player");
      return;
  }

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

  // Show loading state
  document.getElementById("player-info-bar").innerHTML = `<div class="loading">Searching for "${rawQuery}"...</div>`;
  document.getElementById("player-stats").innerHTML = "";
  showView("player");

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

  // Reuse results from a previous identical search instead of re-calling the API
  const cacheKey = `${query}-${season}`;
  if (searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey);
    if (cached.length === 1) {
      displayPlayerStats(cached[0], season);
    } else {
      showDropdown(cached, season);
      document.getElementById("player-info-bar").innerHTML =
        `<div class="loading">Select a player from the dropdown.</div>`;
    }
    return;
  }

  //Collect all matching players across leagues 
  const allPlayers = [];
  const seenIds = new Set();

  for (const leagueId of leaguesToTry) {
    try { 
      const playerData = await fetchAPI(
        `/players?search=${encodeURIComponent(query)}&league=${leagueId}&season=${season}`
      );

      if (playerData.errors && Object.keys(playerData.errors).length > 0) {
        document.getElementById("player-info-bar").innerHTML = 
        `<div class="error-msg">Too many requests right now — please wait a moment and try again.</div>`;
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

    } catch (err) {
      document.getElementById("player-info-bar").innerHTML = 
        `<div class="error-msg">Connection error. Check your internet and try again.</div>`;
      return;
    }

    // Small delay between requests to avoid tripping the per-minute rate limit
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  if (allPlayers.length > 0) {
    searchCache.set(cacheKey, allPlayers);
  }

  //If only one result load directly
  if (allPlayers.length === 1) {
    const playerId = allPlayers[0].player.id;
    const fullData = await fetchAPI(`/players?id=${playerId}&season=${season}`);
    displayPlayerStats(fullData.results > 0 ? fullData.response[0] : allPlayers[0], season);
    return;
  }

  //Multiple results shows dropdown
  if (allPlayers.length > 1) {
    showDropdown(allPlayers, season);
    document.getElementById("player-info-bar").innerHTML = 
      `<div class="loading">Select a player from the dropdown.</div>`;
    return;
  }

  // Nothing found anywhere
  document.getElementById("player-info-bar").innerHTML =
      `<div class="error-msg">
        No results found for "${rawQuery}" in the ${season}/${seasonNum + 1} season.<br><br>
        Tips: Check the spelling. Use just the player's last name. Season must be between 2022-2024
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
        onerror="this.src='img/placeholder.png'" />
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

      document.getElementById("player-info-bar").innerHTML = 
        `<div class="loading">Loading player stats...</div>`;
      document.getElementById("player-stats").innerHTML = "";
        
      const data = await fetchAPI(`/players?id=${playerId}&season=${season}`);
      if (data.results > 0) {
        displayPlayerStats(data.response[0], season);
      } else { 
        document.getElementById("player-info-bar").innerHTML = 
          `<div class="error-msg">Stats not available for this player in ${season}. </div>`;
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
async function fetchAPI(endpoint) {
    const response = await fetch(`/api/players?endpoint=${encodeURIComponent(endpoint)}`, {
        method: "GET"
    });
    const data = await response.json();
    return data;
}

// PLAYER STATS
function displayPlayerStats(playerObj, season) {
  const p = playerObj.player;
  const stats = playerObj.statistics;

  // Clear the search bar so the next search doesn't require deleting the old query
  document.getElementById("search-input").value = "";
  document.getElementById("season-input").value = ""

  const seasonLabel = `${season}/${String(parseInt(season) + 1).slice(-2)}`;

  //----INFO BAR ---
  const countryCode = getCountryCode(p.nationality);

  document.getElementById("player-info-bar").innerHTML = `
    <div id="player-info">
      <div class="player-info-photo">
          <img
            src="${p.photo}"
            alt="${p.name}"
            onerror="this.src='img/placeholder.png'"
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

  const rawQuery = document.getElementById(inputId).value.trim();
  const season = document.getElementById(seasonId).value.trim();

  if (!rawQuery) return;

  if (!season) {
    document.getElementById("compare-status").innerHTML =
      `<span style="color:var(--red)">Please enter a season for Player ${side.toUpperCase()}.</span>`;
    return;
  }

  const seasonNum = parseInt(season);
  if (seasonNum < 2022 || seasonNum > 2024) {
    document.getElementById("compare-status").innerHTML =
      `<span style="color:var(--red)">Season must be between 2022 and 2024.</span>`;
    return;
  }

  const query = normalizeQuery(rawQuery);
  document.getElementById("compare-status").innerHTML =
    `Searching for Player ${side.toUpperCase()}...`;

  const leaguesToTry = [39, 140, 78, 135, 61];
  const allPlayers = [];
  const seenIds = new Set();

  // Reuse results from a previous identical search instead of re-calling the API
  const cacheKey = `${query}-${season}`;
  let usedCache = false;
  if (searchCache.has(cacheKey)) {
    allPlayers.push(...searchCache.get(cacheKey));
    usedCache = true;
  }

  if (!usedCache) {
    for (const leagueId of leaguesToTry) {
      try {
        const data = await fetchAPI(
          `/players?search=${encodeURIComponent(query)}&league=${leagueId}&season=${season}`
        );
        if (data.errors && Object.keys(data.errors).length > 0) {
          document.getElementById("compare-status").innerHTML =
            `<span style="color:var(--red)">Too many requests right now — please wait a moment and try again.</span>`;
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
      } catch (err) {
        document.getElementById("compare-status").innerHTML =
          `<span style="color:var(--red)">Connection error. Are you on localhost:5500?</span>`;
        return;
      }

      // Small delay between requests to avoid tripping the per-minute rate limit
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    if (allPlayers.length > 0) {
      searchCache.set(cacheKey, allPlayers);
    }
  }

  if (allPlayers.length === 0) {
    document.getElementById("compare-status").innerHTML =
      `<span style="color:var(--red)">No results for "${rawQuery}". Try just the last name or initials like L. Messi.</span>`;
    return;
  }

  if (allPlayers.length === 1) {
    await selectComparePlayer(side, allPlayers[0], season);
    return;
  }

  showCompareDropdown(side, allPlayers, season, dropdownId);
  document.getElementById("compare-status").innerHTML =
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
             onerror="this.src='img/placeholder.png'" />
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

      document.getElementById("compare-status").innerHTML =
        `Loading Player ${side.toUpperCase()}...`;

      const data = await fetchAPI(`/players?id=${playerId}&season=${season}`);
      const finalData = data.results > 0 ? data.response[0] : chosen;
      await selectComparePlayer(side, finalData, season);
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
         onerror="this.src='img/placeholder.png'" />
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