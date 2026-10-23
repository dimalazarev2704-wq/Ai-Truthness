// content.js — runs on every page.
// 1) Lets the user select any text and click "Verify" to fact-check it.
// 2) On known AI chat sites, automatically checks each new AI answer and shows a result badge.

const VERDICTS = {
  true: { color: "#2E7D4F", label: "Accurate" },
  false: { color: "#B3412F", label: "Inaccurate" },
  partially_true: { color: "#A0721A", label: "Partly accurate" },
  uncertain: { color: "#6B6B6B", label: "Can't confirm" },
  opinion: { color: "#6B6B6B", label: "Opinion" }
};

// The AI sometimes answers 0.9 instead of 90. Treat 0-1 as a fraction.
function normConf(c) {
  let n = Number(c);
  if (!Number.isFinite(n)) return null;
  if (n > 0 && n <= 1) n = n * 100;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function formatReset(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "later";
  return d.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
}

function hostOf(url) {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, "");
  } catch (e) {
    return "";
  }
}

// ---------- shared UI: result card ----------

function removeExistingCard() {
  const existing = document.getElementById("truthcheck-card");
  if (existing) existing.remove();
}

// Anchors are kept in document coordinates, so the card doesn't jump if the page
// scrolls while a check is running.
function docRect(rect) {
  return {
    top: rect.top + window.scrollY,
    bottom: rect.bottom + window.scrollY,
    left: rect.left + window.scrollX
  };
}

function renderCard(anchor, state) {
  removeExistingCard();

  const card = document.createElement("div");
  card.id = "truthcheck-card";
  card.className = "truthcheck-card";
  card.innerHTML = renderCardContent(state);
  card.style.visibility = "hidden"; // measure first, then place
  document.body.appendChild(card);

  const margin = 8;
  const viewTop = window.scrollY;
  const viewBottom = window.scrollY + window.innerHeight;
  const viewLeft = window.scrollX;
  const viewRight = window.scrollX + document.documentElement.clientWidth;
  const h = card.offsetHeight;
  const w = card.offsetWidth;

  // Prefer just below the anchor. If that would run off the screen, go above it;
  // if there's no room above either, slide it up so it stays fully visible.
  let top = anchor.bottom + margin;
  if (top + h > viewBottom - margin) {
    const above = anchor.top - margin - h;
    top = above >= viewTop + margin ? above : Math.max(viewTop + margin, viewBottom - margin - h);
  }
  const left = Math.max(viewLeft + margin, Math.min(anchor.left, viewRight - w - margin));
  card.style.top = `${top}px`;
  card.style.left = `${left}px`;
  card.style.visibility = "visible";

  const closeBtn = card.querySelector(".truthcheck-close");
  if (closeBtn) closeBtn.addEventListener("click", removeExistingCard);
}

function cardHead(color, title, extra, pulse) {
  return `<div class="truthcheck-head">
      <span class="truthcheck-dot${pulse ? " truthcheck-pulse" : ""}" style="background:${color}"></span>
      <span class="truthcheck-verdict">${escapeHtml(title)}</span>
      ${extra ? `<span class="truthcheck-conf">${escapeHtml(extra)}</span>` : ""}
      <button class="truthcheck-close" aria-label="Close">&times;</button>
    </div>`;
}

function renderCardContent(state) {
  if (state.loading) {
    return `${cardHead("#6B6B6B", "Checking", "", true)}
      <div class="truthcheck-body"><p class="truthcheck-muted">Searching the web for sources…</p></div>`;
  }

  if (state.error) {
    const messages = {
      NOT_SIGNED_IN: "Sign in to check this. Open the TruthCheck icon in your toolbar to create a free account or sign in.",
      DAILY_LIMIT_REACHED: `You've used today's free checks. They reset ${formatReset(state.resetsAt)}.`,
      SERVICE_BUSY: "TruthCheck is busy right now. Try again in a few minutes.",
      RATE_LIMITED: state.detail || "Too many checks in a short time. Try again in a minute.",
      SERVER_MISCONFIGURED: "The server isn't fully set up yet.",
      SERVER_MISSING_KEY: "The server isn't fully set up yet.",
      DATABASE_UNAVAILABLE: "The account service is waking up. Try again in a moment.",
      PARSE_ERROR: "The answer came back in a form that couldn't be read. Try again.",
      NETWORK_ERROR: state.detail || "Couldn't reach the server. If it was idle it may be waking up, so try again in 30 seconds.",
      API_ERROR: "The checking service had a problem. Try again in a moment."
    };
    const msg = messages[state.error] || "Something went wrong. Try again.";
    const showDetail = state.error === "API_ERROR" && state.detail;
    return `${cardHead("#B3412F", "Couldn't check", "", false)}
      <div class="truthcheck-body">
        <p>${escapeHtml(msg)}</p>
        ${showDetail ? `<p class="truthcheck-muted truthcheck-small">${escapeHtml(String(state.detail).slice(0, 160))}</p>` : ""}
      </div>`;
  }

  const r = state.result || {};
  const v = VERDICTS[r.verdict] || VERDICTS.uncertain;
  const conf = normConf(r.confidence);
  const sources = (Array.isArray(r.sources) ? r.sources : []).filter((s) => safeUrl(s.url)).slice(0, 4);

  return `${cardHead(v.color, v.label, conf === null ? "" : `${conf}% confident`, false)}
    <div class="truthcheck-body">
      <p>${escapeHtml(r.summary || "No summary provided.")}</p>
      ${r.corrections ? `<p class="truthcheck-correction" style="border-left-color:${v.color}"><span class="truthcheck-label">Correction</span>${escapeHtml(r.corrections)}</p>` : ""}
      ${sources.length ? `<div class="truthcheck-sources"><span class="truthcheck-label">Sources</span><ul>${sources
        .map((s) => `<li><a href="${escapeAttr(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title || hostOf(s.url))}</a><span class="truthcheck-host">${escapeHtml(hostOf(s.url))}</span></li>`)
        .join("")}</ul></div>` : ""}
    </div>`;
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = String(str == null ? "" : str);
  return d.innerHTML;
}
function escapeAttr(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
// Only allow normal web links in the Sources list (blocks javascript: etc.).
function safeUrl(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch (e) {
    return "";
  }
}

// Wraps chrome.runtime.sendMessage so a reloaded/updated extension doesn't throw.
function sendToBackground(message, callback) {
  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        callback(null);
        return;
      }
      callback(response);
    });
  } catch (e) {
    callback(null);
  }
}

