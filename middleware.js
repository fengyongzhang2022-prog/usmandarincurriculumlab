const USERNAME = process.env.SITE_USERNAME || "teacher";
const PASSWORD = process.env.SITE_PASSWORD || "";

export default function middleware(request) {
  if (!PASSWORD) {
    return;
  }

  const authHeader = request.headers.get("authorization") || "";
  const expected = `Basic ${base64(`${USERNAME}:${PASSWORD}`)}`;

  if (authHeader === expected) {
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
