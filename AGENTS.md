# Repository Guidelines

## Project Structure & Module Organization
This repository is a lightweight, single-page web tool.

- `index.html`: HTML structure and UI markup.
- `styles.css`: Application styling and responsive layout rules.
- `app.js`: Canvas behavior, crop logic, and edge generation.

When adding features, keep the app runnable without a build step.

## Build, Test, and Development Commands
No package manager or build pipeline is required.

- `python3 -m http.server 8000`: Run a local static server.
- `xdg-open http://localhost:8000` (Linux): Open the app in a browser.
- `git status`: Check local changes before committing.
- `node --check app.js`: Quick syntax check for JavaScript changes.

You can open `index.html` directly, but a local server is preferred for consistent behavior.

## Coding Style & Naming Conventions
- Use 2-space indentation in HTML, CSS, and JavaScript to match existing style.
- Prefer `const`/`let` over `var`.
- Use camelCase for variables/functions (`allStraightBtn`, `setAllEdges`).
- Use descriptive IDs for DOM elements (`edgeTop`, `roughness`).
- Keep comments brief and focused on non-obvious logic (for example, fractal edge generation).

Before submitting, avoid unused variables or dead UI controls.

## Testing Guidelines
There is no automated test suite yet; use manual verification.

- Load an image, drag-select a region, and run `Crop`.
- Verify each edge mode (`straight`/`torn`) on all four sides.
- Validate `Download PNG` and clipboard copy behavior.
- Confirm behavior on both desktop and mobile-width viewports.

Place future automated tests under `tests/` and document run commands here.

## Test Methodology Plan
Use a phased strategy so quality improves without adding heavy tooling too early.

1. Phase 1 (now): Manual scenario testing on every behavior change.
2. Phase 2: Add smoke checks for core UI actions (file load, drag selection, crop, download).
3. Phase 3: Add regression tests for edge-shape generation and output dimensions.

For each PR, run one happy-path test and one edge case (small image, large image, or narrow viewport), then record results in the PR description. Prefer deterministic inputs under `tests/fixtures/` once `tests/` exists.

## Commit & Pull Request Guidelines
Current history is minimal, so keep conventions simple and consistent.

- Commit messages: short, imperative, and scoped (example: `Add torn edge seed reset`).
- Keep commits focused on one change.
- PRs should include: purpose, summary of behavior changes, manual test steps, and screenshots/GIFs for UI updates.
- Link related issues when available.

## Security & Configuration Tips
- Do not commit secrets, tokens, or local config files.
