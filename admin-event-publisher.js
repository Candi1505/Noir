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

  let access = {
    user: null,
    profile: null,
    isAdmin: false,
    isApproved: false
  };
  let passwordRecoveryActive = false;

  function setStatus(message, failed = false) {
    const status = get("adminAccessStatus");

    if (!status) return;

    status.textContent = message;
    status.classList.toggle(
      "error-text",
      failed
    );
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
        "Choose a new password for your Chest Companion account.";
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
        "CHEST COMPANION";
      if (title) title.textContent =
        "Live Predictor";
      if (description) description.textContent =
        "Your account is connected. Open the live predictor to track chest rewards.";
      if (badge) badge.textContent = "Ready";
    } else {
      if (eyebrow) eyebrow.textContent =
        "PRIVATE ACCESS";
      if (title) title.textContent =
        "Invitation Required";
      if (description) description.textContent =
        "NOIR • I ZI is private. Only approved invited accounts can enter.";
      if (badge) badge.textContent = "Locked";
    }

    if (importButton) {
      importButton.disabled =
        !access.isAdmin;
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
    try {
      access =
        await window.ChestDatabase
          .getCurrentAccess();
    } catch (error) {
      console.warn(
        "[Noir] Could not check administrator access.",
        error
      );

      access = {
        user: null,
        profile: null,
        isAdmin: false,
        isApproved: false
      };
    }

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

    try {
      access =
        await window.ChestDatabase
          .signInMember(email, password);

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
    try {
      await window.ChestDatabase
        .signOutAdmin();
    } catch (error) {
      console.warn(
        "[Noir] Administrator sign-out failed.",
        error
      );
    }

    access = {
      user: null,
      profile: null,
      isAdmin: false,
      isApproved: false
    };
    passwordRecoveryActive = false;

    renderAccess();
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

    const currentAccess =
      await refreshAccess();

    if (!currentAccess.isAdmin) {
      setStatus(
        "The event data was prepared on this device but was not published because administrator access was not confirmed.",
        true
      );
      return;
    }

    const importButton =
      get("importEventDataButton");
    const status =
      get("eventImportStatus");

    if (importButton) {
      importButton.disabled = true;
    }

    if (status) {
      status.textContent =
        "Event data ready. Publishing to players...";
    }

    try {
      const published =
        await window.ChestDatabase
          .publishLiveEvent(
            eventData,
            event?.detail?.sourceFile ||
              null
          );

      window.LivePredictorEngine
        ?.publishEventData?.(
          published.eventData,
          published.eventData.sourceFile
        );

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
      if (importButton) {
        importButton.disabled =
          !access.isAdmin;
      }
    }
  }

  function initialise() {
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
