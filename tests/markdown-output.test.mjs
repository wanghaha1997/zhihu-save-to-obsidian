import { buildMarkdown } from "../server/index.js";

const markdown = buildMarkdown({
  source: "zhihu",
  title: "测试标题",
  author: "答主 A",
  url: "https://www.zhihu.com/question/1/answer/2",
  html: "<p>测试正文。</p>",
  savedAt: "2026-06-24T12:00:00.000Z"
});

assertIncludes(markdown, 'author: "[[答主 A]]"', "frontmatter 作者应保存为 Obsidian 内部链接");
assertIncludes(markdown, "> 作者：[[答主 A]]", "正文作者应保存为 Obsidian 内部链接");
assertIncludes(markdown, "测试正文。", "正文转换失败");

const escapedMarkdown = buildMarkdown({
  source: "zhihu",
  title: "测试标题",
  author: "[[答主|A]]",
  url: "https://www.zhihu.com/question/1/answer/2",
  html: "<p>测试正文。</p>",
  savedAt: "2026-06-24T12:00:00.000Z"
});

assertIncludes(escapedMarkdown, 'author: "[[答主A]]"', "作者内部链接应清理 Obsidian 链接特殊字符");

const caixinMarkdown = buildMarkdown({
  source: "caixin",
  title: "财新测试标题",
  author: "于海荣",
  url: "https://economy.caixin.com/2026-06-24/102457132.html",
  html: "<p>财新测试正文。</p>",
  savedAt: "2026-06-24T12:00:00.000Z"
});

assertIncludes(caixinMarkdown, "source: 财新", "财新 source 应写入中文来源");
assertIncludes(caixinMarkdown, "  - 财新", "财新标签应写入 Markdown");
assertIncludes(caixinMarkdown, 'author: "[[于海荣]]"', "财新作者应保存为 Obsidian 内部链接");

console.log("markdown output tests passed");

function assertIncludes(actual, expected, message) {
  if (!actual.includes(expected)) {
    throw new Error(`${message}，实际内容：${actual}`);
  }
}
