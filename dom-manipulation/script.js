// ===== Storage Keys =====
const QUOTES_KEY = "dqg.quotes.v1";
const LAST_QUOTE_KEY = "dqg.lastQuote";
const SELECTED_CATEGORY_KEY = "dqg.selectedCategory";

// Initial quotes array
let quotes = [
  { text: "The best way to predict the future is to invent it.", category: "Inspiration" },
  { text: "Life is what happens when you're busy making other plans.", category: "Life" },
  { text: "Do or do not. There is no try.", category: "Motivation" }
];

// DOM elements
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

// --- 1. Create Add Quote Form dynamically ---
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

  // Append to form section
  formSection.appendChild(heading);
  formSection.appendChild(inputQuote);
  formSection.appendChild(inputCategory);
  formSection.appendChild(addBtn);

  // Append to body (or another container if preferred)
  document.body.appendChild(formSection);

  // Add event listener for button
  addBtn.addEventListener("click", addQuote);
}

// --- 2. Populate Categories Dropdown ---
function populateCategories() {
  const categories = [...new Set(quotes.map(q => q.category))]; // unique categories
  categoryFilter.innerHTML = `<option value="all">All</option>`;
  categories.forEach(cat => {
    let option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    categoryFilter.appendChild(option);
  });
}

// --- 3. Show random quote ---
function showRandomQuote() {
  let filteredQuotes = quotes;
  const selectedCategory = categoryFilter.value;

  if (selectedCategory !== "all") {
    filteredQuotes = quotes.filter(q => q.category === selectedCategory);
  }

  if (filteredQuotes.length === 0) {
    quoteDisplay.textContent = "No quotes available in this category.";
    return;
  }

  const randomIndex = Math.floor(Math.random() * filteredQuotes.length);
  const quote = filteredQuotes[randomIndex];
  quoteDisplay.textContent = `"${quote.text}" — [${quote.category}]`;
}

// --- 4. Add new quote ---
function addQuote() {
  const text = document.getElementById("newQuoteText").value.trim();
  const category = document.getElementById("newQuoteCategory").value.trim();

  if (text === "" || category === "") {
    alert("Please enter both a quote and category.");
    return;
  }

  quotes.push({ text, category });

  document.getElementById("newQuoteText").value = "";
  document.getElementById("newQuoteCategory").value = "";

  populateCategories();

  alert("Quote added successfully!");
}

// --- 5. Event listeners ---
newQuoteBtn.addEventListener("click", showRandomQuote);
categoryFilter.addEventListener("change", showRandomQuote);

// --- 6. Initial load ---
populateCategories();
createAddQuoteForm();
