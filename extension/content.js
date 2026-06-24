(function () {
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

  globalThis.__zhihuSaveToObsidianExtract = extractZhihuPage;

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || message.type !== "EXTRACT_ZHIHU_PAGE") {
        return false;
      }

      sendResponse(extractZhihuPage());
      return false;
    });
  }
}());
