const els = {
  videoUrl: document.querySelector("#videoUrl"),
  videoTitle: document.querySelector("#videoTitle"),
  transcript: document.querySelector("#transcript"),
  tags: [...document.querySelectorAll(".tag")],
  activeTag: document.querySelector("#activeTag"),
  analyzeButton: document.querySelector("#analyzeButton"),
  quickSaveButton: document.querySelector("#quickSaveButton"),
  clearButton: document.querySelector("#clearButton"),
  sampleButton: document.querySelector("#sampleButton"),
  copyPromptButton: document.querySelector("#copyPromptButton"),
  saveButton: document.querySelector("#saveButton"),
  exportButton: document.querySelector("#exportButton"),
  deleteButton: document.querySelector("#deleteButton"),
  summaryList: document.querySelector("#summaryList"),
  highlights: document.querySelector("#highlights"),
  terms: document.querySelector("#terms"),
  promptOutput: document.querySelector("#promptOutput"),
  libraryList: document.querySelector("#libraryList"),
  savedCount: document.querySelector("#savedCount"),
  toast: document.querySelector("#toast"),
  mobileTabs: [...document.querySelectorAll(".mobile-tab")]
};

const storageKey = "swat-video-notes";
let selectedTag = "training";
let selectedId = null;
let notes = loadNotes();

const glossary = [
  ["tactical", "戦術的、作戦上の"],
  ["breach", "扉や障害物を突破すること"],
  ["entry", "建物や部屋に入ること"],
  ["entry team", "突入担当チーム"],
  ["stack", "入口前で隊員が並ぶ隊形"],
  ["clear", "部屋や区域の安全確認が終わった状態"],
  ["perimeter", "外周警戒、包囲線"],
  ["suspect", "容疑者"],
  ["hostage", "人質"],
  ["training", "訓練"],
  ["gear", "装備"],
  ["vehicle", "車両"],
  ["shield", "盾"],
  ["less lethal", "致死性を抑えた装備や手段"],
  ["negotiator", "交渉担当者"],
  ["scenario", "想定訓練、場面設定"]
];

function loadNotes() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function persist() {
  localStorage.setItem(storageKey, JSON.stringify(notes));
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function setMobileView(viewClass) {
  ["input-panel", "output-panel", "library-panel"].forEach((className) => {
    document.querySelector(`.${className}`)?.classList.toggle("mobile-active", className === viewClass);
  });
  els.mobileTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewClass);
  });
}

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function makeSummary(text) {
  const clean = normalizeText(text);
  if (!clean) {
    return [
      "字幕や説明文を貼ると、動画の内容を整理できます。",
      "日本語訳を頼むための依頼文を自動で作ります。",
      "気になった動画は保存リストに残せます。"
    ];
  }

  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const first = sentences[0] || clean.slice(0, 120);
  const second = sentences.find((line) => /training|gear|vehicle|team|officer|tactical|entry|clear/i.test(line)) || sentences[1] || clean.slice(120, 240);
  const third = clean.length > 420
    ? "長めの字幕なので、全体翻訳・用語解説・見どころ抽出に分けて読むのがおすすめです。"
    : "短めの字幕なので、まず全体訳を作ってから分からない用語を確認すると読みやすいです。";

  return [
    `冒頭では「${first.slice(0, 92)}${first.length > 92 ? "..." : ""}」という内容から始まります。`,
    `注目ポイントは「${second.slice(0, 92)}${second.length > 92 ? "..." : ""}」の周辺です。`,
    third
  ];
}

function findTerms(text) {
  const lower = text.toLowerCase();
  return glossary
    .filter(([term]) => lower.includes(term))
    .slice(0, 8);
}

