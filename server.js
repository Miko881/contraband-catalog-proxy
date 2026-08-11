// Contraband Catalog Proxy
// Pośredniczy między grą Roblox a katalogiem Roblox (catalog.roblox.com),
// żeby ominąć blokadę HttpService na domeny *.roblox.com z poziomu gry.

const express = require("express");
const app = express();
const PORT = process.env.PORT || 10000;

// Dozwolone wartości wg oficjalnej dokumentacji Roblox
// https://create.roblox.com/docs/projects/assets/api
const VALID_LIMITS = new Set([10, 28, 30]);

// Category (byte): 0=Featured 1=All 2=Collectibles 3=Clothing 4=BodyParts
//                  5=Gear 11=Accessories 12=AvatarAnimations 13=CommunityCreations
const DEFAULT_CATEGORY = 11; // Accessories — to było źródłem błędu 400 (wcześniej 2 = Collectibles)

app.get("/catalog", async (req, res) => {
  try {
    const {
      keyword = "",
      creatorId = "",
      creatorType = "", // 1 = User, 2 = Group
      category = String(DEFAULT_CATEGORY),
      subcategory = "",
      limit = "30",
      sortType = "0", // 0=Relevance 1=Favorited 2=Sales 3=Updated 4=PriceAsc 5=PriceDesc
    } = req.query;

    const params = new URLSearchParams();
    params.set("Category", category);
    if (subcategory) params.set("Subcategory", subcategory);
    if (keyword) params.set("Keyword", keyword);

    // CreatorType i CreatorTargetId muszą iść razem
    if (creatorId && creatorType) {
      params.set("CreatorTargetId", creatorId);
      params.set("CreatorType", creatorType); // 1 lub 2 (byte)
    }

    const safeLimit = VALID_LIMITS.has(Number(limit)) ? limit : "30";
    params.set("Limit", safeLimit);
    params.set("SortType", sortType);

    const url = `https://catalog.roblox.com/v1/search/items/details?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ContrabandCatalogProxy/1.0)",
        Accept: "application/json",
      },
    });

    const rawText = await response.text();

    if (!response.ok) {
      console.error(`Roblox catalog zwrocil ${response.status}: ${rawText.slice(0, 300)}`);
      return res.status(response.status).json({
        error: `Katalog Roblox odpowiedzial kodem ${response.status}`,
        requestedUrl: url,
        details: rawText.slice(0, 300),
      });
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      return res.status(502).json({
        error: "Nie udalo sie sparsowac odpowiedzi z katalogu Roblox",
        details: rawText.slice(0, 300),
      });
    }

    const items = (data.data || []).map((it) => ({
      name: it.name,
      assetId: it.id,
      price: it.price ?? 0,
      priceStatus: it.priceStatus ?? null,
      creatorName: it.creatorName,
      itemType: it.itemType,
    }));

    res.json({
      items,
      nextPageCursor: data.nextPageCursor || null,
    });
  } catch (err) {
    console.error("Blad serwera proxy:", err);
    res.status(500).json({ error: "Blad serwera proxy", details: err.message });
  }
});

app.get("/", (_req, res) => {
  res.send("Contraband Catalog Proxy dziala. Sprawdz /catalog?keyword=cat%20ears");
});

app.listen(PORT, () => {
  console.log("Proxy nasluchuje na porcie " + PORT);
});
