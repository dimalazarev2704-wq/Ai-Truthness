// background.js — service worker
// Sends text to your TruthCheck server (hosted on Render, code on GitHub).
// The server holds the shared Groq key and does search + checking.
// Users may optionally add their OWN free Groq key in the popup; it is sent to the
// server with each request so their usage never touches the shared quota.

// ⚠️ SETUP: after deploying the server (see factcheck-server/DEPLOY.md),
// replace this with your Render URL (no trailing slash).
const SERVER_URL = "https://YOUR-APP-NAME.onrender.com";

async function verifyClaim(text) {
  if (SERVER_URL.includes("YOUR-APP-NAME")) {
    return { error: "NOT_CONFIGURED" };
  }
  const { groqApiKey } = await chrome.storage.local.get("groqApiKey");
  const headers = { "Content-Type": "application/json" };
  if (groqApiKey && groqApiKey.trim()) {
    headers["x-user-groq-key"] = groqApiKey.trim();
  }

  try {
    const resp = await fetch(`${SERVER_URL}/verify`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text })
    });
    let data;
    try {
      data = await resp.json();
    } catch (e) {
      return { error: "PARSE_ERROR", raw: "" };
    }
    if (!resp.ok) {
      return { error: data.error || "API_ERROR", detail: data.detail || `HTTP ${resp.status}`, raw: data.raw };
    }
    return data;
  } catch (e) {
    return { error: "NETWORK_ERROR", detail: "Couldn't reach the server. If it was idle it may be waking up - try again in 30 seconds." };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "VERIFY_CLAIM") {
    verifyClaim(message.text).then(sendResponse);
    return true;
  }
  if (message.type === "TEST_OWN_KEY") {
    (async () => {
      try {
        const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${message.apiKey}` },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            max_tokens: 8,
            messages: [{ role: "user", content: "Say OK" }]
          })
        });
        sendResponse({ ok: resp.ok, status: resp.status });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
});
