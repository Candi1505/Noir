/* =========================================================
   ONYX COMMAND — PLAYER WAR DRAGONS AUTHORISATION

   The browser receives connection status and a one-time handoff
   only. Player API keys and the application secret never enter
   browser storage, page markup or client logs.
========================================================= */

(function initialiseOnyxWarDragonsAuth(window) {
  "use strict";

  const FUNCTION_NAME = "onyx-war-dragons-oauth";
  const HANDOFF_KEY = "wd-connect";
  const ERROR_KEY = "wd-connect-error";
  let installed = false;
  let statusSnapshot = Object.freeze({
    phase: "checking",
    connected: false,
    readyToAuthorise: false,
    reviewStatus: "pending_review",
    playerId: null,
    scopes: [],
    connectedAt: null,
    lastVerifiedAt: null,
    message: "Checking the secure War Dragons connection."
  });

  function clone(value) {
    return value === null || value === undefined
      ? value
      : JSON.parse(JSON.stringify(value));
  }

  function cleanText(value, maximum = 180) {
    return typeof value === "string"
      ? value.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, maximum)
      : "";
  }

  function normaliseStatus(value) {
    const source = value && typeof value === "object" ? value : {};
    const connected = source.connected === true;
    const readyToAuthorise = source.readyToAuthorise === true;
    return Object.freeze({
      phase: connected ? "connected" : readyToAuthorise ? "ready" : "pending",
      connected,
      readyToAuthorise,
      reviewStatus: source.reviewStatus === "ready" ? "ready" : "pending_review",
      playerId: cleanText(source.playerId, 160) || null,
      scopes: Array.isArray(source.scopes)
        ? source.scopes.filter(scope => ["atlas.read", "player.public.read"].includes(scope))
        : [],
      connectedAt: cleanText(source.connectedAt, 64) || null,
      lastVerifiedAt: cleanText(source.lastVerifiedAt, 64) || null,
      message: connected
        ? "Your player-authorised War Dragons connection is active."
        : readyToAuthorise
          ? "Onyx is ready for your War Dragons authorisation."
          : "War Dragons multi-player API review is pending."
    });
  }

  function setStatus(next) {
    statusSnapshot = Object.freeze({ ...statusSnapshot, ...next });
    window.dispatchEvent?.(new CustomEvent("onyx-war-dragons-connection", {
      detail: clone(statusSnapshot)
    }));
    return clone(statusSnapshot);
  }

  async function functionMessage(error, fallback) {
    const context = error?.context;
    if (context && typeof context.clone === "function") {
      try {
        const payload = await context.clone().json();
        if (typeof payload?.message === "string") {
          return cleanText(payload.message) || fallback;
        }
      } catch {
        // Use the stable, non-sensitive fallback below.
      }
    }
    return fallback;
  }

  async function invoke(action, extra = {}) {
    const client = window.chestSupabase;
    const userId = window.OnyxCommandCore?.getCurrentUserId?.();
    if (!client || !userId) {
      throw new Error("Sign in to Onyx Command first.");
    }
    const { data, error } = await client.functions.invoke(FUNCTION_NAME, {
      body: { action, ...extra }
    });
    if (error) {
      throw new Error(await functionMessage(
        error,
        "The secure War Dragons connection service is unavailable."
      ));
    }
    if (!data?.ok) {
      throw new Error(cleanText(data?.message) || "The secure connection did not complete.");
    }
    return data;
  }

  async function refreshStatus() {
    setStatus({ phase: "checking", message: "Checking the secure War Dragons connection." });
    try {
      const data = await invoke("status");
      statusSnapshot = normaliseStatus(data);
      return setStatus(statusSnapshot);
    } catch (error) {
      return setStatus({
        phase: "error",
        connected: false,
        readyToAuthorise: false,
        message: cleanText(error?.message) || "Onyx could not check the connection."
      });
    }
  }

  async function beginAuthorization() {
    setStatus({ phase: "working", message: "Preparing the official War Dragons authorisation." });
    try {
      const data = await invoke("begin");
      const authorizeUrl = cleanText(data.authorizeUrl, 1000);
      if (!/^https:\/\/api-dot-pgdragonsong\.appspot\.com\/api\/authorize\?/.test(authorizeUrl)) {
        throw new Error("War Dragons returned an unexpected authorisation address.");
      }
      window.location.assign(authorizeUrl);
      return true;
    } catch (error) {
      setStatus({
        phase: "pending",
        connected: false,
        message: cleanText(error?.message) || "War Dragons authorisation is not ready yet."
      });
      return false;
    }
  }

  function returnParameters() {
    const raw = String(window.location?.hash || "");
    if (!raw.startsWith("#")) return null;
    const parameters = new URLSearchParams(raw.slice(1));
    const handoff = parameters.get(HANDOFF_KEY);
    const error = parameters.get(ERROR_KEY);
    return handoff || error ? { handoff, error } : null;
  }

  function clearReturnHash() {
    const current = new URL(window.location.href);
    const parameters = new URLSearchParams(current.hash.slice(1));
    parameters.delete(HANDOFF_KEY);
    parameters.delete(ERROR_KEY);
    const remainder = parameters.toString();
    current.hash = remainder ? `#${remainder}` : "";
    window.history.replaceState({}, "", current.toString());
  }

  async function finishReturn() {
    const returned = returnParameters();
    if (!returned) return false;
    if (returned.error) {
      clearReturnHash();
      setStatus({
        phase: "error",
        connected: false,
        message: "War Dragons did not complete the authorisation. You can try again later."
      });
      return false;
    }

    setStatus({ phase: "working", message: "Securing your player-authorised connection." });
    try {
      const data = await invoke("complete", { handoffToken: returned.handoff });
      clearReturnHash();
      setStatus({
        phase: "connected",
        connected: true,
        readyToAuthorise: true,
        reviewStatus: "ready",
        playerId: cleanText(data.playerId, 160) || null,
        scopes: ["atlas.read", "player.public.read"],
        message: "Your War Dragons account is securely connected."
      });
      return true;
    } catch (error) {
      setStatus({
        phase: "error",
        connected: false,
        message: cleanText(error?.message) || "Onyx could not secure this authorisation."
      });
      return false;
    }
  }

  async function disconnect() {
    setStatus({ phase: "working", message: "Removing the encrypted War Dragons connection." });
    try {
      await invoke("disconnect");
      setStatus({
        phase: statusSnapshot.readyToAuthorise ? "ready" : "pending",
        connected: false,
        playerId: null,
        scopes: [],
        connectedAt: null,
        lastVerifiedAt: null,
        message: "The encrypted War Dragons key was removed from Onyx."
      });
      return true;
    } catch (error) {
      setStatus({
        phase: "error",
        message: cleanText(error?.message) || "Onyx could not remove the connection."
      });
      return false;
    }
  }

  async function install() {
    if (installed) return;
    installed = true;
    const completed = await finishReturn();
    if (!completed) await refreshStatus();
  }

  window.OnyxWarDragonsAuth = Object.freeze({
    install,
    refreshStatus,
    beginAuthorization,
    finishReturn,
    disconnect,
    normaliseStatus,
    getStatus: () => clone(statusSnapshot)
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})(window);
