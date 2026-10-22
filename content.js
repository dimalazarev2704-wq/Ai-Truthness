// content.js — runs on every page.
// 1) Lets the user select any text and click "Verify" to fact-check it.
// 2) On known AI chat sites, automatically checks each new AI answer and shows a result badge.

const VERDICT_STYLES = {
  true: { color: "#1a7f37", label: "✓ Looks accurate" },
  false: { color: "#cf222e", label: "✗ Inaccurate" },
  partially_true: { color: "#9a6700", label: "◐ Partially accurate" },
  uncertain: { color: "#57606a", label: "? Uncertain" },
  opinion: { color: "#57606a", label: "— Opinion / not checkable" }
};

// ---------- shared UI: result card ----------

function removeExistingCard() {
  const existing = document.getElementById("truthcheck-card");
  if (existing) existing.remove();
}

function renderCard(anchorRect, state) {
  removeExistingCard();

  const card = document.createElement("div");
  card.id = "truthcheck-card";
  card.className = "truthcheck-card";

  const top = Math.min(
    window.scrollY + anchorRect.bottom + 8,
    window.scrollY + document.documentElement.clientHeight - 20
  );
  const left = Math.min(
    window.scrollX + anchorRect.left,
    window.scrollX + document.documentElement.clientWidth - 340
  );
  card.style.top = `${top}px`;
  card.style.left = `${Math.max(8, left)}px`;

  card.innerHTML = renderCardContent(state);
  document.body.appendChild(card);

  const closeBtn = card.querySelector(".truthcheck-close");
  if (closeBtn) closeBtn.addEventListener("click", removeExistingCard);
}