function makeHighlights(text, tag) {
  const map = {
    training: "訓練の流れ、隊員同士の連携、部屋や区域を確認する場面に注目すると理解しやすいです。",
    gear: "装備名、ベスト・ヘルメット・盾・通信機器の説明が出る部分を重点的に訳すと楽しめます。",
    vehicle: "車両の用途、搭載装備、移動や現場支援の説明が見どころになりそうです。",
    documentary: "部隊紹介、インタビュー、訓練の背景説明を拾うと動画全体の意味が見えやすいです。"
  };
  const hasAudioCue = /radio|command|communicat|call/i.test(text);
  return `${map[tag]}${hasAudioCue ? " 無線や指揮系統の話も出ているので、そこは用語メモに分けると追いやすいです。" : ""}`;
}

function makePrompt() {
  const title = els.videoTitle.value.trim() || "未入力";
  const url = els.videoUrl.value.trim() || "未入力";
  const transcript = els.transcript.value.trim() || "ここに英語字幕や説明文を貼ります。";
  const tagLabel = document.querySelector(".tag.active")?.textContent || "未分類";

  return `次のSWAT関連YouTube動画について、日本語で理解できるように整理してください。

動画タイトル: ${title}
動画URL: ${url}
カテゴリ: ${tagLabel}

お願いしたいこと:
1. 英語字幕を自然な日本語に翻訳
2. 先に3行で要約
3. SWAT、警察、装備、訓練に関係する専門用語をやさしく解説
4. 動画の見どころを日本語で箇条書き
5. 自動字幕の聞き間違いっぽい部分があれば推測して補足

英語字幕・説明文:
${transcript}`;
}

function renderAnalysis() {
  const text = els.transcript.value;
  const summary = makeSummary(text);
  const terms = findTerms(text);

  els.summaryList.innerHTML = summary.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  els.highlights.textContent = makeHighlights(text, selectedTag);
  els.terms.innerHTML = terms.length
    ? terms.map(([term, ja]) => `<span title="${escapeHtml(ja)}">${escapeHtml(term)}: ${escapeHtml(ja)}</span>`).join("")
    : "<span>字幕から用語候補を拾います</span>";
  els.promptOutput.value = makePrompt();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderLibrary() {
  els.savedCount.textContent = notes.length;

  if (!notes.length) {
    els.libraryList.innerHTML = `<p class="empty">まだ保存した動画はありません。</p>`;
    return;
  }

  els.libraryList.innerHTML = notes.map((note) => `
    <button class="library-item ${note.id === selectedId ? "active" : ""}" type="button" data-id="${note.id}">
      <strong>${escapeHtml(note.title || "Untitled video")}</strong>
      <span>${escapeHtml(note.tagLabel)} / ${escapeHtml(new Date(note.createdAt).toLocaleDateString("ja-JP"))}</span>
    </button>
  `).join("");
}

function inferTitleFromUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu")) {
      return "YouTube video";
    }
  } catch {
    return "";
  }
  return "";
}

function makeNoteId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function saveCurrentNote() {
  renderAnalysis();
  const activeTagButton = document.querySelector(".tag.active");
  const url = els.videoUrl.value.trim();
  if (!url) {
    setMobileView("input-panel");
    showToast("動画URLを貼ってください");
    return;
  }
  const id = selectedId || makeNoteId();
  const fallbackTitle = inferTitleFromUrl(url) || "Untitled video";
  const note = {
    id,
    url,
    title: els.videoTitle.value.trim() || fallbackTitle,
    transcript: els.transcript.value.trim(),
    prompt: els.promptOutput.value,
    tag: selectedTag,
    tagLabel: activeTagButton?.textContent || "未分類",
    createdAt: new Date().toISOString()
  };

  notes = [note, ...notes.filter((item) => item.id !== id)];
  selectedId = id;
  persist();
  renderLibrary();
  if (window.matchMedia("(max-width: 760px)").matches) {
    setMobileView("library-panel");
  }
  showToast("保存しました");
}

