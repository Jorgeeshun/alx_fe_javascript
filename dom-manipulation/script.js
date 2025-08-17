// --- Quotes Array ---
let quotes = JSON.parse(localStorage.getItem("quotes")) || [
  { text: "The best way to predict the future is to invent it.", category: "Inspiration" },
  { text: "Life is 10% what happens to us and 90% how we react to it.", category: "Life" },
  { text: "Do not take life too seriously. You will never get out of it alive.", category: "Humor" }
];

// --- DOM References ---
const quoteDisplay = document.getElementById("quoteDisplay");
const newQuoteBtn = document.getElementById("newQuote");
const categoryFilter = document.getElementById("categoryFilter");
const exportBtn = document.getElementById("exportJson");
const statusBox = document.getElementById("status");

// --- Storage Helpers ---
function saveQuotes() {
  localStorage.setItem("quotes", JSON.stringify(quotes));
}

// --- Quote Display ---
function showRandomQuote() {
  const category = categoryFilter.value || "all";
  let filtered = quotes;
  if (category !== "all") {
    filtered = quotes.filter(q => q.category === category);
  }

  if (filtered.length === 0) {
    quoteDisplay.textContent = "No quotes available for this category.";
    return;
  }

  const randomIndex = Math.floor(Math.random() * filtered.length);
  const quote = filtered[randomIndex];
  quoteDisplay.textContent = `"${quote.text}" — [${quote.category}]`;

  // Save last viewed quote + filter in sessionStorage
  sessionStorage.setItem("lastQuote", JSON.stringify(quote));
  sessionStorage.setItem("lastFilter", category);
}

// --- Category Population ---
function populateCategories() {
  const categories = ["all", ...new Set(quotes.map(q => q.category))];
  categoryFilter.innerHTML = "";
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    categoryFilter.appendChild(opt);
  });

  // Restore last filter
  const savedFilter = localStorage.getItem("lastFilter") || "all";
  categoryFilter.value = savedFilter;
}

// --- Add Quote Form ---
function createAddQuoteForm() {
  const container = document.getElementById("addQuoteContainer");
  container.innerHTML = `
    <div class="form-section">
      <h3>Add a New Quote</h3>
      <div class="row">
        <input id="newQuoteText" type="text" placeholder="Enter a new quote" />
        <input id="newQuoteCategory" type="text" placeholder="Enter quote category" />
        <button id="addQuoteBtn">Add Quote</button>
      </div>
    </div>
  `;

  document.getElementById("addQuoteBtn").addEventListener("click", addQuote);
}

function addQuote() {
  const text = document.getElementById("newQuoteText").value.trim();
  const category = document.getElementById("newQuoteCategory").value.trim();

  if (!text || !category) {
    alert("Please enter both a quote and a category.");
    return;
  }

  quotes.push({ text, category });
  saveQuotes();
  populateCategories();
  document.getElementById("newQuoteText").value = "";
  document.getElementById("newQuoteCategory").value = "";
  alert("Quote added successfully!");
}

// --- Import / Export ---
function exportToJsonFile() {
  const dataStr = JSON.stringify(quotes, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quotes.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importFromJsonFile(event) {
  const fileReader = new FileReader();
  fileReader.onload = function (e) {
    const importedQuotes = JSON.parse(e.target.result);
    quotes.push(...importedQuotes);
    saveQuotes();
    populateCategories();
    alert("Quotes imported successfully!");
  };
  fileReader.readAsText(event.target.files[0]);
}

// --- Filtering ---
function filterQuotes() {
  const selected = categoryFilter.value;
  localStorage.setItem("lastFilter", selected);
  showRandomQuote();
}

// --- 🔥 Server Sync (NEW) ---
async function fetchQuotesFromServer() {
  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/posts?_limit=5");
    const serverData = await response.json();

    // Convert server posts into quote format
    const serverQuotes = serverData.map(post => ({
      text: post.title,
      category: "Server"
    }));

    // Conflict resolution: server data takes precedence
    quotes = [...serverQuotes, ...quotes];
    saveQuotes();
    populateCategories();
    showRandomQuote();
    notifyUser("Quotes synced with server (server data takes precedence).");
  } catch (err) {
    console.error("Error fetching from server:", err);
    notifyUser("Failed to sync with server.");
  }
}

// --- 🔥 Sync ALL Quotes to Server ---
async function syncAllQuotesToServer() {
  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/posts", {
      method: "POST",                     // ✅ required
      headers: {                          // ✅ required
        "Content-Type": "application/json" // ✅ required
      },
      body: JSON.stringify(quotes)        // send the entire quotes array
    });

    const result = await response.json();
    console.log("All quotes synced to server:", result);
    notifyUser("All quotes synced to server!");
  } catch (err) {
    console.error("Error syncing all quotes:", err);
    notifyUser("Failed to sync all quotes.");
  }
}

// --- 🔥 Unified Sync Function ---
async function syncQuotes() {
  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(quotes)  // send entire array
    });

    const result = await response.json();
    console.log("Quotes synced (syncQuotes):", result);
    notifyUser("Quotes synced with server!");
  } catch (err) {
    console.error("Error syncing quotes:", err);
    notifyUser("Failed to sync quotes with server.");
  }
}


// Attach to button
document.getElementById("syncAll").addEventListener("click", syncAllQuotesToServer);
document.getElementById("syncAll").addEventListener("click", syncQuotes);


function notifyUser(message) {
  if (!statusBox) return;
  statusBox.textContent = message;
  setTimeout(() => (statusBox.textContent = ""), 5000);
}

// --- Initialization ---
newQuoteBtn.addEventListener("click", showRandomQuote);
categoryFilter.addEventListener("change", filterQuotes);
exportBtn.addEventListener("click", exportToJsonFile);

// Setup UI
createAddQuoteForm();
populateCategories();
showRandomQuote();

// Restore last viewed quote if session exists
const lastQuote = JSON.parse(sessionStorage.getItem("lastQuote"));
if (lastQuote) {
  quoteDisplay.textContent = `"${lastQuote.text}" — [${lastQuote.category}]`;
}

// 🔁 Periodic Sync (every 30s)
setInterval(fetchQuotesFromServer, 30000);
