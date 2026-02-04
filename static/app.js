// ============================
// SUPABASE SETUP
// ============================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ceugatsgpakmaluyugmz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Xwo0cHgou1UHOI-3lEh7og_JEx7Vdih";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================
// DOM ELEMENTS
// ============================

const authSection    = document.getElementById("auth-section");
const adminSection   = document.getElementById("admin-section");
const tabsSection    = document.getElementById("tabs-section");
const userEmailSpan  = document.getElementById("user-email");
const logoutBtn      = document.getElementById("logout-btn");

const emailInput     = document.getElementById("email");
const passwordInput  = document.getElementById("password");

const loginBtn       = document.getElementById("login-btn");
const signupBtn      = document.getElementById("signup-btn");

const tabsList       = document.getElementById("tabs-list");
const searchInput    = document.getElementById("search-input");

const addTabBtn      = document.getElementById("add-tab-btn");
const titleInput     = document.getElementById("title");
const artistInput    = document.getElementById("artist");
const tuningInput    = document.getElementById("tuning");
const contentInput   = document.getElementById("content");

// State
let allTabs = [];           // Full list for filtering
let isProcessing = false;   // Prevent double-clicks

// ============================
// AUTH HANDLERS
// ============================

loginBtn.addEventListener("click", () => handleAuth("login"));
signupBtn.addEventListener("click", () => handleAuth("signup"));

async function handleAuth(type) {
  if (isProcessing) return;
  isProcessing = true;

  const btn = type === "login" ? loginBtn : signupBtn;
  btn.disabled = true;
  btn.textContent = type === "login" ? "Logging in..." : "Signing up...";

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    alert("Please enter both email and password");
    resetButton(btn, type === "login" ? "Login" : "Sign Up");
    return;
  }

  if (password.length < 6) {
    alert("Password must be at least 6 characters long");
    resetButton(btn, type === "login" ? "Login" : "Sign Up");
    return;
  }

  let result;
  if (type === "login") {
    result = await supabase.auth.signInWithPassword({ email, password });
  } else {
    result = await supabase.auth.signUp({ email, password });
  }

  const { data, error } = result;

  if (error) {
    alert(error.message);
  } else if (data.session) {
    // Normal success case
    alert(type === "signup" ? "Signup successful! You're now logged in." : "Logged in successfully!");
  } else if (type === "signup" && data.user) {
    // Auto-login after signup (required when confirm email is off)
    const fallback = await supabase.auth.signInWithPassword({ email, password });
    if (fallback.error) {
      alert("Account created but auto-login failed: " + fallback.error.message + ". Try logging in manually.");
    } else {
      alert("Signup successful! Logged in via fallback.");
    }
  } else {
    alert("Unexpected response – check console.");
    console.log("Auth result:", { data, error });
  }

  resetButton(btn, type === "login" ? "Login" : "Sign Up");
}

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
});

// ============================
// AUTH STATE CHANGE + INIT
// ============================

supabase.auth.onAuthStateChange((_event, session) => {
  updateUI(session);
});

async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  updateUI(session);
}

init();

// ============================
// UI UPDATE – core logic for showing/hiding tabs
// ============================

async function updateUI(session) {
  if (session?.user) {
    userEmailSpan.textContent = session.user.email || "Logged in";
    logoutBtn.hidden = false;
    authSection.hidden = true;

    const isAdmin = await isUserAdmin(session.user.id);
    adminSection.hidden = !isAdmin;

    // Show tabs section and load data
    tabsSection.hidden = false;
    await loadTabs();
  } else {
    userEmailSpan.textContent = "Not logged in";
    logoutBtn.hidden = true;
    authSection.hidden = false;
    adminSection.hidden = true;

    // Hide tabs section and show message
    tabsSection.hidden = true;
    tabsList.innerHTML = `
      <div class="empty-state">
        <p>Please log in or sign up to view guitar tabs.</p>
      </div>
    `;
  }
}

async function isUserAdmin(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  return !error && data?.role === "admin";
}

// ============================
// LOAD & RENDER TABS (collapsible)
// ============================

async function loadTabs() {
  tabsList.innerHTML = "<p class='empty-state'>Loading tabs...</p>";

  const { data, error } = await supabase
    .from("tabs")
    .select("*")
    .order("artist", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    console.error("Tabs load error:", error);
    tabsList.innerHTML = "<p class='empty-state'>Error loading tabs. Try refreshing.</p>";
    return;
  }

  allTabs = data || [];
  renderTabs(allTabs);
}

function renderTabs(tabsToShow) {
  tabsList.innerHTML = "";

  if (tabsToShow.length === 0) {
    tabsList.innerHTML = `
      <div class="empty-state">
        <p>No tabs found${searchInput?.value ? ` matching "${searchInput.value}"` : ""}.</p>
        <p>${isUserAdmin ? "Add your first tab in the admin section above!" : "More songs coming soon — check back later!"}</p>
      </div>
    `;
    return;
  }

  tabsToShow.forEach((tab) => {
    const details = document.createElement("details");
    details.className = "tab-item";

    const summary = document.createElement("summary");
    summary.innerHTML = `
      <strong>${escapeHtml(tab.title)}</strong>
      <span class="artist">${escapeHtml(tab.artist)}${tab.tuning ? " • " + escapeHtml(tab.tuning) : ""}</span>
    `;

    const contentDiv = document.createElement("div");
    contentDiv.className = "tab-content";
    contentDiv.innerHTML = `<pre>${escapeHtml(tab.content)}</pre>`;

    details.appendChild(summary);
    details.appendChild(contentDiv);
    tabsList.appendChild(details);
  });
}

// ============================
// SEARCH (real-time filter)
// ============================

if (searchInput) {
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();

    if (!query) {
      renderTabs(allTabs);
      return;
    }

    const filtered = allTabs.filter(tab =>
      tab.title.toLowerCase().includes(query) ||
      tab.artist.toLowerCase().includes(query)
    );

    renderTabs(filtered);
  });
}

// ============================
// ADD TAB
// ============================

addTabBtn.addEventListener("click", async () => {
  if (isProcessing) return;
  isProcessing = true;
  addTabBtn.disabled = true;
  addTabBtn.textContent = "Adding...";

  const title   = titleInput.value.trim();
  const artist  = artistInput.value.trim();
  const tuning  = tuningInput.value.trim();
  const content = contentInput.value.trim();

  if (!title || !artist || !content) {
    alert("Title, artist, and content are required.");
    resetButton(addTabBtn, "Add Tab");
    return;
  }

  const { error } = await supabase.from("tabs").insert({
    title,
    artist,
    tuning: tuning || null,
    content,
  });

  if (error) {
    alert("Failed to add tab: " + error.message);
  } else {
    titleInput.value = artistInput.value = tuningInput.value = contentInput.value = "";
    await loadTabs();
    alert("Tab added!");
  }

  resetButton(addTabBtn, "Add Tab");
});

// ============================
// HELPERS
// ============================

function escapeHtml(unsafe) {
  const div = document.createElement("div");
  div.textContent = unsafe;
  return div.innerHTML;
}

function resetButton(btn, text) {
  isProcessing = false;
  btn.disabled = false;
  btn.textContent = text;
}