/**********************
 *  Storage Keys
 **********************/
const QUOTES_KEY = "dqg.quotes.v2"; // bumped schema
const SELECTED_CATEGORY_KEY = "dqg.selectedCategory";
const LAST_QUOTE_KEY = "dqg.lastQuote";

/**********************
 *  Simulated Server
 *  Using JSONPlaceholder for network I/O simulation.
 *  Note: JSONPlaceholder does NOT persist writes. We still POST for demo.
 **********************/
const SERVER_BASE = "https://jsonplaceholder.typicode.com";
const SERVER_RESOURCE = "/posts";
const SERVER_USER_ID = 9;     // namespace (static)
const SYNC_INTERVAL_MS = 30_000;

/**********************
 *  State
 **********************/
let quotes = []; // { id, serverId?, text, category, updatedAt, origin, lastSyncedAt? }
let autoSyncTimer = null;
let conflictLog = []; // [{ local, remote, resolution: 'server'|'local' }]

/**********************
 *  DOM
 **********************/
const quoteDisplay = document.getElementById("quoteDisplay");
const newQuoteBtn = document.getElementById("newQuote");
const categoryFilter = document.getElementById("categoryFilter");
const exportBtn = document.getElementById("exportJson");
const statusEl = document.getElementById("status");

const syncNowBtn = document.getElementById("syncNow");
const autoSyncToggle = document.getElementById("autoSyncToggle");
const syncStatusEl = document.getElementById("syncStatus");
const openConflictsBtn = document.getElementById("openConflicts");

const conflictModal = document.getElementById("conflictModal");
const conflictList = document.getElementById("conflictList");
const applyResolutionsBtn = document.getElementById("applyResolutions");
const cancelResolutionsBtn = document.getElementById("cancelResolutions");

/**********************
 *  Utilities
 **********************/
const nowISO = () => new Date().toISOString();
const pad = n => String(n).padStart(2, "0");
function setStatus(msg) { statusEl.textContent = msg || ""; }
function setSyncStatus(msg) { syncStatusEl.textContent = msg || ""; }

function uid() {
  // unique per device; good enough for demo (timestamp + random)
  const r = Math.random().toString(36).slice(2, 8);
  const t = Date.now().toString(36);
  return `local-${t}-${r}`;
}
function sanitizeQuote(obj) {
  if (!obj || typeof obj !== "object") return null;
  let { id, serverId, text, category, updatedAt, origin, lastSyncedAt } = obj;
  text = typeof text === "string" ? text.trim() : "";
  category = typeof category === "string" ? category.trim() : "";
  if (!text || !category) return null;
  if (!id) id = uid();
  if (!updatedAt) updatedAt = nowISO();
  if (!origin) origin = serverId ? "server" : "local";
  return { id, serverId, text, category, updatedAt, origin, lastSyncedAt };
}

/**********************
 *  Local Storage
 **********************/
