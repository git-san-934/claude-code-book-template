(() => {
  "use strict";

  const STORAGE_KEY = "diningHistory.entries.v1";

  const GENRES = [
    "ラーメン", "寿司", "焼肉", "居酒屋", "中華", "イタリアン", "フランス料理",
    "フレンチ", "カフェ", "定食", "カレー", "焼き鳥", "そば・うどん",
    "ファストフード", "その他",
  ];

  const MEAL_TYPES = ["朝食", "ランチ", "ディナー", "間食"];

  const genreSelect = document.getElementById("genre");
  GENRES.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    genreSelect.appendChild(opt);
  });

  const mealTypeSelect = document.getElementById("mealType");
  MEAL_TYPES.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    mealTypeSelect.appendChild(opt);
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

  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const importFile = document.getElementById("importFile");

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

  // ---------- backup (export / import) ----------

  exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `外食履歴_${todayISO()}.json`;
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
        if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.store) {
          return;
        }
        const normalized = {
          id: item.id,
          date: typeof item.date === "string" ? item.date : todayISO(),
          store: String(item.store),
          genre: typeof item.genre === "string" ? item.genre : "",
          mealType: typeof item.mealType === "string" ? item.mealType : "",
          amount: Number(item.amount) || 0,
          memo: typeof item.memo === "string" ? item.memo : "",
          createdAt: Number(item.createdAt) || Date.now(),
        };
        const existingIndex = entries.findIndex((e) => e.id === normalized.id);
        if (existingIndex >= 0) {
          entries[existingIndex] = normalized;
          updated++;
        } else {
          entries.push(normalized);
          added++;
        }
      });

      saveEntries(entries);
      render();
      alert(`インポートが完了しました。追加 ${added}件 / 更新 ${updated}件`);
    };
    reader.readAsText(file);
  });

  // ---------- voice parsing (heuristic, Japanese) ----------

  const MEAL_TYPE_PATTERNS = [
    [/朝ご飯|朝食|モーニング/, "朝食"],
    [/ランチ|昼ご飯|昼食|お昼/, "ランチ"],
    [/ディナー|夜ご飯|夕食|晩ご飯|夕飯/, "ディナー"],
    [/間食|おやつ/, "間食"],
  ];

  function toHalfWidth(str) {
    return str
      .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30))
      .replace(/，/g, ",")
      .replace(/　/g, " ");
  }

  function parseTranscript(rawText) {
    const text = toHalfWidth(rawText);
    const result = { date: todayISO(), store: "", genre: "", mealType: "", amount: "", memo: "" };

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

    const mealTypeMatch = MEAL_TYPE_PATTERNS.find(([re]) => re.test(text));
    let mealTypeWord = "";
    if (mealTypeMatch) {
      result.mealType = mealTypeMatch[1];
      mealTypeWord = text.match(mealTypeMatch[0])[0];
    }

    // Explicit "メモ<...>" / "メモは<...>" marker: whatever follows is taken
    // verbatim as the memo, so a spoken aside like "メモ肉がおいしかった" doesn't
    // need any particular grammar to be recognized.
    const memoMatch = text.match(/メモは?([\s\S]+?)。?$/);
    if (memoMatch && memoMatch[1].trim()) {
      result.memo = memoMatch[1].trim();
    }

    // Explicit "店名は<...>" / "店名<...>" marker takes priority over the
    // heuristic guess below, since it's unambiguous.
    const storeMatch = text.match(/店名は?([^\s、。]+?)(?=メモ|、|。|\d|$)/);
    if (storeMatch && storeMatch[1].trim()) {
      result.store = storeMatch[1].trim().replace(/[でのはをに、。,]+$/, "");
    } else {
      let stripped = text
        .replace(/おととい|一昨日|昨日|今日|本日/g, "")
        .replace(/\d{1,2}月\d{1,2}日に?/g, "")
        .trim();

      if (mealTypeWord) {
        // Drop "<mealTypeWord>で/の" too, so a phrase like "ディナーで焼肉トラジ"
        // isn't mistaken for a store name ending in "ディナー".
        stripped = stripped.replace(new RegExp(mealTypeWord + "(で|の)?"), "").trim();
      }

      result.store = guessStore(stripped, foundGenre, result.mealType);
    }

    return result;
  }

  function shiftDate(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  function guessStore(text, genre, mealType) {
    // Look for "<name>で" (at <name>) or "<name>の<genre>" patterns.
    const deMatch = text.match(/([^\s、。,]{2,20}?)で(食べ|飲|使|食事)/);
    if (deMatch) return deMatch[1];

    const noMatch = genre && text.match(new RegExp(`([^\\s、。,]{2,20}?)の${genre}`));
    if (noMatch) return noMatch[1];

    const plainDe = text.match(/([^\s、。,]{2,20}?)で/);
    if (plainDe) return plainDe[1];

    // Fallback: no particle-based pattern matched (e.g. "サイゼリヤ 1500円" with
    // no で/の). Take whatever is left after stripping the amount, genre/meal
    // words, and trailing particles, so the field is rarely left blank.
    let fallback = text
      .replace(/[\d,]+\s*円.*$/, "")
      .replace(/(食べ|飲んだ|飲み|使った|使いました|食事した|食事しました)$/, "")
      .trim();
    if (genre) {
      fallback = fallback.replace(new RegExp(genre + "$"), "").trim();
    }
    if (mealType) {
      fallback = fallback.replace(new RegExp(mealType + "$"), "").trim();
    }
    fallback = fallback.replace(/[でのはをに、。,\s]+$/, "").trim();

    return fallback.length >= 1 && fallback.length <= 20 ? fallback : "";
  }

  // ---------- speech recognition ----------

  const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isRecording = false;
  let voiceReady = false; // true once a final transcript is waiting to be saved

  const voiceBtnIcon = voiceBtn.querySelector(".voice-btn-icon");
  const voiceBtnLabel = voiceBtn.querySelector(".voice-btn-label");

  function setVoiceButtonState(state) {
    voiceBtn.classList.remove("recording", "ready");
    if (state === "recording") {
      voiceBtn.classList.add("recording");
      voiceBtnIcon.textContent = "🎤";
      voiceBtnLabel.textContent = "記録中…";
    } else if (state === "ready") {
      voiceBtn.classList.add("ready");
      voiceBtnIcon.textContent = "💾";
      voiceBtnLabel.textContent = "保存する";
    } else {
      voiceBtnIcon.textContent = "🎤";
      voiceBtnLabel.textContent = "音声で記録する";
    }
  }

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
      voiceReady = false;
      setVoiceButtonState("recording");
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
        voiceReady = true;
      }
    });

    recognition.addEventListener("error", (event) => {
      voiceReady = false;
      voiceStatus.textContent = `音声認識でエラーが発生しました（${event.error}）。もう一度お試しください。`;
    });

    recognition.addEventListener("end", () => {
      isRecording = false;
      if (voiceReady) {
        setVoiceButtonState("ready");
        voiceStatus.textContent = "内容を確認して、もう一度ボタンを押すと保存されます。";
      } else {
        setVoiceButtonState("idle");
        if (!voiceStatus.textContent.includes("エラー")) {
          voiceStatus.textContent = "ボタンを押して「今日、渋谷のラーメン屋でランチ1200円」のように話してください";
        }
      }
    });

    voiceBtn.addEventListener("click", () => {
      if (isRecording) {
        recognition.stop();
        return;
      }

      if (voiceReady) {
        if (trySaveEntry()) {
          resetForm();
          render();
        }
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
    storeInput.value = parsed.store;
    genreSelect.value = parsed.genre;
    mealTypeSelect.value = parsed.mealType;
    amountInput.value = parsed.amount;
    memoInput.value = parsed.memo;
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
    voiceReady = false;
    if (recognition) {
      setVoiceButtonState("idle");
      voiceStatus.textContent = "ボタンを押して「今日、渋谷のラーメン屋で1200円使った」のように話してください";
    }
  }

  function trySaveEntry() {
    const id = entryIdInput.value || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry = {
      id,
      date: dateInput.value || todayISO(),
      store: storeInput.value.trim(),
      genre: genreSelect.value,
      mealType: mealTypeSelect.value,
      amount: amountInput.value ? Number(amountInput.value) : 0,
      memo: memoInput.value.trim(),
      createdAt: entryIdInput.value ? entries.find((x) => x.id === id)?.createdAt ?? Date.now() : Date.now(),
    };

    if (!entry.store) {
      storeInput.focus();
      storeInput.reportValidity();
      return false;
    }

    const existingIndex = entries.findIndex((x) => x.id === id);
    if (existingIndex >= 0) {
      entries[existingIndex] = entry;
    } else {
      entries.push(entry);
    }

    saveEntries(entries);
    return true;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (trySaveEntry()) {
      resetForm();
      render();
    }
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
    mealTypeSelect.value = entry.mealType || "";
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

  const MEAL_TYPE_CLASSES = {
    朝食: "breakfast",
    ランチ: "lunch",
    ディナー: "dinner",
    間食: "snack",
  };

  function mealTypeClass(mealType) {
    return MEAL_TYPE_CLASSES[mealType] || "";
  }

  function render() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = entries
      .filter((e) => {
        if (!query) return true;
        return (
          e.store.toLowerCase().includes(query) ||
          (e.memo || "").toLowerCase().includes(query) ||
          (e.genre || "").toLowerCase().includes(query) ||
          (e.mealType || "").toLowerCase().includes(query)
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
            ${entry.mealType ? `<span class="history-mealtype ${mealTypeClass(entry.mealType)}">${escapeHtml(entry.mealType)}</span>` : ""}${entry.genre ? `<span class="history-genre">${escapeHtml(entry.genre)}</span>` : ""}${entry.date}
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
