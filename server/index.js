import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import cors from "cors";
import express from "express";
import TurndownService from "turndown";

export {
  buildMarkdown,
  getTargetDir,
  normalizeConfig
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

app.get("/config", async (req, res, next) => {
  try {
    const config = await readConfig();
    res.json({
      ok: true,
      config: createConfigResponse(config)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/config", async (req, res, next) => {
  try {
    const config = normalizeConfig(req.body);
    const targetDir = getTargetDir(config);

    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");

    console.log(`已更新保存目录：${targetDir}`);
    res.json({
      ok: true,
      config: createConfigResponse(config)
    });
  } catch (error) {
    next(error);
  }
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

  return normalizeConfig(config);
}

function normalizeConfig(body) {
  if (!body || typeof body !== "object") {
    throw userError("配置必须是 JSON 对象");
  }

  const vaultPath = cleanPathText(body.vaultPath);
  const saveFolder = cleanPathText(body.saveFolder);

  if (!vaultPath) {
    throw userError("config.json 缺少 vaultPath");
  }

  if (!path.isAbsolute(vaultPath)) {
    throw userError("config.json 的 vaultPath 必须是绝对路径");
  }

  if (!saveFolder) {
    throw userError("config.json 缺少 saveFolder");
  }

  const normalizedSaveFolder = path.normalize(saveFolder).replace(/[\\/]+$/g, "");

  if (
    path.isAbsolute(normalizedSaveFolder) ||
    normalizedSaveFolder === "." ||
    normalizedSaveFolder === ".." ||
    normalizedSaveFolder.startsWith(`..${path.sep}`)
  ) {
    throw userError("saveFolder 只能是 Vault 内的相对目录");
  }

  return {
    vaultPath,
    saveFolder: normalizedSaveFolder
  };
}

function getTargetDir(config) {
  return path.join(config.vaultPath, config.saveFolder);
}

function createConfigResponse(config) {
  return {
    vaultPath: config.vaultPath,
    saveFolder: config.saveFolder,
    targetDir: getTargetDir(config)
  };
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
    savedAt,
    planet: cleanText(body.planet),
    publishedAt: cleanText(body.publishedAt),
    comments: normalizeComments(body.comments)
  };
}

function normalizeComments(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((comment) => ({
      author: cleanText(comment.author) || "未知评论者",
      time: cleanText(comment.time),
      text: typeof comment.text === "string" ? comment.text.trim() : "",
      html: typeof comment.html === "string" ? comment.html : ""
    }))
    .filter((comment) => comment.text || comment.html);
}

function buildMarkdown(payload) {
  let markdownBody = turndownService.turndown(payload.html).trim();

  if (payload.source === "zsxq") {
    markdownBody = postProcessZsxqMarkdown(markdownBody, payload.planet);
  }

  const commentsSection = buildCommentsMarkdown(payload.comments);
  const savedDate = payload.savedAt.slice(0, 10);
  const title = escapeYamlValue(payload.title);
  const authorLink = createObsidianLink(payload.author);
  const author = escapeYamlValue(authorLink);
  const url = escapeYamlValue(payload.url);
  const sourceLabel = SOURCES[payload.source] || payload.source;
  const planetLine = payload.planet ? `planet: ${escapeYamlValue(payload.planet)}\n` : "";
  const publishedLine = payload.publishedAt ? `published_at: ${escapeYamlValue(payload.publishedAt.slice(0, 10))}\n` : "";
  const planetTag = payload.planet ? `\n  - ${sanitizeYamlListItem(payload.planet)}` : "";
  const intro = payload.source === "zsxq"
    ? buildZsxqIntro(payload)
    : `\n\n# ${payload.title}\n\n> 作者：${authorLink}\n> 原文：${payload.url}\n\n`;

  return `---\ntitle: ${title}\nauthor: ${author}\nsource: ${sourceLabel}\n${planetLine}${publishedLine}url: ${url}\nsaved_at: ${savedDate}\ntags:\n  - ${sourceLabel}${planetTag}\n  - 待整理\n---${intro}${markdownBody}${commentsSection}`;
}

function buildZsxqIntro(payload) {
  const authorLink = createObsidianLink(payload.author);
  const parts = [authorLink];

  if (payload.planet) {
    parts.push(`[[${cleanObsidianLinkTarget(payload.planet)}]]`);
  }

  if (payload.publishedAt) {
    parts.push(payload.publishedAt.slice(0, 10));
  }

  parts.push(`[原文](${payload.url})`);
  return `\n\n> ${parts.join(" · ")}\n\n`;
}

function buildCommentsMarkdown(comments) {
  if (!Array.isArray(comments) || comments.length === 0) {
    return "";
  }

  const items = comments.map((comment) => {
    const authorLink = createObsidianLink(comment.author);
    const meta = comment.time ? `${authorLink} · ${comment.time}` : authorLink;
    const body = comment.text || turndownService.turndown(comment.html || "").trim();
    return `### ${meta}\n\n${body}`;
  });

  return `\n\n## 评论（${comments.length}）\n\n${items.join("\n\n---\n\n")}\n`;
}

function postProcessZsxqMarkdown(markdown, planet) {
  let result = markdown
    .replace(/知识星球([\u4e00-\u9fa5A-Za-z0-9·]+)/g, "[[$1]]")
    .replace(/\s+-\s*(?=[\u4e00-\u9fa5A-Za-z])/g, "\n\n- ")
    .replace(/([。！？])\s+(?=[\u4e00-\u9fa5A-Za-z0-9])/g, "$1\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (planet) {
    const planetLink = `[[${cleanObsidianLinkTarget(planet)}]]`;
    result = result.replace(new RegExp(planetLink, "g"), planetLink);
  }

  return result;
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

function cleanPathText(value) {
  return typeof value === "string" ? value.trim() : "";
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

function sanitizeYamlListItem(value) {
  return cleanText(value)
    .replace(/[\r\n]/g, " ")
    .replace(/#/g, "")
    .replace(/:/g, "")
    .trim();
}

function userError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}