function requestVerification(text, anchor) {
  renderCard(anchor, { loading: true });
  sendToBackground({ type: "VERIFY_CLAIM", text }, (response) => {
    if (!response) {
      renderCard(anchor, {
        error: "NETWORK_ERROR",
        detail: "No response from the extension. If you just updated it, refresh this page."
      });
      return;
    }
    if (response.error) {
      renderCard(anchor, response);
    } else {
      renderCard(anchor, { result: response.result });
    }
  });
}

// ---------- feature 1: selection-based checking ----------

let selectionBtn = null;

function removeSelectionBtn() {
  if (selectionBtn) {
    selectionBtn.remove();
    selectionBtn = null;
  }
}

document.addEventListener("mouseup", (e) => {
  // Ignore clicks on our own UI
  if (e.target.closest && (e.target.closest(".truthcheck-card") || e.target.closest(".truthcheck-btn"))) {
    return;
  }
  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : "";
    removeSelectionBtn();

    if (text.length < 15 || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return;

    selectionBtn = document.createElement("button");
    selectionBtn.className = "truthcheck-btn";
    selectionBtn.textContent = "Verify";
    const anchor = docRect(rect);
    selectionBtn.style.top = `${Math.max(window.scrollY + 4, anchor.top - 34)}px`;
    selectionBtn.style.left = `${anchor.left}px`;
    selectionBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      requestVerification(text, anchor);
      removeSelectionBtn();
    });
    document.body.appendChild(selectionBtn);
  }, 0);
});

document.addEventListener("mousedown", (e) => {
  if (e.target.closest && (e.target.closest(".truthcheck-card") || e.target.closest(".truthcheck-btn"))) {
    return;
  }
  removeExistingCard();
  removeSelectionBtn();
});

// ---------- feature 2: fully automatic checking of AI chat answers ----------

const AI_SITE_SELECTORS = [
  { host: "chatgpt.com", selector: '[data-message-author-role="assistant"]' },
  { host: "chat.openai.com", selector: '[data-message-author-role="assistant"]' },
  { host: "claude.ai", selector: '[data-testid="chat-message"], .font-claude-message' },
  { host: "gemini.google.com", selector: ".model-response-text, message-content" }
];

function getSelectorForThisHost() {
  const host = window.location.hostname;
  const match = AI_SITE_SELECTORS.find((s) => host.includes(s.host));
  return match ? match.selector : null;
}

function setBadge(badge, color, text, pulse) {
  const dot = document.createElement("span");
  dot.className = "truthcheck-dot" + (pulse ? " truthcheck-pulse" : "");
  dot.style.background = color;
  const label = document.createElement("span");
  label.className = "truthcheck-badge-text";
  label.textContent = text;
  badge.replaceChildren(dot, label);
}

function makeBadge(container) {
  const badge = document.createElement("span");
  badge.className = "truthcheck-badge";
  badge.setAttribute("role", "button");
  badge.tabIndex = 0;
  setBadge(badge, "#6B6B6B", "Checking", true);
  badge.title = "Checking this answer…";
  container.appendChild(document.createElement("br"));
  container.appendChild(badge);
  const open = (e) => {
    e.stopPropagation();
    if (!badge.dataset.state) return; // still loading
    renderCard(docRect(badge.getBoundingClientRect()), JSON.parse(badge.dataset.state));
  };
  badge.addEventListener("click", open);
  badge.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open(e);
    }
  });
  return badge;
}

