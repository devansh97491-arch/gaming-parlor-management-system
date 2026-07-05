/* ═══════════════════════════════════════════════
   HKG Gaming Parlour — app.js
   Full client-side logic + cursor-tracking controller
═══════════════════════════════════════════════ */

const API = "http://localhost:5000/api";

// ─────────────────────────────────────────────
//  CONTROLLER CURSOR TRACKING
// ─────────────────────────────────────────────
const controllerWrap = document.getElementById("controllerWrap");
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let currentRotX = 0;
let currentRotY = 0;
let currentRotZ = 0;

document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

function animateController() {
    const cx = window.innerWidth * 0.85;
    const cy = window.innerHeight * 0.5;

    const dx = mouseX - cx;
    const dy = mouseY - cy;

    // Map mouse position to rotation angles
    const targetRotY = (dx / window.innerWidth) * 35;
    const targetRotX = -(dy / window.innerHeight) * 25;
    const targetRotZ = (dx / window.innerWidth) * 8;

    // Smooth lerp (0.06 = slow/smooth, higher = snappier)
    currentRotX += (targetRotX - currentRotX) * 0.06;
    currentRotY += (targetRotY - currentRotY) * 0.06;
    currentRotZ += (targetRotZ - currentRotZ) * 0.06;

    if (controllerWrap) {
        controllerWrap.style.transform = `
      translateY(-50%)
      perspective(600px)
      rotateX(${currentRotX}deg)
      rotateY(${currentRotY}deg)
      rotateZ(${currentRotZ}deg)
    `;
    }
    requestAnimationFrame(animateController);
}
animateController();

// ─────────────────────────────────────────────
//  TOAST NOTIFICATIONS
// ─────────────────────────────────────────────
const toastEl = document.getElementById("toast");
let toastTimer;

function showToast(msg, type = "info") {
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.className = `toast ${type} show`;
    toastTimer = setTimeout(() => { toastEl.classList.remove("show"); }, 3500);
}

// ─────────────────────────────────────────────
//  SMOOTH SCROLL
// ─────────────────────────────────────────────
function smoothScroll(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
}

// ─────────────────────────────────────────────
//  NAVBAR
// ─────────────────────────────────────────────
const navbar = document.getElementById("navbar");
const hamburger = document.getElementById("hamburger");
const navLinks = document.querySelector(".nav-links");

window.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", window.scrollY > 40);

    // Active link highlight
    const sections = ["home", "games", "play", "admin"];
    const scrollY = window.scrollY + 100;
    sections.forEach((id) => {
        const sec = document.getElementById(id);
        const link = document.querySelector(`.nav-link[href="#${id}"]`);
        if (sec && link) {
            const top = sec.offsetTop;
            const bot = top + sec.offsetHeight;
            link.classList.toggle("active", scrollY >= top && scrollY < bot);
        }
    });
});

hamburger.addEventListener("click", () => {
    navLinks.classList.toggle("open");
    hamburger.classList.toggle("open");
});

document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
        navLinks.classList.remove("open");
        hamburger.classList.remove("open");
    });
});

// ─────────────────────────────────────────────
//  SCROLL REVEAL
// ─────────────────────────────────────────────
const revealObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach((e) => {
            if (e.isIntersecting) {
                e.target.classList.add("visible");
                revealObserver.unobserve(e.target);
            }
        });
    },
    { threshold: 0.1 }
);
document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

// ─────────────────────────────────────────────
//  LOAD GAMES
// ─────────────────────────────────────────────
let allGames = [];

async function loadGames() {
    try {
        const res = await fetch(`${API}/games`);
        if (!res.ok) throw new Error("Failed to load");
        allGames = await res.json();

        renderGameCards(allGames);
        populateGameSelect(allGames);

        // Update hero stat
        const active = allGames.filter((g) => g.status === "ACTIVE").length;
        const statEl = document.getElementById("statGames");
        if (statEl) statEl.textContent = active;
    } catch (err) {
        const grid = document.getElementById("gamesGrid");
        if (grid)
            grid.innerHTML = `<p class="no-data" style="padding:2rem;text-align:center;">⚠️ Could not load games. Is the API running? (python api.py)</p>`;
    }
}

function stars(rating) {
    if (!rating) return "";
    return Array.from({ length: 5 }, (_, i) =>
        `<span class="star">${i < rating ? "★" : "☆"}</span>`
    ).join("");
}

function renderGameCards(games) {
    const grid = document.getElementById("gamesGrid");
    if (!grid) return;

    if (!games.length) {
        grid.innerHTML = `<p class="no-data" style="padding:2rem;text-align:center;">No games in the database yet. Add one via the Admin panel!</p>`;
        return;
    }

    grid.innerHTML = games
        .map(
            (g) => `
    <div class="game-card" onclick="smoothScroll('play')">
      <span class="game-card-badge badge-${g.status.toLowerCase()}">${g.status}</span>
      <p class="game-card-console">${g.console}</p>
      <h3 class="game-card-name">${g.name}</h3>
      <div class="game-card-meta">
        <span class="game-card-price">₹${g.price_per_hour ?? "–"}/hr</span>
        <span class="game-card-rating">${stars(g.rating)}</span>
      </div>
    </div>`
        )
        .join("");
}