function renderCardContent(state) {
  if (state.loading) {
    return `
      <div class="truthcheck-header">
        <span>Checking…</span>
        <button class="truthcheck-close">&times;</button>
      </div>
      <div class="truthcheck-body">
        <div class="truthcheck-spinner"></div>
        <p>Searching the web to verify this claim…</p>
      </div>`;
  }

  if (state.error) {
    let msg = "Something went wrong.";
    if (state.error === "NOT_CONFIGURED") {
      msg = "This extension isn't connected to its server yet. The developer needs to add the server URL before publishing.";
    } else if (state.error === "SHARED_LIMIT_REACHED") {
      msg = "Lots of people are using the built-in free checking right now, so today's shared limit is used up. Click the TruthCheck icon in your toolbar to add your own free key (about 30 seconds, no card) and keep going.";
    } else if (state.error === "OWN_KEY_RATE_LIMITED") {
      msg = "You've hit your own key's rate limit for now. Wait a bit and try again.";
    } else if (state.error === "RATE_LIMITED") {
      msg = state.detail || "Too many checks in a short time. Try again in a few minutes.";
    } else if (state.error === "API_ERROR") {
      msg = `API error: ${state.detail || ""}`;
    } else if (state.error === "PARSE_ERROR") {
      msg = `Got an unexpected response: ${(state.raw || "").slice(0, 200)}`;
    } else if (state.error === "NETWORK_ERROR") {
      msg = `Network error: ${state.detail || ""}`;
    }
    return `
      <div class="truthcheck-header">
        <span>TruthCheck</span>
        <button class="truthcheck-close">&times;</button>
      </div>
      <div class="truthcheck-body truthcheck-error">
        <p>${escapeHtml(msg)}</p>
      </div>`;
  }

  const r = state.result || {};
  const v = VERDICT_STYLES[r.verdict] || VERDICT_STYLES.uncertain;
  const sources = Array.isArray(r.sources) ? r.sources : [];

  return `
    <div class="truthcheck-header" style="border-left: 4px solid ${v.color}">
      <span style="color:${v.color}; font-weight:600;">${v.label}</span>
      <button class="truthcheck-close">&times;</button>
    </div>
    <div class="truthcheck-body">
      <p class="truthcheck-confidence">Confidence: ${Number.isFinite(Number(r.confidence)) ? Math.round(Number(r.confidence)) : "?"}%</p>
      <p>${escapeHtml(r.summary || "No summary provided.")}</p>
      ${r.corrections ? `<p class="truthcheck-correction"><strong>Correction:</strong> ${escapeHtml(r.corrections)}</p>` : ""}
      ${sources.filter((s) => safeUrl(s.url)).length ? `<div class="truthcheck-sources"><strong>Sources:</strong><ul>${sources
        .filter((s) => safeUrl(s.url))
        .map((s) => `<li><a href="${escapeAttr(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title || s.url)}</a></li>`)
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

function requestVerification(text, anchorRect) {
  renderCard(anchorRect, { loading: true });
  sendToBackground({ type: "VERIFY_CLAIM", text }, (response) => {
    if (!response) {
      renderCard(anchorRect, {
        error: "NETWORK_ERROR",
        detail: "No response from the extension. If you just updated it, refresh this page."
      });
      return;
    }
    if (response.error) {
      renderCard(anchorRect, response);
    } else {
      renderCard(anchorRect, { result: response.result });
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
    selectionBtn.textContent = "🔍 Verify";
    selectionBtn.style.top = `${window.scrollY + rect.top - 34}px`;
    selectionBtn.style.left = `${window.scrollX + rect.left}px`;
    selectionBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      requestVerification(text, rect);
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

const BADGE_STYLES = {
  true: { color: "#1a7f37", label: "✓" },
  false: { color: "#cf222e", label: "✗" },
  partially_true: { color: "#9a6700", label: "◐" },
  uncertain: { color: "#57606a", label: "?" },
  opinion: { color: "#57606a", label: "—" }
};

function getSelectorForThisHost() {
  const host = window.location.hostname;
  const match = AI_SITE_SELECTORS.find((s) => host.includes(s.host));
  return match ? match.selector : null;
}

function makeBadge(container) {
  const badge = document.createElement("span");
  badge.className = "truthcheck-badge truthcheck-badge-loading";
  badge.textContent = "⋯";
  badge.title = "Checking this answer…";
  container.appendChild(document.createElement("br"));
  container.appendChild(badge);
  badge.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!badge.dataset.state) return; // still loading
    renderCard(badge.getBoundingClientRect(), JSON.parse(badge.dataset.state));
  });
  return badge;
}

function updateBadgeWithResponse(badge, response) {
  if (!response || response.error) {
    badge.className = "truthcheck-badge truthcheck-badge-error";
    badge.textContent = "!";
    badge.title =
      response && response.error === "SHARED_LIMIT_REACHED"
        ? "Shared free limit reached. Click for how to add your own free key."
        : "Couldn't check this answer. Click for details.";
    badge.dataset.state = JSON.stringify(
      response || { error: "NETWORK_ERROR", detail: "No response from the extension. Try refreshing the page." }
    );
    return;
  }
  const r = response.result || {};
  const style = BADGE_STYLES[r.verdict] || BADGE_STYLES.uncertain;
  const conf = Number.isFinite(Number(r.confidence)) ? Math.round(Number(r.confidence)) : "?";
  badge.className = "truthcheck-badge";
  badge.style.color = style.color;
  badge.style.borderColor = style.color;
  badge.textContent = `${style.label} ${conf}%`;
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

function scanForAiMessages() {
  if (!autoCheckEnabled) return;
  const selector = getSelectorForThisHost();
  if (!selector) return;
  document.querySelectorAll(selector).forEach((container) => {
    if (!trackedContainers.has(container)) {
      trackedContainers.set(container, {
        lastText: container.innerText.trim(),
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
    const currentText = container.innerText.trim();
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
      const text = currentText.slice(0, 6000); // read BEFORE adding our badge
      const badge = makeBadge(container);
      enqueueJob((finish) => {
        sendToBackground({ type: "VERIFY_CLAIM", text }, (response) => {
          updateBadgeWithResponse(badge, response);
          finish();
        });
      });
    }
  });
}

const selectorForHost = getSelectorForThisHost();
if (selectorForHost) {
  chrome.storage.local.get(["autoCheck"], ({ autoCheck }) => {
    autoCheckEnabled = autoCheck !== false; // default: on
    // Always start watching; the flag is checked inside, so turning the toggle
    // on later works without reloading the page.
    scanForAiMessages();
    const observer = new MutationObserver(() => scanForAiMessages());
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(stabilityTick, 800);
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.autoCheck) {
      autoCheckEnabled = changes.autoCheck.newValue !== false;
      if (autoCheckEnabled) scanForAiMessages();
    }
  });
}
