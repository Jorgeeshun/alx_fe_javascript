// ===== Storage Keys =====
const QUOTES_KEY = "dqg.quotes.v1";
const SELECTED_CATEGORY_KEY = "dqg.selectedCategory";

// ===== State =====
let quotes = [];

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
  if (!obj || typeof obj !== "object") return null;
  const text = typeof obj.text === "string" ? obj.text.trim() : "";
  const category = typeof obj.category === "string" ? obj.category.trim() : "";
  if (!text || !category) return null;
  return { text, category };
}

// ===== LocalStorage =====
function loadQuotes() {
  const raw = localStorage.getItem(QUOTES_KEY);
  if (!raw) {
    return [
      { text: "The best way to predict the future is to invent it.", category: "Inspiration" },
      { text: "Life is what happens when you're busy making other plans.", category: "Life" },
      { text: "Do or do not. There is no try.", category: "Motivation" }
    ];
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

// ===== UI Builders =====
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

// ===== Category Handling =====
function populateCategories() {
  const categories = [...new Set(quotes.map(q => q.category))].sort();
  categoryFilter.innerHTML = `<option value="all">All Categories</option>`;
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);
  });

  // Restore saved filter
  const saved = getSavedCategory();
  if ([...categoryFilter.options].some(o => o.value === saved)) {
    categoryFilter.value = saved;
  }
}

// ===== Filtering =====
function filterQuotes() {
  const selected = categoryFilter.value;
  saveSelectedCategory(selected);

  const filtered = selected === "all" ? quotes : quotes.filter(q => q.category === selected);

  if (!filtered.length) {
    quoteDisplay.textContent = "No quotes available in this category.";
    return;
  }

  // show first one from filtered (or random if you prefer)
  const q = filtered[Math.floor(Math.random() * filtered.length)];
  quoteDisplay.textContent = `"${q.text}" — [${q.category}]`;
}

// ===== Adding Quotes =====
function addQuote() {
  const text = document.getElementById("newQuoteText").value.trim();
  const category = document.getElementById("newQuoteCategory").value.trim();

  if (!text || !category) {
    alert("Please enter both a quote and category.");
    return;
  }

  quotes.push({ text, category });
  saveQuotes();
  populateCategories();
  setStatus("Quote added!");
  document.getElementById("newQuoteText").value = "";
  document.getElementById("newQuoteCategory").value = "";
}

// ===== JSON Export/Import =====
function exportToJsonFile() {
  const data = JSON.stringify(quotes, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "quotes.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importFromJsonFile(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) return alert("Invalid file format");
      const cleaned = imported.map(sanitizeQuote).filter(Boolean);
      if (!cleaned.length) return alert("No valid quotes found");

      quotes.push(...cleaned);
      saveQuotes();
      populateCategories();
      alert("Quotes imported!");
    } catch {
      alert("Invalid JSON");
    }
  };
  reader.readAsText(file);
}
window.importFromJsonFile = importFromJsonFile;

// ===== Init =====
function init() {
  quotes = loadQuotes();
  populateCategories();
  createAddQuoteForm();
  filterQuotes();

  newQuoteBtn.addEventListener("click", filterQuotes);
  exportBtn.addEventListener("click", exportToJsonFile);
}
init();
