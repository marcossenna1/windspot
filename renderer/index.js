/**
 * Kitesurf OG Image Renderer
 * GET /og-image/:spot?wind=22&gusts=28&status=go&score=88&dir=SW
 * Returns a 1200×630 PNG forecast card suitable for og:image meta tags.
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");
const satori = require("satori").default;
const { Resvg } = require("@resvg/resvg-js");

// Load Inter woff font from @fontsource/inter (woff format — supported by Satori)
const FONT_PATH = require.resolve(
  "@fontsource/inter/files/inter-latin-400-normal.woff"
);
let fontData = null;
function getFont() {
  if (!fontData) {
    fontData = fs.readFileSync(FONT_PATH);
    console.log("[renderer] Font loaded from", FONT_PATH, "(" + fontData.length + " bytes)");
  }
  return fontData;
}

const PORT = process.env.PORT || 8001;

// Zone colour lookup
const STATUS_COLOR = {
  go:    "#2a9d5c",
  maybe: "#ccaa00",
  nogo:  "#c0392b",
};

const STATUS_LABEL = {
  go:    "GO",
  maybe: "MAYBE",
  nogo:  "NO GO",
};

function scoreToStatus(score) {
  if (score >= 75) return "go";
  if (score >= 45) return "maybe";
  return "nogo";
}

/**
 * Build the Satori JSX-like element tree for the forecast card.
 */
function buildCard({ spot, wind, gusts, dir, status, score, air, water, wave }) {
  const color = STATUS_COLOR[status] || "#888";
  const label = STATUS_LABEL[status] || status.toUpperCase();

  const col = (style, children) => ({
    type: "div",
    props: { style: { display: "flex", flexDirection: "column", ...style }, children },
  });

  const row = (style, children) => ({
    type: "div",
    props: { style: { display: "flex", flexDirection: "row", ...style }, children },
  });

  const txt = (style, children) => ({
    type: "div",
    props: { style, children },
  });

  const statCol = (label, value, valueStyle) =>
    col({ gap: "4px" }, [
      txt({ fontSize: "18px", color: "#888" }, label),
      txt({ fontSize: "56px", fontWeight: "700", ...valueStyle }, value),
    ]);

  const extraCols = [];
  if (air) extraCols.push(statCol("Air / Water", `${air}° / ${water || "?"}°`, {}));
  if (wave) extraCols.push(statCol("Waves", `${wave}m`, {}));

  return col(
    { width: "1200px", height: "630px", background: "#0d1117", padding: "48px 64px", color: "#f0f0f0" },
    [
      // Header
      row({ justifyContent: "space-between", alignItems: "center" }, [
        txt({ fontSize: "52px", fontWeight: "700", color: "#ffffff" }, spot),
        txt({
          background: color, color: "#fff", fontSize: "36px", fontWeight: "800",
          padding: "10px 32px", borderRadius: "12px",
        }, label),
      ]),
      // Score
      txt({ fontSize: "24px", color: "#aaa", marginTop: "8px" }, `Session score: ${score}`),
      // Divider
      txt({ height: "2px", background: "#2a2a2a", margin: "32px 0" }, ""),
      // Wind stats row
      row({ gap: "64px", alignItems: "flex-end" }, [
        statCol("Wind / Gusts", `${wind}/${gusts} kn`, { color }),
        statCol("Direction", dir, {}),
        ...extraCols,
      ]),
      // Footer
      txt({ marginTop: "auto", fontSize: "18px", color: "#555" }, "WindSpot — Kitesurf Forecast Dashboard"),
    ]
  );
}

async function renderCard(params) {
  const element = buildCard(params);
  const font = getFont();
  const svg = await satori(element, {
    width: 1200,
    height: 630,
    fonts: [{ name: "Inter", data: font, weight: 400, style: "normal" }],
  });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
  return resvg.render().asPng();
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  if (path === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  const match = path.match(/^\/og-image\/(.+)$/);
  if (!match) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const spot = decodeURIComponent(match[1]);
  const wind  = parseInt(url.searchParams.get("wind")   ?? "0",  10);
  const gusts = parseInt(url.searchParams.get("gusts")  ?? "0",  10);
  const score = parseInt(url.searchParams.get("score")  ?? "0",  10);
  const dir   = url.searchParams.get("dir")   ?? "—";
  const air   = url.searchParams.get("air")   ?? null;
  const water = url.searchParams.get("water") ?? null;
  const wave  = url.searchParams.get("wave")  ?? null;
  const rawStatus = url.searchParams.get("status");
  const status = rawStatus ?? scoreToStatus(score);

  try {
    const png = await renderCard({ spot, wind, gusts, dir, status, score, air, water, wave });
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=900",  // 15 min
      "Content-Length": png.length,
    });
    res.end(png);
  } catch (err) {
    console.error("[renderer]", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(err) }));
  }
});

server.listen(PORT, () => {
  console.log(`[renderer] listening on http://0.0.0.0:${PORT}`);
});
