(() => {
  "use strict";

  const STOCKS_KEY = "stockSignal.stocks.v1";
  const SELECTED_KEY = "stockSignal.selectedStockId.v1";

  const stockSelect = document.getElementById("stockSelect");
  const newStockBtn = document.getElementById("newStockBtn");
  const deleteStockBtn = document.getElementById("deleteStockBtn");
  const newStockForm = document.getElementById("newStockForm");
  const newStockName = document.getElementById("newStockName");
  const cancelNewStockBtn = document.getElementById("cancelNewStockBtn");
  const noStockState = document.getElementById("noStockState");

  const priceForm = document.getElementById("priceForm");
  const priceIdInput = document.getElementById("priceId");
  const priceDateInput = document.getElementById("priceDate");
  const priceCloseInput = document.getElementById("priceClose");
  const cancelPriceEditBtn = document.getElementById("cancelPriceEditBtn");

  const judgmentBadge = document.getElementById("judgmentBadge");
  const judgmentMessage = document.getElementById("judgmentMessage");
  const smaShortValue = document.getElementById("smaShortValue");
  const smaLongValue = document.getElementById("smaLongValue");
  const rsiValue = document.getElementById("rsiValue");
  const rsiNote = document.getElementById("rsiNote");

  const chartCanvas = document.getElementById("priceChart");
  const chartEmptyState = document.getElementById("chartEmptyState");

  const priceHistoryList = document.getElementById("priceHistoryList");
  const priceEmptyState = document.getElementById("priceEmptyState");

  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const importFile = document.getElementById("importFile");

  const todayISO = () => new Date().toISOString().slice(0, 10);
  priceDateInput.value = todayISO();

  // ---------- storage ----------

  function loadStocks() {
    try {
      const raw = localStorage.getItem(STOCKS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveStocks() {
    localStorage.setItem(STOCKS_KEY, JSON.stringify(stocks));
  }

  function loadSelectedId() {
    return localStorage.getItem(SELECTED_KEY) || "";
  }

  function saveSelectedId(id) {
    localStorage.setItem(SELECTED_KEY, id || "");
  }

  let stocks = loadStocks();
  let selectedStockId = loadSelectedId();

  function currentStock() {
    return stocks.find((s) => s.id === selectedStockId) || null;
  }

  function makeId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // ---------- stock selection / CRUD ----------

  function renderStockSelect() {
    stockSelect.innerHTML = "";
    stocks.forEach((stock) => {
      const opt = document.createElement("option");
      opt.value = stock.id;
      opt.textContent = stock.name;
      stockSelect.appendChild(opt);
    });

    if (!stocks.find((s) => s.id === selectedStockId)) {
      selectedStockId = stocks[0]?.id || "";
      saveSelectedId(selectedStockId);
    }
    stockSelect.value = selectedStockId;

    const hasStock = stocks.length > 0;
    noStockState.hidden = hasStock;
    stockSelect.hidden = !hasStock;
    deleteStockBtn.hidden = !hasStock;
    priceForm.closest("section").hidden = !hasStock;
  }

  stockSelect.addEventListener("change", () => {
    selectedStockId = stockSelect.value;
    saveSelectedId(selectedStockId);
    resetPriceForm();
    render();
  });

  newStockBtn.addEventListener("click", () => {
    newStockForm.hidden = false;
    newStockName.focus();
  });

  cancelNewStockBtn.addEventListener("click", () => {
    newStockForm.hidden = true;
    newStockForm.reset();
  });

  newStockForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = newStockName.value.trim();
    if (!name) return;

    const stock = { id: makeId(), name, prices: [] };
    stocks.push(stock);
    selectedStockId = stock.id;
    saveStocks();
    saveSelectedId(selectedStockId);

    newStockForm.hidden = true;
    newStockForm.reset();
    renderStockSelect();
    render();
  });

  deleteStockBtn.addEventListener("click", () => {
    const stock = currentStock();
    if (!stock) return;
    if (!confirm(`「${stock.name}」を削除しますか？記録した終値もすべて削除されます。`)) return;

    stocks = stocks.filter((s) => s.id !== stock.id);
    saveStocks();
    selectedStockId = stocks[0]?.id || "";
    saveSelectedId(selectedStockId);
    renderStockSelect();
    render();
  });

  // ---------- price entry CRUD ----------

  function resetPriceForm() {
    priceIdInput.value = "";
    priceForm.reset();
    priceDateInput.value = todayISO();
    cancelPriceEditBtn.hidden = true;
    document.getElementById("savePriceBtn").textContent = "記録する";
  }

  priceForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const stock = currentStock();
    if (!stock) return;

    const date = priceDateInput.value;
    const close = Number(priceCloseInput.value);
    if (!date || !Number.isFinite(close)) return;

    const editingId = priceIdInput.value;
    const existingByDate = stock.prices.find((p) => p.date === date && p.id !== editingId);

    if (editingId) {
      const entry = stock.prices.find((p) => p.id === editingId);
      if (entry) {
        entry.date = date;
        entry.close = close;
      }
    } else if (existingByDate) {
      existingByDate.close = close;
    } else {
      stock.prices.push({ id: makeId(), date, close });
    }

    saveStocks();
    resetPriceForm();
    render();
  });

  cancelPriceEditBtn.addEventListener("click", resetPriceForm);

  function startEditPrice(id) {
    const stock = currentStock();
    if (!stock) return;
    const entry = stock.prices.find((p) => p.id === id);
    if (!entry) return;

    priceIdInput.value = entry.id;
    priceDateInput.value = entry.date;
    priceCloseInput.value = entry.close;
    cancelPriceEditBtn.hidden = false;
    document.getElementById("savePriceBtn").textContent = "更新する";
    priceCloseInput.focus();
  }

  function deletePrice(id) {
    const stock = currentStock();
    if (!stock) return;
    if (!confirm("この終値の記録を削除しますか？")) return;
    stock.prices = stock.prices.filter((p) => p.id !== id);
    saveStocks();
    render();
  }

  // ---------- backup (export / import) ----------

  exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(stocks, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `株シグナル_${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  importBtn.addEventListener("click", () => {
    importFile.value = "";
    importFile.click();
  });

  importFile.addEventListener("change", () => {
    const file = importFile.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      let imported;
      try {
        imported = JSON.parse(reader.result);
        if (!Array.isArray(imported)) throw new Error("not an array");
      } catch {
        alert("読み込みに失敗しました。このアプリから書き出したバックアップファイルを選んでください。");
        return;
      }

      let added = 0;
      let updated = 0;
      imported.forEach((item) => {
        if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.name) {
          return;
        }
        const normalized = {
          id: item.id,
          name: String(item.name),
          prices: Array.isArray(item.prices)
            ? item.prices
                .filter((p) => p && typeof p.date === "string" && Number.isFinite(Number(p.close)))
                .map((p) => ({ id: typeof p.id === "string" ? p.id : makeId(), date: p.date, close: Number(p.close) }))
            : [],
        };
        const existingIndex = stocks.findIndex((s) => s.id === normalized.id);
        if (existingIndex >= 0) {
          stocks[existingIndex] = normalized;
          updated++;
        } else {
          stocks.push(normalized);
          added++;
        }
      });

      saveStocks();
      if (!selectedStockId && stocks.length > 0) {
        selectedStockId = stocks[0].id;
        saveSelectedId(selectedStockId);
      }
      renderStockSelect();
      render();
      alert(`インポートが完了しました。追加 ${added}件 / 更新 ${updated}件`);
    };
    reader.readAsText(file);
  });

  // ---------- technical indicators ----------

  function computeSMA(closes, period) {
    const result = new Array(closes.length).fill(null);
    let sum = 0;
    for (let i = 0; i < closes.length; i++) {
      sum += closes[i];
      if (i >= period) sum -= closes[i - period];
      if (i >= period - 1) result[i] = sum / period;
    }
    return result;
  }

  function computeRSI(closes, period = 14) {
    if (closes.length < period + 1) return null;

    let gainSum = 0;
    let lossSum = 0;
    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gainSum += diff;
      else lossSum += -diff;
    }
    let avgGain = gainSum / period;
    let avgLoss = lossSum / period;

    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  const SHORT_PERIOD = 5;
  const LONG_PERIOD = 25;

  function judge(sortedPrices) {
    const closes = sortedPrices.map((p) => p.close);

    if (closes.length < LONG_PERIOD) {
      return {
        status: "unknown",
        badge: "データ不足",
        message: `終値が${closes.length}件です。${LONG_PERIOD}件以上になると判定できます。`,
        smaShort: null,
        smaLong: null,
        rsi: closes.length >= 15 ? computeRSI(closes) : null,
      };
    }

    const smaShortSeries = computeSMA(closes, SHORT_PERIOD);
    const smaLongSeries = computeSMA(closes, LONG_PERIOD);
    const n = closes.length;
    const todayShort = smaShortSeries[n - 1];
    const todayLong = smaLongSeries[n - 1];
    const prevShort = smaShortSeries[n - 2];
    const prevLong = smaLongSeries[n - 2];

    let status;
    let badge;
    let message;

    if (prevShort <= prevLong && todayShort > todayLong) {
      status = "buy";
      badge = "買い";
      message = "ゴールデンクロスが発生しました。買いのタイミングの可能性があります。";
    } else if (prevShort >= prevLong && todayShort < todayLong) {
      status = "sell";
      badge = "売り";
      message = "デッドクロスが発生しました。売りのタイミングの可能性があります。";
    } else if (todayShort > todayLong) {
      status = "hold-buy";
      badge = "上昇継続";
      message = "短期線が長期線の上にあり、上昇トレンドが継続しています。";
    } else if (todayShort < todayLong) {
      status = "hold-sell";
      badge = "下降継続";
      message = "短期線が長期線の下にあり、下降トレンドが継続しています。";
    } else {
      status = "neutral";
      badge = "様子見";
      message = "短期線と長期線が拮抗しています。しばらく様子を見ましょう。";
    }

    return { status, badge, message, smaShort: todayShort, smaLong: todayLong, rsi: computeRSI(closes) };
  }

  // ---------- rendering ----------

  function formatYen(n) {
    return `¥${Number(n || 0).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function sortedPricesOf(stock) {
    return [...stock.prices].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  function renderJudgment(stock) {
    if (!stock || stock.prices.length === 0) {
      judgmentBadge.className = "judgment-badge unknown";
      judgmentBadge.textContent = "データ不足";
      judgmentMessage.textContent = "終値を記録すると判定を開始します。";
      smaShortValue.textContent = "–";
      smaLongValue.textContent = "–";
      rsiValue.textContent = "–";
      rsiNote.hidden = true;
      return;
    }

    const sorted = sortedPricesOf(stock);
    const result = judge(sorted);

    judgmentBadge.className = `judgment-badge ${result.status}`;
    judgmentBadge.textContent = result.badge;
    judgmentMessage.textContent = result.message;
    smaShortValue.textContent = result.smaShort != null ? formatYen(result.smaShort) : "–";
    smaLongValue.textContent = result.smaLong != null ? formatYen(result.smaLong) : "–";
    rsiValue.textContent = result.rsi != null ? result.rsi.toFixed(1) : "–";

    if (result.rsi != null && result.rsi >= 70) {
      rsiNote.hidden = false;
      rsiNote.textContent = `RSIが${result.rsi.toFixed(1)}で買われすぎ水準です。利益確定の売りに注意しましょう。`;
    } else if (result.rsi != null && result.rsi <= 30) {
      rsiNote.hidden = false;
      rsiNote.textContent = `RSIが${result.rsi.toFixed(1)}で売られすぎ水準です。反発による買いの好機の可能性があります。`;
    } else {
      rsiNote.hidden = true;
    }
  }

  function renderChart(stock) {
    const ctx = chartCanvas.getContext("2d");
    const { width, height } = chartCanvas;
    ctx.clearRect(0, 0, width, height);

    if (!stock || stock.prices.length < 2) {
      chartEmptyState.hidden = false;
      chartCanvas.hidden = true;
      return;
    }
    chartEmptyState.hidden = true;
    chartCanvas.hidden = false;

    const sorted = sortedPricesOf(stock).slice(-90);
    const closes = sorted.map((p) => p.close);
    const smaShortSeries = computeSMA(closes, SHORT_PERIOD);
    const smaLongSeries = computeSMA(closes, LONG_PERIOD);

    const allValues = closes.concat(smaShortSeries.filter((v) => v != null), smaLongSeries.filter((v) => v != null));
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const pad = (max - min) * 0.1 || 1;
    const yMin = min - pad;
    const yMax = max + pad;

    const marginLeft = 8;
    const marginRight = 8;
    const marginTop = 10;
    const marginBottom = 10;
    const plotW = width - marginLeft - marginRight;
    const plotH = height - marginTop - marginBottom;

    const xAt = (i) => marginLeft + (closes.length === 1 ? 0 : (i / (closes.length - 1)) * plotW);
    const yAt = (v) => marginTop + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

    function drawLine(series, color, lineWidth) {
      ctx.beginPath();
      let started = false;
      series.forEach((v, i) => {
        if (v == null) return;
        const x = xAt(i);
        const y = yAt(v);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }

    drawLine(smaLongSeries, "#c0392b", 1.5);
    drawLine(smaShortSeries, "#1f6f5c", 1.5);
    drawLine(closes, "#8a8f8c", 1);
  }

  function renderPriceHistory(stock) {
    priceHistoryList.innerHTML = "";

    if (!stock || stock.prices.length === 0) {
      priceEmptyState.hidden = false;
      return;
    }
    priceEmptyState.hidden = true;

    const sortedDesc = sortedPricesOf(stock).reverse();
    const sortedAsc = [...sortedDesc].reverse();

    sortedDesc.forEach((entry) => {
      const idx = sortedAsc.findIndex((p) => p.id === entry.id);
      const prev = idx > 0 ? sortedAsc[idx - 1] : null;
      const diff = prev ? entry.close - prev.close : null;

      const li = document.createElement("li");
      li.className = "history-item";
      const diffHtml =
        diff == null
          ? ""
          : `<span class="history-change ${diff >= 0 ? "up" : "down"}">${diff >= 0 ? "▲" : "▼"} ${formatYen(Math.abs(diff))}</span>`;

      li.innerHTML = `
        <div class="history-main">
          <span class="history-date">${escapeHtml(entry.date)}</span>
          ${diffHtml}
        </div>
        <div class="history-side">
          <span class="history-close">${formatYen(entry.close)}</span>
          <div class="history-actions">
            <button type="button" class="icon-btn edit" aria-label="編集">✏️</button>
            <button type="button" class="icon-btn delete" aria-label="削除">🗑️</button>
          </div>
        </div>
      `;
      li.querySelector(".edit").addEventListener("click", () => startEditPrice(entry.id));
      li.querySelector(".delete").addEventListener("click", () => deletePrice(entry.id));
      priceHistoryList.appendChild(li);
    });
  }

  function render() {
    const stock = currentStock();
    renderJudgment(stock);
    renderChart(stock);
    renderPriceHistory(stock);
  }

  renderStockSelect();
  render();
})();
