import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const allowedOrigin = "https://candi1505.github.io";

function corsHeaders(origin: string | null) {
  return {
    "access-control-allow-origin":
      origin === allowedOrigin
        ? allowedOrigin
        : allowedOrigin,
    "access-control-allow-headers":
      "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "POST, OPTIONS",
    "cache-control": "no-store",
    "vary": "origin",
  };
}

function json(
  origin: string | null,
  status: number,
  body: Record<string, unknown>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "content-type": "application/json",
    },
  });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async request => {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    if (origin !== allowedOrigin) {
      return json(origin, 403, {
        ok: false,
        message: "Registration is available from NOIR only.",
      });
    }

    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  if (
    request.method !== "POST" ||
    origin !== allowedOrigin
  ) {
    return json(origin, 403, {
      ok: false,
      message: "Registration is available from NOIR only.",
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json(origin, 503, {
      ok: false,
      message: "Registration is temporarily unavailable.",
    });
  }

  let requestBody: Record<string, unknown>;

  try {
    requestBody = await request.json();
  } catch {
    return json(origin, 400, {
      ok: false,
      message: "Enter a valid email and password.",
    });
  }

  const email = String(requestBody.email || "")
    .trim()
    .toLowerCase();
  const password = String(requestBody.password || "");
  const nickname = String(requestBody.nickname || "")
    .trim()
    .slice(0, 30) || "Player";

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254
  ) {
    return json(origin, 400, {
      ok: false,
      message: "Enter a valid email address.",
    });
  }

  if (password.length < 8 || password.length > 72) {
    return json(origin, 400, {
      ok: false,
      message:
        "Use a password between 8 and 72 characters.",
    });
  }

  const forwardedFor =
    request.headers.get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim() ||
    request.headers.get("cf-connecting-ip") ||
    "unknown";
  const ipHash = await sha256(
    `noir-registration:${forwardedFor}`,
  );

  const rateResponse = await fetch(
    `${supabaseUrl}/rest/v1/rpc/claim_noir_registration`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_ip_hash: ipHash }),
    },
  );

  const registrationAllowed =
    rateResponse.ok &&
    await rateResponse.json() === true;

  if (!registrationAllowed) {
    return json(origin, 429, {
      ok: false,
      message:
        "Too many account attempts. Please wait and try again.",
    });
  }

  const createResponse = await fetch(
    `${supabaseUrl}/auth/v1/admin/users`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { nickname },
      }),
    },
  );

  if (!createResponse.ok) {
    if (
      createResponse.status === 409 ||
      createResponse.status === 422
    ) {
      return json(origin, 409, {
        ok: false,
        message:
          "That email may already have an account. Try signing in or use Forgot password.",
      });
    }

    return json(origin, 503, {
      ok: false,
      message:
        "Registration is temporarily unavailable. Please try again.",
    });
  }

  return json(origin, 201, {
    ok: true,
    message: "Player account created.",
  });
});
