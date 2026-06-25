(function () {
  function extractCurrentPage() {
    if (isCaixinPage()) {
      return extractCaixinPage();
    }

    if (isZsxqPage()) {
      return extractZsxqPage();
    }

    return extractZhihuPage();
  }

  function extractZhihuPage() {
    const title = getFirstText([
      "h1",
      ".QuestionHeader-title",
      ".Post-Title",
      ".ContentItem-title"
    ]);
    const candidates = getContentCandidates();
    const selectedCandidate = candidates[0] || null;
    const author = selectedCandidate ? selectedCandidate.author : getPageAuthor();
    const html = selectedCandidate ? selectedCandidate.html : "";
    const warnings = [];

    if (!title) {
      warnings.push("未能获取标题，将使用页面标题或默认标题。");
    }

    if (!author) {
      warnings.push("未能获取作者，将保存为未知作者。");
    }

    if (!html) {
      warnings.push("未能获取正文，请确认知乎正文已经加载完成。");
    }

    return {
      source: "zhihu",
      title: title || document.title || "未命名知乎内容",
      author: author || "未知作者",
      url: location.href,
      html,
      candidates,
      warnings
    };
  }

  function extractCaixinPage() {
    const title = getMetaContent(["og:title", "twitter:title"]) || getFirstText([
      "h1",
      ".article-title",
      ".articleTit",
      ".title"
    ]);
    const author = getCaixinAuthor();
    const contentElement = getBestCaixinContentElement();
    const html = contentElement ? cleanContentHtml(contentElement) : "";
    const text = contentElement ? normalizeText(contentElement.textContent) : "";
    const warnings = [];

    if (!title) {
      warnings.push("未能获取标题，将使用页面标题或默认标题。");
    }

    if (!author) {
      warnings.push("未能获取作者，将保存为未知作者。");
    }

    if (!html) {
      warnings.push("未能获取正文，请确认财新文章正文已经加载完成。");
    }

    const normalizedTitle = stripCaixinTitle(title || document.title || "未命名财新内容");
    const normalizedAuthor = author || "未知作者";
    const candidates = html ? [{
      id: "article",
      label: buildCandidateLabel(1, normalizedAuthor, text),
      author: normalizedAuthor,
      html,
      textPreview: text.slice(0, 80),
      url: location.href
    }] : [];

    return {
      source: "caixin",
      title: normalizedTitle,
      author: normalizedAuthor,
      url: location.href,
      html,
      candidates,
      warnings
    };
  }

  function extractZsxqPage() {
    const candidates = getZsxqCandidates();
    const selectedCandidate = candidates[0] || null;
    const title = getZsxqTitle(selectedCandidate);
    const author = selectedCandidate ? selectedCandidate.author : getZsxqPageAuthor();
    const html = selectedCandidate ? selectedCandidate.html : "";
    const warnings = [];

    if (!title) {
      warnings.push("未能获取标题，将使用页面标题或默认标题。");
    }

    if (!author) {
      warnings.push("未能获取作者，将保存为未知作者。");
    }

    if (!html) {
      warnings.push("未能获取正文，请确认知识星球内容已经加载完成。");
    }

    return {
      source: "zsxq",
      title: title || document.title || "未命名知识星球内容",
      author: author || "未知作者",
      url: location.href,
      html,
      candidates,
      warnings
    };
  }

  function getFirstText(selectors) {
    for (const selector of selectors) {
      const elements = Array.from(document.querySelectorAll(selector));
      const match = elements
        .map((element) => normalizeText(element.textContent))
        .find(Boolean);

      if (match) {
        return match;
      }
    }

    return "";
  }

  function getContentCandidates() {
    if (location.hostname === "zhuanlan.zhihu.com") {
      return getArticleCandidates();
    }

    const contentElements = Array.from(document.querySelectorAll(".RichContent-inner, .RichText"));
    const seenContentElements = new Set();
    const seenContainers = new Set();
    const seenTextFingerprints = new Set();
    const candidates = [];

    for (const contentElement of contentElements) {
      if (seenContentElements.has(contentElement)) {
        continue;
      }

      seenContentElements.add(contentElement);

      const html = contentElement.innerHTML.trim();
      const text = normalizeText(contentElement.textContent);

      if (!html || !text) {
        continue;
      }

      const container = contentElement.closest(".AnswerItem, .List-item, .ContentItem") || contentElement.parentElement;

      if (container && seenContainers.has(container)) {
        continue;
      }

      const textFingerprint = getTextFingerprint(text);

      if (seenTextFingerprints.has(textFingerprint)) {
        continue;
      }

      if (container) {
        seenContainers.add(container);
      }

      seenTextFingerprints.add(textFingerprint);

      const author = getContainerAuthor(container) || getPageAuthor() || "未知作者";

      candidates.push({
        id: `candidate-${candidates.length + 1}`,
        label: buildCandidateLabel(candidates.length + 1, author, text),
        author,
        html,
        textPreview: text.slice(0, 80),
        url: location.href
      });
    }

    return candidates;
  }

  function getArticleCandidates() {
    const contentElement = getFirstElement([
      ".Post-RichTextContainer",
      ".RichContent-inner",
      ".RichText"
    ]);

    if (!contentElement) {
      return [];
    }

    const html = contentElement.innerHTML.trim();
    const text = normalizeText(contentElement.textContent);

    if (!html || !text) {
      return [];
    }

    const author = getPageAuthor() || "未知作者";

    return [{
      id: "article",
      label: buildCandidateLabel(1, author, text),
      author,
      html,
      textPreview: text.slice(0, 80),
      url: location.href
    }];
  }

  function getFirstElement(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);

      if (element) {
        return element;
      }
    }

    return null;
  }

  function getMetaContent(names) {
    for (const name of names) {
      const element = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
      const content = element ? normalizeText(element.getAttribute("content")) : "";

      if (content) {
        return content;
      }
    }

    return "";
  }

  function getCaixinAuthor() {
    const metaAuthor = getMetaContent(["author"]);

    if (metaAuthor) {
      return normalizeCaixinAuthor(metaAuthor);
    }

    const bylineText = getFirstText([
      ".article-time",
      ".articleInfo",
      ".article-info",
      ".artInfo",
      ".source",
      ".author"
    ]);
    const parsedBylineAuthor = parseCaixinAuthor(bylineText);

    if (parsedBylineAuthor) {
      return parsedBylineAuthor;
    }

    return parseCaixinAuthor(document.body ? document.body.innerText.slice(0, 3000) : "");
  }

  function getBestCaixinContentElement() {
    const selectors = [
      "#Main_Content_Val",
      ".article-content",
      ".articleContent",
      ".article-content-l",
      ".articleMain",
      ".articalContent",
      ".content",
      "article"
    ];
    const candidates = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
    let bestElement = null;
    let bestScore = 0;

    for (const element of candidates) {
      const paragraphCount = element.querySelectorAll("p").length;
      const textLength = normalizeText(element.textContent).length;
      const score = textLength + paragraphCount * 120;

      if (paragraphCount > 0 && textLength > 30 && score > bestScore) {
        bestElement = element;
        bestScore = score;
      }
    }

    return bestElement;
  }

  function getZsxqCandidates() {
    const containers = getZsxqCandidateContainers();
    const seenContainers = new Set();
    const seenFingerprints = new Set();
    const candidates = [];

    for (const container of containers) {
      if (!container || seenContainers.has(container)) {
        continue;
      }

      const contentElement = getZsxqContentElement(container);

      if (!contentElement) {
        continue;
      }

      const html = cleanContentHtml(contentElement);
      const text = normalizeText(contentElement.textContent);

      if (!html || text.length < 20) {
        continue;
      }

      const fingerprint = getTextFingerprint(text);

      if (seenFingerprints.has(fingerprint)) {
        continue;
      }

      seenContainers.add(container);
      seenFingerprints.add(fingerprint);

      const author = getZsxqContainerAuthor(container) || getZsxqPageAuthor() || "未知作者";

      candidates.push({
        id: `candidate-${candidates.length + 1}`,
        label: buildCandidateLabel(candidates.length + 1, author, text),
        author,
        html,
        textPreview: text.slice(0, 80),
        url: location.href
      });
    }

    return candidates.slice(0, 20);
  }

  function getZsxqCandidateContainers() {
    const selectors = [
      ".topic-item",
      ".topicItem",
      ".topic-detail",
      ".topicDetail",
      ".post-item",
      ".feed-item",
      ".content-item",
      "article",
      "[class*='topic']",
      "[class*='feed']",
      "[class*='post']"
    ];
    const containers = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));

    if (containers.length > 0) {
      return dedupeNestedElements(containers);
    }

    return [document.body].filter(Boolean);
  }

  function getZsxqContentElement(container) {
    const selectors = [
      ".topic-content",
      ".topicContent",
      ".content",
      ".text-content",
      ".post-content",
      ".article-content",
      "[class*='content']",
      "[class*='text']"
    ];

    for (const selector of selectors) {
      const element = container.querySelector(selector);

      if (element && normalizeText(element.textContent).length >= 20) {
        return element;
      }
    }

    return normalizeText(container.textContent).length >= 20 ? container : null;
  }

  function dedupeNestedElements(elements) {
    const uniqueElements = [];

    for (const element of elements) {
      if (uniqueElements.some((existing) => existing.contains(element))) {
        continue;
      }

      if (uniqueElements.some((existing) => element.contains(existing))) {
        continue;
      }

      uniqueElements.push(element);
    }

    return uniqueElements;
  }

  function cleanContentHtml(element) {
    const clone = element.cloneNode(true);

    for (const selector of [
      "script",
      "style",
      "iframe",
      ".related",
      ".recommend",
      ".share",
      ".advertisement",
      ".ad"
    ]) {
      for (const node of clone.querySelectorAll(selector)) {
        node.remove();
      }
    }

    return clone.innerHTML.trim();
  }

  function getPageAuthor() {
    return getFirstText([
      ".AuthorInfo-name",
      ".Post-Author .UserLink-link",
      ".UserLink-link",
      ".ContentItem-meta .AuthorInfo-head"
    ]);
  }

  function getContainerAuthor(container) {
    if (!container) {
      return "";
    }

    return getFirstTextIn(container, [
      ".AuthorInfo-name",
      ".UserLink-link",
      ".ContentItem-meta .AuthorInfo-head",
      "[itemprop='name']"
    ]);
  }

  function getFirstTextIn(root, selectors) {
    for (const selector of selectors) {
      const elements = Array.from(root.querySelectorAll(selector));
      const match = elements
        .map((element) => normalizeText(element.textContent))
        .find(Boolean);

      if (match) {
        return match;
      }
    }

    return "";
  }

  function getZsxqPageAuthor() {
    return getFirstText([
      ".user-name",
      ".username",
      ".author-name",
      ".nickname",
      "[class*='user'][class*='name']",
      "[class*='author']",
      "[class*='nickname']"
    ]);
  }

  function getZsxqContainerAuthor(container) {
    if (!container) {
      return "";
    }

    return getFirstTextIn(container, [
      ".user-name",
      ".username",
      ".author-name",
      ".nickname",
      "[class*='user'][class*='name']",
      "[class*='author']",
      "[class*='nickname']"
    ]);
  }

  function getZsxqTitle(candidate) {
    const explicitTitle = getFirstText([
      "h1",
      ".title",
      ".topic-title",
      ".post-title",
      "[class*='title']"
    ]);

    if (explicitTitle) {
      return stripZsxqTitle(explicitTitle);
    }

    if (candidate && candidate.textPreview) {
      return stripZsxqTitle(candidate.textPreview.slice(0, 42));
    }

    return stripZsxqTitle(document.title || "");
  }

  function stripZsxqTitle(value) {
    return normalizeText(value)
      .replace(/[-_｜|].*?知识星球.*$/, "")
      .replace(/^知识星球\s*/, "")
      .trim();
  }

  function buildCandidateLabel(index, author, text) {
    const preview = text.slice(0, 36);
    return `${index}. ${author || "未知作者"}：${preview}${text.length > 36 ? "..." : ""}`;
  }

  function normalizeText(value) {
    return value ? value.replace(/\s+/g, " ").trim() : "";
  }

  function getTextFingerprint(text) {
    return text.replace(/\s+/g, "").slice(0, 500);
  }

  function isCaixinPage() {
    return /(^|\.)caixin\.com$/.test(location.hostname);
  }

  function isZsxqPage() {
    return /(^|\.)zsxq\.com$/.test(location.hostname);
  }

  function stripCaixinTitle(value) {
    return normalizeText(value).replace(/[_-].*?财新网.*$/, "").trim();
  }

  function parseCaixinAuthor(value) {
    const text = normalizeText(value);

    if (!text) {
      return "";
    }

    const authorMatch = text.match(/作者[：:]\s*([^责任编辑|｜\n]{1,60})/);

    if (authorMatch) {
      return normalizeCaixinAuthor(authorMatch[1]);
    }

    const bylineMatch = text.match(/文[｜|]\s*财新\s*([^0-9\n]{1,80})/);

    if (bylineMatch) {
      return normalizeCaixinAuthor(bylineMatch[1]);
    }

    return "";
  }

  function normalizeCaixinAuthor(value) {
    return normalizeText(value)
      .replace(/^财新\s*/, "")
      .replace(/\s*责任编辑.*$/, "")
      .replace(/\s*\d{4}.*$/, "")
      .replace(/发自[^，,、\s]+/g, "")
      .replace(/\s+/g, " ")
      .replace(/\s*[，,]\s*/g, "，")
      .trim();
  }

  globalThis.__zhihuSaveToObsidianExtract = extractCurrentPage;

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !["EXTRACT_PAGE", "EXTRACT_ZHIHU_PAGE"].includes(message.type)) {
        return false;
      }

      sendResponse(extractCurrentPage());
      return false;
    });
  }
}());
