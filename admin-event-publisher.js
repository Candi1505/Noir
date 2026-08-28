/* ============================================================
   NOIR — ADMIN EVENT PUBLISHER

   Only an authenticated profile with role=admin or
   is_admin=true may publish. The raw HAR and personal gacha
   history remain on the administrator's device. Only the
   sanitised event/deck data is written to Supabase.
   ============================================================ */

(function initialiseAdminEventPublisher(window) {
  "use strict";

  const get = id =>
    document.getElementById(id);
  const SIGN_OUT_TIMEOUT_MS = 5000;
  const SUPABASE_AUTH_STORAGE_KEY =
    "sb-prjixwuvyhiqzoekoadj-auth-token";

  let access = {
    user: null,
    profile: null,
    isAdmin: false,
    isApproved: false
  };
  let passwordRecoveryActive = false;
  let publishGeneration = 0;
  let publishInFlight = false;
  let accessRefreshGeneration = 0;
  let signOutInProgress = false;

  function invalidateAccessRefresh() {
    accessRefreshGeneration += 1;
  }

  function invalidatePublishing() {
    publishGeneration += 1;

    const importButton = get(
      "importEventDataButton"
    );
    if (importButton) {
      if (!publishInFlight) {
        delete importButton.dataset
          .publisherGeneration;
      }
      if (
        publishInFlight ||
        importButton.dataset.importBusy ===
          "true"
      ) {
        importButton.disabled = true;
      } else {
        importButton.disabled =
          !access.isAdmin;
      }
    }
  }

  function setStatus(message, failed = false) {
    const status = get("adminAccessStatus");

    if (!status) return;

    status.textContent = message;
    status.classList.toggle(
      "error-text",
      failed
    );
  }

  function showSigningOutBoundary() {
    const message =
      "Signing out securely. This page will refresh automatically.";

    setStatus(message);
    window.NoirAccessControl?.show?.({
      message,
      signedIn: true
    });

    [
      "adminSignOutButton",
      "playerSignOutButton",
      "accessGateSignOut"
    ].forEach(id => {
      const button = get(id);

      if (button) {
        button.disabled = true;
        button.textContent =
          "Signing out...";
      }
    });
  }

  async function requestRemoteSignOut() {
    const scheduleTimeout =
      window.setTimeout ||
      (typeof setTimeout === "function"
        ? setTimeout
        : null);
    const cancelTimeout =
      window.clearTimeout ||
      (typeof clearTimeout === "function"
        ? clearTimeout
        : null);
    let timeoutId = null;

    const remoteRequest = Promise.resolve()
      .then(() =>
        window.ChestDatabase
          .signOutAdmin()
      )
      .then(() => ({ timedOut: false }));

    try {
      if (!scheduleTimeout) {
        await remoteRequest;
        return true;
      }

      const result = await Promise.race([
        remoteRequest,
        new Promise(resolve => {
          timeoutId = scheduleTimeout(
            () => resolve({ timedOut: true }),
            SIGN_OUT_TIMEOUT_MS
          );
        })
      ]);

      if (result?.timedOut) {
        console.warn(
          "[Noir] Remote sign-out timed out; completing local sign-out."
        );
        return false;
      }

      return true;
    } catch (error) {
      console.warn(
        "[Noir] Remote sign-out failed; completing local sign-out."
      );
      return false;
    } finally {
      if (
        timeoutId !== null &&
        cancelTimeout
      ) {
        cancelTimeout(timeoutId);
      }
    }
  }

  function forceLocalSupabaseSessionClear() {
    if (
      window.NoirAccessControl
        ?.forceLocalSessionClear
    ) {
      window.NoirAccessControl
        .forceLocalSessionClear();
      return;
    }

    try {
      Promise.resolve(
        window.chestSupabase?.auth
          ?.signOut?.({ scope: "local" })
      ).catch(() => {
        /* Storage clearing below is the deterministic fallback. */
      });
    } catch (error) {
      /* Storage clearing below is the deterministic fallback. */
    }

    [
      "localStorage",
      "sessionStorage"
    ].forEach(storageName => {
      try {
        const storage =
          window[storageName];
        storage?.removeItem?.(
          SUPABASE_AUTH_STORAGE_KEY
        );
        storage?.removeItem?.(
          `${SUPABASE_AUTH_STORAGE_KEY}-code-verifier`
        );
      } catch (error) {
        /* The locked page remains fail-closed until reload. */
      }
    });
  }

  function renderAccess() {
    const loginPanel =
      get("adminLoginPanel");
    const signedInPanel =
      get("adminSignedInPanel");
    const playerPanel =
      get("playerSignedInPanel");
    const recoveryPanel =
      get("passwordRecoveryPanel");
    const controls =
      get("adminDataControls");
    const importButton =
      get("importEventDataButton");

    loginPanel?.classList.toggle(
      "hidden",
      Boolean(access.user) ||
      passwordRecoveryActive
    );
    recoveryPanel?.classList.toggle(
      "hidden",
      !passwordRecoveryActive
    );
    signedInPanel?.classList.toggle(
      "hidden",
      !access.isAdmin
    );
    controls?.classList.toggle(
      "hidden",
      !access.isAdmin
    );
    playerPanel?.classList.toggle(
      "hidden",
      !access.user ||
      !access.isApproved ||
      access.isAdmin ||
      passwordRecoveryActive
    );

    const eyebrow = get("eventAccessEyebrow");
    const title = get("eventAccessTitle");
    const description =
      get("eventAccessDescription");
    const badge = get("eventImportBadge");

    if (passwordRecoveryActive) {
      if (eyebrow) eyebrow.textContent =
        "ACCOUNT SECURITY";
      if (title) title.textContent =
        "Reset Password";
      if (description) description.textContent =
        "Choose a new password for your Onyx Command account.";
      if (badge) badge.textContent = "Secure";
    } else if (access.isAdmin) {
      if (eyebrow) eyebrow.textContent =
        "LIVE EVENT DATA";
      if (title) title.textContent =
        "Import Live Event Data";
      if (description) description.textContent =
        "Upload the current live-event data and publish the prepared chest rewards.";
    } else if (access.user) {
      if (eyebrow) eyebrow.textContent =
        "ONYX COMMAND";
      if (title) title.textContent =
        "Live Predictor";
      if (description) description.textContent =
        "Your account is connected. Open the live predictor to track chest rewards.";
      if (badge) badge.textContent = "Ready";
    } else {
      if (eyebrow) eyebrow.textContent =
        "PRIVATE ACCESS";
      if (title) title.textContent =
        "Sign In Required";
      if (description) description.textContent =
        "Onyx Command requires a signed-in player account.";
      if (badge) badge.textContent = "Locked";
    }

    if (importButton) {
      importButton.disabled =
        !access.isAdmin ||
        importButton.dataset.importBusy ===
          "true" ||
        Boolean(
          importButton.dataset
            .publisherGeneration
        );
    }

    if (access.isAdmin) {
      setStatus(
        `Administrator access confirmed${
          access.user?.email
            ? ` for ${access.user.email}`
            : ""
        }.`
      );
    }
  }

  async function refreshAccess() {
    const operationGeneration =
      ++accessRefreshGeneration;
    let refreshedAccess;

    try {
      refreshedAccess =
        await window.ChestDatabase
          .getCurrentAccess();
    } catch (error) {
      console.warn(
        "[Noir] Could not check administrator access.",
        error
      );

      refreshedAccess = {
        user: null,
        profile: null,
        isAdmin: false,
        isApproved: false
      };
    }

    if (
      operationGeneration !==
        accessRefreshGeneration
    ) {
      return { ...access };
    }

    access = refreshedAccess;

    renderAccess();

    window.dispatchEvent(
      new CustomEvent(
        "noir:admin-access-changed",
        { detail: { ...access } }
      )
    );

    return access;
  }

  async function signIn() {
    const email =
      get("adminEmailInput")?.value;
    const password =
      get("adminPasswordInput")?.value;
    const button =
      get("adminSignInButton");

    if (!email || !password) {
      window.alert(
        "Enter your email and password."
      );
      return;
    }

    button.disabled = true;
    button.textContent = "Signing in...";
    const operationGeneration =
      ++accessRefreshGeneration;

    try {
      const signedInAccess =
        await window.ChestDatabase
          .signInMember(email, password);

      if (
        operationGeneration !==
          accessRefreshGeneration
      ) {
        return;
      }

      access = signedInAccess;

      const passwordInput =
        get("adminPasswordInput");

      if (passwordInput) {
        passwordInput.value = "";
      }

      renderAccess();
    } catch (error) {
      window.alert(
        error?.message ||
        "Sign-in failed."
      );
    } finally {
      button.disabled = false;
      button.textContent =
        "Sign in";
    }
  }

  async function signOut() {
    if (signOutInProgress) {
      return;
    }

    signOutInProgress = true;
    invalidateAccessRefresh();
    invalidatePublishing();
    try {
      window.NoirAccessControl
        ?.clearPrivateClientState?.();
    } catch (error) {
      window.dispatchEvent?.(
        new CustomEvent(
          "noir:signout-started"
        )
      );
      try {
        window.OnyxEventImportPrivacy
          ?.clearPrivateImport?.({
            resetInterface: true,
            clearFileInput: true
          });
      } catch (cleanupError) {
        /* Supabase sign-out and reload remain mandatory. */
      }
    }

    access = {
      user: null,
      profile: null,
      isAdmin: false,
      isApproved: false
    };
    passwordRecoveryActive = false;
    renderAccess();

    try {
      showSigningOutBoundary();
    } catch (error) {
      get("appShell")?.classList.add(
        "hidden"
      );
    }

    try {
      const remoteSignOutCompleted =
        await requestRemoteSignOut();

      if (!remoteSignOutCompleted) {
        forceLocalSupabaseSessionClear();
      }
    } finally {
      window.location.reload();
    }
  }

  async function sendPasswordReset() {
    const email =
      get("adminEmailInput")?.value;
    const status =
      get("adminAccessStatus");

    try {
      status?.classList.remove("error-text");
      await window.ChestDatabase
        .sendPasswordReset(email);
      window.alert(
        "Check your email for the secure password-reset link."
      );
    } catch (error) {
      window.alert(
        error?.message ||
        "The password-reset email could not be sent."
      );
    }
  }

  async function saveNewPassword() {
    const password =
      get("memberNewPasswordInput")?.value;
    const button =
      get("saveMemberPasswordButton");
    const status =
      get("passwordRecoveryStatus");

    button.disabled = true;

    try {
      await window.ChestDatabase
        .updateMemberPassword(password);
      status.textContent =
        "Your password has been updated successfully.";
      passwordRecoveryActive = false;
      await refreshAccess();
    } catch (error) {
      status.textContent =
        error?.message ||
        "Your password could not be updated.";
      status.classList.add("error-text");
    } finally {
      button.disabled = false;
    }
  }

  async function publishImportedEvent(event) {
    const operationGeneration =
      publishGeneration;

    if (
      event?.detail?.restored ||
      event?.detail?.cloud
    ) {
      return;
    }

    const eventData =
      event?.detail?.eventData;

    if (!eventData?.chests) {
      return;
    }

    const requiredChestTypes = [
      "gold",
      "platinum",
      "draconic",
      "freedom",
      "arcane",
      "super_sigil"
    ];

    const incompleteChestTypes =
      requiredChestTypes.filter(
        chestType => {
          const chest =
            eventData.chests[
              chestType
            ];

          return !(
            chest?.found === true &&
            Array.isArray(chest.deck) &&
            chest.deck.length > 0 &&
            !(
              Array.isArray(chest.warnings) &&
              chest.warnings.length > 0
            )
          );
        }
      );

    if (
      eventData.ready !== true ||
      Number(eventData.readyChestCount) !==
        requiredChestTypes.length ||
      incompleteChestTypes.length
    ) {
      const message =
        `Event import is incomplete (${incompleteChestTypes.join(", ") || "readiness check"}). Existing player data was left unchanged.`;
      const status =
        get("eventImportStatus");

      if (status) {
        status.textContent = message;
      }

      setStatus(message, true);
      return;
    }

    const importButton =
      get("importEventDataButton");
    const status =
      get("eventImportStatus");
    const operationToken =
      String(operationGeneration);

    if (importButton) {
      importButton.dataset
        .publisherGeneration =
          operationToken;
      importButton.disabled = true;
    }

    const currentAccess =
      await refreshAccess();

    if (
      operationGeneration !==
        publishGeneration ||
      !currentAccess.isAdmin
    ) {
      if (
        importButton?.dataset
          .publisherGeneration ===
            operationToken
      ) {
        delete importButton.dataset
          .publisherGeneration;
        if (
          importButton.dataset.importBusy !==
            "true"
        ) {
          importButton.disabled =
            !access.isAdmin;
        }
      }
      if (
        operationGeneration ===
          publishGeneration
      ) {
        setStatus(
          "The event data was prepared on this device but was not published because administrator access was not confirmed.",
          true
        );
      }
      return;
    }

    if (status) {
      status.textContent =
        "Event data ready. Publishing atomically to players. Once sent, the server update may finish even if this page closes.";
    }

    try {
      publishInFlight = true;

      const published =
        await window.ChestDatabase
          .publishLiveEvent(
            eventData,
            event?.detail?.sourceFile ||
              null,
            {
              isCancelled: () =>
                operationGeneration !==
                  publishGeneration
            }
          );

      if (
        operationGeneration !==
          publishGeneration
      ) {
        return;
      }

      window.LivePredictorEngine
        ?.publishEventData?.(
          published.eventData,
          published.eventData.sourceFile
        );

      await window.ChestPredictorCloud
        ?.load?.();

      if (
        operationGeneration !==
          publishGeneration
      ) {
        return;
      }

      if (status) {
        status.textContent =
          `${published.records.length} chest predictor(s) published successfully. Players will load this event automatically.`;
      }

      setStatus(
        `Published ${published.eventData.event} at ${new Date(
          published.publishedAt
        ).toLocaleString()}.`
      );
    } catch (error) {
      if (
        operationGeneration !==
          publishGeneration ||
        error?.name === "AbortError"
      ) {
        return;
      }

      console.error(
        "[Noir] Event publishing failed.",
        error
      );

      if (status) {
        status.textContent =
          error?.message ||
          "The sanitised event could not be published.";
      }

      setStatus(
        "The event data was prepared locally, but cloud publishing failed.",
        true
      );
    } finally {
      publishInFlight = false;

      if (
        importButton?.dataset
          .publisherGeneration ===
            operationToken
      ) {
        delete importButton.dataset
          .publisherGeneration;
        if (
          importButton.dataset.importBusy !==
            "true"
        ) {
          importButton.disabled =
            !access.isAdmin;
        }
      }
    }
  }

  function initialise() {
    window.addEventListener(
      "noir:signout-started",
      () => {
        invalidateAccessRefresh();
        invalidatePublishing();
      }
    );
    window.addEventListener(
      "noir:private-import-cleared",
      invalidatePublishing
    );

    get("adminSignInButton")
      ?.addEventListener(
        "click",
        signIn
      );

    get("adminSignOutButton")
      ?.addEventListener(
        "click",
        signOut
      );

    get("playerSignOutButton")
      ?.addEventListener(
        "click",
        signOut
      );

    get("forgotPasswordButton")
      ?.addEventListener(
        "click",
        sendPasswordReset
      );

    get("saveMemberPasswordButton")
      ?.addEventListener(
        "click",
        saveNewPassword
      );

    get("openPlayerPredictorButton")
      ?.addEventListener(
        "click",
        () => {
          window.LivePredictorUI?.open?.(
            window.LivePredictorEngine
              ?.getActiveChest?.() ||
            "gold"
          );
        }
      );

    window.addEventListener(
      "noir:event-imported",
      publishImportedEvent
    );

    window.chestSupabase?.auth
      ?.onAuthStateChange?.(
        event => {
          if (event === "PASSWORD_RECOVERY") {
            passwordRecoveryActive = true;
          }

          refreshAccess();
        }
      );

    refreshAccess();
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialise,
      { once: true }
    );
  } else {
    initialise();
  }

  window.NoirAdminPublisher =
    Object.freeze({
      refreshAccess,
      getAccess: () => ({ ...access })
    });
})(window);
