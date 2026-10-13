# Paper

A small Typora-inspired Markdown editor with a quiet paper layout.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:5173. Build with `npm run build`.

## Features

- A continuous CodeMirror 6 editor with cursor-aware Markdown rendering. Inline syntax appears when the caret enters it; headings and list markers appear on the active line. Formatting updates while typing.
- Native selection across paragraphs, undo/redo, Markdown list continuation, and composition-event handling for IME input.
- Tables, images, and horizontal rules render as previews; click to reveal and edit their Markdown.
- Toggle full Markdown source with the toolbar or Cmd/Ctrl+Shift+M.
- Headings, tables, quotes, code blocks, links, images and interactive task lists.
- Multiple local documents, automatic browser storage, outline navigation and word counts.
- Import Markdown; export Markdown or standalone HTML. Cmd/Ctrl+S exports Markdown.
- Light/dark themes, collapsible sidebar and focus mode (Escape exits).

Document content is sanitized using DOMPurify. Documents stay in this browser's local storage; export files for a durable backup. Source and preview share one Markdown document, selection and undo history. This is a cursor-aware browser editor, not full Typora feature parity (for example, no math or Mermaid rendering). Fonts use Google Fonts with system fallbacks.

## Browser regression

With the dev server running, use the Playwright CLI:

```sh
playwright-cli open http://localhost:5173
playwright-cli run-code "$(cat tests/live-editor.browser.js)"
mkdir -p output/playwright
playwright-cli run-code "$(cat tests/live-editor-edge.browser.js)"
playwright-cli run-code "$(cat tests/cursor-hit-testing.browser.js)"
```

The regressions check marker visibility, continuous input, undo/redo, mode switching, local persistence, task toggles, table editing, code fences, simulated composition events, and mobile overflow. It restores the browser's existing documents afterward. The cursor regression clicks actual glyph coordinates after headings at desktop and mobile widths, checking the exact Markdown insertion offset. Real OS input-method candidate selection still needs manual testing.
