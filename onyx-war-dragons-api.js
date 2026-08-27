/* =========================================================
   ONYX COMMAND — OFFICIAL WAR DRAGONS API LINK

   The browser receives only the authorised API response. The
   API key and client secret remain inside the Supabase Edge
   Function and are never stored or logged here.
========================================================= */

(function initialiseOnyxWarDragonsAPI(window) {
  "use strict";

  const FUNCTION_NAME = "onyx-war-dragons";
  const PROFILE_RESOURCE = "profile";
  const MAX_SHAPE_LINES = 180;
  const MAX_SHAPE_DEPTH = 7;
  let profileSnapshot = null;
  let installed = false;

  function getElement(id) {
    return document.getElementById(id);
  }

  function clone(value) {
    return value === null || value === undefined
      ? value
      : JSON.parse(JSON.stringify(value));
  }

  function valueType(value) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    if (Number.isInteger(value)) return "integer";
    return typeof value;
  }

  function safeFieldName(key) {
    const value = String(key || "");
    if (
      value.length > 48 ||
      /^[0-9]{8,}$/.test(value) ||
      /^[0-9a-f]{8}-[0-9a-f-]{20,}$/i.test(value) ||
      /^[A-Za-z0-9_-]{28,}$/.test(value)
    ) {
      return "[dynamic-key]";
    }
    return value.replaceAll(".", "[dot]");
  }

  function describeShape(value) {
    const lines = [];
    const seen = new WeakSet();

    function add(path, type) {
      if (lines.length < MAX_SHAPE_LINES) lines.push(`${path}: ${type}`);
    }

    function visit(current, path, depth) {
      const type = valueType(current);
      add(path, type);

      if (
        lines.length >= MAX_SHAPE_LINES ||
        current === null ||
        typeof current !== "object" ||
        depth >= MAX_SHAPE_DEPTH
      ) {
        return;
      }

      if (seen.has(current)) {
        add(`${path}.[cycle]`, "reference");
        return;
      }
      seen.add(current);

      if (Array.isArray(current)) {
        const sample = current.find(item => item !== null && item !== undefined);
        if (sample !== undefined) visit(sample, `${path}[]`, depth + 1);
        return;
      }

      Object.keys(current)
        .sort((left, right) => left.localeCompare(right))
        .forEach(key => {
          if (lines.length >= MAX_SHAPE_LINES) return;
          visit(current[key], `${path}.${safeFieldName(key)}`, depth + 1);
        });
    }

    visit(value, "$", 0);
    if (lines.length >= MAX_SHAPE_LINES) {
      lines.push("[shape truncated: additional fields omitted]");
    }
    return lines.join("\n");
  }

  function setStatus(state, label, message) {
    const status = getElement("onyxWdApiStatus");
    const messageElement = getElement("onyxWdApiMessage");
    if (status) {
      status.dataset.state = state;
      status.textContent = label;
    }
    if (messageElement) messageElement.textContent = message;
  }

  async function safeFunctionMessage(error) {
    const context = error?.context;
    if (context && typeof context.clone === "function") {
      try {
        const payload = await context.clone().json();
        if (typeof payload?.message === "string") return payload.message;
      } catch {
        // Use the stable fallback below. Never print an upstream response.
      }
    }
    return "The secure gateway could not verify the official profile.";
  }

  async function verifyProfile() {
    const button = getElement("onyxWdApiTest");
    const shapePanel = getElement("onyxWdShapePanel");
    const shapeOutput = getElement("onyxWdShapeOutput");
    const client = window.chestSupabase;
    const userId = window.OnyxCommandCore?.getCurrentUserId?.();

    if (!client || !userId) {
      setStatus(
        "error",
        "Sign-in required",
        "Sign in to Onyx Command, then verify the official profile again."
      );
      return null;
    }

    if (button) {
      button.disabled = true;
      button.textContent = "Verifying secure link…";
    }
    if (shapePanel) shapePanel.hidden = true;
    if (shapeOutput) shapeOutput.value = "";
    setStatus(
      "working",
      "Contacting gateway",
      "Onyx is requesting the official public profile through Supabase."
    );

    try {
      const { data, error } = await client.functions.invoke(
        FUNCTION_NAME,
        { body: { resource: PROFILE_RESOURCE } }
      );

      if (error) {
        const message = await safeFunctionMessage(error);
        setStatus("error", "Link not verified", message);
        return null;
      }

      if (!data?.ok || data.resource !== PROFILE_RESOURCE) {
        setStatus(
          "error",
          "Unexpected response",
          "The gateway replied, but the official profile was not confirmed."
        );
        return null;
      }

      profileSnapshot = clone(data.data);
      const fieldShape = describeShape(profileSnapshot);
      if (shapeOutput) shapeOutput.value = fieldShape;
      if (shapePanel) shapePanel.hidden = false;

      const fetchedAt = new Date(data.fetchedAt || Date.now());
      const timeLabel = Number.isNaN(fetchedAt.getTime())
        ? "just now"
        : fetchedAt.toLocaleTimeString("en-AU", {
          hour: "numeric",
          minute: "2-digit"
        });
      setStatus(
        "connected",
        "Official API connected",
        `Official public profile received at ${timeLabel}. Nothing was saved to this device.`
      );

      window.dispatchEvent(new CustomEvent("onyx-war-dragons-profile", {
        detail: {
          source: "War Dragons API",
          fetchedAt: data.fetchedAt,
          profile: clone(profileSnapshot)
        }
      }));
      return clone(profileSnapshot);
    } catch {
      setStatus(
        "error",
        "Connection interrupted",
        "Onyx could not reach the secure gateway. Please try again."
      );
      return null;
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Verify official profile";
      }
    }
  }

  async function copyShape() {
    const output = getElement("onyxWdShapeOutput");
    const button = getElement("onyxWdCopyShape");
    const text = output?.value || "";
    if (!text) return false;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      output.focus();
      output.select();
      if (!document.execCommand("copy")) return false;
    }

    if (button) {
      button.textContent = "Safe field shape copied";
      window.setTimeout(() => {
        button.textContent = "Copy safe field shape";
      }, 1800);
    }
    return true;
  }

  function install() {
    if (installed) return;
    installed = true;
    getElement("onyxWdApiTest")?.addEventListener("click", verifyProfile);
    getElement("onyxWdCopyShape")?.addEventListener("click", copyShape);
  }

  window.OnyxWarDragonsAPI = Object.freeze({
    install,
    verifyProfile,
    describeShape,
    getProfile: () => clone(profileSnapshot)
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})(window);
