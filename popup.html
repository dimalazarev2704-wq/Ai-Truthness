<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>TruthCheck</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    [hidden] { display: none !important; }
    body {
      width: 300px;
      padding: 20px;
      background: #ffffff;
      color: #1a1a1a;
      font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    h1 { font-size: 16px; font-weight: 600; }
    .sub { margin-top: 2px; color: #6b6b6b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .hint { margin-top: 6px; color: #6b6b6b; font-size: 12px; }
    .fine { margin-top: 16px; color: #8a8a8a; font-size: 11px; }

    /* sign in / create account tabs */
    .tabs { display: flex; margin-top: 18px; border-bottom: 1px solid #ececec; }
    .tab {
      flex: 1;
      padding: 8px 0;
      border: 0;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      background: none;
      color: #6b6b6b;
      font: inherit;
      font-weight: 500;
      cursor: pointer;
    }
    .tab[aria-selected="true"] { color: #1a1a1a; border-bottom-color: #1a1a1a; }
    .tab:focus-visible { outline: 2px solid #1a1a1a; outline-offset: -2px; }

    label.field { display: block; margin-top: 14px; font-size: 12px; font-weight: 600; }
    input[type="email"], input[type="password"] {
      display: block;
      width: 100%;
      margin-top: 4px;
      padding: 8px 10px;
      border: 1px solid #d9d9d9;
      border-radius: 8px;
      background: #ffffff;
      color: #1a1a1a;
      font: inherit;
      font-weight: 400;
    }
    input[type="email"]:focus, input[type="password"]:focus { outline: none; border-color: #1a1a1a; }

    .primary {
      display: block;
      width: 100%;
      margin-top: 16px;
      padding: 9px 10px;
      border: 1px solid #1a1a1a;
      border-radius: 8px;
      background: #1a1a1a;
      color: #ffffff;
      font: inherit;
      font-weight: 500;
      cursor: pointer;
    }
    .primary:hover { background: #000000; }
    .primary:disabled { opacity: 0.6; cursor: default; }
    .primary:focus-visible { outline: 2px solid #1a1a1a; outline-offset: 2px; }

    #msg { min-height: 18px; margin-top: 10px; font-size: 12px; color: #6b6b6b; }
    #msg.err { color: #b3412f; }

    /* signed-in view */
    .account { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .account > div { min-width: 0; }
    .link {
      flex: none;
      border: 0;
      background: none;
      padding: 2px 0;
      color: #6b6b6b;
      font: inherit;
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
    }
    .link:hover { color: #1a1a1a; }
    .link:focus-visible { outline: 2px solid #1a1a1a; outline-offset: 2px; }

    .usage { margin-top: 20px; padding: 14px 0; border-top: 1px solid #ececec; }
    .usage-top { display: flex; justify-content: space-between; gap: 12px; }
    .usage-top span:first-child { font-weight: 600; }
    .usage-top span:last-child { color: #6b6b6b; }
    .meter { margin-top: 8px; height: 4px; border-radius: 999px; background: #ececec; overflow: hidden; }
    #meterFill { width: 0; height: 100%; border-radius: 999px; background: #1a1a1a; transition: width 0.25s; }

    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 0;
      border-top: 1px solid #ececec;
      border-bottom: 1px solid #ececec;
      cursor: pointer;
    }
    .row small { display: block; color: #6b6b6b; font-size: 12px; }

    input[type="checkbox"] {
      appearance: none;
      -webkit-appearance: none;
      flex: none;
      position: relative;
      width: 36px;
      height: 20px;
      border-radius: 999px;
      background: #d4d4d4;
      cursor: pointer;
      transition: background 0.15s;
    }
    input[type="checkbox"]::after {
      content: "";
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #ffffff;
      transition: transform 0.15s;
    }
    input[type="checkbox"]:checked { background: #1a1a1a; }
    input[type="checkbox"]:checked::after { transform: translateX(16px); }
    input[type="checkbox"]:focus-visible { outline: 2px solid #1a1a1a; outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) {
      #meterFill, input[type="checkbox"], input[type="checkbox"]::after { transition: none; }
    }
  </style>
</head>
<body>
  <!-- signed out -->
  <section id="viewOut" hidden>
    <h1>TruthCheck</h1>
    <p class="sub" style="white-space: normal">Free fact-checks for AI answers and web text.</p>

    <div class="tabs" role="tablist">
      <button class="tab" id="tabIn" role="tab" aria-selected="true">Sign in</button>
      <button class="tab" id="tabUp" role="tab" aria-selected="false">Create account</button>
    </div>

    <form id="form" novalidate>
      <label class="field" for="email">Email
        <input id="email" type="email" autocomplete="email" />
      </label>
      <label class="field" for="password">Password
        <input id="password" type="password" autocomplete="current-password" />
      </label>
      <p class="hint" id="pwHint" hidden>Use at least 8 characters.</p>
      <button type="submit" class="primary" id="submit">Sign in</button>
      <div id="msg" role="status"></div>
    </form>
    <p class="fine">Your email is only used for your account and your daily limit.</p>
  </section>

  <!-- signed in -->
  <section id="viewIn" hidden>
    <div class="account">
      <div>
        <h1>TruthCheck</h1>
        <p class="sub" id="who"></p>
      </div>
      <button class="link" id="signout">Sign out</button>
    </div>

    <div class="usage">
      <div class="usage-top"><span>Today's usage</span><span id="usageText">Loading…</span></div>
      <div class="meter" role="progressbar" id="meter" aria-label="Daily usage" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <div id="meterFill"></div>
      </div>
      <p class="hint" id="resetText"></p>
    </div>

    <label class="row" for="autoCheck">
      <span>
        Check AI answers automatically
        <small>ChatGPT, Claude and Gemini</small>
      </span>
      <input type="checkbox" id="autoCheck" role="switch" checked />
    </label>
  </section>

  <script src="popup.js"></script>
</body>
</html>
