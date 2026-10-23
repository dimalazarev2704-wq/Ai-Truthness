// background.js: service worker.
// Talks to your TruthCheck server (Render). Handles sign up, sign in and checks.
// The session token is kept in the browser's extension storage; passwords are never stored.

const SERVER_URL = "https://aifactcheck-server.onrender.com";

async function getToken() {
  const { authToken } = await chrome.storage.local.get("authToken");
  return authToken || null;
}

async function clearSession() {
  await chrome.storage.local.remove(["authToken", "userEmail"]);
}

// One place that talks to the server. Returns { status, data } or { networkError }.
async function callServer(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const resp = await fetch(`${SERVER_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60000) // free servers can take ~30s to wake up
    });
    let data = {};
    try {
      data = await resp.json();
    } catch (e) {
      if (resp.status >= 500) {
        // A server that is still waking up often answers with a plain HTML error page.
        return {
          networkError: true,
          data: { error: "NETWORK_ERROR", detail: "The server is waking up. Try again in 30 seconds." }
        };
      }
      data = { error: "PARSE_ERROR" };
    }
    return { status: resp.status, ok: resp.ok, data };
  } catch (e) {
    return {
      networkError: true,
      data: {
        error: "NETWORK_ERROR",
        detail: "Couldn't reach the server. If it was idle it may be waking up, so try again in 30 seconds."
      }
    };
  }
}

// Keep only the fields the interface needs.
function errorFrom(data) {
  return {
    error: data.error || "API_ERROR",
    detail: data.detail,
    raw: data.raw,
    used: data.used,
    limit: data.limit,
    resetsAt: data.resetsAt
  };
}

async function signInOrUp(kind, email, password) {
  const r = await callServer(kind === "signup" ? "/auth/signup" : "/auth/login", {
    method: "POST",
    body: { email, password }
  });
  if (r.networkError || !r.ok) return errorFrom(r.data);
  await chrome.storage.local.set({ authToken: r.data.token, userEmail: r.data.email });
  return { ok: true, email: r.data.email };
}

async function getMe() {
  const token = await getToken();
  if (!token) return { error: "NOT_SIGNED_IN" };
  const r = await callServer("/me", { token });
  if (r.status === 401) {
    await clearSession();
    return { error: "NOT_SIGNED_IN" };
  }
  if (r.networkError || !r.ok) return errorFrom(r.data);
  return { me: r.data };
}

async function verifyClaim(text) {
  const token = await getToken();
  if (!token) return { error: "NOT_SIGNED_IN" };
  const r = await callServer("/verify", { method: "POST", body: { text }, token });
  if (r.status === 401) {
    await clearSession();
    return { error: "NOT_SIGNED_IN" };
  }
  if (r.networkError || !r.ok) return errorFrom(r.data);
  return r.data; // { result, usage }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let job = null;
  if (message.type === "SIGNUP") job = signInOrUp("signup", message.email, message.password);
  else if (message.type === "LOGIN") job = signInOrUp("login", message.email, message.password);
  else if (message.type === "LOGOUT") job = clearSession().then(() => ({ ok: true }));
  else if (message.type === "GET_ME") job = getMe();
  else if (message.type === "VERIFY_CLAIM") job = verifyClaim(message.text);
  if (!job) return false;
  job.then(sendResponse).catch(() => sendResponse({ error: "API_ERROR" }));
  return true; // keep the message channel open for the async response
});
