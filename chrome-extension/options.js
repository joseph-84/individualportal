const portalUrlInput = document.getElementById("portalUrl");
const tokenInput = document.getElementById("token");
const statusEl = document.getElementById("status");

async function load() {
  const { portalUrl, token } = await chrome.storage.local.get(["portalUrl", "token"]);
  if (portalUrl) portalUrlInput.value = portalUrl;
  if (token) tokenInput.value = token;
}

document.getElementById("save").addEventListener("click", async () => {
  const portalUrl = portalUrlInput.value.trim().replace(/\/+$/, "");
  const token = tokenInput.value.trim();
  if (!portalUrl || !token) {
    statusEl.textContent = "포털 URL과 토큰을 모두 입력하세요.";
    statusEl.style.color = "#a83326";
    return;
  }
  await chrome.storage.local.set({ portalUrl, token });
  statusEl.textContent = "저장되었습니다.";
  statusEl.style.color = "#2f7350";
});

load();
