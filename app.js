(() => {
  "use strict";

  const STORAGE_KEY = "diningHistory.entries.v1";

  const GENRES = [
    "ラーメン", "寿司", "焼肉", "居酒屋", "中華", "イタリアン",
    "フレンチ", "カフェ", "定食", "カレー", "焼き鳥", "そば・うどん",
    "ファストフード", "その他",
  ];

  const genreSelect = document.getElementById("genre");
  GENRES.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    genreSelect.appendChild(opt);
  });

  const voiceBtn = document.getElementById("voiceBtn");
  const voiceStatus = document.getElementById("voiceStatus");
  const voiceUnsupported = document.getElementById("voiceUnsupported");
  const transcriptEl = document.getElementById("transcript");

  const form = document.getElementById("entryForm");
  const entryIdInput = document.getElementById("entryId");
  const dateInput = document.getElementById("date");
  const storeInput = document.getElementById("store");
  const amountInput = document.getElementById("amount");
  const memoInput = document.getElementById("memo");
  const cancelEditBtn = document.getElementById("cancelEditBtn");

  const summaryCount = document.getElementById("summaryCount");
  const summaryMonthTotal = document.getElementById("summaryMonthTotal");
  const summaryTotal = document.getElementById("summaryTotal");

  const historyList = document.getElementById("historyList");
  const emptyState = document.getElementById("emptyState");
  const searchInput = document.getElementById("searchInput");

  const todayISO = () => new Date().toISOString().slice(0, 10);
  dateInput.value = todayISO();

  // ---------- storage ----------

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  let entries = loadEntries();

  // ---------- voice parsing (heuristic, Japanese) ----------

  function parseTranscript(text) {
    const result = { date: todayISO(), store: "", genre: "", amount: "", memo: text };

    if (/おととい|一昨日/.test(text)) {
      result.date = shiftDate(-2);
    } else if (/昨日/.test(text)) {
      result.date = shiftDate(-1);
    } else {
      const md = text.match(/(\d{1,2})月(\d{1,2})日/);
      if (md) {
        const year = new Date().getFullYear();
        const month = String(md[1]).padStart(2, "0");
        const day = String(md[2]).padStart(2, "0");
        result.date = `${year}-${month}-${day}`;
      }
    }

    const amountMatch = text.match(/([\d,]+)\s*円/);
    if (amountMatch) {
      result.amount = amountMatch[1].replace(/,/g, "");
    }

    const foundGenre = GENRES.find((g) => g !== "その他" && text.includes(g));
    if (foundGenre) {
      result.genre = foundGenre;
    }

    const stripped = text
      .replace(/おととい|一昨日|昨日|今日|本日/g, "")
      .replace(/\d{1,2}月\d{1,2}日に?/g, "")
      .trim();

    result.store = guessStore(stripped, foundGenre);

    return result;
  }

  function shiftDate(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  function guessStore(text, genre) {
    // Look for "<name>で" (at <name>) or "<name>の<genre>" patterns.
    const deMatch = text.match(/([^\s、。,]{2,20}?)で(食べ|飲|使|食事)/);
    if (deMatch) return deMatch[1];

    const noMatch = genre && text.match(new RegExp(`([^\\s、。,]{2,20}?)の${genre}`));
    if (noMatch) return noMatch[1];

    const plainDe = text.match(/([^\s、。,]{2,20}?)で/);
    if (plainDe) return plainDe[1];

    return "";
  }

  // ---------- speech recognition ----------

  const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isRecording = false;

  if (!SpeechRecognitionImpl) {
    voiceBtn.disabled = true;
    voiceUnsupported.hidden = false;
    voiceStatus.hidden = true;
  } else {
    recognition = new SpeechRecognitionImpl();
    recognition.lang = "ja-JP";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.addEventListener("start", () => {
      isRecording = true;
      voiceBtn.classList.add("recording");
      voiceBtn.querySelector(".voice-btn-label").textContent = "聞き取り中…";
      voiceStatus.textContent = "話してください（もう一度押すと停止します）";
    });

    recognition.addEventListener("result", (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      transcriptEl.value = text;

      const isFinal = event.results[event.results.length - 1].isFinal;
      if (isFinal) {
        applyParsedResult(text);
      }
    });

    recognition.addEventListener("error", (event) => {
      voiceStatus.textContent = `音声認識でエラーが発生しました（${event.error}）。もう一度お試しください。`;
    });

    recognition.addEventListener("end", () => {
      isRecording = false;
      voiceBtn.classList.remove("recording");
      voiceBtn.querySelector(".voice-btn-label").textContent = "音声で記録する";
      if (!voiceStatus.textContent.includes("エラー")) {
        voiceStatus.textContent = "ボタンを押して「今日、渋谷のラーメン屋で1200円使った」のように話してください";
      }
    });

    voiceBtn.addEventListener("click", () => {
      if (isRecording) {
        recognition.stop();
        return;
      }
      transcriptEl.value = "";
      try {
        recognition.start();
      } catch {
        // start() throws if called while already active; ignore.
      }
    });
  }

  function applyParsedResult(text) {
    const parsed = parseTranscript(text);
    dateInput.value = parsed.date;
    if (parsed.store) storeInput.value = parsed.store;
    if (parsed.genre) genreSelect.value = parsed.genre;
    if (parsed.amount) amountInput.value = parsed.amount;
    memoInput.value = "";
    voiceStatus.textContent = "認識結果をもとに下のフォームを自動入力しました。内容を確認して保存してください。";
  }

  transcriptEl.addEventListener("change", () => {
    if (transcriptEl.value.trim()) {
      applyParsedResult(transcriptEl.value.trim());
    }
  });

  // ---------- form / CRUD ----------

  function resetForm() {
    entryIdInput.value = "";
    form.reset();
    dateInput.value = todayISO();
    transcriptEl.value = "";
    cancelEditBtn.hidden = true;
    document.getElementById("saveBtn").textContent = "保存する";
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const id = entryIdInput.value || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry = {
      id,
      date: dateInput.value || todayISO(),
      store: storeInput.value.trim(),
      genre: genreSelect.value,
      amount: amountInput.value ? Number(amountInput.value) : 0,
      memo: memoInput.value.trim(),
      createdAt: entryIdInput.value ? entries.find((x) => x.id === id)?.createdAt ?? Date.now() : Date.now(),
    };

    if (!entry.store) {
      storeInput.focus();
      return;
    }

    const existingIndex = entries.findIndex((x) => x.id === id);
    if (existingIndex >= 0) {
      entries[existingIndex] = entry;
    } else {
      entries.push(entry);
    }

    saveEntries(entries);
    resetForm();
    render();
  });

  cancelEditBtn.addEventListener("click", () => {
    resetForm();
  });

  function startEdit(id) {
    const entry = entries.find((x) => x.id === id);
    if (!entry) return;
    entryIdInput.value = entry.id;
    dateInput.value = entry.date;
    storeInput.value = entry.store;
    genreSelect.value = entry.genre || "";
    amountInput.value = entry.amount || "";
    memoInput.value = entry.memo || "";
    cancelEditBtn.hidden = false;
    document.getElementById("saveBtn").textContent = "更新する";
    storeInput.focus();
    window.scrollTo({ top: form.offsetTop - 20, behavior: "smooth" });
  }

  function deleteEntry(id) {
    if (!confirm("この記録を削除しますか？")) return;
    entries = entries.filter((x) => x.id !== id);
    saveEntries(entries);
    render();
  }

  // ---------- rendering ----------

  function formatYen(n) {
    return `¥${Number(n || 0).toLocaleString("ja-JP")}`;
  }

  function render() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = entries
      .filter((e) => {
        if (!query) return true;
        return (
          e.store.toLowerCase().includes(query) ||
          (e.memo || "").toLowerCase().includes(query) ||
          (e.genre || "").toLowerCase().includes(query)
        );
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));

    historyList.innerHTML = "";
    emptyState.hidden = filtered.length > 0;

    filtered.forEach((entry) => {
      const li = document.createElement("li");
      li.className = "history-item";
      li.innerHTML = `
        <div class="history-main">
          <span class="history-store">${escapeHtml(entry.store)}</span>
          <span class="history-meta">
            ${entry.genre ? `<span class="history-genre">${escapeHtml(entry.genre)}</span>` : ""}${entry.date}
          </span>
          ${entry.memo ? `<span class="history-memo">${escapeHtml(entry.memo)}</span>` : ""}
        </div>
        <div class="history-side">
          <span class="history-amount">${formatYen(entry.amount)}</span>
          <div class="history-actions">
            <button type="button" class="icon-btn edit" aria-label="編集">✏️</button>
            <button type="button" class="icon-btn delete" aria-label="削除">🗑️</button>
          </div>
        </div>
      `;
      li.querySelector(".edit").addEventListener("click", () => startEdit(entry.id));
      li.querySelector(".delete").addEventListener("click", () => deleteEntry(entry.id));
      historyList.appendChild(li);
    });

    summaryCount.textContent = `${entries.length}件`;
    summaryTotal.textContent = formatYen(entries.reduce((sum, e) => sum + (e.amount || 0), 0));

    const currentMonth = todayISO().slice(0, 7);
    const monthTotal = entries
      .filter((e) => e.date.startsWith(currentMonth))
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    summaryMonthTotal.textContent = formatYen(monthTotal);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  searchInput.addEventListener("input", render);

  render();
})();
