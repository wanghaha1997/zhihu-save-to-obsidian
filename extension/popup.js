const SERVICE_BASE_URL = "http://127.0.0.1:3721";
const SAVE_URL = `${SERVICE_BASE_URL}/save`;
const CONFIG_URL = `${SERVICE_BASE_URL}/config`;
const SELECT_FOLDER_URL = `${SERVICE_BASE_URL}/select-folder`;
const titleElement = document.getElementById("title");
const authorElement = document.getElementById("author");
const urlElement = document.getElementById("url");
const statusElement = document.getElementById("status");
const saveButton = document.getElementById("save");
const chooseVaultButton = document.getElementById("chooseVault");
const saveConfigButton = document.getElementById("saveConfig");
const candidateField = document.getElementById("candidateField");
const candidateSelect = document.getElementById("candidate");
const commentField = document.getElementById("commentField");
const commentModeSelect = document.getElementById("commentMode");
const vaultPathInput = document.getElementById("vaultPath");
const saveFolderInput = document.getElementById("saveFolder");
const targetDirElement = document.getElementById("targetDir");
let pageData = null;
let selectedCandidate = null;

document.addEventListener("DOMContentLoaded", init);
saveButton.addEventListener("click", saveToObsidian);
chooseVaultButton.addEventListener("click", chooseVaultFolder);
saveConfigButton.addEventListener("click", saveConfig);
candidateSelect.addEventListener("change", selectCandidate);
commentModeSelect.addEventListener("change", updateCommentStatus);

async function init() {
  try {
    loadConfig();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      throw new Error("未找到当前标签页。");
    }

    setStatus("正在读取页面内容...");
    const data = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE" });
    pageData = data;
    selectedCandidate = getInitialCandidate(data);
    renderPageData(data);
    renderCandidateOptions(data);
    renderCommentOptions(data);

    if (!selectedCandidate || !selectedCandidate.html) {
      setStatus("未能读取正文，暂时不能保存。", "error");
      return;
    }

    const warningText = data.warnings && data.warnings.length ? `\n${data.warnings.join("\n")}` : "";
    const candidateText = data.candidates && data.candidates.length > 1 ? `已找到 ${data.candidates.length} 段可保存内容，请选择其中一段。` : "已读取页面内容，可以保存。";
    setStatus(`${candidateText}${getCommentStatusSuffix()}${warningText}`);
    saveButton.disabled = false;
  } catch (error) {
    pageData = null;
    selectedCandidate = null;
    titleElement.textContent = "未能读取";
    authorElement.textContent = "未能读取";
    urlElement.textContent = "未能读取";
    saveButton.disabled = true;
    setStatus(`读取失败：${error.message}\n请确认当前标签页是知乎问题回答页、知乎专栏文章页、财新文章页或知识星球内容页。`, "error");
  }
}

async function saveToObsidian() {
  if (!pageData || !selectedCandidate || !selectedCandidate.html) {
    setStatus("没有可保存的正文内容。", "error");
    return;
  }

  saveButton.disabled = true;
  setStatus("正在保存...");

  try {
    const saveCandidate = selectedCandidate;
    const saveTitle = getCandidateTitle(pageData, selectedCandidate);
    const comments = filterComments(saveCandidate.comments || [], commentModeSelect.value, saveCandidate.author);

    const response = await fetch(SAVE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source: pageData.source,
        title: saveTitle,
        author: saveCandidate.author || pageData.author,
        url: saveCandidate.url || pageData.url,
        html: saveCandidate.html,
        comments,
        planet: pageData.planet || saveCandidate.planet || "",
        publishedAt: saveCandidate.publishedAt || pageData.publishedAt || "",
        savedAt: new Date().toISOString()
      })
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "保存失败");
    }

    setStatus(`保存成功：${result.path}`, "success");
    saveButton.disabled = false;
  } catch (error) {
    setStatus(`保存失败：${error.message}\n请确认 Node.js 服务已经启动。`, "error");
    saveButton.disabled = false;
  }
}

async function loadConfig() {
  try {
    const response = await fetch(CONFIG_URL);
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "读取保存目录失败");
    }

    renderConfig(result.config);
  } catch (error) {
    targetDirElement.textContent = "未连接本地服务";
  }
}

async function chooseVaultFolder() {
  chooseVaultButton.disabled = true;
  setStatus("正在打开文件夹选择窗口...");

  try {
    const response = await fetch(SELECT_FOLDER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        saveFolder: saveFolderInput.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "选择文件夹失败");
    }

    renderConfig(result.config);
    setStatus(`保存目录已更新：${result.config.targetDir}`, "success");
  } catch (error) {
    setStatus(`选择文件夹失败：${error.message}\n请确认 Node.js 服务已经启动。`, "error");
  } finally {
    chooseVaultButton.disabled = false;
  }
}