function populateGameSelect(games) {
    const sel = document.getElementById("gameSelect");
    if (!sel) return;
    const active = games.filter((g) => g.status === "ACTIVE");
    sel.innerHTML = `<option value="">-- Select a Game --</option>` +
        active.map((g) => `<option value="${g.id}">${g.name} (${g.console}) — ₹${g.price_per_hour}/hr</option>`).join("");
}

// ─────────────────────────────────────────────
//  START SESSION
// ─────────────────────────────────────────────
const startForm = document.getElementById("startSessionForm");
const startResult = document.getElementById("startResult");
const startBtn = document.getElementById("startBtn");
const resultSessionId = document.getElementById("resultSessionId");

startForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("playerName").value.trim();
    const phone = document.getElementById("playerPhone").value.trim();
    const game_id = parseInt(document.getElementById("gameSelect").value);

    if (!name || !phone || !game_id) return;

    startBtn.disabled = true;
    startBtn.innerHTML = `<div class="spinner" style="width:18px;height:18px;border-width:2px"></div>`;

    try {
        const res = await fetch(`${API}/sessions/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, phone, game_id }),
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Failed to start session");

        resultSessionId.textContent = data.session_id;
        startResult.classList.remove("hidden");
        startForm.reset();
        showToast(`✅ Session #${data.session_id} started!`, "success");
        loadActiveSessions();
    } catch (err) {
        showToast(`❌ ${err.message}`, "error");
    } finally {
        startBtn.disabled = false;
        startBtn.innerHTML = `<span>Start Playing</span>`;
    }
});

// ─────────────────────────────────────────────
//  END SESSION
// ─────────────────────────────────────────────
const endForm = document.getElementById("endSessionForm");
const endResult = document.getElementById("endResult");
const endBtn = document.getElementById("endBtn");

endForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const session_id = parseInt(document.getElementById("sessionId").value);
    if (!session_id) return;

    endBtn.disabled = true;
    endBtn.innerHTML = `<div class="spinner" style="width:18px;height:18px;border-width:2px"></div>`;

    try {
        const res = await fetch(`${API}/sessions/end`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to end session");

        document.getElementById("billCustomer").textContent = data.customer_name;
        document.getElementById("billGame").textContent = data.game_name;
        document.getElementById("billDuration").textContent =
            data.duration_hours < 0.017
                ? "< 1 min"
                : `${(data.duration_hours * 60).toFixed(0)} min`;
        document.getElementById("billTotal").textContent = `₹${data.total_amount}`;
        endResult.classList.remove("hidden");
        endForm.reset();
        showToast(`💰 Bill: ₹${data.total_amount}`, "success");
        loadActiveSessions();
    } catch (err) {
        showToast(`❌ ${err.message}`, "error");
    } finally {
        endBtn.disabled = false;
        endBtn.innerHTML = `<span>End & Pay</span>`;
    }
});

// ─────────────────────────────────────────────
//  ACTIVE SESSIONS
// ─────────────────────────────────────────────
async function loadActiveSessions() {
    const wrap = document.getElementById("activeSessions");
    if (!wrap) return;
    try {
        const res = await fetch(`${API}/sessions/active`);
        const data = await res.json();
        if (!data.length) {
            wrap.innerHTML = `<p class="no-data">No active sessions right now</p>`;
            return;
        }
        wrap.innerHTML = data
            .map(
                (s) => `
      <div class="session-chip">
        <span class="chip-id">#${s.session_id}</span>
        <span>${s.customer}</span>
        <span style="color:#858ba0">→</span>
        <span>${s.game}</span>
      </div>`
            )
            .join("");
    } catch {
        wrap.innerHTML = `<p class="no-data">Could not load sessions</p>`;
    }
}

// ─────────────────────────────────────────────
//  ADMIN LOGIN
// ─────────────────────────────────────────────
let isAdminLoggedIn = false;
const adminLoginCard = document.getElementById("adminLoginCard");
const adminDashboard = document.getElementById("adminDashboard");

