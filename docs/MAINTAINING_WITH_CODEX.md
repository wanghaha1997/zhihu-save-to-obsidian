# Maintaining with Codex

This project uses Codex as a maintainer tool for code quality, compatibility, testing, and release work. Codex is not part of the content-saving data path.

## Maintainer workflows

Codex can assist with:

- Reviewing changes to content extraction selectors
- Creating regression tests from small synthetic or sanitized DOM fixtures
- Diagnosing breakages after supported websites change their rendered HTML
- Reviewing path validation, CORS, and localhost-only service behavior
- Maintaining macOS, Windows, and Linux setup instructions
- Preparing changelogs, release notes, and contributor documentation
- Triaging reproducible GitHub Issues and reviewing pull requests

All generated changes remain subject to automated tests and maintainer review.

## Privacy boundary

The following data must not be sent to Codex or an OpenAI API as part of project maintenance:

- User cookies, passwords, tokens, or request headers
- Private or paid page content
- Personal Obsidian vault contents
- Real local file paths containing personal information
- Unsanitized logs or screenshots containing personal data

Regression fixtures should contain only the minimum HTML structure required to reproduce an extraction problem, with synthetic titles, authors, URLs, and body text.

## Example maintenance cycle

1. A user reports that extraction failed on a supported page without sharing private content.
2. The maintainer creates a minimal sanitized DOM fixture that reproduces the selector failure.
3. Codex helps inspect the relevant extraction code and propose a focused change.
4. Automated extraction and Markdown tests verify the change.
5. The maintainer reviews the privacy and behavior impact before merging.
6. The fix is documented in the changelog and included in a release.

## Intended program use

Access provided through Codex for Open Source would be used for ongoing issue triage, code review, regression testing, cross-platform setup work, security review, and release maintenance. It would not be used to process users' captured articles or add cloud content analysis to the product.
