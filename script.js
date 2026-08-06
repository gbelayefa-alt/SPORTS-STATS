/* 
Author: Amanda Gbe
Date: August 2nd, 2026
Description: This is the JAVASCRIPT file for the SPORTS-STATS API website
*/

const apiKey = '8ac66be1a5262bc5c515ffda84a93b78'; 
const apiURL = "https://v3.football.api-sports.io";

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
    team: document.getElementById("team-view"),
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
document.addEventListener("click", () => {
    leagueMenu.classList.add("hidden"); 
});

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
      `<div class="error-msg">Please enter a season year (>= 2000) before searching.</div>`;
    showView("player");
    return;
  }
  if (!rawQuery) return;

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
    2,    // UCL
    1,    // World Cup
    3,    // Europa League
    848,  // Conference League
    307,  // Saudi Pro League
    253,  // MLS
    88,   // Eredivisie
    203,  // Süper Lig (Turkey)
  ];

  let found = false;

  for (const leagueId of leaguesToTry) {
    try { 
      const playerData = await fetchAPI(
        `/players?search=${encodeURIComponent(query)}&league=${leagueId}&season=${season}`
      );

      if (playerData.errors && Object.keys(playerData.errors).length > 0) {
        document.getElementById("player-info-bar").innerHTML = 
        `<div class="error-msg">API limit reached for today. Please try again tomorrow.</div>`;
        return;
      }

      if (playerData.results > 0) {
        const playerId = playerData.response[0].player.id;
        const fullData = await fetchAPI(`/players?id=${playerId}&season=${season}`);
        if (fullData.results > 0) {
          displayPlayerStats(fullData.response[0], season);
        } else {
          displayPlayerStats(playerData.response[0], season);
        }
        found = true;
        break;
      }

    } catch (err) {
      document.getElementById("player-info-bar").innerHTML = 
        `<div class="error-msg">Connection error. Check your internet and try again.</div>`;
      return;
    }    
  }

    // If still nothing, try as a team
  if (!found) { 
    const teamData = await fetchAPI(`/teams?search=${encodeURIComponent(query)}`);

    if (teamData.results > 0) {
      displayTeamProfile(teamData.response[0]);
      showView("team");
      return;
    }

    // Nothing found anywhere
    document.getElementById("player-info-bar").innerHTML =
      `<div class="error-msg">No results found for "${query}". Try checking the spelling or use the player's full name.</div>`;
  }
}

//API HELPER
async function fetchAPI(endpoint) {
    const response = await fetch(apiURL + endpoint, {
        method: "GET",
        headers: {"x-apisports-key": apiKey}
    });
    const data = await response.json();
    return data;
}

// PLAYER STATS
function displayPlayerStats(playerObj, season) {
  const p = playerObj.player;
  const stats = playerObj.statistics;
  
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

//  TEAM PROFILE 
async function displayTeamProfile(teamObj) {
  const team = teamObj.team;

  document.getElementById("team-profile").innerHTML = `
    <div id="team-header">
      <img id="team-logo" src="${team.logo}" alt="${team.name}"
        onerror="this.style.display='none'"/>
      <div>
        <div id="team-name">${team.name}</div>
        <div id="team-country">${team.country || ""}</div>
      </div>
    </div>
    <div id="position-filters">
      <button class="filter-pill active" data-pos="all">All</button>
      <button class="filter-pill" data-pos="Goalkeeper">Goalkeepers</button>
      <button class="filter-pill" data-pos="Defender">Defenders</button>
      <button class="filter-pill" data-pos="Midfielder">Midfielders</button>
      <button class="filter-pill" data-pos="Attacker">Forwards</button>
    </div>
    <div class="loading">Loading squad...</div>
  `;
  showView("team");

  //Fetch squad
  const squadData = await fetchAPI(`/players/squads?team=${team.id}`);

  if (!squadData.response || squadData.response.length === 0) {
    document.getElementById("team-profile").querySelector(".loading").outerHTML  =
      `<div class="error-msg">Squad not available for this team.</div>`;
    return;
  }

  const players = squadData.response[0].players;
  renderSquad(players, "all");

  //Position filter clicks
  document.querySelectorAll(".filter-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      renderSquad(players, pill.dataset.pos);
    });
  });
}

function renderSquad(players, posFilter) {
  const filtered = posFilter === "all"
    ? players
    : players.filter(p => p.position === posFilter);

  const html = filtered.map(p => `
    <div class="player-card" onclick="searchPlayerById(${p.id})">
      <img src="${p.photo}" alt="${p.name}"
        onerror="this.src='img/placeholder.png'"/>
      <div class="player-card-number">${p.number || "-"}</div>
      <div class="player-card-info">
        <div class="player-card-name">${p.name}</div>
        <div class="player-card-pos">${p.position}</div>
      </div>
    </div>
  `).join("");

  let squadGrid = document.getElementById("squad-grid");
  if (!squadGrid) {
    const grid = document.createElement("div");
    grid.id = "squad-grid";
    document.getElementById("team-profile").appendChild(grid);
    squadGrid = grid;
  }
  squadGrid.innerHTML = html || `<div class="error-msg">No players found for this position.</div>`;
}

//Click a player card in team view -> go to their stats 
async function searchPlayerById(playerId) {
  const season = document.getElementById("season-input").value.trim() || "2024";
  document.getElementById("player-info-bar").innerHTML = 
    `<div class="loading">Loading player...</div>`;
  showView("player");

  const data = await fetchAPI(`/players?id=${playerId}&season=${season}`);
  if (data.results > 0) {
    displayPlayerStats(data.response[0], season);
  }else {
    document.getElementById("player-info-bar").innerHTML = 
      `<div class="error-msg">Stats not available for this player.</div>`;
  }
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