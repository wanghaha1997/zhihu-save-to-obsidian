const SERVICE_URL = "http://127.0.0.1:3721/save";
const titleElement = document.getElementById("title");
const authorElement = document.getElementById("author");
const urlElement = document.getElementById("url");
const statusElement = document.getElementById("status");
const saveButton = document.getElementById("save");
const candidateField = document.getElementById("candidateField");
const candidateSelect = document.getElementById("candidate");
let pageData = null;
let selectedCandidate = null;

document.addEventListener("DOMContentLoaded", init);
saveButton.addEventListener("click", saveToObsidian);
candidateSelect.addEventListener("change", selectCandidate);

async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      throw new Error("未找到当前标签页。");
    }

    const data = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_ZHIHU_PAGE" });
    pageData = data;
    selectedCandidate = getInitialCandidate(data);
    renderPageData(data);
    renderCandidateOptions(data);

    if (!selectedCandidate || !selectedCandidate.html) {
      setStatus("未能读取正文，暂时不能保存。", "error");
      return;
    }

    const warningText = data.warnings && data.warnings.length ? `\n${data.warnings.join("\n")}` : "";
    const candidateText = data.candidates && data.candidates.length > 1 ? `已找到 ${data.candidates.length} 段可保存内容，请选择其中一段。` : "已读取页面内容，可以保存。";
    setStatus(`${candidateText}${warningText}`);
    saveButton.disabled = false;
  } catch (error) {
    pageData = null;
    selectedCandidate = null;
    titleElement.textContent = "未能读取";
    authorElement.textContent = "未能读取";
    urlElement.textContent = "未能读取";
    saveButton.disabled = true;
    setStatus(`读取失败：${error.message}\n请确认当前标签页是知乎问题回答页或知乎专栏文章页。`, "error");
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
    const response = await fetch(SERVICE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source: "zhihu",
        title: pageData.title,
        author: selectedCandidate.author || pageData.author,
        url: pageData.url,
        html: selectedCandidate.html,
        savedAt: new Date().toISOString()
      })
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "保存失败");
    }

    setStatus(`保存成功：${result.path}`, "success");
  } catch (error) {
    setStatus(`保存失败：${error.message}\n请确认 Node.js 服务已经启动。`, "error");
    saveButton.disabled = false;
  }
}

function renderPageData(data) {
  titleElement.textContent = data.title || "未能获取标题";
  authorElement.textContent = selectedCandidate && selectedCandidate.author ? selectedCandidate.author : data.author || "未能获取作者";
  urlElement.textContent = data.url || "未能获取链接";
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
  setStatus("已切换保存内容，可以保存。");
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
