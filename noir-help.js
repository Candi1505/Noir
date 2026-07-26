(() => {
  "use strict";

  const OVERLAY_ID =
    "noirHelpOverlay";

  function addStyles() {
    if (
      document.getElementById(
        "noirHelpStyles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "noirHelpStyles";

    style.textContent = `
      .noir-help-launcher {
        appearance: none;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 14px;
        width: 100%;
        margin: 0 0 18px;
        padding: 17px 18px;
        border: 1px solid rgba(111, 218, 184, .34);
        border-radius: 20px;
        background:
          linear-gradient(
            145deg,
            rgba(13, 59, 47, .55),
            rgba(7, 16, 14, .96)
          );
        color: #e7e3da;
        text-align: left;
        font: inherit;
        box-shadow:
          0 18px 38px rgba(0, 0, 0, .22);
      }

      .noir-help-launcher-icon {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border: 1px solid rgba(111, 218, 184, .38);
        border-radius: 14px;
        background: rgba(111, 218, 184, .09);
        color: #7fd9bd;
        font-size: 22px;
        font-weight: 950;
      }

      .noir-help-launcher strong,
      .noir-help-launcher small {
        display: block;
      }

      .noir-help-launcher strong {
        color: #f0ede6;
        font-size: 17px;
      }

      .noir-help-launcher small {
        margin-top: 4px;
        color: #aaa49a;
        font-size: 12px;
        line-height: 1.45;
      }

      .noir-help-launcher-arrow {
        color: #7fd9bd;
        font-size: 22px;
      }

      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        z-index: 1000000;
        display: none;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding:
          max(16px, env(safe-area-inset-top))
          12px
          max(28px, env(safe-area-inset-bottom));
        background:
          radial-gradient(
            circle at 50% 0,
            rgba(36, 91, 73, .2),
            transparent 34%
          ),
          rgba(2, 3, 3, .98);
        color: #dedbd4;
      }

      #${OVERLAY_ID}.open {
        display: block;
      }

      .noir-help-shell {
        width: min(760px, 100%);
        margin: 0 auto;
      }

      .noir-help-topbar {
        position: sticky;
        top: 0;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 14px;
        padding: 15px 16px;
        border: 1px solid rgba(217, 191, 118, .2);
        border-radius: 20px;
        background: rgba(5, 6, 6, .94);
        backdrop-filter: blur(18px);
      }

      .noir-help-eyebrow {
        margin: 0 0 5px;
        color: #d9bf76;
        font-size: 10px;
        font-weight: 950;
        letter-spacing: .2em;
      }

      .noir-help-topbar h1 {
        margin: 0;
        color: #f2efe8;
        font-size: clamp(22px, 6vw, 30px);
      }

      .noir-help-close {
        appearance: none;
        flex: 0 0 auto;
        width: 46px;
        height: 46px;
        border: 1px solid #3a3a3a;
        border-radius: 50%;
        background: #111;
        color: #ddd;
        font: inherit;
        font-size: 28px;
      }

      .noir-help-intro,
      .noir-help-section,
      .noir-help-tip {
        margin-bottom: 12px;
        border: 1px solid #292929;
        border-radius: 20px;
        background:
          linear-gradient(
            145deg,
            rgba(18, 18, 18, .98),
            rgba(6, 7, 7, .98)
          );
      }

      .noir-help-intro {
        padding: 20px;
        border-color: rgba(111, 218, 184, .28);
      }

      .noir-help-intro h2,
      .noir-help-intro p {
        margin: 0;
      }

      .noir-help-intro h2 {
        color: #7fd9bd;
        font-size: 21px;
      }

      .noir-help-intro p {
        margin-top: 9px;
        color: #aaa49a;
        line-height: 1.6;
      }

      .noir-help-steps {
        display: grid;
        gap: 10px;
        margin-top: 16px;
      }

      .noir-help-step {
        display: grid;
        grid-template-columns: 32px minmax(0, 1fr);
        gap: 11px;
        align-items: start;
        color: #c9c5bd;
        line-height: 1.5;
      }

      .noir-help-step span {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border: 1px solid rgba(217, 191, 118, .3);
        border-radius: 11px;
        color: #d9bf76;
        font-weight: 950;
      }

      .noir-help-section {
        overflow: hidden;
      }

      .noir-help-section summary {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        padding: 17px;
        color: #e3dfd7;
        font-weight: 900;
        cursor: pointer;
        list-style: none;
      }

      .noir-help-section summary::-webkit-details-marker {
        display: none;
      }

      .noir-help-section summary::after {
        content: "+";
        color: #d9bf76;
        font-size: 22px;
      }

      .noir-help-section[open] summary::after {
        content: "−";
      }

      .noir-help-section-icon {
        font-size: 21px;
      }

      .noir-help-body {
        padding: 0 17px 18px;
        color: #aaa49a;
        font-size: 14px;
        line-height: 1.62;
      }

      .noir-help-body p {
        margin: 0 0 12px;
      }

      .noir-help-body ul,
      .noir-help-body ol {
        margin: 0;
        padding-left: 21px;
      }

      .noir-help-body li + li {
        margin-top: 8px;
      }

      .noir-help-body strong {
        color: #e0d8c3;
      }

      .noir-help-callout {
        margin-top: 13px;
        padding: 13px 14px;
        border: 1px solid rgba(111, 218, 184, .26);
        border-radius: 14px;
        background: rgba(111, 218, 184, .06);
        color: #9edcc8;
      }

      .noir-help-warning {
        border-color: rgba(217, 191, 118, .3);
        background: rgba(217, 191, 118, .07);
        color: #d2bd7e;
      }

      .noir-help-email {
        display: block;
        margin-top: 14px;
        padding: 14px 16px;
        border: 1px solid rgba(111, 218, 184, .38);
        border-radius: 14px;
        background: rgba(111, 218, 184, .09);
        color: #8ce0c4;
        font-weight: 900;
        text-align: center;
        text-decoration: none;
      }

      .noir-help-tip {
        padding: 17px;
        color: #9d978d;
        font-size: 13px;
        line-height: 1.6;
      }

      body.noir-help-open {
        overflow: hidden;
      }
    `;

    document.head.appendChild(
      style
    );
  }

  function addLauncher() {
    if (
      document.getElementById(
        "noirHelpLauncher"
      )
    ) {
      return;
    }

    const home =
      document.getElementById(
        "homeView"
      );

    const hero =
      home?.querySelector(
        ".hero-card"
      );

    if (!home || !hero) {
      return;
    }

    const button =
      document.createElement(
        "button"
      );

    button.id =
      "noirHelpLauncher";
    button.type =
      "button";
    button.className =
      "noir-help-launcher";
    button.innerHTML = `
      <span class="noir-help-launcher-icon">?</span>
      <span>
        <strong>Need help? Start here</strong>
        <small>
          Learn how predictions, confidence, bonuses and every chest tool work.
        </small>
      </span>
      <span class="noir-help-launcher-arrow">›</span>
    `;

    hero.insertAdjacentElement(
      "afterend",
      button
    );
  }

  function addOverlay() {
    if (
      document.getElementById(
        OVERLAY_ID
      )
    ) {
      return;
    }

    const overlay =
      document.createElement(
        "section"
      );

    overlay.id =
      OVERLAY_ID;
    overlay.setAttribute(
      "aria-hidden",
      "true"
    );
    overlay.setAttribute(
      "aria-label",
      "Noir help and instructions"
    );

    overlay.innerHTML = `
      <div class="noir-help-shell">
        <header class="noir-help-topbar">
          <div>
            <p class="noir-help-eyebrow">CHEST COMPANION</p>
            <h1>Help &amp; How It Works</h1>
          </div>
          <button
            id="noirHelpClose"
            class="noir-help-close"
            type="button"
            aria-label="Close help"
          >×</button>
        </header>

        <section class="noir-help-intro">
          <h2>Quick start</h2>
          <p>
            Noir uses the current event’s live chest decks and your own
            consecutive rewards to locate where you are. Your history stays
            on your device and never changes another player’s position.
          </p>
          <div class="noir-help-steps">
            <div class="noir-help-step">
              <span>1</span>
              <div>Choose Gold, Platinum, Draconic or Freedom.</div>
            </div>
            <div class="noir-help-step">
              <span>2</span>
              <div>Record each reward and amount in the exact order received.</div>
            </div>
            <div class="noir-help-step">
              <span>3</span>
              <div>Keep recording until Noir says safe predictions are ready.</div>
            </div>
            <div class="noir-help-step">
              <span>4</span>
              <div>Follow the safe list. Record more only when you want to extend it.</div>
            </div>
          </div>
        </section>

        <details class="noir-help-section" open>
          <summary>
            <span class="noir-help-section-icon">✦</span>
            Live Predictor
          </summary>
          <div class="noir-help-body">
            <ol>
              <li>Choose the same chest type you are opening in the game.</li>
              <li>Enter the exact reward name and amount after every opening.</li>
              <li>Rewards must be consecutive. Do not skip or reorder results.</li>
              <li>Use Undo immediately if the wrong reward or amount was entered.</li>
            </ol>
            <div class="noir-help-callout">
              When Noir says <strong>Predictions ready</strong> or
              <strong>Safe predictions ready</strong>, you can stop recording
              and use the displayed list.
            </div>
          </div>
        </details>

        <details class="noir-help-section">
          <summary>
            <span class="noir-help-section-icon">%</span>
            Confidence and short prediction lists
          </summary>
          <div class="noir-help-body">
            <p>
              <strong>100%</strong> means Noir has uniquely located the main
              sequence and every separate reward pool used by that chest.
            </p>
            <p>
              <strong>99% with safe predictions</strong> means the main sequence
              is located, but one or more later reward pools still need an
              identifying result. It does not mean every displayed reward has
              a 1% chance of being wrong.
            </p>
            <p>
              Noir may show only a few predictions because it pauses before an
              unresolved reward pool instead of guessing. When the safe list
              ends, open and record the next consecutive reward to identify
              that pool and unlock more.
            </p>
            <div class="noir-help-callout noir-help-warning">
              Different players and chest types may need different numbers of
              consecutive starting rewards. Keep recording until Noir
              explicitly says safe predictions are ready.
            </div>
          </div>
        </details>

        <details class="noir-help-section">
          <summary>
            <span class="noir-help-section-icon">★</span>
            Bonus chests
          </summary>
          <div class="noir-help-body">
            <ul>
              <li>Freedom earns a bonus after 15 regular chests.</li>
              <li>Gold, Platinum and Draconic earn a bonus after 30 regular chests.</li>
              <li>Enter the progress number currently shown on the game’s bonus bar—not your total history.</li>
              <li>Tick <strong>This reward came from a bonus chest</strong> only for the actual claimed bonus reward.</li>
            </ul>
            <p>
              A correctly marked bonus advances the separate bonus sequence
              without shifting the regular sequence.
            </p>
          </div>
        </details>

        <details class="noir-help-section">
          <summary>
            <span class="noir-help-section-icon">⌕</span>
            Find a Reward
          </summary>
          <div class="noir-help-body">
            <p>
              Find a Reward unlocks when confirmed predictions exist. Choose
              any reward to see every confirmed occurrence, its amount and how
              many regular chests away it is.
            </p>
            <p>
              If a reward is not found, it may be beyond the current safe
              prediction window. Record the next required consecutive result
              to extend the search.
            </p>
          </div>
        </details>

        <details class="noir-help-section">
          <summary>
            <span class="noir-help-section-icon">%</span>
            Chest Drop Rates
          </summary>
          <div class="noir-help-body">
            <p>
              Drop Rates compares the rewards, chances and estimated returns
              contained in the published event deck.
            </p>
            <p>
              These are long-term averages—not a promise about your next chest.
              Use Live Predictor for your exact confirmed upcoming rewards.
            </p>
          </div>
        </details>

        <details class="noir-help-section">
          <summary>
            <span class="noir-help-section-icon">◎</span>
            Chest Planner and rubies
          </summary>
          <div class="noir-help-body">
            <p>
              Planner compares chest value, estimates how many chests are
              needed for a resource goal and calculates what a ruby budget can
              open. Bonus chests are included using each chest’s cadence.
            </p>
            <p>
              Planner results are estimates. Solve your Live Predictor first
              if you want the most useful reward estimate for a ruby spend.
            </p>
          </div>
        </details>

        <details class="noir-help-section">
          <summary>
            <span class="noir-help-section-icon">⚡</span>
            Chest Tools
          </summary>
          <div class="noir-help-body">
            <ul>
              <li><strong>Reward search:</strong> find which chests contain a resource.</li>
              <li><strong>Chest budget:</strong> calculate chest openings from available rubies.</li>
              <li><strong>Event check:</strong> confirm regular and bonus data is ready for players.</li>
              <li><strong>Result cards:</strong> create clean summaries suitable for Discord.</li>
            </ul>
          </div>
        </details>

        <details class="noir-help-section">
          <summary>
            <span class="noir-help-section-icon">!</span>
            When something does not match
          </summary>
          <div class="noir-help-body">
            <ol>
              <li>Stop opening more chests.</li>
              <li>Check the selected chest, reward name and amount.</li>
              <li>Confirm whether the result was a regular or bonus chest.</li>
              <li>Use Undo for an incorrect last entry.</li>
              <li>Take screenshots of Noir’s prediction and the game result before changing anything.</li>
            </ol>
            <div class="noir-help-callout noir-help-warning">
              Never reset saved history simply because the safe list is short.
              A short list usually means Noir needs one result from a new pool.
            </div>
          </div>
        </details>

        <details class="noir-help-section">
          <summary>
            <span class="noir-help-section-icon">✉</span>
            Help &amp; Feedback
          </summary>
          <div class="noir-help-body">
            <p>
              Found a problem or have an idea for Noir? Email Chest Companion
              and include:
            </p>
            <ul>
              <li>The chest type you were using.</li>
              <li>Screenshots of Noir and the game result.</li>
              <li>The confidence shown at the time.</li>
              <li>Whether it was a regular or bonus chest.</li>
              <li>A short description of what happened.</li>
            </ul>
            <div class="noir-help-callout noir-help-warning">
              For your security, never email your WD IGN, HAR files, passwords,
              login codes or any account/session information.
            </div>
            <a
              class="noir-help-email"
              href="mailto:noirchestcompanion@gmail.com?subject=Noir%20Help%20%26%20Feedback"
            >Email Noir Chest Companion</a>
          </div>
        </details>

        <details class="noir-help-section">
          <summary>
            <span class="noir-help-section-icon">↻</span>
            Refresh App versus Reset Local Data
          </summary>
          <div class="noir-help-body">
            <p>
              <strong>Refresh App</strong> loads the newest live version while
              preserving predictor history, bonus progress and profile data.
            </p>
            <p>
              <strong>Reset Local Data</strong> deletes saved information from
              the current device. Use it only when you intentionally want to
              start over.
            </p>
          </div>
        </details>

        <div class="noir-help-tip">
          Predictions depend on the current event deck and accurate consecutive
          entries. If an event changes, wait until the new event data is marked
          ready before recording new results.
        </div>
      </div>
    `;

    document.body.appendChild(
      overlay
    );
  }

  function openHelp() {
    const overlay =
      document.getElementById(
        OVERLAY_ID
      );

    if (!overlay) {
      return;
    }

    overlay.classList.add(
      "open"
    );
    overlay.setAttribute(
      "aria-hidden",
      "false"
    );
    document.body.classList.add(
      "noir-help-open"
    );
    overlay.scrollTop = 0;
  }

  function closeHelp() {
    const overlay =
      document.getElementById(
        OVERLAY_ID
      );

    if (!overlay) {
      return;
    }

    overlay.classList.remove(
      "open"
    );
    overlay.setAttribute(
      "aria-hidden",
      "true"
    );
    document.body.classList.remove(
      "noir-help-open"
    );
  }

  function bindEvents() {
    document
      .getElementById(
        "noirHelpLauncher"
      )
      ?.addEventListener(
        "click",
        openHelp
      );

    document
      .getElementById(
        "noirHelpClose"
      )
      ?.addEventListener(
        "click",
        closeHelp
      );

    document
      .getElementById(
        OVERLAY_ID
      )
      ?.addEventListener(
        "click",
        event => {
          if (
            event.target.id ===
            OVERLAY_ID
          ) {
            closeHelp();
          }
        }
      );

    document.addEventListener(
      "keydown",
      event => {
        if (event.key === "Escape") {
          closeHelp();
        }
      }
    );
  }

  function initialise() {
    addStyles();
    addLauncher();
    addOverlay();
    bindEvents();
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialise,
      { once: true }
    );
  } else {
    initialise();
  }
})();
