/* ============================================================
   NOIR • I ZI — INVITE-ONLY ACCESS GATE

   The application shell is never opened by this module. It only
   verifies access and presents the private sign-in boundary.
   Supabase RLS remains the authoritative data-access control.
   ============================================================ */

(function initialiseNoirAccessControl(window) {
  "use strict";

  const get = id =>
    document.getElementById(id);
  let passwordRecoveryActive = false;
  const inviteSetupRequested = (() => {
    try {
      return new URL(window.location.href)
        .searchParams.get("invite") === "1";
    } catch (error) {
      return false;
    }
  })();

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
      "Sign in with an approved invitation to enter.",
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
      ?.classList.toggle("hidden", signedIn);
    get("accessGateResetPassword")
      ?.classList.toggle("hidden", signedIn);
    setMessage(message, failed);
  }

  function hide() {
    get("accessGate")?.classList.add("hidden");
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
        "Enter your invited email and password.",
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
            "Your account is signed in but has not been approved for Noir. Ask the administrator to approve your invitation.",
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
          ? "Email or password not recognised. Use the email your invitation was sent to, or choose Forgot password."
          : error?.message ||
        "Sign-in failed.",
        true
      );
    } finally {
      button.disabled = false;
      button.textContent = "Sign in";
    }
  }

  async function signOut() {
    try {
      await window.ChestDatabase
        .signOutAdmin();
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
      "Choose and confirm your new Noir password."
  } = {}) {
    passwordRecoveryActive = true;
    show({ message });
    get("accessGateNewPassword")?.focus();
  }

  function beginInvitedAccountSetup(session) {
    if (
      inviteSetupRequested &&
      session?.user
    ) {
      beginPasswordRecovery({
        message:
          "Your Noir invitation is confirmed. Create and confirm your password to finish setting up your account."
      });
    }
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
        "Password updated. Opening Noir..."
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
            signIn();
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
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          beginPasswordRecovery();
          return;
        }

        if (
          event === "INITIAL_SESSION" ||
          event === "SIGNED_IN"
        ) {
          beginInvitedAccountSetup(session);
        }
      }
    );

  if (inviteSetupRequested) {
    window.chestSupabase?.auth
      ?.getSession?.()
      .then(({ data }) => {
        beginInvitedAccountSetup(
          data?.session
        );
      })
      .catch(() => {
        /* The Auth state listener remains the fallback. */
      });
  }

  window.NoirAccessControl =
    Object.freeze({
      verify,
      show,
      hide,
      beginPasswordRecovery,
      isPasswordRecoveryActive: () =>
        passwordRecoveryActive,
      isInviteSetupRequested: () =>
        inviteSetupRequested
    });
})(window);
