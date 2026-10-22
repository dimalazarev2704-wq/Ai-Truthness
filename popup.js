const keyInput = document.getElementById("groqKey");
const statusEl = document.getElementById("status");
const autoCheckInput = document.getElementById("autoCheck");

chrome.storage.local.get(["groqApiKey", "autoCheck"], ({ groqApiKey, autoCheck }) => {
  if (groqApiKey) keyInput.value = groqApiKey;
  autoCheckInput.checked = autoCheck !== false;
});

autoCheckInput.addEventListener("change", () => {
  chrome.storage.local.set({ autoCheck: autoCheckInput.checked });
});

document.getElementById("save").addEventListener("click", async () => {
  await chrome.storage.local.set({ groqApiKey: keyInput.value.trim() });
  statusEl.textContent = keyInput.value.trim() ? "Saved. Using your own key." : "Cleared. Using the shared default.";
  statusEl.className = "ok";
});

document.getElementById("test").addEventListener("click", () => {
  const key = keyInput.value.trim();
  if (!key) {
    statusEl.textContent = "Paste a key first.";
    statusEl.className = "err";
    return;
  }
  statusEl.textContent = "Testing…";
  statusEl.className = "";
  chrome.runtime.sendMessage({ type: "TEST_OWN_KEY", apiKey: key }, (resp) => {
    if (resp && resp.ok) {
      statusEl.textContent = "✓ Key works.";
      statusEl.className = "ok";
    } else {
      statusEl.textContent = `✗ Failed (${(resp && (resp.status || resp.error)) || "unknown"})`;
      statusEl.className = "err";
    }
  });
});
