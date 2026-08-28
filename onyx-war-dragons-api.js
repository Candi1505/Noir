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
  let mappedProfileSnapshot = null;
  let installed = false;

  const numberFormatter = new Intl.NumberFormat("en-AU", {
    maximumFractionDigits: 0
  });

  function getElement(id) {
    return document.getElementById(id);
  }

  function clone(value) {
    return value === null || value === undefined
      ? value
      : JSON.parse(JSON.stringify(value));
  }

  function cleanText(value, maximum = 80) {
    return typeof value === "string"
      ? value.trim().slice(0, maximum)
      : "";
  }

  function cleanInteger(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  }

  function cleanPercent(value) {
    const text = cleanText(value, 16);
    return /^\d{1,3}(?:\.\d+)?%$/.test(text) ? text : "—";
  }

  function formatNumber(value) {
    return value === null || value === undefined
      ? "—"
      : numberFormatter.format(value);
  }

  function formatEpoch(value) {
    const epoch = cleanInteger(value);
    if (epoch === null) return "—";
    const milliseconds = epoch > 9999999999 ? epoch : epoch * 1000;
    const date = new Date(milliseconds);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function mapOfficialProfile(profile) {
    const source = profile && typeof profile === "object" ? profile : {};
    const activeness = source.activeness && typeof source.activeness === "object"
      ? source.activeness
      : {};
    const attacks = source.battle?.attacks && typeof source.battle.attacks === "object"
      ? source.battle.attacks
      : {};
    const elos = source.elos && typeof source.elos === "object" ? source.elos : {};
    const trophies = source.trophies && typeof source.trophies === "object"
      ? source.trophies
      : {};
    const epochs = source.epochs && typeof source.epochs === "object" ? source.epochs : {};
    const topDragons = Array.isArray(source.top_dragons)
      ? source.top_dragons.slice(0, 6).map(dragon => ({
        id: cleanText(dragon?.id, 64),
        attackPower: cleanInteger(dragon?.attack_power)
      })).filter(dragon => dragon.attackPower !== null)
      : [];

    return {
      name: cleanText(source.name, 60),
      guildName: cleanText(source.guild_name, 80),
      guildPosition: cleanText(source.guild_pos, 40),
      guildTitle: cleanText(source.guild_title, 50),
      previousLeague: cleanText(source.previous_guild_league, 40),
      online: source.online === true,
      // The public profile calls this field `xp`. It is accumulated player XP,
      // not the player's displayed game level.
      playerXp: cleanInteger(source.xp),
      defencePower: cleanInteger(source.defense_power),
      rosterPower: cleanInteger(source.roster_power),
      attackWinPercent: cleanPercent(source["attack_win_%"]),
      defenceWinPercent: cleanPercent(source["defense_win_%"]),
      attacks: cleanInteger(attacks.n),
      attacksWon: cleanInteger(attacks.won),
      eloOverall: cleanInteger(elos.overall),
      eloAttack: cleanInteger(elos.attack),
      eloDefence: cleanInteger(elos.defense),
      activenessLabel: cleanText(activeness.label, 40),
      activenessLevel: cleanInteger(activeness.level),
      activenessScore: Number.isFinite(Number(activeness.score))
        ? Number(activeness.score)
        : null,
      weeklyTrophies: cleanInteger(trophies.weekly),
      lifetimeTrophies: cleanInteger(trophies.lifetime),
      lifetimeWarStars: cleanInteger(source.lifetime_war_stars),
      boosts: cleanInteger(source.num_boosts),
      lastSeen: formatEpoch(epochs.last_seen),
      topDragons
    };
  }

  function clearElement(element) {
    if (!element) return;
    while (element.firstChild) element.removeChild(element.firstChild);
  }

  function appendLabelledValue(container, className, label, value) {
    if (!container) return;
    const row = document.createElement("div");
    row.className = className;
    const labelElement = document.createElement("span");
    const valueElement = document.createElement("strong");
    labelElement.textContent = label;
    valueElement.textContent = value;
    row.append(labelElement, valueElement);
    container.appendChild(row);
  }

  function renderProfileDossier(profile) {
    const mapped = mapOfficialProfile(profile);
    mappedProfileSnapshot = mapped;
    const panel = getElement("onyxWdProfilePanel");
    if (!panel) return;
    const guildLine = [mapped.guildName, mapped.guildPosition, mapped.guildTitle]
      .filter(Boolean)
      .join(" · ");

    const name = getElement("onyxWdProfileName");
    const guild = getElement("onyxWdProfileGuild");
    const online = getElement("onyxWdOnlineState");
    if (name) name.textContent = mapped.name || "Verified player";
    if (guild) guild.textContent = guildLine || "No guild shown in the official profile";
    if (online) {
      online.textContent = mapped.online ? "Online" : "Offline";
      online.dataset.online = String(mapped.online);
    }

    const primary = getElement("onyxWdPrimaryMetrics");
    clearElement(primary);
    appendLabelledValue(primary, "onyx-wd-metric", "Player XP", formatNumber(mapped.playerXp));
    appendLabelledValue(primary, "onyx-wd-metric", "Defence power", formatNumber(mapped.defencePower));
    appendLabelledValue(primary, "onyx-wd-metric", "Roster power", formatNumber(mapped.rosterPower));
    appendLabelledValue(primary, "onyx-wd-metric", "Weekly trophies", formatNumber(mapped.weeklyTrophies));

    const battle = getElement("onyxWdBattleMetrics");
    clearElement(battle);
    const attackRecord = mapped.attacks === null
      ? "—"
      : `${formatNumber(mapped.attacksWon)} / ${formatNumber(mapped.attacks)}`;
    appendLabelledValue(battle, "onyx-wd-signal-row", "Attack wins", mapped.attackWinPercent);
    appendLabelledValue(battle, "onyx-wd-signal-row", "Defence wins", mapped.defenceWinPercent);
    appendLabelledValue(battle, "onyx-wd-signal-row", "Recorded attacks", attackRecord);
    appendLabelledValue(battle, "onyx-wd-signal-row", "ELO · overall", formatNumber(mapped.eloOverall));
    appendLabelledValue(battle, "onyx-wd-signal-row", "ELO · attack", formatNumber(mapped.eloAttack));
    appendLabelledValue(battle, "onyx-wd-signal-row", "ELO · defence", formatNumber(mapped.eloDefence));

    const command = getElement("onyxWdCommandMetrics");
    clearElement(command);
    appendLabelledValue(command, "onyx-wd-signal-row", "Activity", mapped.activenessLabel || "—");
    appendLabelledValue(command, "onyx-wd-signal-row", "Activity level", formatNumber(mapped.activenessLevel));
    appendLabelledValue(command, "onyx-wd-signal-row", "Last seen", mapped.lastSeen);
    appendLabelledValue(command, "onyx-wd-signal-row", "Lifetime trophies", formatNumber(mapped.lifetimeTrophies));
    appendLabelledValue(command, "onyx-wd-signal-row", "War stars", formatNumber(mapped.lifetimeWarStars));
    appendLabelledValue(command, "onyx-wd-signal-row", "Boosts", formatNumber(mapped.boosts));
    appendLabelledValue(command, "onyx-wd-signal-row", "Previous league", mapped.previousLeague || "—");

    const dragonSection = getElement("onyxWdDragonSection");
    const dragonList = getElement("onyxWdDragonList");
    clearElement(dragonList);
    mapped.topDragons.forEach((dragon, index) => {
      const card = document.createElement("article");
      card.className = "onyx-wd-dragon-card";
      const label = document.createElement("span");
      const power = document.createElement("strong");
      const sourceLabel = document.createElement("small");
      label.textContent = `Vanguard ${String(index + 1).padStart(2, "0")}`;
      power.textContent = formatNumber(dragon.attackPower);
      sourceLabel.textContent = dragon.id ? "Verified roster entry" : "Official profile";
      card.append(label, power, sourceLabel);
      dragonList?.appendChild(card);
    });
    if (dragonSection) dragonSection.hidden = mapped.topDragons.length === 0;

    const applyButton = getElement("onyxWdApplyProfile");
    if (applyButton) applyButton.disabled = !mapped.name && !mapped.guildName;
    const syncMessage = getElement("onyxWdProfileSyncMessage");
    if (syncMessage) syncMessage.textContent = "";
    panel.hidden = false;
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

  async function invokeAtlasResource(resource, parameters = {}) {
    const client = window.chestSupabase;
    const userId = window.OnyxCommandCore?.getCurrentUserId?.();
    if (!client?.functions?.invoke || !userId) {
      const failure = new Error("Sign in to Onyx Command first.");
      failure.code = "authorisation_required";
      throw failure;
    }

    const { data, error } = await client.functions.invoke(FUNCTION_NAME, {
      body: { resource, ...parameters }
    });
    if (error) {
      let payload = null;
      try {
        if (error.context?.clone) payload = await error.context.clone().json();
      } catch {
        payload = null;
      }
      const failure = new Error(
        payload?.message || error.message || "Onyx could not reach the secure Atlas bridge."
      );
      failure.code = payload?.code || "function_error";
      failure.retryAfterMs = Number(payload?.retryAfterMs) || 0;
      throw failure;
    }
    if (!data?.ok || data.resource !== resource) {
      const failure = new Error(data?.message || "The official Atlas API did not return data.");
      failure.code = data?.code || "api_error";
      failure.retryAfterMs = Number(data?.retryAfterMs) || 0;
      throw failure;
    }
    return clone(data.data);
  }

  function atlasMacro({ kingdomId, realmName }) {
    return invokeAtlasResource("atlasMacro", { kingdomId, realmName });
  }

  function atlasCritical(castleIds) {
    return invokeAtlasResource("atlasCritical", { castleIds });
  }

  function atlasInfo(castleIds) {
    return invokeAtlasResource("atlasInfo", { castleIds });
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
      renderProfileDossier(profileSnapshot);
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
        `Official public profile received at ${timeLabel}. Live intelligence is ready below.`
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

  async function applyVerifiedIdentity() {
    const button = getElement("onyxWdApplyProfile");
    const message = getElement("onyxWdProfileSyncMessage");
    const profile = mappedProfileSnapshot;
    const apply = window.OnyxCommandCore?.applyOfficialProfile;

    if (!profile || typeof apply !== "function") {
      if (message) message.textContent = "The Onyx profile bridge is not ready yet.";
      return false;
    }

    if (button) {
      button.disabled = true;
      button.textContent = "Securing identity…";
    }
    if (message) message.textContent = "";

    try {
      const destination = await apply({
        nickname: profile.name,
        alliance_name: profile.guildName
      });
      if (message) {
        message.textContent = destination === "cloud"
          ? "Verified name and guild saved to your Onyx profile."
          : "Verified name and guild saved on this device.";
      }
      return true;
    } catch {
      if (message) message.textContent = "Onyx could not save the verified identity. Please try again.";
      return false;
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Use verified identity";
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
    getElement("onyxWdApplyProfile")?.addEventListener("click", applyVerifiedIdentity);
  }

  window.OnyxWarDragonsAPI = Object.freeze({
    install,
    atlasMacro,
    atlasCritical,
    atlasInfo,
    verifyProfile,
    applyVerifiedIdentity,
    describeShape,
    mapOfficialProfile,
    getProfile: () => clone(profileSnapshot),
    getMappedProfile: () => clone(mappedProfileSnapshot)
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})(window);
