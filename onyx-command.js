(function () {
  "use strict";

  const STORAGE_KEY = "onyx_command_season_planner_v1";
  const defaultState = {
    sigils: 0,
    chestEstimate: 0,
    targetKeys: 20,
    progress: {}
  };

  const intel = {
    base: {
      title: "Base & Towers",
      eyebrow: "VIOLET COMMAND",
      description:
        "Build, compare and explain base layouts using verified tower statistics and recognisable positions.",
      status: "Foundation mapped",
      message:
        "The capture contains tower definitions and upgrade tables. Player layouts and official artwork still need separate verification."
    },
    riders: {
      title: "Rider Intelligence",
      eyebrow: "CRIMSON COMMAND",
      description:
        "Match riders to dragon classes, flying styles and defensive-base roles with reasons players can understand.",
      status: "71 riders mapped",
      message:
        "The capture resolves 71 riders, 1,952 skill nodes and 2,847 effects. Recommendation rules are the next layer."
    },
    atlas: {
      title: "Atlas Command",
      eyebrow: "BLUE COMMAND",
      description:
        "Bring authorised territory and team information into a focused strategic workspace.",
      status: "Awaiting official API",
      message:
        "Atlas Command will use approved API access and authorised team data—not another player’s private account state."
    },
    calculators: {
      title: "Calculators",
      eyebrow: "AMBER COMMAND",
      description:
        "Turn upgrade costs, currencies and long-term goals into clear, versioned plans.",
      status: "Data catalogue ready",
      message:
        "Every result will expose its inputs and assumptions, so players can see where the number came from."
    }
  };

  function get(id) {
    return document.getElementById(id);
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("en-AU");
  }

  function clampNumber(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return minimum;
    return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return {
        ...defaultState,
        ...(saved || {}),
        progress: { ...defaultState.progress, ...(saved?.progress || {}) }
      };
    } catch (error) {
      console.warn("[Onyx Command] Season planner state could not be restored.", error);
      return { ...defaultState, progress: {} };
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function commandSigil(innerPath) {
    return `
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path class="sigil-frame" d="M24 2 42 13v22L24 46 6 35V13Z"></path>
        <path class="sigil-frame sigil-frame-inner" d="m24 8 12 7v18l-12 7-12-7V15Z"></path>
        ${innerPath}
      </svg>
    `;
  }

  function renderProgressInputs(state) {
    const container = get("onyxBranchProgress");
    const data = window.OnyxSeasonData;
    if (!container || !data) return;

    container.innerHTML = "";
    data.season.branches.forEach(branch => {
      const row = document.createElement("label");
      row.className = "onyx-progress-row";
      row.setAttribute("for", `onyx-progress-${branch.id}`);

      const copy = document.createElement("span");
      copy.innerHTML = `<strong>${branch.name}</strong><small>${branch.keyCosts.length - 1} captured keys</small>`;

      const select = document.createElement("select");
      select.id = `onyx-progress-${branch.id}`;
      select.dataset.onyxBranchProgress = branch.id;
      select.setAttribute("aria-label", `${branch.name} keys already claimed`);
      for (let keyCount = 0; keyCount < branch.keyCosts.length; keyCount += 1) {
        const option = document.createElement("option");
        option.value = String(keyCount);
        option.textContent = `${keyCount} key${keyCount === 1 ? "" : "s"}`;
        option.selected = Number(state.progress[branch.id] || 0) === keyCount;
        select.appendChild(option);
      }

      row.append(copy, select);
      container.appendChild(row);
    });
  }

  function renderBranchExplorer(selectedId) {
    const data = window.OnyxSeasonData;
    const select = get("onyxBranchSelect");
    if (!data || !select) return;

    if (!select.options.length) {
      data.season.branches.forEach(branch => {
        const option = document.createElement("option");
        option.value = branch.id;
        option.textContent = branch.name;
        select.appendChild(option);
      });
    }

    if (selectedId) select.value = selectedId;
    const branch =
      data.season.branches.find(item => item.id === select.value) ||
      data.season.branches[0];

    get("onyxBranchName").textContent = branch.name;
    get("onyxBranchNodes").textContent = formatNumber(branch.nodes);
    get("onyxBranchComplete").textContent = formatNumber(branch.completionCost);
    get("onyxBranchKeys").textContent = String(branch.keyCosts.length - 1);
    get("onyxBranchLastKey").textContent = formatNumber(
      branch.keyCosts[branch.keyCosts.length - 1]
    );

    const checkpoints = get("onyxBranchCheckpoints");
    checkpoints.innerHTML = "";
    branch.keyCosts.slice(1).forEach((cost, index) => {
      const item = document.createElement("li");
      item.innerHTML = `<span>Key ${index + 1}</span><strong>${formatNumber(cost)} sigils</strong>`;
      checkpoints.appendChild(item);
    });
  }

  function readStateFromControls(state) {
    state.sigils = clampNumber(get("onyxSigils")?.value);
    state.chestEstimate = clampNumber(get("onyxChestEstimate")?.value);
    state.progress = {};
    document.querySelectorAll("[data-onyx-branch-progress]").forEach(select => {
      state.progress[select.dataset.onyxBranchProgress] = clampNumber(select.value);
    });
    return state;
  }

  function renderPlanner(state) {
    const data = window.OnyxSeasonData;
    if (!data) return;

    const plan = data.cheapestRoute(state.targetKeys, state.progress);
    const available = state.sigils + state.chestEstimate;
    const cost = plan.cost ?? 0;
    const difference = available - cost;
    const progressPercent = Math.min(100, Math.round((plan.currentKeys / state.targetKeys) * 100));

    get("onyxDashboardSigils").textContent = formatNumber(state.sigils);
    get("onyxDashboardKeys").textContent = String(plan.currentKeys);
    get("onyxDashboardChestEstimate").textContent = `+${formatNumber(state.chestEstimate)}`;
    get("onyxHeroKeys").textContent = String(plan.currentKeys);
    get("onyxHeroRemaining").textContent = `${Math.max(0, state.targetKeys - plan.currentKeys)} keys remaining`;
    get("onyxHeroProgress").style.setProperty("--onyx-key-progress", `${progressPercent * 3.6}deg`);

    get("onyxPlannerCurrentKeys").textContent = String(plan.currentKeys);
    get("onyxPlannerBudget").textContent = formatNumber(available);
    get("onyxPlannerRouteCost").textContent = formatNumber(cost);
    get("onyxPlannerPosition").textContent =
      difference >= 0
        ? `${formatNumber(difference)} sigils spare`
        : `${formatNumber(Math.abs(difference))} sigils short`;
    get("onyxPlannerPosition").dataset.status = difference >= 0 ? "ready" : "short";
    get("onyxPlannerStatus").textContent =
      plan.currentKeys >= state.targetKeys
        ? "Target secured"
        : difference >= 0
          ? "Route affordable"
          : "More sigils required";
    get("onyxPlannerStatus").dataset.status =
      plan.currentKeys >= state.targetKeys || difference >= 0 ? "ready" : "short";

    const routeBody = get("onyxRouteRows");
    routeBody.innerHTML = "";
    if (!plan.route.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="3">${plan.currentKeys >= state.targetKeys ? "Your captured progress already reaches the target." : "No additional route is available in this capture."}</td>`;
      routeBody.appendChild(row);
    } else {
      plan.route.forEach(item => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${item.branchName}<small>${item.fromKeys} → ${item.toKeys} keys</small></td>
          <td>${item.additionalKeys}</td>
          <td>${formatNumber(item.cost)}</td>
        `;
        routeBody.appendChild(row);
      });
    }

    saveState(state);
  }

  function openView(viewId, title) {
    if (window.OnyxApp?.showView) {
      window.OnyxApp.showView(viewId, title);
      return;
    }
    console.warn(`[Onyx Command] View ${viewId} is not ready yet.`);
  }

  function bindNavigation() {
    document.querySelectorAll("[data-command-view]").forEach(button => {
      button.addEventListener("click", () => {
        openView(button.dataset.commandView, button.dataset.commandTitle || "Onyx Command");
      });
    });

    document.querySelectorAll("[data-command-back]").forEach(button => {
      button.addEventListener("click", () => openView("homeView", "Command Centre"));
    });

    document.querySelectorAll("[data-intel-key]").forEach(button => {
      button.addEventListener("click", () => {
        const feature = intel[button.dataset.intelKey] || intel.riders;
        get("onyxIntelEyebrow").textContent = feature.eyebrow;
        get("onyxIntelTitle").textContent = feature.title;
        get("onyxIntelDescription").textContent = feature.description;
        get("onyxIntelStatus").textContent = feature.status;
        get("onyxIntelMessage").textContent = feature.message;
        openView("onyxIntelView", feature.title);
      });
    });
  }

  function setGreeting() {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    get("onyxGreeting").textContent = `${greeting}, Commander`;
  }

  function initialise() {
    const data = window.OnyxSeasonData;
    if (!data) {
      console.error("[Onyx Command] Verified season data is unavailable.");
      return;
    }

    const state = loadState();
    state.progress = data.normaliseProgress(state.progress);
    get("onyxSigils").value = String(state.sigils);
    get("onyxChestEstimate").value = String(state.chestEstimate);
    get("onyxSeasonName").textContent = data.season.name;
    get("onyxSeasonCaptureNote").textContent = data.season.note;

    renderProgressInputs(state);
    renderBranchExplorer();
    renderPlanner(state);
    bindNavigation();
    setGreeting();

    [get("onyxSigils"), get("onyxChestEstimate")].forEach(input => {
      input?.addEventListener("input", () => renderPlanner(readStateFromControls(state)));
    });
    document.querySelectorAll("[data-onyx-branch-progress]").forEach(select => {
      select.addEventListener("change", () => renderPlanner(readStateFromControls(state)));
    });
    get("onyxBranchSelect")?.addEventListener("change", event => {
      renderBranchExplorer(event.target.value);
    });
  }

  window.OnyxCommand = Object.freeze({
    commandSigil,
    initialise
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }
})();