function loadNote(id) {
  const note = notes.find((item) => item.id === id);
  if (!note) return;

  selectedId = id;
  els.videoUrl.value = note.url;
  els.videoTitle.value = note.title;
  els.transcript.value = note.transcript;
  selectedTag = note.tag;
  syncTags();
  renderAnalysis();
  renderLibrary();
}

function syncTags() {
  els.tags.forEach((button) => {
    button.classList.toggle("active", button.dataset.tag === selectedTag);
  });
  els.activeTag.textContent = document.querySelector(".tag.active")?.textContent || "未分類";
}

function clearForm() {
  selectedId = null;
  els.videoUrl.value = "";
  els.videoTitle.value = "";
  els.transcript.value = "";
  renderAnalysis();
  renderLibrary();
}

function exportMarkdown() {
  renderAnalysis();
  const markdown = `# ${els.videoTitle.value.trim() || "SWAT Video Note"}

- URL: ${els.videoUrl.value.trim() || "未入力"}
- タグ: ${document.querySelector(".tag.active")?.textContent || "未分類"}

## 3行要約
${[...els.summaryList.children].map((li) => `- ${li.textContent}`).join("\n")}

## 見どころ
${els.highlights.textContent}

## 翻訳依頼文
\`\`\`text
${els.promptOutput.value}
\`\`\`
`;
  navigator.clipboard.writeText(markdown).then(() => showToast("Markdownをコピーしました"));
}

els.tags.forEach((button) => {
  button.addEventListener("click", () => {
    selectedTag = button.dataset.tag;
    syncTags();
    renderAnalysis();
  });
});

els.analyzeButton.addEventListener("click", () => {
  renderAnalysis();
  if (window.matchMedia("(max-width: 760px)").matches) {
    setMobileView("output-panel");
  }
  showToast("日本語メモを更新しました");
});

els.clearButton.addEventListener("click", clearForm);
els.quickSaveButton.addEventListener("click", saveCurrentNote);
els.saveButton.addEventListener("click", saveCurrentNote);
els.exportButton.addEventListener("click", exportMarkdown);

els.copyPromptButton.addEventListener("click", () => {
  renderAnalysis();
  navigator.clipboard.writeText(els.promptOutput.value).then(() => showToast("翻訳依頼文をコピーしました"));
});

els.deleteButton.addEventListener("click", () => {
  if (!selectedId) {
    showToast("削除する動画を選んでください");
    return;
  }
  notes = notes.filter((item) => item.id !== selectedId);
  selectedId = null;
  persist();
  clearForm();
  showToast("削除しました");
});

els.sampleButton.addEventListener("click", () => {
  els.videoUrl.value = "https://www.youtube.com/watch?v=example";
  els.videoTitle.value = "Example SWAT training overview";
  els.transcript.value = "In this training scenario, the entry team approaches the building and establishes a perimeter. Officers communicate by radio while the tactical unit checks each room. The team uses a shield during entry and clears the hallway before moving to the next area. The instructor explains the gear, safety rules, and how the scenario is evaluated.";
  selectedTag = "training";
  syncTags();
  renderAnalysis();
});

els.libraryList.addEventListener("click", (event) => {
  const item = event.target.closest(".library-item");
  if (item) {
    loadNote(item.dataset.id);
    if (window.matchMedia("(max-width: 760px)").matches) {
      setMobileView("output-panel");
    }
  }
});

els.mobileTabs.forEach((button) => {
  button.addEventListener("click", () => setMobileView(button.dataset.view));
});

["input", "change"].forEach((eventName) => {
  els.videoTitle.addEventListener(eventName, () => {
    els.promptOutput.value = makePrompt();
  });
  els.videoUrl.addEventListener(eventName, () => {
    els.promptOutput.value = makePrompt();
  });
  els.transcript.addEventListener(eventName, () => {
    els.promptOutput.value = makePrompt();
  });
});

syncTags();
setMobileView("input-panel");
renderAnalysis();
renderLibrary();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
