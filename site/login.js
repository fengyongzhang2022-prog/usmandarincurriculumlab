const form = document.getElementById("loginForm");
const usernameInput = document.getElementById("loginUsername");
const passwordInput = document.getElementById("loginPassword");
const statusNode = document.getElementById("loginStatus");
const button = document.getElementById("loginButton");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    statusNode.textContent = "请输入账号和密码。";
    return;
  }

  button.disabled = true;
  statusNode.textContent = "正在验证，请稍候…";

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "登录失败，请检查账号或密码。");
    }

    const next = new URLSearchParams(window.location.search).get("next") || "/";
    window.location.href = next;
  } catch (error) {
    statusNode.textContent = error.message || "登录失败，请稍后重试。";
  } finally {
    button.disabled = false;
  }
});
