# TruthCheck — AI Answer & Claim Verifier

Automatically checks AI chatbot answers (ChatGPT, Claude.ai, Gemini) for factual accuracy using live web search. Select text on any other page and click Verify to check it too.

## How it works
Extension -> your server on Render -> web search (Firecrawl Keyless, no account) + Groq free LLM (no card). The Groq key stays on the server. Users who hit the shared limit can paste their own free Groq key in the popup.

## Setup (once)
1. Deploy the server: follow `factcheck-server/DEPLOY.md` (GitHub + Render).
2. Open `background.js`, replace the `SERVER_URL` line with your Render URL.
3. Chrome -> chrome://extensions -> Developer mode -> Load unpacked -> pick this folder.

## Known limits
- Auto-detect on chat sites depends on their page layout and may need selector updates if they redesign.
- Auto-check only runs on answers that appear while the page is open. Old messages already in a chat are skipped on purpose (to save your free limit); select the text and click Verify to check those.
- Render's free tier sleeps when idle; the first check after a quiet period can take 20-30 seconds.
- Llama via Groq is good, not perfect: treat results as a strong second opinion.

## Before publishing to the Chrome Web Store
Add 16/48/128px icons in manifest.json, write a short privacy policy (text being checked is sent to your server and to Groq and Firecrawl for analysis), pay the one-time $5 developer fee, submit for review.
