import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import cors from "cors";
import express from "express";
import TurndownService from "turndown";

export {
  buildMarkdown
};

const app = express();
const HOST = "127.0.0.1";
const PORT = 3721;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(PROJECT_ROOT, "config.json");
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced"
});
const SOURCES = {
  zhihu: "知乎",
  caixin: "财新",
  zsxq: "知识星球"
};

app.disable("x-powered-by");
app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    const isChromeExtension = origin.startsWith("chrome-extension://");
    const isLocalDebug = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);

    if (isChromeExtension || isLocalDebug) {
      callback(null, true);
      return;
    }

    callback(new Error("不允许的跨域来源"));
  },
  methods: ["POST", "GET"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json({ limit: "10mb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/save", async (req, res, next) => {
  try {
    const payload = normalizePayload(req.body);
    const config = await readConfig();
    const targetDir = getTargetDir(config);
    await fs.mkdir(targetDir, { recursive: true });

    const markdown = buildMarkdown(payload);
    const targetPath = await getAvailableFilePath(targetDir, payload.title);

    await fs.writeFile(targetPath, markdown, "utf8");

    console.log(`已保存：${targetPath}`);
    res.json({
      ok: true,
      path: targetPath
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    error.statusCode = 400;
    error.message = "请求体不是合法 JSON";
  }

  const status = error.statusCode || 500;
  const message = status === 500 ? "保存失败，请查看 Node.js 服务日志" : error.message;
  console.error(error.message);
  res.status(status).json({
    ok: false,
    error: message
  });
});

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(PORT, HOST, () => {
    console.log(`保存到 Obsidian 服务已启动：http://${HOST}:${PORT}`);
  });
}

async function readConfig() {
  let rawConfig;

  try {
    rawConfig = await fs.readFile(CONFIG_PATH, "utf8");
  } catch (error) {
    throw userError(`找不到配置文件：${CONFIG_PATH}`);
  }

  let config;

  try {
    config = JSON.parse(rawConfig);
  } catch (error) {
    throw userError("config.json 不是合法 JSON，请检查逗号和引号");
  }

  if (!config.vaultPath || typeof config.vaultPath !== "string") {
    throw userError("config.json 缺少 vaultPath");
  }

  if (!path.isAbsolute(config.vaultPath)) {
    throw userError("config.json 的 vaultPath 必须是绝对路径");
  }

  if (!config.saveFolder || typeof config.saveFolder !== "string") {
    throw userError("config.json 缺少 saveFolder");
  }

  return config;
}

function getTargetDir(config) {
  const saveFolder = path.normalize(config.saveFolder);

  if (path.isAbsolute(saveFolder) || saveFolder.startsWith("..")) {
    throw userError("saveFolder 只能是 Vault 内的相对目录");
  }

  return path.join(config.vaultPath, saveFolder);
}

function normalizePayload(body) {
  if (!body || typeof body !== "object") {
    throw userError("请求体必须是 JSON 对象");
  }

  const title = cleanText(body.title) || "未命名知乎内容";
  const author = cleanText(body.author) || "未知作者";
  const url = cleanText(body.url);
  const html = typeof body.html === "string" ? body.html : "";
  const savedAt = parseSavedAt(body.savedAt);

  if (!SOURCES[body.source]) {
    throw userError(`source 必须是以下值之一：${Object.keys(SOURCES).join(", ")}`);
  }

  if (!url) {
    throw userError("缺少原文链接 url");
  }

  if (!html.trim()) {
    throw userError("正文 HTML 为空，请确认知乎页面正文已经加载完成");
  }

  return {
    source: body.source,
    title,
    author,
    url,
    html,
    savedAt
  };
}

function buildMarkdown(payload) {
  const markdownBody = turndownService.turndown(payload.html).trim();
  const savedDate = payload.savedAt.slice(0, 10);
  const title = escapeYamlValue(payload.title);
  const authorLink = createObsidianLink(payload.author);
  const author = escapeYamlValue(authorLink);
  const url = escapeYamlValue(payload.url);
  const sourceLabel = SOURCES[payload.source] || payload.source;

  return `---\ntitle: ${title}\nauthor: ${author}\nsource: ${sourceLabel}\nurl: ${url}\nsaved_at: ${savedDate}\ntags:\n  - ${sourceLabel}\n  - 待整理\n---\n\n# ${payload.title}\n\n> 作者：${authorLink}\n> 原文：${payload.url}\n\n${markdownBody}\n`;
}

async function getAvailableFilePath(targetDir, title) {
  const baseName = sanitizeFileName(title) || "未命名知乎内容";
  let candidate = path.join(targetDir, `${baseName}.md`);

  for (let index = 1; await fileExists(candidate); index += 1) {
    candidate = path.join(targetDir, `${baseName}-${index}.md`);
  }

  return candidate;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

function sanitizeFileName(fileName) {
  return fileName
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function cleanText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function parseSavedAt(value) {
  if (typeof value !== "string") {
    return new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function escapeYamlValue(value) {
  return JSON.stringify(value);
}

function createObsidianLink(value) {
  const linkTarget = cleanObsidianLinkTarget(value);
  return `[[${linkTarget || "未知作者"}]]`;
}

function cleanObsidianLinkTarget(value) {
  return cleanText(value)
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .replace(/[#[\]^|]/g, "")
    .trim();
}

function userError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}
