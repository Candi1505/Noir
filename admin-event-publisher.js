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
    isAdmin: false
  };

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
    const controls =
      get("adminHarControls");
    const importButton =
      get("importEventDataButton");

    loginPanel?.classList.toggle(
      "hidden",
      access.isAdmin
    );
    signedInPanel?.classList.toggle(
      "hidden",
      !access.isAdmin
    );
    controls?.classList.toggle(
      "hidden",
      !access.isAdmin
    );

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
        isAdmin: false
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
        "Enter the Noir administrator email and password."
      );
      return;
    }

    button.disabled = true;
    button.textContent = "Signing in...";

    try {
      access =
        await window.ChestDatabase
          .signInAdmin(email, password);

      const passwordInput =
        get("adminPasswordInput");

      if (passwordInput) {
        passwordInput.value = "";
      }

      renderAccess();
    } catch (error) {
      window.alert(
        error?.message ||
        "Administrator sign-in failed."
      );
    } finally {
      button.disabled = false;
      button.textContent =
        "Sign in as Admin";
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
      isAdmin: false
    };

    renderAccess();
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
        "The HAR was read on this device but was not published because administrator access was not confirmed.",
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
        "The HAR was imported locally, but cloud publishing failed.",
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

    window.addEventListener(
      "noir:event-imported",
      publishImportedEvent
    );

    window.chestSupabase?.auth
      ?.onAuthStateChange?.(
        () => refreshAccess()
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