document.getElementById("adminLoginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("adminUser").value.trim();
    const password = document.getElementById("adminPass").value;
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Logging in…";

    try {
        const res = await fetch(`${API}/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error("Invalid credentials");

        isAdminLoggedIn = true;
        adminLoginCard.classList.add("hidden");
        adminDashboard.classList.remove("hidden");
        showToast("🔓 Admin access granted", "success");
        loadAdminGamesList();
    } catch (err) {
        showToast(`❌ ${err.message}`, "error");
        document.getElementById("adminPass").value = "";
    } finally {
        btn.disabled = false;
        btn.textContent = "Login";
    }
});

function adminLogout() {
    isAdminLoggedIn = false;
    adminDashboard.classList.add("hidden");
    adminLoginCard.classList.remove("hidden");
    document.getElementById("adminLoginForm").reset();
    showToast("🔒 Logged out", "info");
}

// ─────────────────────────────────────────────
//  ADMIN — Manage Games
// ─────────────────────────────────────────────
async function loadAdminGamesList() {
    const list = document.getElementById("adminGamesList");
    if (!list) return;
    list.innerHTML = `<div class="spinner" style="margin:1rem auto"></div>`;

    try {
        const res = await fetch(`${API}/games`);
        const games = await res.json();
        if (!games.length) {
            list.innerHTML = `<p class="no-data">No games yet</p>`;
            return;
        }
        list.innerHTML = games
            .map(
                (g) => `
      <div class="admin-game-row" id="agr-${g.id}">
        <div class="admin-game-info">
          <strong>${g.name}</strong>
          <span>${g.console} · ₹${g.price_per_hour}/hr · ★${g.rating ?? "–"} · <span style="color:${g.status === 'ACTIVE' ? '#00ff88' : '#ff3ca0'}">${g.status}</span></span>
        </div>
        <div class="admin-game-actions">
          <button class="btn-icon" onclick="openModal('rating', ${g.id}, ${g.rating})">Rating</button>
          <button class="btn-icon" onclick="openModal('price', ${g.id}, ${g.price_per_hour})">Price</button>
          ${g.status === "ACTIVE"
                        ? `<button class="btn-icon disc" onclick="toggleGame(${g.id},'discontinue')">Discontinue</button>`
                        : `<button class="btn-icon reac" onclick="toggleGame(${g.id},'reactivate')">Reactivate</button>`
                    }
        </div>
      </div>`
            )
            .join("");
    } catch {
        list.innerHTML = `<p class="no-data">Failed to load games</p>`;
    }
}

async function toggleGame(id, action) {
    try {
        const res = await fetch(`${API}/games/${id}/${action}`, { method: "PUT" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        showToast(`✅ ${data.message}`, "success");
        loadAdminGamesList();
        loadGames();
    } catch (err) {
        showToast(`❌ ${err.message}`, "error");
    }
}

// ─────────────────────────────────────────────
//  ADMIN — Add Game
// ─────────────────────────────────────────────
document.getElementById("addGameForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Adding…";

    try {
        const res = await fetch(`${API}/games`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: document.getElementById("newGameName").value.trim(),
                console: document.getElementById("newConsole").value.trim(),
                price: parseFloat(document.getElementById("newPrice").value),
                rating: parseInt(document.getElementById("newRating").value),
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to add game");
        showToast(`✅ Game added! ID: ${data.game_id}`, "success");
        e.target.reset();
        loadAdminGamesList();
        loadGames();
    } catch (err) {
        showToast(`❌ ${err.message}`, "error");
    } finally {
        btn.disabled = false;
        btn.textContent = "Add Game";
    }
});

// ─────────────────────────────────────────────
//  UPDATE MODAL (rating / price)
// ─────────────────────────────────────────────
let modalAction = null;
let modalGameId = null;
const modalOverlay = document.getElementById("modalOverlay");

function openModal(type, gameId, currentVal) {
    modalAction = type;
    modalGameId = gameId;
    const title = document.getElementById("modalTitle");
    const label = document.getElementById("modalLabel");
    const input = document.getElementById("modalInput");

    if (type === "rating") {
        title.textContent = "Update Rating";
        label.textContent = "New Rating (1–5)";
        input.min = 1; input.max = 5; input.step = 1;
    } else {
        title.textContent = "Update Price";
        label.textContent = "New Price per Hour (₹)";
        input.min = 1; input.max = 9999; input.step = 0.5;
    }
    input.value = currentVal ?? "";
    modalOverlay.classList.remove("hidden");
    setTimeout(() => input.focus(), 100);
}

function closeModal() {
    modalOverlay.classList.add("hidden");
    modalAction = null;
    modalGameId = null;
}

document.getElementById("modalConfirm").addEventListener("click", async () => {
    const val = parseFloat(document.getElementById("modalInput").value);
    if (!val || !modalGameId || !modalAction) return;

    try {
        const body = modalAction === "rating" ? { rating: val } : { price: val };
        const res = await fetch(`${API}/games/${modalGameId}/${modalAction}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error("Update failed");
        showToast(`✅ ${modalAction === "rating" ? "Rating" : "Price"} updated!`, "success");
        closeModal();
        loadAdminGamesList();
        loadGames();
    } catch (err) {
        showToast(`❌ ${err.message}`, "error");
    }
});

// Close modal on overlay click
modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
});

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    loadGames();
    loadActiveSessions();

    // Auto refresh active sessions every 30 seconds
    setInterval(loadActiveSessions, 30000);
});