function loadQuotes() {
  const raw = localStorage.getItem(QUOTES_KEY);
  if (!raw) {
    // Seed defaults
    return [
      { text: "The best way to predict the future is to invent it.", category: "Inspiration" },
      { text: "Life is what happens when you're busy making other plans.", category: "Life" },
      { text: "Do or do not. There is no try.", category: "Motivation" },
    ].map(sanitizeQuote);
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed.map(sanitizeQuote).filter(Boolean);
  } catch {
    return [];
  }
}
function saveQuotes() {
  localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));
}
function saveSelectedCategory(cat) {
  localStorage.setItem(SELECTED_CATEGORY_KEY, cat);
}
function getSavedCategory() {
  return localStorage.getItem(SELECTED_CATEGORY_KEY) || "all";
}
function saveLastViewedQuote(quote) {
  try { sessionStorage.setItem(LAST_QUOTE_KEY, JSON.stringify(quote)); } catch {}
}
function getLastViewedQuote() {
  try { const raw = sessionStorage.getItem(LAST_QUOTE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

/**********************
 *  UI Builders
 **********************/
function createAddQuoteForm() {
  const container = document.getElementById("addQuoteContainer");
  container.innerHTML = "";

  const formSection = document.createElement("div");
  formSection.classList.add("form-section");

  const heading = document.createElement("h3");
  heading.textContent = "Add a New Quote";

  const inputQuote = document.createElement("input");
  inputQuote.type = "text";
  inputQuote.placeholder = "Enter a new quote";
  inputQuote.id = "newQuoteText";

  const inputCategory = document.createElement("input");
  inputCategory.type = "text";
  inputCategory.placeholder = "Enter quote category";
  inputCategory.id = "newQuoteCategory";

  const addBtn = document.createElement("button");
  addBtn.textContent = "Add Quote";
  addBtn.id = "addQuoteBtn";

  const row = document.createElement("div");
  row.className = "row";
  row.appendChild(inputQuote);
  row.appendChild(inputCategory);
  row.appendChild(addBtn);

  formSection.appendChild(heading);
  formSection.appendChild(row);
  container.appendChild(formSection);

  addBtn.addEventListener("click", addQuote);
}

/**********************
 *  Categories & Filtering
 **********************/
function populateCategories() {
  const categories = [...new Set(quotes.map(q => q.category))].sort((a, b) => a.localeCompare(b));
  categoryFilter.innerHTML = `<option value="all">All Categories</option>`;
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);
  });

  const saved = getSavedCategory();
  if ([...categoryFilter.options].some(o => o.value === saved)) {
    categoryFilter.value = saved;
  }
}
function filterQuotes() {
  const selected = categoryFilter.value;
  saveSelectedCategory(selected);

  const filtered = selected === "all" ? quotes : quotes.filter(q => q.category === selected);
  if (!filtered.length) {
    quoteDisplay.textContent = "No quotes available in this category.";
    return;
  }
  const q = filtered[Math.floor(Math.random() * filtered.length)];
  quoteDisplay.textContent = `"${q.text}" — [${q.category}]`;
  saveLastViewedQuote(q);
}
window.filterQuotes = filterQuotes;

/**********************
 *  Core Actions
 **********************/
function addQuote() {
  const text = document.getElementById("newQuoteText").value.trim();
  const category = document.getElementById("newQuoteCategory").value.trim();

  if (!text || !category) {
    alert("Please enter both a quote and category.");
    return;
  }

  const q = sanitizeQuote({ text, category, origin: "local" });
  quotes.push(q);
  saveQuotes();
  populateCategories();
  setStatus("Quote added!");
  document.getElementById("newQuoteText").value = "";
  document.getElementById("newQuoteCategory").value = "";
}

/**********************
 *  Import / Export
 **********************/
function exportToJsonFile() {
  const data = JSON.stringify(quotes, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const d = new Date();
  const fname = `quotes-${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}.json`;

  const a = document.createElement("a");
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus("Exported quotes to JSON file.");
}
function importFromJsonFile(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) return alert("Invalid file format: expected an array.");
      const incoming = imported.map(sanitizeQuote).filter(Boolean);
      if (!incoming.length) return alert("No valid quotes found.");

      // De-dupe by text+category
      const key = q => `${q.text}❙${q.category}`;
      const seen = new Set(quotes.map(key));
      const toAdd = incoming.filter(q => !seen.has(key(q)));

      if (!toAdd.length) return alert("All imported quotes were duplicates.");
      quotes.push(...toAdd);
      saveQuotes();
      populateCategories();
      setStatus(`Imported ${toAdd.length} quote(s).`);
      alert("Quotes imported successfully!");
    } catch {
      alert("Invalid JSON.");
    } finally {
      event.target.value = ""; // allow re-select
    }
  };
  reader.readAsText(file);
}
window.importFromJsonFile = importFromJsonFile;

/**********************
 *  Server Mapping (JSONPlaceholder ↔ quotes)
 *  Note: We synthesize updatedAt for remote items (demo only).
 **********************/
