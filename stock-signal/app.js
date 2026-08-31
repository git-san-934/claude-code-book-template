(() => {
  "use strict";

  const SHORT_PERIOD = 5;
  const LONG_PERIOD = 25;
  const RSI_PERIOD = 14;
  const CROSS_RECENT_WINDOW = 5;
  const FETCH_TIMEOUT_MS = 8000;

  const form = document.getElementById("codeForm");
  const codeInput = document.getElementById("codeInput");
  const checkBtn = document.getElementById("checkBtn");
  const statusMsg = document.getElementById("statusMsg");
  const fallbackNotice = document.getElementById("fallbackNotice");

  const resultPanel = document.getElementById("resultPanel");
  const resultCode = document.getElementById("resultCode");
  const resultName = document.getElementById("resultName");
  const signalBadge = document.getElementById("signalBadge");
  const resultPrice = document.getElementById("resultPrice");
  const resultChange = document.getElementById("resultChange");
  const reasonList = document.getElementById("reasonList");
  const canvas = document.getElementById("chartCanvas");

  let requestSeq = 0;
  let lastChartData = null; // { rows, smaShort, smaLong, signals } for redraw on resize

  // ---------- symbol normalization ----------

  function normalizeSymbol(raw) {
    const trimmed = raw.trim();
    if (/^\d{4}$/.test(trimmed)) {
      return { symbol: `${trimmed}.jp`, market: "日本株" };
    }
    if (trimmed.includes(".")) {
      return { symbol: trimmed.toLowerCase(), market: guessMarket(trimmed) };
    }
    if (/^[A-Za-z]+$/.test(trimmed)) {
      return { symbol: `${trimmed.toLowerCase()}.us`, market: "米国株" };
    }
    return { symbol: trimmed.toLowerCase(), market: "" };
  }

  function guessMarket(symbolWithSuffix) {
    const suffix = symbolWithSuffix.split(".").pop().toLowerCase();
    if (suffix === "jp") return "日本株";
    if (suffix === "us") return "米国株";
    return "";
  }

  // ---------- data fetching (Stooq daily CSV, no API key required) ----------

  async function fetchStooqData(symbol) {
    const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const rows = parseStooqCSV(text);
      if (rows.length < LONG_PERIOD + CROSS_RECENT_WINDOW) {
        throw new Error("insufficient data for this symbol");
      }
      return rows;
    } finally {
      clearTimeout(timer);
    }
  }

  function parseStooqCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const header = lines[0].toLowerCase();
    if (!header.includes("date") || !header.includes("close")) return [];

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      if (cols.length < 5) continue;
      const [date, open, high, low, close] = cols;
      const closeNum = Number(close);
      if (!date || Number.isNaN(closeNum)) continue;
      rows.push({
        date,
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: closeNum,
      });
    }
    return rows;
  }

  // ---------- deterministic demo data (used when live data can't be fetched) ----------

  function hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) | 0;
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let s = seed;
    return function () {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generateDemoSeries(symbol, days = 130) {
    const seed = hashCode(symbol);
    const rand = mulberry32(seed);
    let price = 500 + (seed % 4000);
    const trendPhase = rand() * Math.PI * 2;

    const dates = [];
    const cursor = new Date();
    while (dates.length < days) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) dates.unshift(new Date(cursor));
      cursor.setDate(cursor.getDate() - 1);
    }

    return dates.map((date, i) => {
      const drift = Math.sin(trendPhase + i / 14) * 0.006;
      const noise = (rand() - 0.5) * 0.02;
      price = Math.max(10, price * (1 + drift + noise));
      const open = price * (1 + (rand() - 0.5) * 0.01);
      const high = Math.max(open, price) * (1 + rand() * 0.01);
      const low = Math.min(open, price) * (1 - rand() * 0.01);
      return {
        date: date.toISOString().slice(0, 10),
        open,
        high,
        low,
        close: price,
      };
    });
  }

  // ---------- technical indicators ----------

  function sma(values, period) {
    const out = new Array(values.length).fill(null);
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      sum += values[i];
      if (i >= period) sum -= values[i - period];
      if (i >= period - 1) out[i] = sum / period;
    }
    return out;
  }

  function rsiValue(avgGain, avgLoss) {
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  function rsi(values, period = 14) {
    const out = new Array(values.length).fill(null);
    let gainSum = 0;
    let lossSum = 0;
    for (let i = 1; i < values.length; i++) {
      const diff = values[i] - values[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      if (i <= period) {
        gainSum += gain;
        lossSum += loss;
        if (i === period) {
          out[i] = rsiValue(gainSum / period, lossSum / period);
        }
      } else {
        gainSum = (gainSum * (period - 1) + gain) / period;
        lossSum = (lossSum * (period - 1) + loss) / period;
        out[i] = rsiValue(gainSum, lossSum);
      }
    }
    return out;
  }

  function findCrossSignals(smaShort, smaLong) {
    const signals = [];
    for (let i = 1; i < smaShort.length; i++) {
      const prevShort = smaShort[i - 1];
      const prevLong = smaLong[i - 1];
      const curShort = smaShort[i];
      const curLong = smaLong[i];
      if (prevShort == null || prevLong == null || curShort == null || curLong == null) continue;
      if (prevShort <= prevLong && curShort > curLong) {
        signals.push({ index: i, type: "buy" });
      } else if (prevShort >= prevLong && curShort < curLong) {
        signals.push({ index: i, type: "sell" });
      }
    }
    return signals;
  }

  function buildVerdict(rows, smaShort, smaLong, rsiValues, signals) {
    const lastIdx = rows.length - 1;
    const reasons = [];
    let score = 0;

    const lastSignal = signals.length ? signals[signals.length - 1] : null;
    if (lastSignal && lastIdx - lastSignal.index <= CROSS_RECENT_WINDOW) {
      if (lastSignal.type === "buy") {
        score += 2;
        reasons.push(
          `直近${CROSS_RECENT_WINDOW}日以内に短期線(SMA${SHORT_PERIOD})が長期線(SMA${LONG_PERIOD})を上抜ける「ゴールデンクロス」が発生しました。`
        );
      } else {
        score -= 2;
        reasons.push(
          `直近${CROSS_RECENT_WINDOW}日以内に短期線(SMA${SHORT_PERIOD})が長期線(SMA${LONG_PERIOD})を下抜ける「デッドクロス」が発生しました。`
        );
      }
    } else if (smaShort[lastIdx] != null && smaLong[lastIdx] != null) {
      if (smaShort[lastIdx] > smaLong[lastIdx]) {
        score += 1;
        reasons.push(`短期線(SMA${SHORT_PERIOD})が長期線(SMA${LONG_PERIOD})の上にあり、上昇トレンドが続いています。`);
      } else {
        score -= 1;
        reasons.push(`短期線(SMA${SHORT_PERIOD})が長期線(SMA${LONG_PERIOD})の下にあり、下降トレンドが続いています。`);
      }
    }

    const lastRsi = rsiValues[lastIdx];
    if (lastRsi != null) {
      if (lastRsi < 30) {
        score += 2;
        reasons.push(`RSIが${lastRsi.toFixed(1)}と30を下回り、売られすぎ（買いのタイミング候補）を示しています。`);
      } else if (lastRsi > 70) {
        score -= 2;
        reasons.push(`RSIが${lastRsi.toFixed(1)}と70を上回り、買われすぎ（売りのタイミング候補）を示しています。`);
      } else {
        reasons.push(`RSIは${lastRsi.toFixed(1)}で中立圏です。`);
      }
    }

    let type = "hold";
    if (score >= 2) type = "buy";
    else if (score <= -2) type = "sell";

    return { type, reasons };
  }

  // ---------- chart rendering ----------

  function drawChart(rows, smaShort, smaLong, signals) {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || 640;
    const cssHeight = 280;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const padding = { left: 52, right: 12, top: 14, bottom: 26 };
    const plotWidth = cssWidth - padding.left - padding.right;
    const plotHeight = cssHeight - padding.top - padding.bottom;
    const n = rows.length;

    const allValues = rows
      .map((r) => r.close)
      .concat(smaShort.filter((v) => v != null))
      .concat(smaLong.filter((v) => v != null));
    const minV = Math.min(...allValues);
    const maxV = Math.max(...allValues);
    const vRange = maxV - minV || 1;
    const yPad = vRange * 0.08;
    const yMin = minV - yPad;
    const yMax = maxV + yPad;

    const xAt = (i) => padding.left + (n === 1 ? 0 : (i / (n - 1)) * plotWidth);
    const yAt = (v) => padding.top + (1 - (v - yMin) / (yMax - yMin)) * plotHeight;

    // gridlines + price labels
    ctx.strokeStyle = "#dbe6e2";
    ctx.fillStyle = "#66766f";
    ctx.font = "11px sans-serif";
    ctx.textBaseline = "middle";
    const gridLines = 4;
    for (let g = 0; g <= gridLines; g++) {
      const v = yMin + ((yMax - yMin) * g) / gridLines;
      const y = yAt(v);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(cssWidth - padding.right, y);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.fillText(Math.round(v).toLocaleString("ja-JP"), padding.left - 6, y);
    }

    // date labels (a handful of evenly spaced ticks)
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const tickCount = Math.min(5, n);
    for (let t = 0; t < tickCount; t++) {
      const idx = Math.round((t / (tickCount - 1 || 1)) * (n - 1));
      ctx.fillText(rows[idx].date.slice(5), xAt(idx), cssHeight - padding.bottom + 6);
    }

    function drawLine(values, color, width) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      let started = false;
      for (let i = 0; i < n; i++) {
        const v = values[i];
        if (v == null) {
          started = false;
          continue;
        }
        const x = xAt(i);
        const y = yAt(v);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    drawLine(smaLong, "#2c6fe0", 1.5);
    drawLine(smaShort, "#e08a2c", 1.5);
    drawLine(
      rows.map((r) => r.close),
      "#2b3a37",
      1.8
    );

    // buy/sell markers
    signals.forEach((sig) => {
      const x = xAt(sig.index);
      const row = rows[sig.index];
      ctx.beginPath();
      if (sig.type === "buy") {
        const y = yAt(row.low) + 10;
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x - 5, y);
        ctx.lineTo(x + 5, y);
        ctx.closePath();
        ctx.fillStyle = "#1f8a4c";
      } else {
        const y = yAt(row.high) - 10;
        ctx.moveTo(x, y + 8);
        ctx.lineTo(x - 5, y);
        ctx.lineTo(x + 5, y);
        ctx.closePath();
        ctx.fillStyle = "#c0392b";
      }
      ctx.fill();
    });
  }

  // ---------- rendering the result panel ----------

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function renderResult(displayCode, market, rows, isFallback) {
    const closes = rows.map((r) => r.close);
    const smaShort = sma(closes, SHORT_PERIOD);
    const smaLong = sma(closes, LONG_PERIOD);
    const rsiValues = rsi(closes, RSI_PERIOD);
    const signals = findCrossSignals(smaShort, smaLong);
    const verdict = buildVerdict(rows, smaShort, smaLong, rsiValues, signals);

    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    const change = last.close - prev.close;
    const changePct = (change / prev.close) * 100;

    resultCode.textContent = displayCode;
    resultName.textContent = market ? `(${market})` : "";

    signalBadge.className = `signal-badge ${verdict.type}`;
    signalBadge.textContent =
      verdict.type === "buy" ? "買い時の目安" : verdict.type === "sell" ? "売り時の目安" : "様子見";

    resultPrice.textContent = `${last.close.toLocaleString("ja-JP", { maximumFractionDigits: 2 })}`;
    resultChange.textContent = `${change >= 0 ? "+" : ""}${change.toFixed(2)} (${change >= 0 ? "+" : ""}${changePct.toFixed(2)}%)`;
    resultChange.className = `result-change ${change >= 0 ? "up" : "down"}`;

    reasonList.innerHTML = "";
    verdict.reasons.forEach((reason) => {
      const li = document.createElement("li");
      li.textContent = reason;
      reasonList.appendChild(li);
    });

    fallbackNotice.hidden = !isFallback;
    resultPanel.hidden = false;

    lastChartData = { rows, smaShort, smaLong, signals };
    drawChart(rows, smaShort, smaLong, signals);
  }

  // ---------- form handling ----------

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const raw = codeInput.value.trim();
    if (!raw) return;

    const mySeq = ++requestSeq;
    const { symbol, market } = normalizeSymbol(raw);

    checkBtn.disabled = true;
    statusMsg.hidden = false;
    statusMsg.textContent = `${raw} のデータを取得しています…`;
    fallbackNotice.hidden = true;
    resultPanel.hidden = true;

    let rows;
    let isFallback = false;
    try {
      rows = await fetchStooqData(symbol);
    } catch {
      rows = generateDemoSeries(symbol);
      isFallback = true;
    }

    if (mySeq !== requestSeq) return; // a newer request superseded this one

    statusMsg.hidden = true;
    checkBtn.disabled = false;
    renderResult(raw.toUpperCase(), market, rows, isFallback);
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (!lastChartData) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const { rows, smaShort, smaLong, signals } = lastChartData;
      drawChart(rows, smaShort, smaLong, signals);
    }, 150);
  });
})();
