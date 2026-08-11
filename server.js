// ============================================================
// Contraband Catalog Proxy
// ============================================================
// Prosty serwer pośredniczący między Twoją grą Roblox a katalogiem
// Roblox. Roblox blokuje HttpService z gry do domen *.roblox.com,
// więc ten serwer (hostowany GDZIE INDZIEJ, nie na Roblox) robi to
// zapytanie za Ciebie i zwraca dane w prostym formacie JSON.
//
// URUCHOMIENIE LOKALNE (do testów):
//   npm install
//   npm start
//   -> serwer wystartuje na http://localhost:3000
//
// WDROŻENIE (żeby Roblox mógł się z nim połączyć z internetu):
//   Patrz plik DEPLOY.md w tym folderze.
// ============================================================

const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

app.get("/catalog", async (req, res) => {
  try {
    const {
      keyword = "",
      creatorId = "0",
      creatorType = "2", // 1 = User, 2 = Group
      limit = "30",
    } = req.query;

    let url =
      "https://catalog.roblox.com/v1/search/items/details?Category=2&SortType=3&Limit=" +
      encodeURIComponent(limit);

    if (keyword) {
      url += "&Keyword=" + encodeURIComponent(keyword);
    }
    if (creatorId && creatorId !== "0") {
      url +=
        "&CreatorTargetId=" +
        encodeURIComponent(creatorId) +
        "&CreatorType=" +
        encodeURIComponent(creatorType);
    }

    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (ContrabandCatalogProxy)" },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Katalog Roblox odpowiedzial kodem " + response.status,
      });
    }

    const data = await response.json();

    // Upraszczamy odpowiedź do tego, czego potrzebuje gra
    const items = (data.data || []).map((entry) => ({
      name: entry.name,
      assetId: entry.id,
      assetType: entry.assetType,
      price: entry.price ?? entry.lowestPrice ?? 0,
    }));

    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("Contraband catalog proxy dziala. Uzyj /catalog?keyword=... lub /catalog?creatorId=...");
});

app.listen(PORT, () => {
  console.log("Proxy nasluchuje na porcie " + PORT);
});
