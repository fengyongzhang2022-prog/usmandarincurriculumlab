const USERNAME = process.env.SITE_USERNAME || "teacher";
const PASSWORD = process.env.SITE_PASSWORD || "";
const PASSWORD_HASH = (process.env.SITE_PASSWORD_HASH || "").trim().toLowerCase();
const COOKIE_NAME = "actfl_auth";

export default async function middleware(request) {
  if (!PASSWORD && !PASSWORD_HASH) {
    return;
  }

  const url = new URL(request.url);
  const pathname = url.pathname;
  const search = url.search || "";
  if (
    pathname === "/login" ||
    pathname === "/login.html" ||
    pathname === "/login.js" ||
    pathname === "/styles.css" ||
    pathname === "/api/auth/login" ||
    pathname.startsWith("/docx-media/") ||
    pathname.startsWith("/favicon")
  ) {
    return;
  }

  const authCookie = parseCookie(request.headers.get("cookie") || "", COOKIE_NAME);
  if (authCookie && authCookie === (await expectedCookieValue())) {
    return;
  }

  const loginUrl = new URL("/login.html", request.url);
  if (pathname !== "/") {
    loginUrl.searchParams.set("next", `${pathname}${search || ""}`);
  }
  return Response.redirect(loginUrl, 302);
}

export const config = {
  matcher: "/:path*",
};

async function expectedCookieValue() {
  const secret = PASSWORD_HASH || (await sha256Hex(PASSWORD));
  return sha256Hex(`${USERNAME}:${secret}`);
}

async function sha256Hex(value) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

function parseCookie(header, name) {
  const items = String(header || "").split(/;\s*/);
  for (const item of items) {
    const [key, ...rest] = item.split("=");
    if (key === name) {
      return rest.join("=");
    }
  }
  return "";
}
