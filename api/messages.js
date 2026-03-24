import fs from "node:fs";
import path from "node:path";
import { readJsonBody, sendMethodNotAllowed } from "./_lib/http.js";

const ROOT = path.resolve(process.cwd());
const MESSAGE_DIR = path.join(ROOT, "data");
const MESSAGE_LOG = path.join(MESSAGE_DIR, "messages.jsonl");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendMethodNotAllowed(res, ["POST"]);
    return;
  }

  const body = await readJsonBody(req);
  const name = String(body?.name || "").trim();
  const email = String(body?.email || "").trim();
  const message = String(body?.message || "").trim();

  if (!message) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  fs.mkdirSync(MESSAGE_DIR, { recursive: true });
  fs.appendFileSync(
    MESSAGE_LOG,
    JSON.stringify({
      createdAt: new Date().toISOString(),
      name,
      email,
      message,
    }) + "\n",
    "utf8"
  );

  res.status(200).json({ ok: true });
}
