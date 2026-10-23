const $ = (id) => document.getElementById(id);

function send(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(chrome.runtime.lastError ? null : response);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

const ERRORS = {
  INVALID_EMAIL: "Enter a valid email address.",
  WEAK_PASSWORD: "Use at least 8 characters.",
  EMAIL_TAKEN: "That email already has an account. Try signing in.",
  BAD_LOGIN: "Incorrect email or password.",
  SERVER_MISCONFIGURED: "The server isn't fully set up yet.",
  DATABASE_UNAVAILABLE: "The account service is waking up. Try again in a moment."
};

function errorText(r) {
  if (!r) return "Couldn't reach the extension. Close this window and try again.";
  if (r.error === "RATE_LIMITED" || r.error === "NETWORK_ERROR") {
    return r.detail || "Couldn't reach the server. Try again in a moment.";
  }
  return ERRORS[r.error] || "Something went wrong. Try again.";
}

// ---------- signed out ----------
let mode = "in"; // "in" = sign in, "up" = create account

function setMode(next) {
  mode = next;
  const up = mode === "up";
  $("tabIn").setAttribute("aria-selected", String(!up));
  $("tabUp").setAttribute("aria-selected", String(up));
  $("submit").textContent = up ? "Create account" : "Sign in";
  $("pwHint").hidden = !up;
  $("password").autocomplete = up ? "new-password" : "current-password";
  setMessage("");
}

function setMessage(text, isError) {
  $("msg").textContent = text;
  $("msg").className = isError ? "err" : "";
}

function showOut(note) {
  $("viewIn").hidden = true;
  $("viewOut").hidden = false;
  setMode("in"); // signing out (or an expired session) always returns to "Sign in"
  setMessage(note || "", Boolean(note));
}

$("tabIn").addEventListener("click", () => setMode("in"));
$("tabUp").addEventListener("click", () => setMode("up"));

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!email || !password) {
    setMessage("Enter your email and password.", true);
    return;
  }
  $("submit").disabled = true;
  setMessage(mode === "up" ? "Creating your account…" : "Signing in…");
  const waking = setTimeout(() => setMessage("The server is waking up. This can take up to 30 seconds…"), 6000);
  const r = await send({ type: mode === "up" ? "SIGNUP" : "LOGIN", email, password });
  clearTimeout(waking);
  $("submit").disabled = false;
  if (r && r.ok) {
    $("password").value = "";
    showIn(r.email);
  } else {
    setMessage(errorText(r), true);
  }
});

// ---------- signed in ----------
function showIn(email) {
  $("viewOut").hidden = true;
  $("viewIn").hidden = false;
  $("who").textContent = email || "";
  $("who").title = email || "";
  loadUsage();
}

async function loadUsage() {
  $("usageText").textContent = "Loading…";
  $("resetText").textContent = "";
  const r = await send({ type: "GET_ME" });
  if (r && r.error === "NOT_SIGNED_IN") {
    showOut("Your session ended. Sign in again.");
    return;
  }
  if (!r || !r.me) {
    $("usageText").textContent = "Unavailable";
    $("resetText").textContent = "Couldn't load usage. The server may be waking up. Reopen this window in a moment.";
    return;
  }
  const { used, limit, resetsAt } = r.me;
  const pct = Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
  $("usageText").textContent = `${used.toLocaleString()} of ${limit.toLocaleString()} tokens`;
  $("meterFill").style.width = pct + "%";
  $("meterFill").style.background = pct >= 100 ? "#b3412f" : pct >= 85 ? "#a0721a" : "#1a1a1a";
  $("meter").setAttribute("aria-valuenow", String(pct));
  const when = new Date(resetsAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
  $("resetText").textContent = pct >= 100 ? `Daily limit reached. Resets ${when}.` : `Resets ${when}.`;
}

$("signout").addEventListener("click", async () => {
  await send({ type: "LOGOUT" });
  showOut("");
});

$("autoCheck").addEventListener("change", () => {
  chrome.storage.local.set({ autoCheck: $("autoCheck").checked });
});

// ---------- start ----------
chrome.storage.local.get(["authToken", "userEmail", "autoCheck"], ({ authToken, userEmail, autoCheck }) => {
  $("autoCheck").checked = autoCheck !== false;
  if (authToken) showIn(userEmail);
  else showOut("");
});
