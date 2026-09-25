const WATCHLIST = [
  { ticker: "NEET", name: "NotInEmploymentEducationTraining", mint: "Ce2gx9KGXJ6C9Mp5b5x1sn9Mg87JwEbrQby4Zqo3pump", og: false },
  { ticker: "TROLL", name: "TROLL", mint: "5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2", og: false },
  { ticker: "PENGU", name: "Pudgy Penguins", mint: "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv", og: true },
  { ticker: "TRUMP", name: "Official Trump", mint: "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN", og: true },
  { ticker: "BONK", name: "Bonk", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", og: true },
  { ticker: "WIF", name: "dogwifhat", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", og: true },
  { ticker: "FARTCOIN", name: "Fartcoin", mint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump", og: true },
  { ticker: "USELESS", name: "Useless Coin", mint: "Dz9mQ9NzkBcCsuGPFJ3r1bS4wgqKMHBPiVuniW8Mbonk", og: false },
  { ticker: "BOME", name: "Book of Meme", mint: "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82", og: true },
  { ticker: "POPCAT", name: "Popcat", mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", og: true },
  { ticker: "PNUT", name: "Peanut the Squirrel", mint: "2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump", og: true },
  { ticker: "MOODENG", name: "Moo Deng", mint: "ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY", og: true },
  { ticker: "MEW", name: "cat in a dogs world", mint: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5", og: true },
  { ticker: "GIGA", name: "GIGACHAD", mint: "63LfDmNb3MQ8mw9MtZ2To9bEA2M71kZUUGq5tiJxcqj9", og: true },
  { ticker: "GOAT", name: "Goatseus Maximus", mint: "CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump", og: false },
  { ticker: "PONKE", name: "PONKE", mint: "5z3EqYQo9HiCEs3R84RCDMu2n7anpDMxRhdK8PSWmrRC", og: true }
];

let rows = [];
let selected = WATCHLIST[0].mint;
let chartTf = "15m";
let chart, candleSeries, volSeries;
const candleCache = {};

const $ = id => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const fmtUsd = n => {
  if (n == null || Number.isNaN(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
  if (a >= 1) return "$" + n.toFixed(4);
  return "$" + Number(n).toPrecision(4);
};
const fmtPct = n => n == null || Number.isNaN(n) ? "—" : (n >= 0 ? "+" : "") + n.toFixed(2) + "%";

function scoreToken(t) {
  const liq = t.liq || 0, mcap = t.mcap || 0, vol = t.vol24 || 0;
  const chg24 = t.chg24 || 0, buys = t.buys || 0, sells = t.sells || 0, tx = buys + sells;
  const liqScore = clamp(Math.log10(liq + 1) / Math.log10(8e6) * 22, 0, 22);
  const turn = mcap > 0 ? vol / mcap : 0;
  const turnScore = turn >= 0.08 && turn <= 0.6 ? 20 : turn > 0.6 && turn <= 1.5 ? 14 : turn >= 0.03 ? 10 : 4;
  let mom = chg24 >= 4 && chg24 <= 35 ? 18 : chg24 > 35 && chg24 <= 80 ? 11 : chg24 > 80 ? 4 : chg24 >= -8 ? 10 : 6;
  if ((t.chg1 || 0) > 0 && (t.chg6 || 0) > 0 && chg24 > 0) mom += 4;
  let flow = 6;
  if (tx >= 200) {
    const tilt = buys / tx;
    flow = tilt >= 0.56 ? 16 : tilt >= 0.5 ? 12 : tilt >= 0.45 ? 8 : 3;
  }
  let penalty = liq < 250000 ? 12 : liq < 800000 ? 5 : 0;
  const score = Math.round(clamp(liqScore + turnScore + mom + flow + (t.og ? 8 : 3) - penalty, 1, 99));
  const call = score >= 72 && chg24 < 60 && liq >= 800000 ? "BUY ZONE" : score >= 58 ? "WATCH" : "AVOID";
  return { score, call };
}

function pickPair(pairs, mint) {
  return (pairs || [])
    .filter(p => p.chainId === "solana" && (p.baseToken && p.baseToken.address === mint || p.quoteToken && p.quoteToken.address === mint))
    .sort((a, b) => ((b.liquidity && b.liquidity.usd || 0) - (a.liquidity && a.liquidity.usd || 0)))[0] || null;
}

function geckoSpec(tf) {
  if (tf === "1d") return { tf: "day", agg: 1, limit: 180 };
  if (tf === "4h") return { tf: "hour", agg: 4, limit: 180 };
  if (tf === "1h") return { tf: "hour", agg: 1, limit: 300 };
  if (tf === "15m") return { tf: "minute", agg: 15, limit: 400 };
  if (tf === "5m") return { tf: "minute", agg: 5, limit: 400 };
  return { tf: "minute", agg: 1, limit: 400 };
}

async function fetchCandles(t) {
  const key = t.mint + ":" + chartTf;
  if (candleCache[key] && Date.now() - candleCache[key].at < 20000) return candleCache[key].data;
  const spec = geckoSpec(chartTf);
  const urls = [];
  if (t.pairAddress) urls.push("https://api.geckoterminal.com/api/v2/networks/solana/pools/" + t.pairAddress + "/ohlcv/" + spec.tf + "?aggregate=" + spec.agg + "&limit=" + spec.limit + "&currency=usd");
  urls.push("https://api.geckoterminal.com/api/v2/networks/solana/tokens/" + t.mint + "/ohlcv/" + spec.tf + "?aggregate=" + spec.agg + "&limit=" + spec.limit + "&currency=usd");
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const json = await res.json();
      const list = json && json.data && json.data.attributes && json.data.attributes.ohlcv_list || [];
      const data = list.map(function(r) {
        return { time: Number(r[0]), open: +r[1], high: +r[2], low: +r[3], close: +r[4], value: +r[5] || 0 };
      }).filter(function(c) { return c.close > 0 && c.time; }).sort(function(a, b) { return a.time - b.time; });
      if (data.length) {
        candleCache[key] = { at: Date.now(), data: data, source: "GeckoTerminal" };
        return data;
      }
    } catch (e) {}
  }
  const approx = approxCandles(t);
  candleCache[key] = { at: Date.now(), data: approx, source: "approx" };
  return approx;
}

function approxCandles(t) {
  const price = Number(t.price);
  if (!price) return [];
  const now = Math.floor(Date.now() / 1000);
  const step = chartTf === "1d" ? 86400 : chartTf === "4h" ? 14400 : chartTf === "1h" ? 3600 : chartTf === "15m" ? 900 : chartTf === "5m" ? 300 : 60;
  const p24 = price / (1 + (t.chg24 || 0) / 100);
  const p6 = price / (1 + (t.chg6 || 0) / 100);
  const p1 = price / (1 + (t.chg1 || 0) / 100);
  const p5 = price / (1 + (t.chg5 || 0) / 100);
  const anchors = [
    { t: now - 86400, p: p24 },
    { t: now - 21600, p: p6 },
    { t: now - 3600, p: p1 },
    { t: now - 300, p: p5 },
    { t: now, p: price }
  ];
  const out = [];
  let prev = p24;
  for (let ts = now - 86400; ts <= now; ts += step) {
    const a = anchors.slice().reverse().find(function(x) { return x.t <= ts; }) || anchors[0];
    const b = anchors.find(function(x) { return x.t >= ts; }) || anchors[anchors.length - 1];
    const w = b.t === a.t ? 1 : (ts - a.t) / (b.t - a.t);
    const close = a.p + (b.p - a.p) * w;
    const open = prev;
    out.push({ time: ts, open: open, high: Math.max(open, close) * 1.004, low: Math.min(open, close) * 0.996, close: close, value: (t.vol24 || 0) / (86400 / step) });
    prev = close;
  }
  return out;
}

function initChart() {
  const el = $("tv");
  chart = LightweightCharts.createChart(el, {
    layout: { background: { color: "#07080c" }, textColor: "#8b95a8" },
    grid: { vertLines: { color: "#1a2030" }, horzLines: { color: "#1a2030" } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: "#232a38" },
    timeScale: { borderColor: "#232a38", timeVisible: true, secondsVisible: false, rightOffset: 4 },
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
    handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true }
  });
  candleSeries = chart.addCandlestickSeries({
    upColor: "#3dff9a", downColor: "#ff4d6d",
    borderUpColor: "#3dff9a", borderDownColor: "#ff4d6d",
    wickUpColor: "#3dff9a", wickDownColor: "#ff4d6d"
  });
  volSeries = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "vol" });
  chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
  new ResizeObserver(function() { chart.applyOptions({ width: el.clientWidth, height: el.clientHeight }); }).observe(el);
  chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
}

async function showToken(mint) {
  selected = mint;
  renderList();
  const t = rows.find(function(x) { return x.mint === mint; });
  if (!t) return;
  $("title").textContent = t.ticker + " \u00b7 " + chartTf;
  $("stats").innerHTML =
    "<span>Price <b>" + fmtUsd(t.price) + "</b></span>" +
    "<span>24h <b class=\"" + (t.chg24 >= 0 ? "up" : "dn") + "\">" + fmtPct(t.chg24) + "</b></span>" +
    "<span>MC <b>" + fmtUsd(t.mcap) + "</b></span>" +
    "<span>Liq <b>" + fmtUsd(t.liq) + "</b></span>" +
    "<span>Vol <b>" + fmtUsd(t.vol24) + "</b></span>" +
    "<span>Score <b class=\"" + (t.call === "BUY ZONE" ? "buy" : t.call === "WATCH" ? "watch" : "avoid") + "\">" + t.score + " " + t.call + "</b></span>" +
    "<a href=\"https://dexscreener.com/solana/" + t.mint + "\" target=\"_blank\" rel=\"noopener\" style=\"color:#3dff9a\">DexScreener</a>";
  $("hint").textContent = "Loading candles…";
  const data = await fetchCandles(t);
  if (mint !== selected) return;
  candleSeries.setData(data.map(function(c) { return { time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }; }));
  volSeries.setData(data.map(function(c) {
    return { time: c.time, value: c.value || 0, color: c.close >= c.open ? "rgba(61,255,154,0.35)" : "rgba(255,77,109,0.35)" };
  }));
  chart.timeScale().fitContent();
  const src = (candleCache[t.mint + ":" + chartTf] || {}).source;
  if (src === "GeckoTerminal") {
    $("hint").innerHTML = "Real " + chartTf + " candles. Drag to pan. Scroll to zoom. <a href=\"https://dexscreener.com/solana/" + t.mint + "\" target=\"_blank\">DexScreener</a>";
  } else {
    $("hint").innerHTML = "Using DexScreener 24h path. Drag and zoom still work. Tick candles: <a href=\"https://dexscreener.com/solana/" + t.mint + "\" target=\"_blank\">DexScreener</a>.";
  }
}

function filtered() {
  const q = $("search").value.trim().toLowerCase();
  const key = $("sort").value;
  let list = rows.filter(function(t) { return !q || t.ticker.toLowerCase().includes(q) || t.name.toLowerCase().includes(q); });
  const cmp = {
    score: function(a, b) { return b.score - a.score; },
    mcap: function(a, b) { return b.mcap - a.mcap; },
    vol: function(a, b) { return b.vol24 - a.vol24; },
    chg: function(a, b) { return b.chg24 - a.chg24; }
  }[key];
  return list.sort(cmp);
}

function renderList() {
  $("list").innerHTML = filtered().map(function(t) {
    return "<div class=\"row " + (t.mint === selected ? "on" : "") + "\" data-mint=\"" + t.mint + "\">" +
      "<img src=\"" + t.image + "\" alt=\"\" onerror=\"this.style.opacity=.25\" />" +
      "<div><div class=\"sym\">" + t.ticker + (t.og ? " \u00b7 OG" : "") + "</div><div class=\"sub\">" + fmtUsd(t.price) + "</div></div>" +
      "<div class=\"" + (t.chg24 >= 0 ? "up" : "dn") + "\">" + fmtPct(t.chg24) + "</div>" +
      "<div class=\"score " + (t.call === "BUY ZONE" ? "buy" : t.call === "WATCH" ? "watch" : "avoid") + "\">" + t.score + "</div></div>";
  }).join("");
  $("list").querySelectorAll(".row").forEach(function(el) {
    el.onclick = function() { showToken(el.getAttribute("data-mint")); };
  });
}

async function load(keepChart) {
  const res = await fetch("https://api.dexscreener.com/latest/dex/tokens/" + WATCHLIST.map(function(t) { return t.mint; }).join(","));
  if (!res.ok) throw new Error("DexScreener " + res.status);
  const pairs = (await res.json()).pairs || [];
  rows = WATCHLIST.map(function(meta) {
    const pair = pickPair(pairs, meta.mint);
    const pc = pair && pair.priceChange || {};
    const vol = pair && pair.volume || {};
    const tx = pair && pair.txns && pair.txns.h24 || {};
    const t = Object.assign({}, meta, {
      pairAddress: pair && pair.pairAddress || "",
      image: pair && pair.info && pair.info.imageUrl || ("https://dd.dexscreener.com/ds-data/tokens/solana/" + meta.mint + ".png"),
      price: pair && pair.priceUsd ? Number(pair.priceUsd) : null,
      mcap: Number(pair && (pair.marketCap || pair.fdv) || 0) || 0,
      liq: Number(pair && pair.liquidity && pair.liquidity.usd || 0) || 0,
      vol24: Number(vol.h24 || 0) || 0,
      chg5: Number(pc.m5 || 0),
      chg1: Number(pc.h1 || 0),
      chg6: Number(pc.h6 || 0),
      chg24: Number(pc.h24 || 0),
      buys: Number(tx.buys || 0),
      sells: Number(tx.sells || 0)
    });
    Object.assign(t, scoreToken(t));
    return t;
  });
  $("updated").textContent = new Date().toLocaleTimeString();
  renderList();
  if (!keepChart) await showToken(selected);
}

document.querySelector(".bar").addEventListener("click", function(e) {
  const btn = e.target.closest("[data-tf]");
  if (!btn) return;
  chartTf = btn.getAttribute("data-tf");
  document.querySelectorAll("[data-tf]").forEach(function(b) { b.classList.toggle("on", b === btn); });
  showToken(selected);
});
$("search").addEventListener("input", renderList);
$("sort").addEventListener("change", renderList);
$("fit").addEventListener("click", function() { if (chart) chart.timeScale().fitContent(); });
$("refresh").addEventListener("click", function() { load(true).catch(function(err) { $("list").textContent = err.message; }); });

initChart();
load(false).catch(function(err) { $("list").textContent = err.message; $("hint").textContent = err.message; });
setInterval(function() { load(true).catch(function() {}); }, 30000);