async function saveConfig() {
  const vaultPath = vaultPathInput.value.trim();
  const saveFolder = saveFolderInput.value.trim();

  if (!vaultPath || !saveFolder) {
    setStatus("请填写 Vault 路径和 Vault 内文件夹。", "error");
    return;
  }

  saveConfigButton.disabled = true;
  setStatus("正在更新保存目录...");

  try {
    const response = await fetch(CONFIG_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        vaultPath,
        saveFolder
      })
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "更新保存目录失败");
    }

    renderConfig(result.config);
    setStatus(`保存目录已更新：${result.config.targetDir}`, "success");
  } catch (error) {
    setStatus(`保存目录更新失败：${error.message}\n请确认 Node.js 服务已经启动，并检查路径是否正确。`, "error");
  } finally {
    saveConfigButton.disabled = false;
  }
}

function renderConfig(config) {
  vaultPathInput.value = config.vaultPath || "";
  saveFolderInput.value = config.saveFolder || "";
  targetDirElement.textContent = config.targetDir || "未设置";
}

function renderPageData(data) {
  titleElement.textContent = getCandidateTitle(data, selectedCandidate) || "未能获取标题";
  authorElement.textContent = selectedCandidate && selectedCandidate.author ? selectedCandidate.author : data.author || "未能获取作者";
  urlElement.textContent = (selectedCandidate && selectedCandidate.url) || data.url || "未能获取链接";
}

function getCandidateTitle(data, candidate) {
  if (candidate && candidate.title) {
    return candidate.title;
  }

  if (data.source === "zsxq" && candidate && candidate.textPreview) {
    return candidate.textPreview.slice(0, 42);
  }

  return data.title || "";
}

function renderCandidateOptions(data) {
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];

  candidateSelect.textContent = "";

  if (candidates.length <= 1) {
    candidateField.classList.add("hidden");
    return;
  }

  for (const candidate of candidates) {
    const option = document.createElement("option");
    option.value = candidate.id;
    option.textContent = candidate.label || candidate.author || candidate.id;
    candidateSelect.appendChild(option);
  }

  candidateSelect.value = selectedCandidate ? selectedCandidate.id : candidates[0].id;
  candidateField.classList.remove("hidden");
}

function selectCandidate() {
  if (!pageData || !Array.isArray(pageData.candidates)) {
    return;
  }

  selectedCandidate = pageData.candidates.find((candidate) => candidate.id === candidateSelect.value) || getInitialCandidate(pageData);
  renderPageData(pageData);

  if (!selectedCandidate || !selectedCandidate.html) {
    saveButton.disabled = true;
    setStatus("当前选择没有可保存的正文内容。", "error");
    return;
  }

  saveButton.disabled = false;
  setStatus(`已切换保存内容，可以保存。${getCommentStatusSuffix()}`);
}

function renderCommentOptions(data) {
  if (data.source !== "zsxq") {
    commentField.classList.add("hidden");
    return;
  }

  commentField.classList.remove("hidden");
  commentModeSelect.value = "none";
}

function updateCommentStatus() {
  if (!selectedCandidate || !selectedCandidate.html) {
    return;
  }

  setStatus(`已更新评论范围，可以保存。${getCommentStatusSuffix()}`);
}

function getCommentStatusSuffix() {
  if (!pageData || pageData.source !== "zsxq" || !selectedCandidate) {
    return "";
  }

  const comments = Array.isArray(selectedCandidate.comments) ? selectedCandidate.comments : [];
  const filtered = filterComments(comments, commentModeSelect.value, selectedCandidate.author);

  if (comments.length === 0) {
    return "\n当前页面未读取到已显示评论。";
  }

  if (commentModeSelect.value === "none") {
    return `\n已读取到 ${comments.length} 条页面已显示评论，本次不会保存评论。`;
  }

  if (commentModeSelect.value === "author") {
    return `\n将保存 ${filtered.length}/${comments.length} 条页面已显示的答主回复。`;
  }

  return `\n将保存 ${filtered.length} 条页面已显示评论。`;
}

function filterComments(comments, commentMode, topicAuthor) {
  if (commentMode === "none") {
    return [];
  }

  if (commentMode === "author") {
    return comments.filter((comment) => isSameAuthor(comment.author, topicAuthor));
  }

  return comments;
}

function isSameAuthor(left, right) {
  return normalizeAuthorName(left) === normalizeAuthorName(right);
}

function normalizeAuthorName(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function getInitialCandidate(data) {
  if (Array.isArray(data.candidates) && data.candidates.length > 0) {
    return data.candidates[0];
  }

  if (data.html) {
    return {
      id: "current",
      label: data.author || "当前正文",
      author: data.author,
      html: data.html,
      url: data.url
    };
  }

  return null;
}

function setStatus(message, type) {
  statusElement.textContent = message;
  statusElement.className = type || "";
}
