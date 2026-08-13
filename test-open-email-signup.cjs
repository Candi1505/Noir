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
        const enabled = force === undefined
          ? !classes.has(name)
          : force;
        if (enabled) classes.add(name);
        else classes.delete(name);
        return enabled;
      }
    },
    addEventListener(name, handler) {
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

let signUpRequest;
let reloaded = false;

const window = {
  ChestDatabase: {
    signUpMember: async (
      email,
      password,
      nickname
    ) => {
      signUpRequest = {
        email,
        password,
        nickname
      };
      return {
        isApproved: true,
        confirmationRequired: false
      };
    }
  },
  chestSupabase: {
    auth: {
      onAuthStateChange() {}
    }
  },
  location: {
    href: "https://candi1505.github.io/Noir/",
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

elements.accessGateSignUp.listeners.click();

assert.equal(
  elements.accessGateSignUpFields
    .classList.contains("hidden"),
  false,
  "Create account must reveal player registration fields."
);
assert.equal(
  elements.accessGateSignIn
    .classList.contains("hidden"),
  true,
  "Sign-in action must be hidden while registering."
);

elements.accessGateEmail.value =
  "new.player@example.com";
elements.accessGatePassword.value =
  "safe-password-123";
elements.accessGateSignUpConfirm.value =
  "safe-password-123";
elements.accessGateSignUpNickname.value =
  "New Player";

Promise.resolve(
  elements.accessGateSignUp.listeners.click()
).then(() => {
  assert.deepEqual(
    signUpRequest,
    {
      email: "new.player@example.com",
      password: "safe-password-123",
      nickname: "New Player"
    }
  );
  assert.equal(
    reloaded,
    true,
    "An immediately authenticated player must enter NOIR."
  );
  console.log(
    "Open email/password sign-up checks passed."
  );
});
