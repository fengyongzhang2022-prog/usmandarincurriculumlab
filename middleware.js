const USERNAME = process.env.SITE_USERNAME || "teacher";
const PASSWORD = process.env.SITE_PASSWORD || "";
const PASSWORD_HASH = (process.env.SITE_PASSWORD_HASH || "").trim().toLowerCase();

export default async function middleware(request) {
  if (!PASSWORD && !PASSWORD_HASH) {
    return;
  }

  const authHeader = request.headers.get("authorization") || "";
  const credentials = parseBasic(authHeader);

  if (credentials && credentials.username === USERNAME && await matchesPassword(credentials.password)) {
    return;
  }

  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="ACTFL Teacher Dashboard"',
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  matcher: "/:path*",
};

function base64(value) {
  if (typeof btoa === "function") {
    return btoa(value);
  }
  return Buffer.from(value).toString("base64");
}

function parseBasic(header) {
  if (!header.startsWith("Basic ")) return null;
  const decoded = decodeBase64(header.slice(6));
  const pivot = decoded.indexOf(":");
  if (pivot < 0) return null;
  return {
    username: decoded.slice(0, pivot),
    password: decoded.slice(pivot + 1),
  };
}

function decodeBase64(value) {
  if (typeof atob === "function") {
    return atob(value);
  }
  return Buffer.from(value, "base64").toString("utf8");
}

async function matchesPassword(password) {
  if (PASSWORD_HASH) {
    return (await sha256Hex(password)) === PASSWORD_HASH;
  }
  return password === PASSWORD;
}

async function sha256Hex(value) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}
