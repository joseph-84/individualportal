import { callMcpTool } from "./mcp-client.js";

const setupNotice = document.getElementById("setupNotice");
const form = document.getElementById("form");
const titleInput = document.getElementById("title");
const urlInput = document.getElementById("url");
const folderInput = document.getElementById("folder");
const foldersDatalist = document.getElementById("folders");
const saveButton = document.getElementById("save");
const messageEl = document.getElementById("message");

function showMessage(text, isError) {
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#a83326" : "#2f7350";
}

document.getElementById("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

async function init() {
  const { portalUrl, token } = await chrome.storage.local.get(["portalUrl", "token"]);
  if (!portalUrl || !token) {
    setupNotice.style.display = "block";
    return;
  }
  form.style.display = "block";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  titleInput.value = tab?.title || "";
  urlInput.value = tab?.url || "";

  // Best-effort folder autocomplete -- if this call fails (bad token, unreachable portal),
  // just leave the datalist empty rather than blocking the form; the save attempt below will
  // surface a clear error if the setup is actually broken.
  try {
    const favorites = await callMcpTool(portalUrl, token, "list_favorites", {});
    const folders = Array.from(new Set((favorites || []).map((f) => f.folder).filter(Boolean)));
    for (const folder of folders) {
      const option = document.createElement("option");
      option.value = folder;
      foldersDatalist.appendChild(option);
    }
  } catch {
    // ignore -- see comment above
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    saveButton.disabled = true;
    showMessage("저장 중...", false);
    try {
      await callMcpTool(portalUrl, token, "create_favorite", {
        title: titleInput.value.trim(),
        url: urlInput.value.trim(),
        folder: folderInput.value.trim() || undefined,
      });
      showMessage("저장되었습니다.", false);
      setTimeout(() => window.close(), 600);
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "저장에 실패했습니다.", true);
      saveButton.disabled = false;
    }
  });
}

init();