function mapServerPostToQuote(post) {
  const serverId = `jp-${post.id}`;
  const text = (post.title || post.body || "").trim();
  const category = "Server"; // demo category
  const updatedAt = nowISO(); // synthesize timestamp at fetch time
  // Try to keep a stable local id for server-origin items:
  const existing = quotes.find(q => q.serverId === serverId);
  const id = existing ? existing.id : uid();
  return sanitizeQuote({ id, serverId, text, category, updatedAt, origin: "server" });
}

/**********************
 *  Fetch / Push (simulation)
 **********************/
async function fetchServerQuotes() {
  // We fetch a slice to simulate "new data from server"
  const url = `${SERVER_BASE}${SERVER_RESOURCE}?userId=${SERVER_USER_ID}&_limit=5&_start=${Math.floor(Math.random()*5)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Server fetch failed: ${res.status}`);
  const posts = await res.json();
  return posts.map(mapServerPostToQuote);
}
async function pushLocalChangeToServer(q) {
  // JSONPlaceholder won't persist, but this shows how to POST
  const payload = {
    userId: SERVER_USER_ID,
    title: q.category,
    body: JSON.stringify({ id: q.id, text: q.text, category: q.category, updatedAt: q.updatedAt }),
  };
  try {
    const res = await fetch(`${SERVER_BASE}${SERVER_RESOURCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      // mark as synced for demo
      q.lastSyncedAt = nowISO();
      saveQuotes();
    }
  } catch { /* ignore network errors for demo */ }
}

/**********************
 *  Sync & Conflict Handling
 *  Strategy: Server wins by default, but user can override via modal.
 **********************/
function mergeServerData(remoteQuotes) {
  const localByServerId = new Map(quotes.filter(q => q.serverId).map(q => [q.serverId, q]));
  let applied = 0;

  remoteQuotes.forEach(remote => {
    const existing = localByServerId.get(remote.serverId);
    if (!existing) {
      // New from server
      quotes.push(remote);
      applied++;
      return;
    }

    // Conflict check: compare timestamps (we synthesize remote.updatedAt at fetch time)
    const localIsNewer = new Date(existing.updatedAt) > new Date(remote.updatedAt);
    const sameContent = existing.text === remote.text && existing.category === remote.category;

    if (sameContent) {
      // no change, just mark sync
      existing.lastSyncedAt = nowISO();
      return;
    }

    // Record conflict entry
    const conflict = {
      local: { ...existing },
      remote: { ...remote },
      resolution: "server", // default strategy: server wins
    };
    conflictLog.push(conflict);

    // Apply default resolution (server wins)
    existing.text = remote.text;
    existing.category = remote.category;
    existing.updatedAt = remote.updatedAt;
    existing.origin = "server";
    existing.lastSyncedAt = nowISO();
    applied++;
  });

  if (applied > 0) saveQuotes();
  // Toggle conflict UI if any conflicts captured
  openConflictsBtn.style.display = conflictLog.length ? "" : "none";
  return applied;
}

async function syncNow() {
  setSyncStatus("Syncing with server…");
  try {
    const remote = await fetchServerQuotes();
    const applied = mergeServerData(remote);
    setSyncStatus(`Last sync: ${new Date().toLocaleTimeString()} • Applied ${applied} update(s). ${conflictLog.length ? "Conflicts detected." : ""}`);
  } catch (e) {
    setSyncStatus(`Sync failed: ${e.message}`);
  }
}
function startAutoSync() {
  stopAutoSync();
  autoSyncTimer = setInterval(syncNow, SYNC_INTERVAL_MS);
}
function stopAutoSync() {
  if (autoSyncTimer) clearInterval(autoSyncTimer);
  autoSyncTimer = null;
}

/**********************
 *  Conflict Modal
 **********************/
function openConflictModal() {
  // Build list
  conflictList.innerHTML = "";
  if (!conflictLog.length) {
    const p = document.createElement("p");
    p.textContent = "No conflicts to resolve.";
    conflictList.appendChild(p);
  } else {
    conflictLog.forEach((c, idx) => {
      const wrap = document.createElement("div");
      wrap.className = "conflict-item";

      const title = document.createElement("div");
      title.innerHTML = `<strong>Conflict #${idx+1}</strong> (serverId: ${c.remote.serverId || "n/a"})`;
      wrap.appendChild(title);

      const body = document.createElement("div");
      body.innerHTML = `
        <div class="row" style="margin:8px 0;">
          <label><input type="radio" name="conf-${idx}" value="server" ${c.resolution === "server" ? "checked" : ""}/> Keep <strong>Server</strong></label>
          <label><input type="radio" name="conf-${idx}" value="local"  ${c.resolution === "local"  ? "checked" : ""}/> Keep <strong>Local</strong></label>
        </div>
        <div class="row" style="align-items:flex-start;">
          <div style="flex:1;">
            <div><em>Local</em></div>
            <pre>${JSON.stringify({text:c.local.text, category:c.local.category, updatedAt:c.local.updatedAt}, null, 2)}</pre>
          </div>
          <div style="flex:1;">
            <div><em>Server</em></div>
            <pre>${JSON.stringify({text:c.remote.text, category:c.remote.category, updatedAt:c.remote.updatedAt}, null, 2)}</pre>
          </div>
        </div>
      `;
      wrap.appendChild(body);
      conflictList.appendChild(wrap);
    });
  }
  conflictModal.classList.remove("hidden");
}
function applyResolutions() {
  // Read choices
  conflictLog.forEach((c, idx) => {
    const choice = document.querySelector(`input[name="conf-${idx}"]:checked`);
    const resolution = choice ? choice.value : "server";
    c.resolution = resolution;

    // Apply to local store
    const targetIdx = quotes.findIndex(q => q.id === c.local.id);
    if (targetIdx >= 0) {
      if (resolution === "server") {
        quotes[targetIdx].text = c.remote.text;
        quotes[targetIdx].category = c.remote.category;
        quotes[targetIdx].updatedAt = c.remote.updatedAt;
        quotes[targetIdx].origin = "server";
      } else {
        // keep local -> bump updatedAt and attempt to "push" to server
        quotes[targetIdx].updatedAt = nowISO();
        quotes[targetIdx].origin = "local";
        pushLocalChangeToServer(quotes[targetIdx]); // fire & forget
      }
      quotes[targetIdx].lastSyncedAt = nowISO();
    }
  });

  saveQuotes();
  populateCategories();
  filterQuotes();
  conflictLog = [];
  openConflictsBtn.style.display = "none";
  conflictModal.classList.add("hidden");
  setSyncStatus(`Conflicts resolved at ${new Date().toLocaleTimeString()}.`);
}
function closeConflictModal() {
  conflictModal.classList.add("hidden");
}

