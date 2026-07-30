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
      setMessage(
        error?.message ||
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

  window.NoirAccessControl =
    Object.freeze({
      verify,
      show,
      hide
    });
})(window);
