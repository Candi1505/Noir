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
  let passwordRecoveryActive = false;
  let showingSignUp = false;
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
            "This player account is blocked. Ask a NOIR administrator if you think this is a mistake.",
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
            "Your account was created but could not be opened. Ask a NOIR administrator to check it.",
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
