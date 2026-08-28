const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const forbiddenNames = [
  /(^|\/)\.env(?:\.|$)/i,
  /\.(?:har|zip)$/i,
  /\.(?:pem|key|p12|pfx)$/i,
  /(^|\/)(?:credentials?|client[_-]?secret|service[_-]?account)(?:\.|$)/i
];

const forbiddenContent = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsb_secret_[A-Za-z0-9_-]{16,}\b/,
  /\b(?:sk_live|rk_live)_[A-Za-z0-9_-]{16,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /["']authorization["']\s*:\s*["']Bearer\s+[A-Za-z0-9._~-]{24,}/i,
  /["']service_role(?:_key)?["']\s*[:=]\s*["'][A-Za-z0-9._~-]{24,}/i
];

const failures = [];

function looksLikeBinary(buffer) {
  const sample = buffer.subarray(
    0,
    Math.min(buffer.length, 8192)
  );
  return sample.includes(0);
}

function looksLikeHar(text) {
  return (
    /["']log["']\s*:\s*\{[\s\S]{0,1500}["']entries["']\s*:/i.test(text) ||
    (
      /["']entries["']\s*:\s*\[/i.test(text) &&
      /["']request["']\s*:/i.test(text) &&
      /["']response["']\s*:/i.test(text)
    )
  );
}

const selfTestCapture = JSON.stringify({
  log: {
    entries: [
      { request: {}, response: {} }
    ]
  }
});
if (!looksLikeHar(selfTestCapture)) {
  failures.push(
    "privacy gate self-test: HAR-shaped text was not detected"
  );
}

for (const file of tracked) {
  const normalised = file.replaceAll("\\", "/");
  if (forbiddenNames.some(pattern => pattern.test(normalised))) {
    failures.push(`${normalised}: private capture or credential filename is tracked`);
    continue;
  }

  if (normalised === "test-private-artifact-gate.cjs") continue;

  let buffer;
  try {
    buffer = readFileSync(normalised);
  } catch {
    continue;
  }

  if (looksLikeBinary(buffer)) continue;
  const text = buffer.toString("utf8");

  if (looksLikeHar(text)) {
    failures.push(`${normalised}: HAR-shaped private network capture content is tracked`);
    continue;
  }
  for (const pattern of forbiddenContent) {
    if (pattern.test(text)) {
      failures.push(`${normalised}: possible private credential material is tracked`);
      break;
    }
  }
}

if (failures.length) {
  console.error("Onyx privacy gate failed:\n" + failures.map(item => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`Onyx privacy gate passed (${tracked.length} tracked files checked).`);
