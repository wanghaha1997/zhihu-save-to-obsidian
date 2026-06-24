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

console.log("markdown output tests passed");

function assertIncludes(actual, expected, message) {
  if (!actual.includes(expected)) {
    throw new Error(`${message}，实际内容：${actual}`);
  }
}
