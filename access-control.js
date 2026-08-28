/* ============================================================
   NOIR • I ZI — AUTHENTICATED PLAYER GATE

   The application shell is never opened by this module. It only
   verifies access and presents the private sign-in boundary.
   Supabase RLS remains the authoritative data-access control.
   ============================================================ */

(function initialiseNoirAccessControl(window) {
  "use strict";

  const get = id =>
    document.getElementById(id);
  const SIGN_OUT_TIMEOUT_MS = 5000;
  const SUPABASE_AUTH_STORAGE_KEY =
    "sb-prjixwuvyhiqzoekoadj-auth-token";
  let passwordRecoveryActive = false;
  let showingSignUp = false;
  let signOutInProgress = false;

  function setMessage(message, failed = false) {
    const element = get("accessGateMessage");

    if (!element) return;

    element.textContent = message;
    element.classList.toggle(
      "error-text",
      failed
    );
  }

  function show({
    message =
      "Sign in or create a player account to enter.",
    failed = false,
    signedIn = false
  } = {}) {
    get("loadingScreen")?.classList.add("hidden");
    get("appShell")?.classList.add("hidden");
    get("accessGate")?.classList.remove("hidden");
    get("accessGateCredentials")
      ?.classList.toggle(
        "hidden",
        passwordRecoveryActive
      );
    get("accessGateRecovery")
      ?.classList.toggle(
        "hidden",
        !passwordRecoveryActive
      );
    get("accessGateSignOut")
      ?.classList.toggle("hidden", !signedIn);
    get("accessGateEmail")
      ?.classList.toggle("hidden", signedIn);
    get("accessGatePassword")
      ?.classList.toggle("hidden", signedIn);
    get("accessGateSignIn")
      ?.classList.toggle(
        "hidden",
        signedIn || showingSignUp
      );
    get("accessGateSignUpFields")
      ?.classList.toggle(
        "hidden",
        signedIn || !showingSignUp
      );
    get("accessGateSignUp")
      ?.classList.toggle("hidden", signedIn);
    get("accessGateBackToSignIn")
      ?.classList.toggle(
        "hidden",
        signedIn || !showingSignUp
      );
    get("accessGateResetPassword")
      ?.classList.toggle(
        "hidden",
        signedIn || showingSignUp
      );
    if (get("accessGateSignUp")) {
      get("accessGateSignUp").textContent =
        showingSignUp
          ? "Create player account"
          : "Create account";
    }
    setMessage(message, failed);
  }

  function hide() {
    get("accessGate")?.classList.add("hidden");
  }

  function showSigningOutBoundary() {
    passwordRecoveryActive = false;
    showingSignUp = false;
    show({
      message:
        "Signing out securely. This page will refresh automatically.",
      signedIn: true
    });

    const button =
      get("accessGateSignOut");

    if (button) {
      button.disabled = true;
      button.textContent = "Signing out...";
    }
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

  async function verify() {
    const access =
      await window.ChestDatabase
        .getCurrentAccess();

    if (!access.user) {
      return {
        allowed: false,
        reason: "signed_out",
        access
      };
    }

    if (!access.isApproved) {
      return {
        allowed: false,
        reason: "approval_required",
        access
      };
    }

    return {
      allowed: true,
      reason: "approved",
      access
    };
  }

  async function signIn() {
    const email =
      get("accessGateEmail")?.value;
    const password =
      get("accessGatePassword")?.value;
    const button =
      get("accessGateSignIn");

    if (!email || !password) {
      setMessage(
        "Enter your email and password.",
        true
      );
      return;
    }

    button.disabled = true;
    button.textContent = "Checking access...";

    try {
      const access =
        await window.ChestDatabase
          .signInMember(email, password);

      if (!access.isApproved) {
        show({
          message:
            "This player account is blocked. Ask an Onyx administrator if you think this is a mistake.",
          failed: true,
          signedIn: true
        });
        return;
      }

      window.location.reload();
    } catch (error) {
      const invalidCredentials =
        error?.code === "invalid_credentials" ||
        /invalid login credentials/i.test(
          String(error?.message || "")
        );

      setMessage(
        invalidCredentials
          ? "Email or password not recognised. Check your details, create an account, or choose Forgot password."
          : error?.message ||
        "Sign-in failed.",
        true
      );
    } finally {
      button.disabled = false;
      button.textContent = "Sign in";
    }
  }

  function beginSignUp() {
    showingSignUp = true;
    show({
      message:
        "Create a player account with your email and a password."
    });
    get("accessGateSignUpNickname")
      ?.focus();
  }

  function returnToSignIn() {
    showingSignUp = false;
    show({
      message:
        "Sign in or create a player account to enter."
    });
    get("accessGateEmail")?.focus();
  }

  async function submitSignUp() {
    const email =
      get("accessGateEmail")?.value;
    const password =
      get("accessGatePassword")?.value || "";
    const confirmation =
      get("accessGateSignUpConfirm")?.value || "";
    const nickname =
      get("accessGateSignUpNickname")?.value;
    const button =
      get("accessGateSignUp");

    if (!email) {
      setMessage(
        "Enter your email address.",
        true
      );
      return;
    }

    if (password.length < 8) {
      setMessage(
        "Use a password with at least 8 characters.",
        true
      );
      return;
    }

    if (password !== confirmation) {
      setMessage(
        "The two passwords do not match.",
        true
      );
      return;
    }

    button.disabled = true;
    button.textContent = "Creating account...";

    try {
      const access =
        await window.ChestDatabase
          .signUpMember(
            email,
            password,
            nickname
          );

      if (access.confirmationRequired) {
        showingSignUp = false;
        show({
          message:
            "Account created. Check your email to confirm it, then return here and sign in."
        });
        return;
      }

      if (!access.isApproved) {
        show({
          message:
            "Your account was created but could not be opened. Ask an Onyx administrator to check it.",
          failed: true,
          signedIn: true
        });
        return;
      }

      window.location.reload();
    } catch (error) {
      const signUpDisabled =
        error?.code === "signup_disabled" ||
        /signups? (?:are|is) disabled|signup.*not allowed/i
          .test(String(error?.message || ""));

      setMessage(
        signUpDisabled
          ? "New account registration is temporarily unavailable. Please try again shortly."
          : error?.message ||
            "Your account could not be created.",
        true
      );
    } finally {
      button.disabled = false;
      button.textContent =
        showingSignUp
          ? "Create player account"
          : "Create account";
    }
  }

  async function signUp() {
    if (!showingSignUp) {
      beginSignUp();
      return;
    }

    await submitSignUp();
  }

  function clearPrivateClientStateBeforeSignOut() {
    window.dispatchEvent?.(
      new CustomEvent(
        "noir:signout-started"
      )
    );

    const closableTools = [
      window.LivePredictorUI,
      window.ChestPredictorUI,
      window.NoirChestTools,
      window.ChestPlanner,
      window.ChestDropRates,
      window.NoirBasePlanner,
      window.OnyxBaseCommand,
      window.OnyxAtlasCommand,
      window.OnyxCommand
    ];

    closableTools.forEach(tool => {
      try {
        tool?.close?.();
      } catch (error) {
        // Sign-out must continue even if an optional tool was not mounted.
      }
    });

    document
      .getElementById(
        "noirDoubleArmoryOverlay"
      )
      ?.remove();

    try {
      window.OnyxEventImportPrivacy
        ?.clearPrivateImport?.({
          resetInterface: true,
          clearFileInput: true
        });
    } catch (error) {
      /* Manual clearing below remains the privacy fallback. */
    }

    try {
      window.OnyxTowerInventoryBridge
        ?.clear?.();
    } catch (error) {
      /* The page reload remains the final isolation boundary. */
    }

    window.currentEventData = null;
    window.currentGachaData = null;
    window.currentEventSourceFile = null;
    window.ChestCompanionPublishedEvent = null;

    try {
      delete window.ChestCompanionLastImport;
    } catch (error) {
      window.ChestCompanionLastImport = null;
    }

    try {
      [
        "chestCompanionPublishedEvent",
        "chestCompanionLiveEventData",
        "chestCompanionLiveGachaData",
        "noirChestToolsVerification",
        "noirChestToolsEvent",
        "noirBasePlannerV1",
        "onyxBaseLayoutV1",
        "onyxBaseLayoutV2",
        "onyxTowerMergeV1",
        "onyxBaseReferenceV1",
        "onyxFortificationCommandV1",
        "onyxAtlasManualV1",
        "onyxAtlasModeV1",
        "onyxAtlasFiltersV1",
        "chestCompanionBetaPredictor",
        "chestCompanionLivePredictor:guest",
        "onyxCommandStateV1:signed-out",
        "onyxBaseLayoutV2:signed-out",
        "onyxBaseLayoutV1:signed-out",
        "onyxTowerMergeV1:signed-out",
        "onyxBaseReferenceV1:signed-out",
        "onyxFortificationCommandV1:signed-out",
        "chestCompanionDoubleArmory:signed-out",
        "onyxAtlasManualV1:signed-out",
        "onyxAtlasModeV1:signed-out",
        "onyxAtlasFiltersV1:signed-out"
      ].forEach(key =>
        window.localStorage
          ?.removeItem?.(key)
      );
    } catch (error) {
      /* In-memory state is already cleared above. */
    }

    try {
      window.LivePredictorEngine
        ?.clearPublishedEventData?.();
    } catch (error) {
      /* The direct global cleanup above remains authoritative. */
    }

    try {
      window.LivePredictorEngine
        ?.setPlayerIdentity?.("guest");
    } catch (error) {
      /* The page reload remains the final isolation boundary. */
    }

    const passwordInput =
      get("accessGatePassword");

    if (passwordInput) {
      passwordInput.value = "";
    }

    document.body.style.overflow = "";
    document.body.classList.remove(
      "onyx-modal-open"
    );
    get("appShell")?.classList.add(
      "hidden"
    );
  }

  async function signOut() {
    if (signOutInProgress) {
      return;
    }

    signOutInProgress = true;

    try {
      clearPrivateClientStateBeforeSignOut();
    } catch (error) {
      console.warn(
        "[Noir] Local sign-out cleanup was incomplete; reloading securely."
      );
    }

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

  async function resetPassword() {
    const email =
      get("accessGateEmail")?.value;

    try {
      await window.ChestDatabase
        .sendPasswordReset(email);
      setMessage(
        "Check your email for the secure password-reset link."
      );
    } catch (error) {
      setMessage(
        error?.message ||
        "The reset email could not be sent.",
        true
      );
    }
  }

  function beginPasswordRecovery({
    message =
      "Choose and confirm your new Onyx password."
  } = {}) {
    passwordRecoveryActive = true;
    show({ message });
    get("accessGateNewPassword")?.focus();
  }

  async function saveRecoveredPassword() {
    const password =
      get("accessGateNewPassword")?.value || "";
    const confirmation =
      get("accessGateConfirmPassword")?.value || "";
    const button =
      get("accessGateSavePassword");

    if (password.length < 8) {
      setMessage(
        "Use a password with at least 8 characters.",
        true
      );
      return;
    }

    if (password !== confirmation) {
      setMessage(
        "The two passwords do not match.",
        true
      );
      return;
    }

    button.disabled = true;
    button.textContent = "Saving...";

    try {
      await window.ChestDatabase
        .updateMemberPassword(password);

      setMessage(
        "Password updated. Opening Onyx Command..."
      );
      passwordRecoveryActive = false;

      const cleanUrl =
        new URL(window.location.href);
      cleanUrl.hash = "";
      cleanUrl.search = "";
      window.history.replaceState(
        {},
        document.title,
        cleanUrl.toString()
      );
      window.location.reload();
    } catch (error) {
      setMessage(
        error?.message ||
        "Your password could not be updated.",
        true
      );
    } finally {
      button.disabled = false;
      button.textContent = "Save new password";
    }
  }

  function bind() {
    get("accessGateSignIn")
      ?.addEventListener("click", signIn);
    get("accessGateSignUp")
      ?.addEventListener("click", signUp);
    get("accessGateBackToSignIn")
      ?.addEventListener(
        "click",
        returnToSignIn
      );
    get("accessGateSignOut")
      ?.addEventListener("click", signOut);
    get("accessGateResetPassword")
      ?.addEventListener(
        "click",
        resetPassword
      );
    get("accessGateSavePassword")
      ?.addEventListener(
        "click",
        saveRecoveredPassword
      );
    get("accessGatePassword")
      ?.addEventListener(
        "keydown",
        event => {
          if (event.key === "Enter") {
            if (showingSignUp) {
              submitSignUp();
            } else {
              signIn();
            }
          }
        }
      );
    get("accessGateSignUpConfirm")
      ?.addEventListener(
        "keydown",
        event => {
          if (event.key === "Enter") {
            submitSignUp();
          }
        }
      );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      bind,
      { once: true }
    );
  } else {
    bind();
  }

  window.chestSupabase?.auth
    ?.onAuthStateChange?.(
      event => {
        if (event === "PASSWORD_RECOVERY") {
          beginPasswordRecovery();
        }
      }
    );

  window.NoirAccessControl =
    Object.freeze({
      verify,
      show,
      hide,
      clearPrivateClientState:
        clearPrivateClientStateBeforeSignOut,
      forceLocalSessionClear:
        forceLocalSupabaseSessionClear,
      beginPasswordRecovery,
      isPasswordRecoveryActive: () =>
        passwordRecoveryActive
    });
})(window);
