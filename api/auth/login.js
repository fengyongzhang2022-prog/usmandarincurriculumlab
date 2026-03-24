import crypto from "node:crypto";
import { readJsonBody, sendMethodNotAllowed } from "../_lib/http.js";

const USERNAME = process.env.SITE_USERNAME || "teacher";
const PASSWORD = process.env.SITE_PASSWORD || "";
const PASSWORD_HASH = (process.env.SITE_PASSWORD_HASH || "").trim().toLowerCase();
const COOKIE_NAME = "actfl_auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendMethodNotAllowed(res, ["POST"]);
    return;
  }

  const body = await readJsonBody(req);
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");

  if ((!PASSWORD && !PASSWORD_HASH) || username !== USERNAME || !matchesPassword(password)) {
    res.status(401).json({ error: "账号或密码错误。" });
    return;
  }

  const secret = PASSWORD_HASH || crypto.createHash("sha256").update(PASSWORD).digest("hex");
  const value = crypto.createHash("sha256").update(`${USERNAME}:${secret}`).digest("hex");
  const maxAge = 60 * 60 * 24 * 14;
  const secure = process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`
  );
  res.status(200).json({ ok: true });
}

function matchesPassword(password) {
  if (PASSWORD_HASH) {
    const digest = crypto.createHash("sha256").update(password).digest("hex");
    return digest === PASSWORD_HASH;
  }
  return password === PASSWORD;
}
