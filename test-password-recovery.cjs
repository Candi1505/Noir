const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function element() {
  const classes = new Set(["hidden"]);
  const listeners = {};

  return {
    value: "",
    textContent: "",
    disabled: false,
    classList: {
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      contains: name => classes.has(name),
      toggle(name, force) {
        const enabled =
          force === undefined
            ? !classes.has(name)
            : force;
        if (enabled) classes.add(name);
        else classes.delete(name);
        return enabled;
      }
    },
    addEventListener: (name, handler) => {
      listeners[name] = handler;
    },
    focus() {},
    listeners
  };
}

const ids = [
  "loadingScreen",
  "appShell",
  "accessGate",
  "accessGateMessage",
  "accessGateCredentials",
  "accessGateRecovery",
  "accessGateSignOut",
  "accessGateEmail",
  "accessGatePassword",
  "accessGateSignIn",
  "accessGateSignUpFields",
  "accessGateSignUpNickname",
  "accessGateSignUpConfirm",
  "accessGateSignUp",
  "accessGateBackToSignIn",
  "accessGateResetPassword",
  "accessGateNewPassword",
  "accessGateConfirmPassword",
  "accessGateSavePassword"
];
const elements = Object.fromEntries(
  ids.map(id => [id, element()])
);

let authListener;
let savedPassword;
let reloaded = false;

const window = {
  ChestDatabase: {
    updateMemberPassword: async password => {
      savedPassword = password;
    }
  },
  chestSupabase: {
    auth: {
      onAuthStateChange: listener => {
        authListener = listener;
      }
    }
  },
  location: {
    href: "https://candi1505.github.io/Noir/#access_token=test",
    reload: () => {
      reloaded = true;
    }
  },
  history: {
    replaceState() {}
  }
};

const document = {
  title: "NOIR",
  readyState: "complete",
  getElementById: id => elements[id] || null
};

vm.runInNewContext(
  fs.readFileSync("access-control.js", "utf8"),
  { window, document, URL }
);

assert.equal(
  typeof authListener,
  "function",
  "Supabase recovery listener must be registered."
);

authListener(
  "PASSWORD_RECOVERY",
  { user: { id: "recovering-player" } }
);

assert.equal(
  elements.accessGateRecovery.classList.contains("hidden"),
  false,
  "Password setup must be visible after a recovery link is opened."
);
assert.equal(
  elements.accessGateCredentials.classList.contains("hidden"),
  true,
  "Credential form must be hidden during password recovery."
);
assert.equal(
  window.NoirAccessControl.isPasswordRecoveryActive(),
  true
);

elements.accessGateNewPassword.value = "new-secret-123";
elements.accessGateConfirmPassword.value = "new-secret-123";

Promise.resolve(
  elements.accessGateSavePassword.listeners.click()
).then(() => {
  assert.equal(savedPassword, "new-secret-123");
  assert.equal(reloaded, true);
  assert.equal(
    window.NoirAccessControl.isPasswordRecoveryActive(),
    false
  );
  console.log("Password recovery gate checks passed.");
});
