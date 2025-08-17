// ===== Storage Keys =====
const QUOTES_KEY = "dqg.quotes.v1";
const LAST_QUOTE_KEY = "dqg.lastQuote";
const SELECTED_CATEGORY_KEY = "dqg.selectedCategory";

// ===== State =====
let quotes = []; // set in init()

// ===== DOM =====
const quoteDisplay = document.getElementById("quoteDisplay");
const newQuoteBtn = document.getElementById("newQuote");
const categoryFilter = document.getElementById("categoryFilter");
const exportBtn = document.getElementById("exportJson");
const statusEl = document.getElementById("status");

// ===== Utilities =====
function setStatus(msg) {
  statusEl.textContent = msg || "";
}
function sanitizeQuote(obj) {
  // Returns a normalized quote object or null if invalid
  if (!obj || typeof obj !== "object") return null;
  const text = typeof obj.text === "string" ? obj.text.trim() : "";
  const category = typeof obj.category === "string" ? obj.category.trim() : "";
  if (!text || !category) return null;
  return { text, category };
}

// ===== LocalStorage Handlers =====
function loadQuotes() {
  try {
    const raw = localStorage.getItem(QUOTES_KEY);
    if (!raw) {
      // Seed defaults on first run
      return [
        { text: "The best way to predict the future is to invent it.", category: "Inspiration" },
        { text: "Life is what happens when you're busy making other plans.", category: "Life" },
        { text: "Do or do not. There is no try.", category: "Motivation" }
      ];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("Stored quotes not an array.");
    // sanitize & filter
    const cleaned = parsed.map(sanitizeQuote).filter(Boolean);
    return cleaned.length ? cleaned : [
      { text: "Start where you are. Use what you have. Do what you can.", category: "Action" }
    ];
  } catch {
    // Corrupt storage fallback
    return [
      { text: "Error reading saved data—storage reset to defaults.", category: "System" }
    ];
  }
}

function saveQuotes() {
  localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));
}

// ===== SessionStorage Handlers (Optional) =====
function saveLastViewedQuote(quote) {
  try {
    sessionStorage.setItem(LAST_QUOTE_KEY, JSON.stringify(quote));
  } catch {}
}
function getLastViewedQuote() {
  try {
    const raw = sessionStorage.getItem(LAST_QUOTE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveSelectedCategory(value) {
  try { sessionStorage.setItem(SELECTED_CATEGORY_KEY, value); } catch {}
}
function getSelectedCategory() {
  try { return sessionStorage.getItem(SELECTED_CATEGORY_KEY); } catch { return null; }
}

// ===== UI Builders =====
function createAddQuoteForm() {
  const container = document.getElementById("addQuoteContainer");
  container.innerHTML = ""; // idempotent

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

// ===== Core Features =====
function populateCategories() {
  const categories = [...new Set(quotes.map(q => q.category))].sort((a, b) => a.localeCompare(b));
  const prev = categoryFilter.value;
  categoryFilter.innerHTML = `<option value="all">All</option>`;
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);
  });

  // Restore selected category from session or previous selection
  const saved = getSelectedCategory();
  const toSet = saved || prev || "all";
  if ([...categoryFilter.options].some(o => o.value === toSet)) {
    categoryFilter.value = toSet;
  } else {
    categoryFilter.value = "all";
  }
}

function showRandomQuote() {
  let pool = quotes;
  const selectedCategory = categoryFilter.value;
  if (selectedCategory !== "all") {
    pool = quotes.filter(q => q.category === selectedCategory);
  }
  if (!pool.length) {
    quoteDisplay.textContent = "No quotes available in this category.";
    setStatus("");
    return;
  }
  const idx = Math.floor(Math.random() * pool.length);
  const quote = pool[idx];
  quoteDisplay.textContent = `"${quote.text}" — [${quote.category}]`;
  saveLastViewedQuote(quote);
  saveSelectedCategory(selectedCategory);
  setStatus(`Displayed a ${selectedCategory === "all" ? "random" : `"${selectedCategory}"`} quote.`);
}

function addQuote() {
  const textInput = document.getElementById("newQuoteText");
  const catInput = document.getElementById("newQuoteCategory");
  const text = (textInput?.value || "").trim();
  const category = (catInput?.value || "").trim();

  if (!text || !category) {
    alert("Please enter both a quote and category.");
    return;
  }

  quotes.push({ text, category });
  saveQuotes();
  populateCategories();
  setStatus("Quote added and saved.");
  textInput.value = "";
  catInput.value = "";
}

// ===== JSON Export/Import =====
function exportToJsonFile() {
  const data = JSON.stringify(quotes, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  // Filename like quotes-2025-08-17.json
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
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

// Required to be global since index.html uses inline onchange
function importFromJsonFile(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  const fileReader = new FileReader();
  fileReader.onload = function (e) {
    try {
      const imported = JSON.parse(e.target.result);

      if (!Array.isArray(imported)) {
        alert("Invalid file format: expected an array of quotes.");
        return;
      }

      // sanitize, merge, and de-duplicate by text|category
      const incoming = imported.map(sanitizeQuote).filter(Boolean);
      if (!incoming.length) {
        alert("No valid quotes found in file.");
        return;
      }

      const key = q => `${q.text}❙${q.category}`; // simple composite key
      const seen = new Set(quotes.map(key));
      const toAdd = incoming.filter(q => !seen.has(key(q)));

      if (!toAdd.length) {
        alert("All imported quotes were duplicates of existing ones.");
        return;
      }

      quotes.push(...toAdd);
      saveQuotes();
      populateCategories();
      setStatus(`Imported ${toAdd.length} quote(s).`);
      alert("Quotes imported successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to import: invalid JSON.");
    } finally {
      // clear input so the same file can be re-selected if needed
      event.target.value = "";
    }
  };
  fileReader.readAsText(file);
}

// Attach to window for inline handler access
window.importFromJsonFile = importFromJsonFile;

// ===== Init =====
function init() {
  quotes = loadQuotes();
  populateCategories();
  createAddQuoteForm();

  // Restore last viewed quote if available
  const last = getLastViewedQuote();
  if (last && last.text && last.category) {
    quoteDisplay.textContent = `"${last.text}" — [${last.category}]`;
    setStatus("Restored last viewed quote from session.");
    // Also restore selected category (if it exists in current categories)
    const savedCat = getSelectedCategory();
    if (savedCat && [...categoryFilter.options].some(o => o.value === savedCat)) {
      categoryFilter.value = savedCat;
    }
  } else {
    quoteDisplay.textContent = 'Click "Show New Quote" to see one!';
    setStatus("");
  }

  // Events
  newQuoteBtn.addEventListener("click", showRandomQuote);
  categoryFilter.addEventListener("change", () => {
    saveSelectedCategory(categoryFilter.value);
    showRandomQuote();
  });
  exportBtn.addEventListener("click", exportToJsonFile);
}

init();
