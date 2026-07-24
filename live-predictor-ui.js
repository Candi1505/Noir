/* ============================================================
   CHEST COMPANION BETA
   LIVE PREDICTOR UI

   Must load after:
   - event-parser.js
   - event-import.js
   - live-predictor-engine.js
   ============================================================ */

(function initialiseLivePredictorUI(window) {
  "use strict";

  const Engine =
    window.LivePredictorEngine;

  if (!Engine) {
    console.error(
      "[Chest Companion] live-predictor-engine.js did not load."
    );

    return;
  }

  const OVERLAY_ID =
    "ccLivePredictorOverlay";

  const STYLE_ID =
    "ccLivePredictorStyles";

  const CHEST_ICONS = {
    gold: "🥇",
    platinum: "💎",
    draconic: "🐉",
    freedom: "🦅"
  };

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      character =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;"
        })[character]
    );
  }

  function formatNumber(value) {
    const number =
      Number(value);

    return Number.isFinite(number)
      ? number.toLocaleString()
      : "—";
  }

  function closeLegacyPredictor() {
    const legacyOverlay =
      document.getElementById(
        "ccPredictorOverlay"
      );

    if (legacyOverlay) {
      legacyOverlay.classList.remove(
        "cc-open"
      );
    }
  }

  function addStyles() {
    if (
      document.getElementById(
        STYLE_ID
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id = STYLE_ID;

    style.textContent = `
      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        z-index: 1000000;

        display: none;
        overflow-x: hidden;
        overflow-y: auto;
        width: 100%;
        max-width: 100vw;
        overscroll-behavior: contain;

        padding:
          max(14px, env(safe-area-inset-top))
          12px
          max(32px, env(safe-area-inset-bottom));

        background:
          radial-gradient(
            circle at 80% -10%,
            rgba(185, 149, 66, 0.14),
            transparent 38%
          ),
          radial-gradient(
            circle at 10% 45%,
            rgba(91, 69, 28, 0.08),
            transparent 34%
          ),
          #030303;

        color: #c4c4c4;

        font-family:
          Inter,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;

        -webkit-overflow-scrolling: touch;
      }

      #${OVERLAY_ID}.lp-open {
        display: block;
      }

      #${OVERLAY_ID} *,
      #${OVERLAY_ID} *::before,
      #${OVERLAY_ID} *::after {
        box-sizing: border-box;
      }

      .lp-shell {
        width: min(100%, 760px);
        max-width: 100%;
        margin: 0 auto;
        overflow-x: clip;
      }

      .lp-topbar {
        position: sticky;
        top: 0;
        z-index: 20;

        display: flex;
        align-items: center;
        justify-content: space-between;

        gap: 14px;
        padding: 10px 0 15px;

        border-bottom:
          1px solid rgba(185, 149, 66, 0.20);

        background:
          rgba(3, 3, 3, 0.96);

        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
      }

      .lp-topbar-main {
        min-width: 0;
      }

      .lp-eyebrow {
        margin: 0 0 5px;

        color: #b99542;

        font-size: 11px;
        font-weight: 900;
        letter-spacing: 0.22em;
        text-transform: uppercase;
      }

      .lp-topbar h1 {
        margin: 0;

        color: #e0e0e0;

        font-size: clamp(
          22px,
          6vw,
          28px
        );

        line-height: 1.08;
      }

      .lp-subtitle {
        margin: 6px 0 0;

        color: #858585;

        font-size: 13px;
        line-height: 1.4;
      }

      .lp-close {
        flex: 0 0 auto;

        display: grid;
        place-items: center;

        width: 45px;
        height: 45px;
        padding: 0;

        border:
          1px solid #383838;
        border-radius: 50%;

        background:
          linear-gradient(
            180deg,
            #191919,
            #080808
          );

        color: #d0d0d0;

        font: inherit;
        font-size: 28px;
        line-height: 1;

        cursor: pointer;
        touch-action: manipulation;

        box-shadow:
          0 10px 26px
          rgba(0, 0, 0, 0.34);
      }

      .lp-close:active {
        transform: scale(0.96);
      }

      .lp-card {
        max-width: 100%;
        overflow: hidden;
        position: relative;

        margin-top: 15px;
        padding: 18px;

        border:
          1px solid #292929;
        border-radius: 22px;

        background:
          linear-gradient(
            145deg,
            rgba(19, 19, 19, 0.99),
            rgba(5, 5, 5, 0.99)
          );

        box-shadow:
          0 20px 48px
          rgba(0, 0, 0, 0.52);

        overflow: hidden;
      }

      .lp-card::before {
        content: "";

        position: absolute;
        inset: 0 auto auto 0;

        width: 100%;
        height: 1px;

        background:
          linear-gradient(
            90deg,
            transparent,
            rgba(217, 191, 118, 0.24),
            transparent
          );

        pointer-events: none;
      }

      .lp-card-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;

        gap: 12px;
        margin-bottom: 13px;
      }

      .lp-card-heading {
        min-width: 0;
      }

      .lp-card h2 {
        margin: 0;

        color: #d4d4d4;

        font-size: 20px;
        line-height: 1.2;
      }

      .lp-card h3 {
        margin: 0;

        color: #d0d0d0;

        font-size: 16px;
        line-height: 1.3;
      }

      .lp-muted {
        margin: 7px 0 0;

        color: #858585;

        font-size: 13px;
        line-height: 1.5;
      }

      .lp-divider {
        height: 1px;
        margin: 16px 0;

        border: 0;

        background:
          linear-gradient(
            90deg,
            transparent,
            #292929,
            transparent
          );
      }

      .lp-event-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;

        gap: 12px;
      }

      .lp-event-copy {
        min-width: 0;
      }

      .lp-status {
        flex: 0 0 auto;

        display: inline-flex;
        align-items: center;
        justify-content: center;

        min-height: 34px;
        padding: 8px 11px;

        border-radius: 999px;

        font-size: 12px;
        font-weight: 900;
        white-space: nowrap;
      }

      .lp-status-ready {
        border:
          1px solid
          rgba(101, 226, 180, 0.38);

        background:
          rgba(101, 226, 180, 0.08);

        color: #65e2b4;
      }

      .lp-status-not-ready {
        border:
          1px solid
          rgba(216, 137, 137, 0.42);

        background:
          rgba(216, 137, 137, 0.08);

        color: #d88989;
      }

      .lp-status-searching {
        border:
          1px solid
          rgba(217, 191, 118, 0.42);

        background:
          rgba(217, 191, 118, 0.08);

        color: #d9bf76;
      }

      .lp-event-name {
        margin: 4px 0;

        color: #e0e0e0;

        font-size: clamp(
          22px,
          6vw,
          27px
        );

        font-weight: 900;
        line-height: 1.15;

        overflow-wrap: anywhere;
      }

      .lp-source {
        margin-top: 9px;

        color: #777777;

        font-size: 12px;
        line-height: 1.4;

        overflow-wrap: anywhere;
      }

      .lp-message {
        margin-top: 14px;
        padding: 13px;

        border:
          1px solid
          rgba(185, 149, 66, 0.22);
        border-radius: 14px;

        background:
          rgba(185, 149, 66, 0.06);

        color: #aaaaaa;

        font-size: 13px;
        line-height: 1.5;
      }

      .lp-message-success {
        border-color:
          rgba(101, 226, 180, 0.28);

        background:
          rgba(101, 226, 180, 0.06);

        color: #9adfc6;
      }

      .lp-message-error {
        border-color:
          rgba(216, 137, 137, 0.34);

        background:
          rgba(216, 137, 137, 0.06);

        color: #dba3a3;
      }

      .lp-empty-state {
        padding: 22px 15px;

        border:
          1px dashed #323232;
        border-radius: 16px;

        background:
          rgba(255, 255, 255, 0.015);

        color: #7f7f7f;

        text-align: center;
        font-size: 13px;
        line-height: 1.5;
      }

      .lp-primary-button,
      .lp-secondary-button,
      .lp-danger-button {
        appearance: none;

        display: inline-flex;
        align-items: center;
        justify-content: center;

        min-height: 46px;
        padding: 12px 15px;

        border-radius: 15px;

        font: inherit;
        font-size: 14px;
        font-weight: 900;

        cursor: pointer;
        touch-action: manipulation;
      }

      .lp-primary-button {
        border:
          1px solid
          rgba(185, 149, 66, 0.45);

        background:
          linear-gradient(
            180deg,
            #d9bf76,
            #b99542
          );

        color: #070707;
      }

      .lp-secondary-button {
        border:
          1px solid #383838;

        background:
          linear-gradient(
            180deg,
            #1b1b1b,
            #0a0a0a
          );

        color: #c8c8c8;
      }

      .lp-danger-button {
        border:
          1px solid
          rgba(216, 137, 137, 0.34);

        background:
          rgba(216, 137, 137, 0.07);

        color: #d99898;
      }

      .lp-primary-button:disabled,
      .lp-secondary-button:disabled,
      .lp-danger-button:disabled {
        opacity: 0.42;
        cursor: not-allowed;
      }

      .lp-primary-button:active:not(:disabled),
      .lp-secondary-button:active:not(:disabled),
      .lp-danger-button:active:not(:disabled) {
        transform: scale(0.985);
      }
      
            .lp-chest-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));

        gap: 10px;
        margin-top: 13px;
      }

      .lp-chest {
        appearance: none;

        position: relative;

        display: block;
        width: 100%;

        padding: 15px;

        border:
          1px solid #303030;
        border-radius: 17px;

        background:
          linear-gradient(
            145deg,
            #151515,
            #070707
          );

        color: #bdbdbd;

        text-align: left;
        font: inherit;

        cursor: pointer;
        touch-action: manipulation;

        overflow: hidden;
      }

      .lp-chest::before {
        content: "";

        position: absolute;
        inset: 0 auto 0 0;

        width: 3px;

        background: transparent;
      }

      .lp-chest:hover {
        border-color: #414141;
      }

      .lp-chest:active {
        transform: scale(0.99);
      }

      .lp-chest.lp-active {
        border-color:
          rgba(217, 191, 118, 0.58);

        background:
          linear-gradient(
            145deg,
            rgba(185, 149, 66, 0.25),
            rgba(63, 46, 14, 0.19)
          );

        box-shadow:
          0 0 0 2px
          rgba(185, 149, 66, 0.08);
      }

      .lp-chest.lp-active::before {
        background:
          linear-gradient(
            180deg,
            #e1c981,
            #9e772b
          );
      }

      .lp-chest.lp-disabled {
        opacity: 0.48;
      }

      .lp-chest-top {
        display: flex;
        align-items: center;
        justify-content: space-between;

        gap: 8px;
      }

      .lp-chest-name {
        min-width: 0;

        color: #d1d1d1;

        font-size: 16px;
        font-weight: 900;
        line-height: 1.3;
      }

      .lp-chest-loaded,
      .lp-chest-missing {
        flex: 0 0 auto;

        font-size: 11px;
        font-weight: 900;
        white-space: nowrap;
      }

      .lp-chest-loaded {
        color: #65e2b4;
      }

      .lp-chest-missing {
        color: #d88989;
      }

      .lp-chest-stats {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));

        gap: 8px;
        margin-top: 13px;
      }

      .lp-mini-stat {
        min-width: 0;
        padding: 10px;

        border:
          1px solid #282828;
        border-radius: 12px;

        background:
          rgba(9, 9, 9, 0.92);
      }

      .lp-mini-stat span,
      .lp-mini-stat strong {
        display: block;
      }

      .lp-mini-stat span {
        color: #777777;

        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .lp-mini-stat strong {
        margin-top: 4px;

        color: #c8c8c8;

        font-size: 15px;
        line-height: 1.25;

        overflow-wrap: anywhere;
      }

      .lp-selected-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));

        gap: 9px;
        margin-top: 12px;
      }

      .lp-selected-stat {
        min-width: 0;
        padding: 13px;

        border:
          1px solid #292929;
        border-radius: 14px;

        background:
          linear-gradient(
            145deg,
            #111111,
            #060606
          );
      }

      .lp-selected-stat span,
      .lp-selected-stat strong {
        display: block;
      }

      .lp-selected-stat span {
        color: #7c7c7c;

        font-size: 11px;
        line-height: 1.3;
      }

      .lp-selected-stat strong {
        margin-top: 5px;

        color: #d9bf76;

        font-size: 18px;
        line-height: 1.2;

        overflow-wrap: anywhere;
      }

      .lp-selected-stat.lp-wide {
        grid-column: 1 / -1;
      }

      .lp-selected-summary {
        margin-top: 14px;
        padding: 14px;

        border:
          1px solid
          rgba(217, 191, 118, 0.20);
        border-radius: 15px;

        background:
          linear-gradient(
            145deg,
            rgba(185, 149, 66, 0.10),
            rgba(185, 149, 66, 0.025)
          );
      }

      .lp-selected-summary-label {
        color: #8e8e8e;

        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .lp-selected-summary-value {
        margin-top: 5px;

        color: #e0ca8d;

        font-size: 21px;
        font-weight: 900;
        line-height: 1.2;

        overflow-wrap: anywhere;
      }

      .lp-selected-summary-note {
        margin-top: 6px;

        color: #858585;

        font-size: 12px;
        line-height: 1.45;
      }

      .lp-refresh {
        appearance: none;

        width: 100%;

        margin-top: 14px;
        padding: 14px;

        border:
          1px solid
          rgba(185, 149, 66, 0.42);
        border-radius: 15px;

        background:
          linear-gradient(
            180deg,
            #d9bf76,
            #b99542
          );

        color: #070707;

        font: inherit;
        font-weight: 900;

        cursor: pointer;
        touch-action: manipulation;
      }

      .lp-refresh:active {
        transform: scale(0.99);
      }

      .lp-chip-row {
        display: flex;
        flex-wrap: wrap;

        gap: 7px;
        margin-top: 12px;
      }

      .lp-chip {
        display: inline-flex;
        align-items: center;

        min-height: 30px;
        padding: 6px 10px;

        border:
          1px solid #303030;
        border-radius: 999px;

        background: #0b0b0b;

        color: #999999;

        font-size: 11px;
        font-weight: 800;
      }

      .lp-chip-ready {
        border-color:
          rgba(101, 226, 180, 0.28);

        background:
          rgba(101, 226, 180, 0.05);

        color: #7edcba;
      }

      .lp-chip-warning {
        border-color:
          rgba(217, 191, 118, 0.30);

        background:
          rgba(217, 191, 118, 0.05);

        color: #d2b96e;
      }
      
            .lp-recorder {
        margin-top: 14px;
      }

      .lp-recorder-grid {
        display: grid;
        grid-template-columns:
          minmax(0, 1fr)
          minmax(120px, 0.42fr);

        gap: 10px;
        margin-top: 12px;
      }

      .lp-field {
        min-width: 0;
      }

      .lp-field label {
        display: block;

        margin-bottom: 7px;

        color: #8a8a8a;

        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .lp-input,
      .lp-select {
        appearance: none;

        width: 100%;
        min-height: 48px;
        padding: 12px 13px;

        border:
          1px solid #343434;
        border-radius: 14px;

        background:
          linear-gradient(
            180deg,
            #111111,
            #080808
          );

        color: #d1d1d1;

        font: inherit;
        font-size: 16px;

        outline: none;
      }

      .lp-select {
        padding-right: 38px;

        background-image:
          linear-gradient(
            45deg,
            transparent 50%,
            #8b8b8b 50%
          ),
          linear-gradient(
            135deg,
            #8b8b8b 50%,
            transparent 50%
          ),
          linear-gradient(
            180deg,
            #111111,
            #080808
          );

        background-position:
          calc(100% - 17px)
          calc(50% - 3px),
          calc(100% - 12px)
          calc(50% - 3px),
          0 0;

        background-size:
          5px 5px,
          5px 5px,
          100% 100%;

        background-repeat:
          no-repeat;
      }

      .lp-input:focus,
      .lp-select:focus {
        border-color:
          rgba(217, 191, 118, 0.62);

        box-shadow:
          0 0 0 3px
          rgba(185, 149, 66, 0.10);
      }

      .lp-input::placeholder {
        color: #616161;
      }

      .lp-input:disabled,
      .lp-select:disabled {
        opacity: 0.46;
        cursor: not-allowed;
      }

      .lp-reward-search-wrap {
        position: relative;
      }

      .lp-reward-search-icon {
        position: absolute;
        top: 50%;
        left: 13px;

        transform: translateY(-50%);

        color: #6f6f6f;

        pointer-events: none;
      }

      .lp-reward-search-wrap
      .lp-input {
        padding-left: 38px;
      }

      .lp-reward-options {
        display: grid;
        gap: 8px;

        max-height: 270px;
        margin-top: 10px;
        padding-right: 2px;

        overflow-y: auto;
        overscroll-behavior: contain;
      }

      .lp-reward-option {
        appearance: none;

        display: flex;
        align-items: center;
        justify-content: space-between;

        gap: 12px;
        width: 100%;
        max-width: 100%;
        min-height: 50px;
        padding: 11px 12px;

        border:
          1px solid #2f2f2f;
        border-radius: 14px;

        background:
          linear-gradient(
            145deg,
            #121212,
            #080808
          );

        color: #c4c4c4;

        text-align: left;
        font: inherit;

        cursor: pointer;
        touch-action: manipulation;
      }

      .lp-reward-option:hover {
        border-color: #424242;
      }

      .lp-reward-option:active {
        transform: scale(0.99);
      }

      .lp-reward-option.lp-active {
        border-color:
          rgba(217, 191, 118, 0.54);

        background:
          linear-gradient(
            145deg,
            rgba(185, 149, 66, 0.22),
            rgba(69, 49, 13, 0.16)
          );

        box-shadow:
          0 0 0 2px
          rgba(185, 149, 66, 0.07);
      }

      .lp-reward-option-main {
        display: block;
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
      }

      .lp-reward-option-name {
        display: block;
        color: #d3d3d3;

        font-size: 14px;
        font-weight: 900;
        line-height: 1.3;

        overflow-wrap: anywhere;
      }

      .lp-reward-option-amount {
        flex: 0 0 auto;

        color: #d9bf76;

        font-size: 13px;
        font-weight: 900;
        white-space: nowrap;
        text-align: right;
      }

      .lp-recorder-selection {
        margin-top: 12px;
        padding: 13px;

        border:
          1px solid
          rgba(217, 191, 118, 0.22);
        border-radius: 14px;

        background:
          rgba(185, 149, 66, 0.055);
      }

      .lp-recorder-selection-label {
        color: #777777;

        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .lp-recorder-selection-value {
        margin-top: 5px;

        color: #e0ca8d;

        font-size: 16px;
        font-weight: 900;
        line-height: 1.35;

        overflow-wrap: anywhere;
      }

      .lp-recorder-selection-meta {
        margin-top: 5px;

        color: #858585;

        font-size: 12px;
        line-height: 1.4;
      }

      .lp-bonus-toggle {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 48px;
        margin-top: 14px;
        padding: 12px 14px;
        border: 1px solid rgba(217, 191, 118, 0.28);
        border-radius: 14px;
        background: rgba(185, 149, 66, 0.08);
        color: #d9bf76;
        font-size: 14px;
        font-weight: 800;
        cursor: pointer;
      }

      .lp-bonus-toggle input {
        width: 22px;
        height: 22px;
        margin: 0;
        accent-color: #b99542;
      }

      .lp-recorder-actions {
        display: grid;
        grid-template-columns:
          minmax(0, 1fr)
          minmax(110px, 0.38fr);

        gap: 9px;
        margin-top: 12px;
      }

      .lp-record-button {
        appearance: none;

        min-height: 50px;
        padding: 13px 15px;

        border:
          1px solid
          rgba(185, 149, 66, 0.48);
        border-radius: 15px;

        background:
          linear-gradient(
            180deg,
            #dfc77f,
            #b99542
          );

        color: #060606;

        font: inherit;
        font-size: 15px;
        font-weight: 950;

        cursor: pointer;
        touch-action: manipulation;

        box-shadow:
          0 14px 28px
          rgba(185, 149, 66, 0.12);
      }

      .lp-record-button:disabled {
        opacity: 0.42;
        cursor: not-allowed;
        box-shadow: none;
      }

      .lp-record-button:active:not(:disabled) {
        transform: scale(0.985);
      }

      .lp-undo-button {
        appearance: none;

        min-height: 50px;
        padding: 13px;

        border:
          1px solid #373737;
        border-radius: 15px;

        background:
          linear-gradient(
            180deg,
            #1a1a1a,
            #0a0a0a
          );

        color: #c7c7c7;

        font: inherit;
        font-size: 14px;
        font-weight: 900;

        cursor: pointer;
        touch-action: manipulation;
      }

      .lp-undo-button:disabled {
        opacity: 0.42;
        cursor: not-allowed;
      }

      .lp-undo-button:active:not(:disabled) {
        transform: scale(0.985);
      }

      .lp-recorder-help {
        margin-top: 10px;

        color: #737373;

        font-size: 11px;
        line-height: 1.45;
      }

      .lp-recorder-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;

        min-width: 30px;
        height: 30px;
        padding: 0 9px;

        border:
          1px solid
          rgba(217, 191, 118, 0.26);
        border-radius: 999px;

        background:
          rgba(217, 191, 118, 0.06);

        color: #d9bf76;

        font-size: 12px;
        font-weight: 900;
      }
      
            .lp-history {
        margin-top: 14px;
      }

      .lp-history-list {
        display: grid;
        gap: 10px;

        margin-top: 12px;
      }

      .lp-history-item {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;

        gap: 12px;

        padding: 13px;

        border: 1px solid #2b2b2b;
        border-radius: 14px;

        background:
          linear-gradient(
            145deg,
            #111111,
            #070707
          );
      }

      .lp-history-left {
        min-width: 0;
        flex: 1;
      }

      .lp-history-title {
        color: #d6d6d6;

        font-size: 14px;
        font-weight: 900;
        line-height: 1.3;

        overflow-wrap: anywhere;
      }

      .lp-history-subtitle {
        margin-top: 4px;

        color: #7d7d7d;

        font-size: 12px;
        line-height: 1.45;
      }

      .lp-history-number {
        flex: 0 0 auto;

        display: flex;
        align-items: center;
        justify-content: center;

        width: 34px;
        height: 34px;

        border-radius: 999px;

        border:
          1px solid
          rgba(217,191,118,0.28);

        background:
          rgba(217,191,118,0.06);

        color: #d9bf76;

        font-size: 13px;
        font-weight: 900;
      }

      .lp-history-empty {
        padding: 22px;

        border:
          1px dashed #323232;
        border-radius: 15px;

        color: #7b7b7b;

        text-align: center;
        line-height: 1.6;
      }

      .lp-solver {
        margin-top: 14px;

        padding: 16px;

        border:
          1px solid
          rgba(217,191,118,0.20);

        border-radius: 16px;

        background:
          linear-gradient(
            145deg,
            rgba(185,149,66,0.08),
            rgba(185,149,66,0.02)
          );
      }

      .lp-solver-top {
        display: flex;
        align-items: center;
        justify-content: space-between;

        gap: 12px;
      }

      .lp-solver-title {
        color: #d6d6d6;

        font-size: 18px;
        font-weight: 900;
      }

      .lp-confidence {
        flex: 0 0 auto;

        padding: 7px 12px;

        border-radius: 999px;

        font-size: 12px;
        font-weight: 900;
      }

      .lp-confidence-low {
        border:
          1px solid
          rgba(216,137,137,0.35);

        background:
          rgba(216,137,137,0.08);

        color: #d88989;
      }

      .lp-confidence-medium {
        border:
          1px solid
          rgba(217,191,118,0.35);

        background:
          rgba(217,191,118,0.08);

        color: #d9bf76;
      }

      .lp-confidence-high {
        border:
          1px solid
          rgba(101,226,180,0.35);

        background:
          rgba(101,226,180,0.08);

        color: #65e2b4;
      }

      .lp-solver-grid {
        display: grid;
        grid-template-columns:
          repeat(2,minmax(0,1fr));

        gap: 10px;

        margin-top: 15px;
      }

      .lp-solver-stat {
        padding: 13px;

        border:
          1px solid #2c2c2c;

        border-radius: 14px;

        background:
          rgba(0,0,0,0.18);
      }

      .lp-solver-stat span {
        display: block;

        color: #7d7d7d;

        font-size: 11px;

        text-transform: uppercase;
      }

      .lp-solver-stat strong {
        display: block;

        margin-top: 6px;

        color: #d9bf76;

        font-size: 20px;

        font-weight: 900;
      }

      .lp-solver-note {
        margin-top: 14px;

        color: #8a8a8a;

        font-size: 13px;

        line-height: 1.55;
      }
      
            .lp-predictions {
        margin-top: 14px;
      }

      .lp-prediction-list {
        display: grid;
        gap: 10px;

        margin-top: 12px;
      }

      .lp-prediction-card {
        position: relative;

        display: grid;
        grid-template-columns:
          48px
          minmax(0, 1fr)
          auto;

        align-items: center;

        gap: 12px;
        padding: 13px;

        border:
          1px solid #2d2d2d;
        border-radius: 15px;

        background:
          linear-gradient(
            145deg,
            #121212,
            #070707
          );

        overflow: hidden;
      }

      .lp-prediction-card::before {
        content: "";

        position: absolute;
        inset: 0 auto 0 0;

        width: 3px;

        background:
          linear-gradient(
            180deg,
            #e0c77d,
            #9f772c
          );
      }

      .lp-prediction-card.lp-next {
        border-color:
          rgba(217, 191, 118, 0.48);

        background:
          linear-gradient(
            145deg,
            rgba(185, 149, 66, 0.18),
            rgba(55, 40, 12, 0.12)
          );

        box-shadow:
          0 0 0 2px
          rgba(185, 149, 66, 0.06);
      }

      .lp-prediction-card.lp-bonus {
        border-color:
          rgba(101, 226, 180, 0.55);

        background:
          linear-gradient(
            145deg,
            rgba(101, 226, 180, 0.16),
            rgba(18, 70, 54, 0.12)
          );
      }

      .lp-prediction-position {
        display: flex;
        align-items: center;
        justify-content: center;

        width: 48px;
        height: 48px;

        border:
          1px solid
          rgba(217, 191, 118, 0.26);
        border-radius: 14px;

        background:
          rgba(217, 191, 118, 0.06);

        color: #d9bf76;

        font-size: 17px;
        font-weight: 900;
      }

      .lp-prediction-copy {
        min-width: 0;
      }

      .lp-prediction-name {
        color: #d8d8d8;

        font-size: 14px;
        font-weight: 900;
        line-height: 1.35;

        overflow-wrap: anywhere;
      }

      .lp-prediction-meta {
        margin-top: 4px;

        color: #7d7d7d;

        font-size: 11px;
        line-height: 1.4;

        overflow-wrap: anywhere;
      }

      .lp-prediction-amount {
        flex: 0 0 auto;

        color: #e0ca8d;

        font-size: 14px;
        font-weight: 900;
        white-space: nowrap;
      }

      .lp-prediction-badge {
        display: inline-flex;
        align-items: center;

        margin-top: 6px;
        padding: 4px 8px;

        border:
          1px solid
          rgba(101, 226, 180, 0.28);
        border-radius: 999px;

        background:
          rgba(101, 226, 180, 0.05);

        color: #7fdcba;

        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .lp-prediction-summary {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));

        gap: 9px;
        margin-top: 12px;
      }

      .lp-prediction-summary-item {
        padding: 13px;

        border:
          1px solid #2c2c2c;
        border-radius: 14px;

        background:
          linear-gradient(
            145deg,
            #101010,
            #060606
          );
      }

      .lp-prediction-summary-item span,
      .lp-prediction-summary-item strong {
        display: block;
      }

      .lp-prediction-summary-item span {
        color: #797979;

        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .lp-prediction-summary-item strong {
        margin-top: 5px;

        color: #d9bf76;

        font-size: 18px;
        line-height: 1.25;

        overflow-wrap: anywhere;
      }

      .lp-prediction-empty {
        padding: 24px 15px;

        border:
          1px dashed #323232;
        border-radius: 16px;

        background:
          rgba(255, 255, 255, 0.015);

        color: #7f7f7f;

        text-align: center;
        font-size: 13px;
        line-height: 1.55;
      }

      .lp-prediction-warning {
        margin-top: 12px;
        padding: 12px;

        border:
          1px solid
          rgba(217, 191, 118, 0.24);
        border-radius: 13px;

        background:
          rgba(217, 191, 118, 0.05);

        color: #a89a72;

        font-size: 12px;
        line-height: 1.5;
      }
      
            @media (max-width: 620px) {
        #${OVERLAY_ID} {
          padding-left: 10px;
          padding-right: 10px;
        }

        .lp-topbar {
          align-items: flex-start;
        }

        .lp-card {
          padding: 15px;
          border-radius: 19px;
        }

        .lp-event-header {
          flex-direction: column;
        }

        .lp-status {
          align-self: flex-start;
        }

        .lp-chest-grid {
          grid-template-columns: 1fr;
        }

        .lp-recorder-grid {
          grid-template-columns: 1fr;
        }

        .lp-recorder-actions {
          grid-template-columns: 1fr;
        }

        .lp-solver-grid {
          grid-template-columns: 1fr;
        }

        .lp-prediction-card {
          grid-template-columns:
            42px
            minmax(0, 1fr);
        }

        .lp-prediction-position {
          width: 42px;
          height: 42px;

          border-radius: 12px;
        }

        .lp-prediction-amount {
          grid-column: 2;
          justify-self: start;

          margin-top: -5px;
        }
      }

      @media (max-width: 420px) {
        .lp-topbar h1 {
          font-size: 22px;
        }

        .lp-close {
          width: 42px;
          height: 42px;
        }

        .lp-selected-grid,
        .lp-prediction-summary {
          grid-template-columns: 1fr;
        }

        .lp-selected-stat.lp-wide {
          grid-column: auto;
        }

        .lp-chest-stats {
          grid-template-columns: 1fr 1fr;
        }

        .lp-history-item {
          padding: 12px;
        }

        .lp-solver {
          padding: 14px;
        }
      }

      @media (hover: none) {
        .lp-chest:hover,
        .lp-reward-option:hover {
          border-color: #303030;
        }

        .lp-chest.lp-active:hover {
          border-color:
            rgba(217, 191, 118, 0.58);
        }

        .lp-reward-option.lp-active:hover {
          border-color:
            rgba(217, 191, 118, 0.54);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        #${OVERLAY_ID} *,
        #${OVERLAY_ID} *::before,
        #${OVERLAY_ID} *::after {
          scroll-behavior: auto !important;
          transition: none !important;
          animation: none !important;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

    function createOverlay() {
    if (
      document.getElementById(
        OVERLAY_ID
      )
    ) {
      return;
    }

    const overlay =
      document.createElement("div");

    overlay.id = OVERLAY_ID;

    overlay.innerHTML = `
      <div class="lp-shell">
        <header class="lp-topbar">
          <div class="lp-topbar-main">
            <p class="lp-eyebrow">
              CHEST COMPANION
            </p>

            <h1>
              Live Chest Predictor
            </h1>

            <p
              id="lpSubtitle"
              class="lp-subtitle"
            >
              Waiting for event data
            </p>
          </div>

          <button
            id="lpClose"
            class="lp-close"
            type="button"
            aria-label="Close live predictor"
          >
            ×
          </button>
        </header>

        <section class="lp-card">
          <div class="lp-event-header">
            <div class="lp-event-copy">
              <p class="lp-eyebrow">
                LIVE EVENT
              </p>

              <div
                id="lpEventName"
                class="lp-event-name"
              >
                No Event
              </div>

              <div
                id="lpEventDetails"
                class="lp-muted"
              >
                No live event data is currently available.
              </div>
            </div>

            <div
              id="lpStatus"
              class="lp-status lp-status-not-ready"
            >
              Not ready
            </div>
          </div>

        </section>

        <section class="lp-card">
          <div class="lp-card-header">
            <div class="lp-card-heading">
              <h2>
                Choose chest
              </h2>

              <p class="lp-muted">
                Select the live deck you want to track.
              </p>
            </div>
          </div>

          <div
            id="lpChestGrid"
            class="lp-chest-grid"
          ></div>
        </section>

        <section class="lp-card">
          <div class="lp-card-header">
            <div class="lp-card-heading">
              <h2 id="lpSelectedHeading">
                Selected chest
              </h2>

              <p class="lp-muted">
                Live deck information for the selected chest.
              </p>
            </div>
          </div>

          <div
            id="lpSelectedGrid"
            class="lp-selected-grid"
          ></div>

          <div
            id="lpSelectedMessage"
            class="lp-message"
          ></div>

          <button
            id="lpRefresh"
            class="lp-refresh"
            type="button"
          >
            Refresh live data
          </button>
        </section>

        <section
          id="lpRecorderCard"
          class="lp-card"
        >
          <div class="lp-card-header">
            <div class="lp-card-heading">
              <h2>
                Record chest
              </h2>

              <p class="lp-muted">
                Record each reward exactly as it appears
                when you open a chest.
              </p>
            </div>

            <span
              id="lpRecorderCount"
              class="lp-recorder-count"
            >
              0
            </span>
          </div>

          <div class="lp-recorder">
            <div class="lp-field">
              <label for="lpRewardSearch">
                Find reward
              </label>

              <div class="lp-reward-search-wrap">
                <span
                  class="lp-reward-search-icon"
                  aria-hidden="true"
                >
                  ⌕
                </span>

                <input
                  id="lpRewardSearch"
                  class="lp-input"
                  type="search"
                  placeholder="Search reward name"
                  autocomplete="off"
                />
              </div>
            </div>

            <div
              id="lpRewardOptions"
              class="lp-reward-options"
            >
              <div class="lp-empty-state">
                Select a chest with live deck data
                to view available rewards.
              </div>
            </div>

            <div
              id="lpRecorderSelection"
              class="lp-recorder-selection"
            >
              <div class="lp-recorder-selection-label">
                Selected reward
              </div>

              <div
                id="lpRecorderSelectionValue"
                class="lp-recorder-selection-value"
              >
                No reward selected
              </div>

              <div
                id="lpRecorderSelectionMeta"
                class="lp-recorder-selection-meta"
              >
                Choose a reward from the list above.
              </div>
            </div>

            <div class="lp-recorder-grid">
              <div class="lp-field">
                <label for="lpRewardAmount">
                  Amount
                </label>

                <input
                  id="lpRewardAmount"
                  class="lp-input"
                  type="number"
                  inputmode="numeric"
                  min="0"
                  step="1"
                  placeholder="Reward amount"
                />
              </div>

              <div class="lp-field">
                <label for="lpRewardQuantity">
                  Chests opened
                </label>

                <select
                  id="lpRewardQuantity"
                  class="lp-select"
                >
                  <option value="1">
                    1 chest
                  </option>

                  <option value="2">
                    2 chests
                  </option>

                  <option value="3">
                    3 chests
                  </option>

                  <option value="4">
                    4 chests
                  </option>

                  <option value="5">
                    5 chests
                  </option>

                  <option value="10">
                    10 chests
                  </option>
                </select>
              </div>
            </div>

            <label class="lp-bonus-toggle" for="lpBonusChest">
              <input
                id="lpBonusChest"
                type="checkbox"
              />
              <span>
                This reward came from a bonus chest
              </span>
            </label>

            <div class="lp-recorder-actions">
              <button
                id="lpRecordChest"
                class="lp-record-button"
                type="button"
                disabled
              >
                Record chest
              </button>

              <button
                id="lpUndoChest"
                class="lp-undo-button"
                type="button"
                disabled
              >
                Undo
              </button>
            </div>

            <div
              id="lpRecorderMessage"
              class="lp-recorder-help"
            >
              Record several consecutive rewards
              so the solver can locate your position.
            </div>
          </div>
        </section>

        <section
          id="lpHistoryCard"
          class="lp-card"
        >
          <div class="lp-card-header">
            <div class="lp-card-heading">
              <h2>
                Recorded history
              </h2>

              <p class="lp-muted">
                Your recorded chest sequence for
                the selected deck.
              </p>
            </div>

            <button
              id="lpResetHistory"
              class="lp-danger-button"
              type="button"
              disabled
            >
              Reset
            </button>
          </div>

          <div
            id="lpHistoryList"
            class="lp-history-list"
          >
            <div class="lp-history-empty">
              No chest rewards recorded yet.
            </div>
          </div>
        </section>

        <section
          id="lpSolverCard"
          class="lp-card"
        >
          <div class="lp-card-header">
            <div class="lp-card-heading">
              <h2>
                Solver status
              </h2>

              <p class="lp-muted">
                Chest Companion compares your history
                against the live event deck.
              </p>
            </div>
          </div>

          <div class="lp-solver">
            <div class="lp-solver-top">
              <div
                id="lpSolverTitle"
                class="lp-solver-title"
              >
                Waiting for rewards
              </div>

              <div
                id="lpConfidence"
                class="lp-confidence lp-confidence-low"
              >
                Not solved
              </div>
            </div>

            <div class="lp-solver-grid">
              <div class="lp-solver-stat">
                <span>
                  Player position
                </span>

                <strong id="lpSolvedPosition">
                  —
                </strong>
              </div>

              <div class="lp-solver-stat">
                <span>
                  Matching positions
                </span>

                <strong id="lpMatchCount">
                  —
                </strong>
              </div>

              <div class="lp-solver-stat">
                <span>
                  Recorded rewards
                </span>

                <strong id="lpObservationCount">
                  0
                </strong>
              </div>

              <div class="lp-solver-stat">
                <span>
                  Confidence
                </span>

                <strong id="lpConfidenceValue">
                  —
                </strong>
              </div>
            </div>

            <div
              id="lpSolverNote"
              class="lp-solver-note"
            >
              Record consecutive chest rewards
              to begin solving your deck position.
            </div>
          </div>
        </section>

        <section
          id="lpPredictionsCard"
          class="lp-card"
        >
          <div class="lp-card-header">
            <div class="lp-card-heading">
              <h2>
                Upcoming predictions
              </h2>

              <p class="lp-muted">
                Predicted rewards after your current
                solved position.
              </p>
            </div>
          </div>

          <div
            id="lpPredictionSummary"
            class="lp-prediction-summary"
          >
            <div class="lp-prediction-summary-item">
              <span>
                Current position
              </span>

              <strong id="lpPredictionPosition">
                —
              </strong>
            </div>

            <div class="lp-prediction-summary-item">
              <span>
                Predictions ready
              </span>

              <strong id="lpPredictionCount">
                0
              </strong>
            </div>
          </div>

          <div
            id="lpPredictionList"
            class="lp-prediction-list"
          >
            <div class="lp-prediction-empty">
              Upcoming rewards will appear here
              after your position has been solved.
            </div>
          </div>

          <div
            id="lpPredictionWarning"
            class="lp-prediction-warning"
          >
            Predictions depend on the imported event
            data and the accuracy of recorded rewards.
          </div>
        </section>
      </div>
    `;

    document.body.appendChild(
      overlay
    );
  }

  function renderChestCards(status) {
    const container =
      document.getElementById(
        "lpChestGrid"
      );

    container.innerHTML =
      status.chests
        .map(chest => {
          const icon =
            CHEST_ICONS[
              chest.chestType
            ] || "✦";

          return `
            <button
              type="button"
              class="lp-chest ${
                status.activeChest ===
                chest.chestType
                  ? "lp-active"
                  : ""
              }"
              data-lp-chest="${
                chest.chestType
              }"
            >
              <div class="lp-chest-top">
                <span class="lp-chest-name">
                  ${icon}
                  ${escapeHTML(
                    chest.label
                  )}
                </span>

                <span class="${
                  chest.loaded
                    ? "lp-chest-loaded"
                    : "lp-chest-missing"
                }">
                  ${
                    chest.loaded
                      ? "Ready"
                      : "Missing"
                  }
                </span>
              </div>

              <div class="lp-chest-stats">
                <div class="lp-mini-stat">
                  <span>Deck length</span>

                  <strong>
                    ${formatNumber(
                      chest.length
                    )}
                  </strong>
                </div>
              </div>
            </button>
          `;
        })
        .join("");
  }

    function getSelectedChest(status) {
    if (
      !status ||
      !Array.isArray(status.chests)
    ) {
      return null;
    }

    return (
      status.chests.find(
        chest =>
          chest.chestType ===
          status.activeChest
      ) || null
    );
  }

  function getPlayerPosition(chest) {
  if (!chest) {
    return null;
  }

  const possiblePosition =
    chest.playerPosition ??
    chest.solvedPosition ??
    chest.currentPosition ??
    chest.position ??
    null;

  if (
    possiblePosition === null ||
    possiblePosition === undefined ||
    possiblePosition === ""
  ) {
    return null;
  }

  const number =
    Number(possiblePosition);

  return Number.isFinite(number)
    ? number
    : null;
}

  function getRecordedHistory(chest) {
    if (!chest) {
      return [];
    }

    const history =
      chest.observations ||
      chest.recordedRewards ||
      chest.history ||
      chest.records ||
      [];

    return Array.isArray(history)
      ? history
      : [];
  }

  function getPredictions(chest) {
    if (!chest) {
      return [];
    }

    const predictions =
      chest.predictions ||
      chest.upcomingRewards ||
      chest.nextRewards ||
      [];

    return Array.isArray(predictions)
      ? predictions
      : [];
  }

  function getMatchCount(chest) {
  if (!chest) {
    return null;
  }

  const possibleCount =
    chest.matchCount ??
    chest.matchingPositions ??
    chest.matches?.length ??
    null;

  if (
    possibleCount === null ||
    possibleCount === undefined ||
    possibleCount === ""
  ) {
    return null;
  }

  const number =
    Number(possibleCount);

  return Number.isFinite(number)
    ? number
    : null;
}

  function getConfidence(chest) {
    if (!chest) {
      return null;
    }

    const confidence =
      chest.confidence ??
      chest.solverConfidence ??
      null;

    if (
      confidence === null ||
      confidence === undefined ||
      confidence === ""
    ) {
      return null;
    }

    if (
      typeof confidence === "number"
    ) {
      return confidence <= 1
        ? Math.round(
            confidence * 100
          )
        : Math.round(confidence);
    }

    const number =
      Number(
        String(confidence).replace(
          "%",
          ""
        )
      );

    return Number.isFinite(number)
      ? Math.round(number)
      : null;
  }

  function renderSelectedChest(status) {
    const selected =
      getSelectedChest(status);

    const heading =
      document.getElementById(
        "lpSelectedHeading"
      );

    const grid =
      document.getElementById(
        "lpSelectedGrid"
      );

    const message =
      document.getElementById(
        "lpSelectedMessage"
      );

    if (
      !heading ||
      !grid ||
      !message
    ) {
      return;
    }

    if (!selected) {
      heading.textContent =
        "Selected chest";

      grid.innerHTML = `
        <div class="lp-empty-state">
          No chest data is available.
        </div>
      `;

      message.className =
        "lp-message lp-message-error";

      message.textContent =
        "Import an about_v2 event file to begin.";

      return;
    }

    const icon =
      CHEST_ICONS[
        selected.chestType
      ] || "✦";

    const playerPosition =
      getPlayerPosition(selected);

    const history =
      getRecordedHistory(selected);

    const predictions =
      getPredictions(selected);

    const matchCount =
      getMatchCount(selected);

    const confidence =
      getConfidence(selected);

    heading.textContent =
      `${icon} ${selected.label} Chest`;

    grid.innerHTML = `
      <div class="lp-selected-stat">
        <span>
          Deck loaded
        </span>

        <strong>
          ${
            selected.loaded
              ? "Yes"
              : "No"
          }
        </strong>
      </div>

      <div class="lp-selected-stat">
        <span>
          Deck length
        </span>

        <strong>
          ${formatNumber(
            selected.length
          )}
        </strong>
      </div>

      <div class="lp-selected-stat">
        <span>
          Recorded rewards
        </span>

        <strong>
          ${formatNumber(
            history.length
          )}
        </strong>
      </div>

      <div class="lp-selected-stat">
        <span>
          Player position
        </span>

        <strong>
          ${
            playerPosition === null
              ? "Not solved"
              : formatNumber(
                  playerPosition
                )
          }
        </strong>
      </div>

      <div class="lp-selected-stat">
        <span>
          Matching positions
        </span>

        <strong>
          ${
            matchCount === null
              ? "—"
              : formatNumber(
                  matchCount
                )
          }
        </strong>
      </div>

      <div class="lp-selected-stat">
        <span>
          Confidence
        </span>

        <strong>
          ${
            confidence === null
              ? "—"
              : `${confidence}%`
          }
        </strong>
      </div>

      <div
        class="
          lp-selected-stat
          lp-wide
        "
      >
        <span>
          Upcoming predictions
        </span>

        <strong>
          ${formatNumber(
            predictions.length
          )}
        </strong>
      </div>
    `;

    if (!selected.loaded) {
      message.className =
        "lp-message lp-message-error";

      message.textContent =
        `${selected.label} deck data was not found ` +
        "in the imported event file.";

      return;
    }

    if (playerPosition !== null) {
      message.className =
        "lp-message lp-message-success";

      message.textContent =
        `${selected.label} position solved at ` +
        `${formatNumber(playerPosition)}. ` +
        `${predictions.length} upcoming reward(s) ` +
        "are ready.";

      return;
    }

    if (history.length > 0) {
      message.className =
        "lp-message";

      message.textContent =
        `${history.length} reward(s) recorded. ` +
        "Continue recording consecutive chest drops " +
        "until only one matching position remains.";

      return;
    }

    message.className =
      "lp-message lp-message-success";

    message.textContent =
      `${selected.label} live deck data is connected. ` +
      "Record your first chest reward below to begin solving.";
  }
  
    let selectedRewardState = {
    chestType: null,
    key: null
  };

  function getRawRewardList(chest) {
    if (!chest) {
      return [];
    }

    /*
     * Always ask the engine for its resolved catalogue first.
     * A chest status also contains the raw deck, which can be a list of
     * numeric drop indexes. Treating that raw list as rewards makes the
     * search box look populated internally while names such as "Egg",
     * "Breeding" and "Sigil" can never match.
     */
    if (
      typeof Engine.getRewards ===
      "function"
    ) {
      try {
        const resolvedRewards =
          Engine.getRewards(
            chest.chestType
          );

        if (
          Array.isArray(
            resolvedRewards
          ) &&
          resolvedRewards.length
        ) {
          return resolvedRewards;
        }
      } catch (error) {
        console.warn(
          "[Chest Companion] Could not read the resolved reward catalogue.",
          error
        );
      }
    }

    const directCandidates = [
      chest.rewards,
      chest.entries,
      chest.items,
      chest.sequence,
      chest.data,
      chest.deck
    ];

    for (
      const candidate of
      directCandidates
    ) {
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }

    const engineMethods = [
      "getDeck",
      "getChestDeck",
      "getChestData"
    ];

    for (
      const methodName of
      engineMethods
    ) {
      const method =
        Engine[methodName];

      if (
        typeof method !== "function"
      ) {
        continue;
      }

      try {
        const result =
          method.call(
            Engine,
            chest.chestType
          );

        if (Array.isArray(result)) {
          return result;
        }

        if (
          result &&
          typeof result === "object"
        ) {
          const nestedCandidates = [
            result.rewards,
            result.deck,
            result.entries,
            result.items,
            result.sequence,
            result.data
          ];

          const nestedList =
            nestedCandidates.find(
              Array.isArray
            );

          if (nestedList) {
            return nestedList;
          }
        }
      } catch (error) {
        console.warn(
          `[Chest Companion] Could not read ${methodName}.`,
          error
        );
      }
    }

    return [];
  }

  function normaliseReward(
    reward,
    index
  ) {
    if (
      reward === null ||
      reward === undefined
    ) {
      return null;
    }

    if (
      typeof reward === "string" ||
      typeof reward === "number"
    ) {
      const name =
        String(reward);

      return {
        key:
          `${index}:${name}`,
        name,
        code: "",
        amount: null,
        raw: reward
      };
    }

    if (
      typeof reward !== "object"
    ) {
      return null;
    }

    const name =
      reward.name ??
      reward.label ??
      reward.rewardName ??
      reward.reward_name ??
      reward.title ??
      reward.displayName ??
      reward.display_name ??
      reward.type ??
      reward.reward ??
      reward.item ??
      reward.code ??
      reward.id ??
      `Reward ${index + 1}`;

    const code =
      reward.code ??
      reward.rewardCode ??
      reward.reward_code ??
      reward.key ??
      reward.id ??
      reward.typeId ??
      reward.type_id ??
      "";

    const rawAmount =
      reward.amount ??
      reward.quantity ??
      reward.value ??
      reward.count ??
      reward.qty ??
      reward.rewardAmount ??
      reward.reward_amount ??
      null;

    const numericAmount =
      Number(rawAmount);

    const amount =
      rawAmount !== null &&
      rawAmount !== "" &&
      Number.isFinite(
        numericAmount
      )
        ? numericAmount
        : null;

    const key = [
      String(code),
      String(name),
      amount === null
        ? ""
        : String(amount)
    ].join("::");

    return {
      key:
        key === "::::"
          ? `reward-${index}`
          : key,
      name:
        String(name),
      code:
        String(code),
      amount,
      raw: reward
    };
  }

  function getRewardCatalogue(chest) {
    const rawRewards =
      getRawRewardList(chest);

    const seen =
      new Set();

    const catalogue = [];

    rawRewards.forEach(
      (reward, index) => {
        const normalised =
          normaliseReward(
            reward,
            index
          );

        if (
          !normalised ||
          seen.has(
            normalised.key
          )
        ) {
          return;
        }

        seen.add(
          normalised.key
        );

        catalogue.push(
          normalised
        );
      }
    );

    return catalogue.sort(
      (first, second) =>
        first.name.localeCompare(
          second.name,
          undefined,
          {
            numeric: true,
            sensitivity: "base"
          }
        )
    );
  }

  function getSelectedReward(
    chest,
    catalogue
  ) {
    if (
      !chest ||
      selectedRewardState.chestType !==
        chest.chestType
    ) {
      return null;
    }

    return (
      catalogue.find(
        reward =>
          reward.key ===
          selectedRewardState.key
      ) || null
    );
  }

  function renderRewardOptions(
    status
  ) {
    const selectedChest =
      getSelectedChest(status);

    const container =
      document.getElementById(
        "lpRewardOptions"
      );

    const searchInput =
      document.getElementById(
        "lpRewardSearch"
      );

    if (
      !container ||
      !searchInput
    ) {
      return [];
    }

    if (
      !selectedChest ||
      !selectedChest.loaded
    ) {
      searchInput.disabled = true;

      container.innerHTML = `
        <div class="lp-empty-state">
          Select a chest with live deck data
          to view available rewards.
        </div>
      `;

      return [];
    }

    searchInput.disabled = false;

    const catalogue =
      getRewardCatalogue(
        selectedChest
      );

    if (!catalogue.length) {
      container.innerHTML = `
        <div class="lp-empty-state">
          The live deck is connected, but no
          readable reward entries were found.
        </div>
      `;

      return [];
    }

    const searchTerm =
      searchInput.value
        .trim()
        .toLowerCase();

    const filteredRewards =
      catalogue.filter(
        reward => {
          if (!searchTerm) {
            return true;
          }

          const aliases = [];

          if (reward.code === "breedingToken") {
            aliases.push(
                  "egg",
                  "eggs",
                  "egg token",
                  "egg tokens",
                  "breeding token",
                  "breeding tokens"
            );
          }

          const speedupAliases = {
            expediteConsumable1: ["15 min", "15min"],
            expediteConsumable1a: ["30 min", "30min"],
            expediteConsumable2: ["1 hour", "1hr"],
            expediteConsumable3: ["3 hour", "3hr"],
            expediteConsumable4: ["12 hour", "12hr"]
          }[reward.code];

          if (speedupAliases) {
            aliases.push(
              ...speedupAliases,
              ...speedupAliases.map(
                value => `${value} speedup`
              ),
              ...speedupAliases.map(
                value => `${value} speedups`
              )
            );
          }

          const searchableText = [
            reward.name,
            reward.code,
            reward.amount,
            ...aliases
          ]
            .filter(
              value =>
                value !== null &&
                value !== undefined
            )
            .join(" ")
            .toLowerCase();

          return searchableText.includes(
            searchTerm
          );
        }
      );

    if (!filteredRewards.length) {
      container.innerHTML = `
        <div class="lp-empty-state">
          No rewards matched
          “${escapeHTML(
            searchInput.value.trim()
          )}”.
        </div>
      `;

      return catalogue;
    }

    const visibleRewards =
      filteredRewards.slice(
        0,
        80
      );

    container.innerHTML =
      visibleRewards
        .map(reward => {
          const isActive =
            selectedRewardState.chestType ===
              selectedChest.chestType &&
            selectedRewardState.key ===
              reward.key;

          const amountText =
            reward.amount === null
              ? ""
              : formatNumber(
                  reward.amount
                );

          return `
            <button
              type="button"
              class="lp-reward-option ${
                isActive
                  ? "lp-active"
                  : ""
              }"
              data-lp-reward-key="${escapeHTML(
                reward.key
              )}"
            >
              <span
                class="lp-reward-option-main"
              >
                <span
                  class="lp-reward-option-name"
                >
                  ${escapeHTML(
                    reward.name
                  )}
                </span>

              </span>

              ${
                amountText
                  ? `
                    <span
                      class="lp-reward-option-amount"
                    >
                      ${amountText}
                    </span>
                  `
                  : ""
              }
            </button>
          `;
        })
        .join("");

    if (
      filteredRewards.length >
      visibleRewards.length
    ) {
      container.insertAdjacentHTML(
        "beforeend",
        `
          <div class="lp-empty-state">
            Showing the first
            ${visibleRewards.length}
            of
            ${filteredRewards.length}
            matching rewards. Refine your search
            to narrow the list.
          </div>
        `
      );
    }

    return catalogue;
  }

  function renderRecorder(status) {
    const selectedChest =
      getSelectedChest(status);

    const catalogue =
      renderRewardOptions(
        status
      );

    const searchInput =
      document.getElementById(
        "lpRewardSearch"
      );

    const amountInput =
      document.getElementById(
        "lpRewardAmount"
      );

    const quantityInput =
      document.getElementById(
        "lpRewardQuantity"
      );

    const selectionValue =
      document.getElementById(
        "lpRecorderSelectionValue"
      );

    const selectionMeta =
      document.getElementById(
        "lpRecorderSelectionMeta"
      );

    const recordButton =
      document.getElementById(
        "lpRecordChest"
      );

    const undoButton =
      document.getElementById(
        "lpUndoChest"
      );

    const resetButton =
      document.getElementById(
        "lpResetHistory"
      );

    const countBadge =
      document.getElementById(
        "lpRecorderCount"
      );

    const recorderMessage =
      document.getElementById(
        "lpRecorderMessage"
      );

    if (
      !amountInput ||
      !quantityInput ||
      !selectionValue ||
      !selectionMeta ||
      !recordButton ||
      !undoButton ||
      !resetButton ||
      !countBadge ||
      !recorderMessage
    ) {
      return;
    }

    const history =
      getRecordedHistory(
        selectedChest
      );

    countBadge.textContent =
      String(history.length);

    undoButton.disabled =
      history.length === 0;

    resetButton.disabled =
      history.length === 0;

    const chestReady =
      Boolean(
        selectedChest?.loaded
      );

    amountInput.disabled =
      !chestReady;

    quantityInput.disabled =
      !chestReady;

    if (searchInput) {
      searchInput.disabled =
        !chestReady;
    }

    if (!selectedChest) {
      selectedRewardState = {
        chestType: null,
        key: null
      };

      selectionValue.textContent =
        "No reward selected";

      selectionMeta.textContent =
        "Choose a chest before recording a reward.";

      amountInput.value = "";
      recordButton.disabled = true;

      recorderMessage.textContent =
        "Import event data and select a chest to begin.";

      return;
    }

    if (!selectedChest.loaded) {
      selectedRewardState = {
        chestType:
          selectedChest.chestType,
        key: null
      };

      selectionValue.textContent =
        "Deck unavailable";

      selectionMeta.textContent =
        `${selectedChest.label} reward data is not loaded.`;

      amountInput.value = "";
      recordButton.disabled = true;

      recorderMessage.textContent =
        "This chest cannot be recorded until its live deck is available.";

      return;
    }

    if (
      selectedRewardState.chestType &&
      selectedRewardState.chestType !==
        selectedChest.chestType
    ) {
      selectedRewardState = {
        chestType:
          selectedChest.chestType,
        key: null
      };

      amountInput.value = "";
    }

    const selectedReward =
      getSelectedReward(
        selectedChest,
        catalogue
      );

    if (!selectedReward) {
      selectionValue.textContent =
        "No reward selected";

      selectionMeta.textContent =
        "Choose a reward from the list above.";

      recordButton.disabled = true;

      recorderMessage.textContent =
        history.length
          ? (
              `${history.length} reward(s) recorded. ` +
              "Select the next reward you received."
            )
          : (
              "Select the first reward you received " +
              "from this chest."
            );

      return;
    }

    selectionValue.textContent =
      selectedReward.name;

    const metaParts = [];

    if (
      selectedReward.amount !== null
    ) {
      metaParts.push(
        `Deck amount: ${formatNumber(
          selectedReward.amount
        )}`
      );

      if (!amountInput.value) {
        amountInput.value =
          String(
            selectedReward.amount
          );
      }
    }

    selectionMeta.textContent =
      metaParts.length
        ? metaParts.join(" • ")
        : "Enter the amount shown in the game.";

    const enteredAmount =
      Number(
        amountInput.value
      );

    const validAmount =
      amountInput.value !== "" &&
      Number.isFinite(
        enteredAmount
      ) &&
      enteredAmount >= 0;

    recordButton.disabled =
      !validAmount;

    recorderMessage.textContent =
      validAmount
        ? (
            `Ready to record ${selectedReward.name}.`
          )
        : (
            "Enter the reward amount before recording."
          );
  }
  
    function normaliseHistoryEntry(
    entry,
    index
  ) {
    if (
      entry === null ||
      entry === undefined
    ) {
      return {
        name: `Reward ${index + 1}`,
        code: "",
        amount: null,
        quantity: 1
      };
    }

    if (
      typeof entry === "string" ||
      typeof entry === "number"
    ) {
      return {
        name: String(entry),
        code: "",
        amount: null,
        quantity: 1
      };
    }

    const reward =
      entry.reward &&
      typeof entry.reward === "object"
        ? entry.reward
        : entry;

    const name =
      reward.name ??
      reward.label ??
      reward.rewardName ??
      reward.reward_name ??
      reward.title ??
      reward.displayName ??
      reward.display_name ??
      reward.type ??
      reward.item ??
      reward.code ??
      `Reward ${index + 1}`;

    const code =
      reward.code ??
      reward.rewardCode ??
      reward.reward_code ??
      reward.key ??
      reward.id ??
      "";

    const rawAmount =
      entry.amount ??
      reward.amount ??
      reward.value ??
      reward.rewardAmount ??
      reward.reward_amount ??
      null;

    const amountNumber =
      Number(rawAmount);

    const amount =
      rawAmount !== null &&
      rawAmount !== "" &&
      Number.isFinite(
        amountNumber
      )
        ? amountNumber
        : null;

    const rawQuantity =
      entry.quantity ??
      entry.chestCount ??
      entry.chestsOpened ??
      entry.count ??
      1;

    const quantityNumber =
      Number(rawQuantity);

    const quantity =
      Number.isFinite(
        quantityNumber
      ) &&
      quantityNumber > 0
        ? quantityNumber
        : 1;

    return {
      name: String(name),
      code: String(code),
      amount,
      quantity,
      isBonus: Boolean(
        entry.isBonus ??
        entry.bonus
      )
    };
  }

  function renderHistory(status) {
    const selectedChest =
      getSelectedChest(status);

    const container =
      document.getElementById(
        "lpHistoryList"
      );

    if (!container) {
      return;
    }

    const history =
      getRecordedHistory(
        selectedChest
      );

    if (!history.length) {
      container.innerHTML = `
        <div class="lp-history-empty">
          No chest rewards recorded yet.
        </div>
      `;

      return;
    }

    container.innerHTML =
      history
        .map(
          (entry, index) => {
            const reward =
              normaliseHistoryEntry(
                entry,
                index
              );

            const details = [];

            if (
              reward.amount !== null
            ) {
              details.push(
                `Amount: ${formatNumber(
                  reward.amount
                )}`
              );
            }

            if (
              reward.quantity > 1
            ) {
              details.push(
                `${formatNumber(
                  reward.quantity
                )} chests`
              );
            }

            if (reward.isBonus) {
              details.unshift("Bonus chest");
            }

            return `
              <div class="lp-history-item">
                <div class="lp-history-left">
                  <div class="lp-history-title">
                    ${escapeHTML(
                      reward.name
                    )}
                  </div>

                  <div class="lp-history-subtitle">
                    ${
                      details.length
                        ? escapeHTML(
                            details.join(
                              " • "
                            )
                          )
                        : "Recorded chest reward"
                    }
                  </div>
                </div>

                <div class="lp-history-number">
                  ${reward.isBonus ? "BONUS" : index + 1}
                </div>
              </div>
            `;
          }
        )
        .join("");
  }

  function getConfidenceLevel(
    confidence,
    matchCount,
    playerPosition
  ) {
    if (
      playerPosition !== null ||
      matchCount === 1 ||
      confidence >= 80
    ) {
      return "high";
    }

    if (
      confidence >= 40 ||
      (
        matchCount !== null &&
        matchCount > 1 &&
        matchCount <= 10
      )
    ) {
      return "medium";
    }

    return "low";
  }

  function renderSolver(status) {
    const selectedChest =
      getSelectedChest(status);

    const title =
      document.getElementById(
        "lpSolverTitle"
      );

    const confidenceBadge =
      document.getElementById(
        "lpConfidence"
      );

    const solvedPositionElement =
      document.getElementById(
        "lpSolvedPosition"
      );

    const matchCountElement =
      document.getElementById(
        "lpMatchCount"
      );

    const observationCountElement =
      document.getElementById(
        "lpObservationCount"
      );

    const confidenceValueElement =
      document.getElementById(
        "lpConfidenceValue"
      );

    const note =
      document.getElementById(
        "lpSolverNote"
      );

    if (
      !title ||
      !confidenceBadge ||
      !solvedPositionElement ||
      !matchCountElement ||
      !observationCountElement ||
      !confidenceValueElement ||
      !note
    ) {
      return;
    }

    const history =
      getRecordedHistory(
        selectedChest
      );

    const playerPosition =
      getPlayerPosition(
        selectedChest
      );

    const matchCount =
      getMatchCount(
        selectedChest
      );

    const confidence =
      getConfidence(
        selectedChest
      );

    solvedPositionElement.textContent =
      playerPosition === null
        ? "—"
        : formatNumber(
            playerPosition
          );

    matchCountElement.textContent =
      matchCount === null
        ? "—"
        : formatNumber(
            matchCount
          );

    observationCountElement.textContent =
      formatNumber(
        history.length
      );

    confidenceValueElement.textContent =
      confidence === null
        ? "—"
        : `${confidence}%`;

    if (
      !selectedChest ||
      !selectedChest.loaded
    ) {
      title.textContent =
        "Deck unavailable";

      confidenceBadge.textContent =
        "Not ready";

      confidenceBadge.className =
        "lp-confidence lp-confidence-low";

      note.textContent =
        "Select a chest with live deck data before recording rewards.";

      return;
    }

    if (!history.length) {
      title.textContent =
        "Waiting for rewards";

      confidenceBadge.textContent =
        "Not solved";

      confidenceBadge.className =
        "lp-confidence lp-confidence-low";

      note.textContent =
        "Record consecutive chest rewards to begin solving your deck position.";

      return;
    }

    const confidenceLevel =
      getConfidenceLevel(
        confidence ?? 0,
        matchCount,
        playerPosition
      );

    confidenceBadge.className =
      `lp-confidence lp-confidence-${confidenceLevel}`;

    if (
      playerPosition !== null ||
      matchCount === 1
    ) {
      title.textContent =
        "Position solved";

      confidenceBadge.textContent =
        confidence === null
          ? "Solved"
          : `${confidence}%`;

      note.textContent =
        `Your position has been located at ` +
        `${formatNumber(
          playerPosition
        )}. Upcoming rewards can now be predicted.`;

      return;
    }

    if (matchCount === 0) {
      title.textContent =
        "Sequence does not match";

      confidenceBadge.textContent =
        "Check last reward";

      confidenceBadge.className =
        "lp-confidence lp-confidence-low";

      note.textContent =
        "No position matches the recorded sequence. " +
        "Check the selected chest, reward and amount, " +
        "then undo the last entry and try again.";

      return;
    }

    if (
      matchCount !== null &&
      matchCount > 1
    ) {
      title.textContent =
        "Narrowing matches";

      confidenceBadge.textContent =
        confidence === null
          ? `${formatNumber(
              matchCount
            )} matches`
          : `${confidence}%`;

      note.textContent =
        `${formatNumber(
          matchCount
        )} possible deck positions still match ` +
        "your recorded sequence. Record the next consecutive reward.";

      return;
    }

    title.textContent =
      "Sequence recorded";

    confidenceBadge.textContent =
      confidence === null
        ? "Searching"
        : `${confidence}%`;

    note.textContent =
      `${history.length} reward(s) recorded. ` +
      "The solver needs more consecutive rewards to identify your position.";
  }

  function normalisePrediction(
    prediction,
    index,
    playerPosition
  ) {
    if (
      prediction === null ||
      prediction === undefined
    ) {
      return {
        position:
          playerPosition === null
            ? index + 1
            : playerPosition +
              index +
              1,
        name:
          `Reward ${index + 1}`,
        code: "",
        amount: null
      };
    }

    if (
      typeof prediction === "string" ||
      typeof prediction === "number"
    ) {
      return {
        position:
          playerPosition === null
            ? index + 1
            : playerPosition +
              index +
              1,
        name:
          String(prediction),
        code: "",
        amount: null
      };
    }

    const reward =
      prediction.reward &&
      typeof prediction.reward === "object"
        ? prediction.reward
        : prediction;

    const rawPosition =
      prediction.position ??
      prediction.index ??
      prediction.deckIndex ??
      prediction.deck_index ??
      null;

    const positionNumber =
      Number(rawPosition);

    const position =
      rawPosition !== null &&
      rawPosition !== "" &&
      Number.isFinite(
        positionNumber
      )
        ? positionNumber
        : (
            playerPosition === null
              ? index + 1
              : playerPosition +
                index +
                1
          );

    const name =
      prediction.name ??
      prediction.label ??
      prediction.rewardName ??
      prediction.reward_name ??
      prediction.title ??
      prediction.displayName ??
      prediction.display_name ??
      reward.name ??
      reward.label ??
      reward.rewardName ??
      reward.reward_name ??
      reward.title ??
      reward.displayName ??
      reward.display_name ??
      reward.type ??
      reward.item ??
      reward.code ??
      `Reward ${index + 1}`;

    const code =
      prediction.code ??
      prediction.rewardCode ??
      prediction.reward_code ??
      reward.code ??
      reward.rewardCode ??
      reward.reward_code ??
      reward.key ??
      reward.id ??
      "";

    const rawAmount =
      prediction.amount ??
      reward.amount ??
      reward.value ??
      reward.quantity ??
      reward.rewardAmount ??
      reward.reward_amount ??
      null;

    const amountNumber =
      Number(rawAmount);

    const amount =
      rawAmount !== null &&
      rawAmount !== "" &&
      Number.isFinite(
        amountNumber
      )
        ? amountNumber
        : null;

    return {
      position,
      name: String(name),
      code: String(code),
      amount,
      isBonus: Boolean(
        prediction.isBonus ||
        prediction.bonus
      ),
      bonusEvery:
        Number(prediction.bonusEvery) ||
        null
    };
  }

  function renderPredictions(status) {
    const selectedChest =
      getSelectedChest(status);

    const positionElement =
      document.getElementById(
        "lpPredictionPosition"
      );

    const countElement =
      document.getElementById(
        "lpPredictionCount"
      );

    const container =
      document.getElementById(
        "lpPredictionList"
      );

    const warning =
      document.getElementById(
        "lpPredictionWarning"
      );

    if (
      !positionElement ||
      !countElement ||
      !container ||
      !warning
    ) {
      return;
    }

    const playerPosition =
      getPlayerPosition(
        selectedChest
      );

    const predictions =
      getPredictions(
        selectedChest
      );

    positionElement.textContent =
      playerPosition === null
        ? "—"
        : formatNumber(
            playerPosition
          );

    countElement.textContent =
      formatNumber(
        predictions.length
      );

    if (
      !selectedChest ||
      !selectedChest.loaded
    ) {
      container.innerHTML = `
        <div class="lp-prediction-empty">
          Select a chest with live deck data
          to view predictions.
        </div>
      `;

      warning.textContent =
        "Predictions are unavailable because this chest deck is not loaded.";

      return;
    }

    if (playerPosition === null) {
      container.innerHTML = `
        <div class="lp-prediction-empty">
          Upcoming rewards will appear here
          after your position has been solved.
        </div>
      `;

      warning.textContent =
        "Record consecutive chest rewards until the solver locates one matching position.";

      return;
    }

    if (!predictions.length) {
      container.innerHTML = `
        <div class="lp-prediction-empty">
          Your position is solved, but no
          upcoming predictions are currently available.
        </div>
      `;

      warning.textContent =
        "Refresh the live data or record another chest to generate updated predictions.";

      return;
    }

    const visiblePredictions =
      predictions.slice(
        0,
        100
      );

    container.innerHTML =
      visiblePredictions
        .map(
          (entry, index) => {
            const prediction =
              normalisePrediction(
                entry,
                index,
                playerPosition
              );

            const meta = [];

            meta.push(
              prediction.isBonus
                ? `Earned after ${prediction.bonusEvery || "the required number of"} regular chests`
                : `Deck position ${formatNumber(
                    prediction.position
                  )}`
            );

            return `
              <div
                class="lp-prediction-card ${
                  index === 0
                    ? "lp-next"
                    : ""
                } ${
                  prediction.isBonus
                    ? "lp-bonus"
                    : ""
                }"
              >
                <div class="lp-prediction-position">
                  ${
                    prediction.isBonus
                      ? "★"
                      : `+${index + 1}`
                  }
                </div>

                <div class="lp-prediction-copy">
                  <div class="lp-prediction-name">
                    ${escapeHTML(
                      prediction.name
                    )}
                  </div>

                  <div class="lp-prediction-meta">
                    ${escapeHTML(
                      meta.join(" • ")
                    )}
                  </div>

                  ${
                    index === 0 ||
                    prediction.isBonus
                      ? `
                        <div class="lp-prediction-badge">
                          ${
                            prediction.isBonus
                              ? "Bonus chest"
                              : "Next chest"
                          }
                        </div>
                      `
                      : ""
                  }
                </div>

                <div class="lp-prediction-amount">
                  ${
                    prediction.amount === null
                      ? "—"
                      : formatNumber(
                          prediction.amount
                        )
                  }
                </div>
              </div>
            `;
          }
        )
        .join("");

    warning.textContent =
      predictions.length >
      visiblePredictions.length
        ? (
            `Showing the next ${visiblePredictions.length} ` +
            `of ${predictions.length} predicted rewards.`
          )
        : (
            "Predictions depend on the imported event data and the accuracy of recorded rewards."
          );
  }

  function render() {
    const status =
      Engine.getStatus();

    document.getElementById(
      "lpEventName"
    ).textContent =
      status.event;

    document.getElementById(
      "lpSubtitle"
    ).textContent =
      status.ready
        ? `${status.readyChestCount} live deck(s) connected`
        : "Import an about_v2 file to begin";

    document.getElementById(
      "lpEventDetails"
    ).textContent =
      status.ready
        ? `${status.readyChestCount} chest deck(s) ready`
        : "No live event data is currently available.";

    const statusBadge =
      document.getElementById(
        "lpStatus"
      );

    statusBadge.textContent =
      status.ready
        ? "Live data ready"
        : "Not ready";

    statusBadge.className =
      status.ready
        ? "lp-status lp-status-ready"
        : "lp-status lp-status-not-ready";

         renderChestCards(
         status
      );

        renderSelectedChest(
      status
    );

    renderRecorder(
      status
    );

    renderHistory(
      status
    );

    renderSolver(
      status
    );

    renderPredictions(
      status
    );
  }

  function open(
    chestType = null
  ) {
    closeLegacyPredictor();

    if (
      chestType &&
      Engine.isSupportedChest(
        chestType
      )
    ) {
      Engine.setActiveChest(
        chestType
      );
    }

    render();

    document
      .getElementById(
        OVERLAY_ID
      )
      .classList.add(
        "lp-open"
      );

    document.body.style.overflow =
      "hidden";
  }

  function close() {
    document
      .getElementById(
        OVERLAY_ID
      )
      .classList.remove(
        "lp-open"
      );

    document.body.style.overflow =
      "";
  }

  function detectChestType(
    element
  ) {
    const text = [
      element?.dataset?.chest,
      element?.dataset?.chestType,
      element?.dataset?.predictor,
      element?.id,
      element?.className,
      element?.textContent,
      element?.getAttribute?.(
        "aria-label"
      ),
      element?.getAttribute?.(
        "title"
      )
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (
      text.includes("draconic") ||
      text.includes("drac")
    ) {
      return "draconic";
    }

    if (
      text.includes("freedom")
    ) {
      return "freedom";
    }

    if (
      text.includes("platinum")
    ) {
      return "platinum";
    }

    if (
      text.includes("gold")
    ) {
      return "gold";
    }

    return null;
  }

  function interceptPredictorButtons(
    event
  ) {
    const target =
      event.target.closest(
        [
          "#ccPredictorLauncher",
          "[data-predictor]",
          "[data-chest]",
          "[id*='predictor' i]",
          "[class*='predictor' i]"
        ].join(",")
      );

    if (!target) {
      return;
    }

    if (
      target.closest(
        `#${OVERLAY_ID}`
      )
    ) {
      return;
    }

    const description = [
      target.id,
      target.textContent,
      target.className
    ]
      .join(" ")
      .toLowerCase();

    const looksLikeLauncher =
      target.id ===
        "ccPredictorLauncher" ||
      description.includes(
        "engine ready"
      ) ||
      description.includes(
        "open predictor"
      ) ||
      description.trim() ===
        "predictor";

    if (!looksLikeLauncher) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    open(
      detectChestType(
        target
      )
    );
  }
  
  function resetRecorderInputs() {
    selectedRewardState = {
      chestType: null,
      key: null
    };

    const searchInput =
      document.getElementById(
        "lpRewardSearch"
      );

    const amountInput =
      document.getElementById(
        "lpRewardAmount"
      );

    const quantityInput =
      document.getElementById(
        "lpRewardQuantity"
      );

    const bonusInput =
      document.getElementById(
        "lpBonusChest"
      );

    if (searchInput) {
      searchInput.value = "";
    }

    if (amountInput) {
      amountInput.value = "";
    }

    if (quantityInput) {
      quantityInput.value = "1";
    }

    if (bonusInput) {
      bonusInput.checked = false;
    }
  }

  function refreshAfterAction() {
    if (
      typeof Engine.refresh ===
      "function"
    ) {
      Engine.refresh();
    }

    render();
  }

  function callRecordMethod(
    chestType,
    payload
  ) {
    const methodNames = [
      "recordReward",
      "recordObservation",
      "addObservation",
      "addReward",
      "recordChest"
    ];

    for (
      const methodName of
      methodNames
    ) {
      const method =
        Engine[methodName];

      if (
        typeof method !== "function"
      ) {
        continue;
      }

      const argumentOptions = [
        [
          chestType,
          payload
        ],
        [
          payload
        ],
        [
          chestType,
          payload.reward,
          payload.amount,
          payload.quantity
        ],
        [
          chestType,
          payload.name,
          payload.amount,
          payload.quantity
        ]
      ];

      let lastError = null;

      for (
        const argumentsList of
        argumentOptions
      ) {
        try {
          const result =
            method.apply(
              Engine,
              argumentsList
            );

          return {
            success: true,
            methodName,
            result
          };
        } catch (error) {
          lastError = error;
        }
      }

      if (lastError) {
        console.warn(
          `[Chest Companion] ${methodName} could not record the reward.`,
          lastError
        );
      }
    }

    return {
      success: false,
      error:
        new Error(
          "No compatible reward-recording method was found on LivePredictorEngine."
        )
    };
  }

  function callUndoMethod(
    chestType
  ) {
    const methodNames = [
      "undo",
      "undoLastReward",
      "undoLastObservation",
      "removeLastObservation",
      "removeLastReward"
    ];

    for (
      const methodName of
      methodNames
    ) {
      const method =
        Engine[methodName];

      if (
        typeof method !== "function"
      ) {
        continue;
      }

      const argumentOptions = [
        [chestType],
        []
      ];

      let lastError = null;

      for (
        const argumentsList of
        argumentOptions
      ) {
        try {
          const result =
            method.apply(
              Engine,
              argumentsList
            );

          return {
            success: true,
            methodName,
            result
          };
        } catch (error) {
          lastError = error;
        }
      }

      if (lastError) {
        console.warn(
          `[Chest Companion] ${methodName} could not undo the last reward.`,
          lastError
        );
      }
    }

    return {
      success: false,
      error:
        new Error(
          "No compatible undo method was found on LivePredictorEngine."
        )
    };
  }

  function callResetMethod(
    chestType
  ) {
    const methodNames = [
      "resetHistory",
      "clearHistory",
      "resetObservations",
      "clearObservations",
      "resetChest",
      "reset"
    ];

    for (
      const methodName of
      methodNames
    ) {
      const method =
        Engine[methodName];

      if (
        typeof method !== "function"
      ) {
        continue;
      }

      const argumentOptions = [
        [chestType],
        []
      ];

      let lastError = null;

      for (
        const argumentsList of
        argumentOptions
      ) {
        try {
          const result =
            method.apply(
              Engine,
              argumentsList
            );

          return {
            success: true,
            methodName,
            result
          };
        } catch (error) {
          lastError = error;
        }
      }

      if (lastError) {
        console.warn(
          `[Chest Companion] ${methodName} could not reset the history.`,
          lastError
        );
      }
    }

    return {
      success: false,
      error:
        new Error(
          "No compatible reset method was found on LivePredictorEngine."
        )
    };
  }

  function showRecorderError(
    message
  ) {
    const recorderMessage =
      document.getElementById(
        "lpRecorderMessage"
      );

    if (!recorderMessage) {
      return;
    }

    recorderMessage.textContent =
      message;

    recorderMessage.style.color =
      "#dba3a3";
  }

  function handleRewardSelection(
    rewardKey
  ) {
    const status =
      Engine.getStatus();

    const selectedChest =
      getSelectedChest(status);

    if (
      !selectedChest ||
      !selectedChest.loaded
    ) {
      return;
    }

    const catalogue =
      getRewardCatalogue(
        selectedChest
      );

    const reward =
      catalogue.find(
        item =>
          item.key === rewardKey
      );

    if (!reward) {
      return;
    }

    selectedRewardState = {
      chestType:
        selectedChest.chestType,
      key:
        reward.key
    };

    const amountInput =
      document.getElementById(
        "lpRewardAmount"
      );

    if (amountInput) {
      amountInput.value =
        reward.amount === null
          ? ""
          : String(
              reward.amount
            );

      amountInput.readOnly =
        reward.amount !== null;
    }

    renderRecorder(status);
  }

  function handleRecordReward() {
    const status =
      Engine.getStatus();

    const selectedChest =
      getSelectedChest(status);

    if (
      !selectedChest ||
      !selectedChest.loaded
    ) {
      showRecorderError(
        "Select a chest with live deck data before recording."
      );

      return;
    }

    const catalogue =
      getRewardCatalogue(
        selectedChest
      );

    const selectedReward =
      getSelectedReward(
        selectedChest,
        catalogue
      );

    if (!selectedReward) {
      showRecorderError(
        "Choose the reward you received first."
      );

      return;
    }

    const amountInput =
      document.getElementById(
        "lpRewardAmount"
      );

    const quantityInput =
      document.getElementById(
        "lpRewardQuantity"
      );

    const bonusInput =
      document.getElementById(
        "lpBonusChest"
      );

    const amount =
      Number(
        amountInput?.value
      );

    const quantity =
      Number(
        quantityInput?.value ||
        1
      );

    if (
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      showRecorderError(
        "Enter a valid reward amount."
      );

      return;
    }

    if (
      !Number.isFinite(quantity) ||
      quantity < 1
    ) {
      showRecorderError(
        "Choose how many chests were opened."
      );

      return;
    }

    const payload = {
      chestType:
        selectedChest.chestType,

      reward:
        selectedReward.raw,

      rewardKey:
        selectedReward.key,

      key:
        selectedReward.key,

      name:
        selectedReward.name,

      label:
        selectedReward.name,

      code:
        selectedReward.code,

      amount,

      quantity,

      isBonus:
        Boolean(bonusInput?.checked),

      bonus:
        Boolean(bonusInput?.checked),

      chestCount:
        quantity,

      chestsOpened:
        quantity
    };

    const result =
      callRecordMethod(
        selectedChest.chestType,
        payload
      );

    if (!result.success) {
      console.error(
        "[Chest Companion] Reward recording failed.",
        result.error
      );

      showRecorderError(
        "The recorder could not connect to the predictor engine."
      );

      return;
    }

    console.info(
      `[Chest Companion] Reward recorded using ${result.methodName}.`,
      payload
    );

    resetRecorderInputs();
    refreshAfterAction();
  }

  function handleUndoReward() {
    const status =
      Engine.getStatus();

    const selectedChest =
      getSelectedChest(status);

    const history =
      getRecordedHistory(
        selectedChest
      );

    if (
      !selectedChest ||
      !history.length
    ) {
      return;
    }

    const result =
      callUndoMethod(
        selectedChest.chestType
      );

    if (!result.success) {
      console.error(
        "[Chest Companion] Undo failed.",
        result.error
      );

      showRecorderError(
        "The last reward could not be removed."
      );

      return;
    }

    console.info(
      `[Chest Companion] Undo completed using ${result.methodName}.`
    );

    resetRecorderInputs();
    refreshAfterAction();
  }

  function handleResetHistory() {
    const status =
      Engine.getStatus();

    const selectedChest =
      getSelectedChest(status);

    const history =
      getRecordedHistory(
        selectedChest
      );

    if (
      !selectedChest ||
      !history.length
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Reset all recorded ${selectedChest.label} chest rewards?`
      );

    if (!confirmed) {
      return;
    }

    const result =
      callResetMethod(
        selectedChest.chestType
      );

    if (!result.success) {
      console.error(
        "[Chest Companion] History reset failed.",
        result.error
      );

      showRecorderError(
        "The recorded history could not be reset."
      );

      return;
    }

    console.info(
      `[Chest Companion] History reset using ${result.methodName}.`
    );

    resetRecorderInputs();
    refreshAfterAction();
  }

    function attachEvents() {
    const chestGrid =
      document.getElementById(
        "lpChestGrid"
      );

    const rewardOptions =
      document.getElementById(
        "lpRewardOptions"
      );

    const searchInput =
      document.getElementById(
        "lpRewardSearch"
      );

    const amountInput =
      document.getElementById(
        "lpRewardAmount"
      );

    const quantityInput =
      document.getElementById(
        "lpRewardQuantity"
      );

    const recordButton =
      document.getElementById(
        "lpRecordChest"
      );

    const undoButton =
      document.getElementById(
        "lpUndoChest"
      );

    const resetButton =
      document.getElementById(
        "lpResetHistory"
      );

    const closeButton =
      document.getElementById(
        "lpClose"
      );

    const refreshButton =
      document.getElementById(
        "lpRefresh"
      );

    const overlay =
      document.getElementById(
        OVERLAY_ID
      );

    chestGrid.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "[data-lp-chest]"
          );

        if (!button) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const chestType =
          button.dataset.lpChest;

        Engine.setActiveChest(
          chestType
        );

        resetRecorderInputs();
        render();
      }
    );

    rewardOptions.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "[data-lp-reward-key]"
          );

        if (!button) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        handleRewardSelection(
          button.dataset.lpRewardKey
        );
      }
    );

    searchInput.addEventListener(
      "input",
      () => {
        renderRecorder(
          Engine.getStatus()
        );
      }
    );

    amountInput.addEventListener(
      "input",
      () => {
        renderRecorder(
          Engine.getStatus()
        );
      }
    );

    quantityInput.addEventListener(
      "change",
      () => {
        renderRecorder(
          Engine.getStatus()
        );
      }
    );

    recordButton.addEventListener(
      "click",
      event => {
        event.preventDefault();

        handleRecordReward();
      }
    );

    undoButton.addEventListener(
      "click",
      event => {
        event.preventDefault();

        handleUndoReward();
      }
    );

    resetButton.addEventListener(
      "click",
      event => {
        event.preventDefault();

        handleResetHistory();
      }
    );

    closeButton.addEventListener(
      "click",
      close
    );

    refreshButton.addEventListener(
      "click",
      () => {
        Engine.refresh();
        render();
      }
    );

    overlay.addEventListener(
      "click",
      event => {
        if (
          event.target.id ===
          OVERLAY_ID
        ) {
          close();
        }
      }
    );

    document.addEventListener(
      "click",
      interceptPredictorButtons,
      true
    );

    document.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Escape"
        ) {
          close();
        }
      }
    );

    window.addEventListener(
      "noir:event-imported",
      () => {
        resetRecorderInputs();
        Engine.refresh();

        if (
          overlay?.classList.contains(
            "lp-open"
          )
        ) {
          render();
        }
      }
    );

    window.addEventListener(
      "chest-companion-live-predictor-updated",
      () => {
        if (
          overlay?.classList.contains(
            "lp-open"
          )
        ) {
          render();
        }
      }
    );
  }

  function initialise() {
    addStyles();
    createOverlay();
    attachEvents();

    console.info(
      "[Chest Companion] Live Predictor UI ready.",
      Engine.getStatus()
    );
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialise
    );
  } else {
    initialise();
  }

  window.LivePredictorUI =
    Object.freeze({
      open,
      close,
      render
    });
})(window);
