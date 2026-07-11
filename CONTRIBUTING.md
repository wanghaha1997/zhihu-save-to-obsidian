# 参与贡献

感谢你帮助改进“中文网页保存到 Obsidian”。这个项目优先保持本地运行、隐私友好和安装简单。

## 开发环境

- Node.js 20.19.0 或更高版本
- Chrome 或其他支持 Manifest V3 的 Chromium 浏览器

```bash
npm install
cp config.example.json config.json
npm test
```

修改 `config.json` 时只填写自己的本地路径，不要提交该文件。

## 提交问题

请优先使用仓库中的 Bug 或功能建议模板。网站 DOM 结构变化时，可以提供最小、脱敏后的 HTML 结构，但不要提交：

- Cookie、Token、密码或请求头
- 付费文章正文或大段受版权保护内容
- 真实用户名、本地 Vault 路径或其他个人信息

## 修改代码

1. 保持改动聚焦，一个 PR 解决一个问题。
2. 页面提取逻辑放在 `extension/content.js`，本地保存和 Markdown 转换逻辑放在 `server/index.js`。
3. 新增或修改选择器时，在 `tests/content-extraction.test.mjs` 中增加最小 DOM 用例。
4. 修改 Markdown 输出时，更新 `tests/markdown-output.test.mjs`。
5. 提交前运行 `npm test`。

本项目不计划加入账号系统、云端正文存储、绕过登录或付费限制、批量抓取网站内部接口等功能。
