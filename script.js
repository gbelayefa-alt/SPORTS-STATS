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
    //Try searching as a player first 
    const playerData = await fetchAPI(`/players?search=${encodeURIComponent(query)}&season=2024`);

    if (playerData.results > 0) {
        displayPlayerProfile(playerData.response[0]);
        showView("player");
        return;
    }

    //If no player found, try as a team
    const teamData = await fetchAPI(`/teams?search=${encodeURIComponent(query)}`);
    if (teamData.results > 0) {
        displayTeamProfile(teamData.response[0]);
        showView("team");
        return;
    }

    //Nothing found
    document.getElementById("player-profile").innerHTML = `<div class="error-message">No player or team found for "${query}".</div>`;
    showView("player");
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