/**********************
 *  Init
 **********************/
function init() {
  quotes = loadQuotes();
  populateCategories();
  createAddQuoteForm();

  // Restore last viewed quote if any (session)
  const last = getLastViewedQuote();
  if (last && last.text && last.category) {
    quoteDisplay.textContent = `"${last.text}" — [${last.category}]`;
    setStatus("Restored last viewed quote.");
  } else {
    quoteDisplay.textContent = 'Click "Show New Quote" to see one!';
  }

  // Events
  newQuoteBtn.addEventListener("click", filterQuotes);
  categoryFilter.addEventListener("change", filterQuotes);
  exportBtn.addEventListener("click", exportToJsonFile);

  // Sync controls
  syncNowBtn.addEventListener("click", syncNow);
  autoSyncToggle.addEventListener("change", (e) => {
    if (e.target.checked) startAutoSync(); else stopAutoSync();
  });
  openConflictsBtn.addEventListener("click", openConflictModal);
  applyResolutionsBtn.addEventListener("click", applyResolutions);
  cancelResolutionsBtn.addEventListener("click", closeConflictModal);
  conflictModal.addEventListener("click", (e) => { if (e.target === conflictModal) closeConflictModal(); });

  // Start
  setSyncStatus("Ready. Auto-sync enabled.");
  startAutoSync();
  syncNow(); // initial sync
}
init();