function updateBadgeWithResponse(badge, response) {
  if (!response || response.error) {
    const code = response && response.error;
    const label = code === "DAILY_LIMIT_REACHED" ? "Daily limit reached" : code === "NOT_SIGNED_IN" ? "Sign in to check" : "Couldn't check";
    setBadge(badge, code === "DAILY_LIMIT_REACHED" || code === "NOT_SIGNED_IN" ? "#6B6B6B" : "#B3412F", label, false);
    badge.title = "Click for details.";
    badge.dataset.state = JSON.stringify(
      response || { error: "NETWORK_ERROR", detail: "No response from the extension. Try refreshing the page." }
    );
    return;
  }
  const r = response.result || {};
  const v = VERDICTS[r.verdict] || VERDICTS.uncertain;
  const conf = normConf(r.confidence);
  setBadge(badge, v.color, conf === null ? v.label : `${v.label} ${conf}%`, false);
  badge.title = r.summary || "Click for details";
  badge.dataset.state = JSON.stringify({ result: r });
}

// Checks run one at a time with a short gap, so a burst of answers can't blow
// through the free rate limits.
const jobQueue = [];
let jobRunning = false;
function enqueueJob(job) {
  jobQueue.push(job);
  runNextJob();
}
function runNextJob() {
  if (jobRunning) return;
  const job = jobQueue.shift();
  if (!job) return;
  jobRunning = true;
  job(() => {
    jobRunning = false;
    setTimeout(runNextJob, 1500);
  });
}

const trackedContainers = new Map(); // container -> { lastText, stableSince, changed, done }
let autoCheckEnabled = true;
let signedIn = false; // automatic checks only run for signed-in people
let pausedUntil = 0; // set when today's limit is used up, so we stop asking the server

// Chat pages change constantly while an answer streams in, so don't rescan on every
// tiny change: at most once every 400 ms.
let scanTimer = null;
function scheduleScan() {
  if (scanTimer) return;
  scanTimer = setTimeout(() => {
    scanTimer = null;
    scanForAiMessages();
  }, 400);
}

function scanForAiMessages() {
  if (!autoCheckEnabled) return;
  const selector = getSelectorForThisHost();
  if (!selector) return;
  document.querySelectorAll(selector).forEach((container) => {
    if (!trackedContainers.has(container)) {
      trackedContainers.set(container, {
        lastText: container.textContent.trim(), // textContent is far cheaper than innerText
        stableSince: Date.now(),
        changed: false, // becomes true only if the text streams in while we watch
        done: false
      });
    }
  });
}

function stabilityTick() {
  if (!autoCheckEnabled) return;
  const now = Date.now();
  trackedContainers.forEach((state, container) => {
    if (state.done) return;
    if (!document.body.contains(container)) {
      trackedContainers.delete(container);
      return;
    }
    const currentText = container.textContent.trim();
    if (currentText !== state.lastText) {
      state.lastText = currentText;
      state.stableSince = now;
      state.changed = true;
      return;
    }
    // Only auto-check answers that streamed in while we were watching. Messages
    // already on the page when it loaded (old chat history) are skipped, so opening
    // a long conversation doesn't fire dozens of checks. Select text to check those.
    if (!state.changed) return;
    if (currentText.length > 15 && now - state.stableSince >= 1200) {
      state.done = true;
      // Signed out, or today's limit is used up: skip quietly, no badge.
      if (!signedIn || Date.now() < pausedUntil) return;
      // innerText keeps paragraph breaks. Read it BEFORE adding our badge.
      const text = (container.innerText || currentText).trim().slice(0, 6000);
      const badge = makeBadge(container);
      enqueueJob((finish) => {
        sendToBackground({ type: "VERIFY_CLAIM", text }, (response) => {
          if (response && response.error === "DAILY_LIMIT_REACHED") {
            const t = Date.parse(response.resetsAt);
            pausedUntil = Number.isFinite(t) ? t : Date.now() + 60 * 60 * 1000;
          }
          if (response && response.error === "NOT_SIGNED_IN") signedIn = false;
          updateBadgeWithResponse(badge, response);
          finish();
        });
      });
    }
  });
}

const selectorForHost = getSelectorForThisHost();
if (selectorForHost) {
  chrome.storage.local.get(["autoCheck", "authToken"], ({ autoCheck, authToken }) => {
    autoCheckEnabled = autoCheck !== false; // default: on
    signedIn = Boolean(authToken);
    // Always start watching; the flag is checked inside, so turning the toggle
    // on later works without reloading the page.
    scanForAiMessages();
    const observer = new MutationObserver(() => scheduleScan());
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(stabilityTick, 800);
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.authToken) {
      signedIn = Boolean(changes.authToken.newValue);
      if (signedIn) pausedUntil = 0;
    }
    if (changes.autoCheck) {
      autoCheckEnabled = changes.autoCheck.newValue !== false;
      if (autoCheckEnabled) scanForAiMessages();
    }
  });
}
