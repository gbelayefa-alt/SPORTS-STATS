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
document.getElementById("search-btn").addEventListener("click", handleSearch);
document.getElementById("search-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSearch();
});

async function handleSearch() {
  const query = document.getElementById("search-input").value.trim();
  if (!query) return;

  // Show loading state
  document.getElementById("player-profile").innerHTML = `<div class="loading">Searching...</div>`;
  showView("player");

  // API-Football search works best with a league specified
  // Try top leagues in sequence until we find the player
  const leaguesToTry = [39, 140, 78, 135, 61, 2, 1, 3, 848];

  for (const leagueId of leaguesToTry) {
    const playerData = await fetchAPI(
      `/players?search=${encodeURIComponent(query)}&league=${leagueId}&season=2024`
    );

    if (playerData.results > 0) {
      displayPlayerProfile(playerData.response[0]);
      return;
    }
  }

  // If still nothing, try as a team
  const teamData = await fetchAPI(`/teams?search=${encodeURIComponent(query)}`);

  if (teamData.results > 0) {
    displayTeamProfile(teamData.response[0]);
    showView("team");
    return;
  }

  // Nothing found anywhere
  document.getElementById("player-profile").innerHTML =
    `<div class="error-msg">No player or team found for "${query}". Try checking the spelling or use the player's full name.</div>`;
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

// PLAYER PROFILE 
let currentPlayerId = null;

function displayPlayerProfile(playerObj) {
  const p = playerObj.player;
  const stats = playerObj.statistics;
  const firstStat = stats[0];

  currentPlayerId = p.id;

  const currentTeam = firstStat?.team?.name || "Unknown";
  const currentTeamLogo = firstStat?.team?.logo || "";
  const position = firstStat?.games?.position || "N/A";
  const number = firstStat?.games?.number || "-";
  const rating = firstStat?.games?.rating
    ? parseFloat(firstStat.games.rating).toFixed(1)
    : "N/A";

  const totalGoals = stats.reduce((sum, s) => sum + (s.goals?.total || 0), 0);
  const totalAssists = stats.reduce((sum, s) => sum + (s.goals?.assists || 0), 0);
  const totalApps = stats.reduce((sum, s) => sum + (s.games?.appearences || 0), 0);
  const totalMinutes = stats.reduce((sum, s) => sum + (s.games?.minutes || 0), 0);

  const countryCode = getCountryCode(p.nationality);

  document.getElementById("player-profile").innerHTML = `
    <div id="player-hero">

      <div class="hero-left">
        <div class="hero-top-row">
          <span class="hero-position-tag">${position}</span>
          <img
            src="https://flagcdn.com/24x18/${countryCode}.png"
            alt="${p.nationality}"
            class="hero-flag"
            onerror="this.style.display='none'"
          />
          <span style="font-size:0.9rem; color:var(--text-secondary);">${p.nationality}</span>
        </div>

        <div class="hero-name">${p.name}</div>

        ${number && number !== "-" ? `<div class="hero-number">#${number}</div>` : ""}

        <div class="hero-team-row">
          <img
            src="${currentTeamLogo}"
            alt="${currentTeam}"
            class="hero-team-logo"
            onerror="this.style.display='none'"
          />
          <span class="hero-team-name">${currentTeam}</span>
        </div>

        <div class="hero-stat-pills">
          <div class="hero-pill">
            <span class="pill-value">${totalGoals}</span>
            <span class="pill-label">Goals</span>
          </div>
          <div class="hero-pill">
            <span class="pill-value">${totalAssists}</span>
            <span class="pill-label">Assists</span>
          </div>
          <div class="hero-pill">
            <span class="pill-value">${totalApps}</span>
            <span class="pill-label">Apps</span>
          </div>
          <div class="hero-pill">
            <span class="pill-value">${totalMinutes}</span>
            <span class="pill-label">Mins</span>
          </div>
          <div class="hero-pill">
            <span class="pill-value">${rating}</span>
            <span class="pill-label">Rating</span>
          </div>
        </div>

        <div class="hero-bio-row">
          <div class="bio-cell">
            <span class="bio-value">${p.birth?.date || "N/A"}</span>
            <span class="bio-label">Date of Birth</span>
          </div>
          <div class="bio-cell">
            <span class="bio-value">${p.nationality || "N/A"}</span>
            <span class="bio-label">Nationality</span>
          </div>
          <div class="bio-cell">
            <span class="bio-value">${p.height || "N/A"}</span>
            <span class="bio-label">Height</span>
          </div>
          <div class="bio-cell">
            <span class="bio-value">${p.weight || "N/A"}</span>
            <span class="bio-label">Weight</span>
          </div>
          <div class="bio-cell">
            <span class="bio-value">${p.age || "N/A"}</span>
            <span class="bio-label">Age</span>
          </div>
        </div>
      </div>

      <div class="hero-right">
        <img
          id="player-hero-img"
          src="${p.photo}"
          alt="${p.name}"
          onerror="this.src='img/placeholder.png'"
        />
      </div>

    </div>
  `;

  document.getElementById("player-stats").innerHTML = "";
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
    return map[nationality] || "unknown";
}