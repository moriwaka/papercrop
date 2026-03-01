# Usability Improvement Design Plan (High / Medium Priority)

## Scope
This document proposes implementation-ready UX design for the previously identified high- and medium-priority improvements.

---

## High Priority

### 1) Mobile/Touch support for crop selection

#### Problem
Current crop selection is mouse-event based (`mousedown`/`mousemove`/`mouseup`) and may not work well on touch devices.

#### Design
- Replace mouse-specific listeners with Pointer Events:
  - `pointerdown`, `pointermove`, `pointerup`, `pointercancel` on `srcCanvas`.
- Track active pointer with `activePointerId` to avoid multi-touch conflicts.
- Call `srcCanvas.setPointerCapture(e.pointerId)` on start for stable drag behavior.
- Preserve existing clamp logic (`clampToImageArea`) and drawing behavior.
- Add `touch-action: none;` to `#srcCanvas` to prevent unintended scrolling during drag.

#### Acceptance criteria
- Desktop mouse drag works as before.
- Single-finger drag on mobile creates and updates selection rectangle.
- Dragging outside image area remains clamped.

---

### 2) Keyboard accessibility + focus visibility

#### Problem
Dropzone is not keyboard actionable, and focus state visibility is minimal.

#### Design
- Make upload dropzone keyboard reachable/actionable:
  - Add `tabindex="0"`, `role="button"`, localized `aria-label`.
  - On `keydown` (Enter/Space), trigger file picker when no image is loaded.
- Add visible focus style for interactive controls:
  - `button:focus-visible`, `select:focus-visible`, `input:focus-visible`, `.source-dropzone:focus-visible`.
  - Use accent outline with offset for contrast.
- Keep existing click behavior unchanged.

#### Acceptance criteria
- Tab navigation reaches all controls in logical order.
- Focus ring is clearly visible in dark theme.
- Enter/Space on dropzone opens file picker.

---

### 3) Clear crop precondition feedback

#### Problem
`Crop` can appear to do nothing when no valid selection exists.

#### Design
- Introduce explicit selection state:
  - `hasValidSelection = rect && rect.w >= 2 && rect.h >= 2`.
- Disable `cropBtn` unless both image loaded and valid selection exists.
- Show inline helper text beneath source canvas:
  - No image: “Upload an image to start.”
  - Image loaded, no selection: “Drag on the image to select a crop area.”
  - Invalid tiny selection: “Selection is too small. Drag a larger area.”
- Keep silent guard in crop handler as safety.

#### Acceptance criteria
- User can infer next action without trial-and-error.
- Crop button state updates immediately while dragging.

---

## Medium Priority

### 4) Replace blocking `alert` with inline/toast status

#### Problem
`alert` interrupts flow and is unfriendly for repeated operations.

#### Design
- Add a status region in UI (single message area):
  - `role="status"`, `aria-live="polite"`.
  - Message types: `info`, `success`, `error`.
- Convert current alert points to `showStatus(message, type)`:
  - image load failure
  - clipboard unsupported/no image/read failure/copy failure
- Auto-hide info/success after 3–4s; errors persist until next action.

#### Acceptance criteria
- No blocking modal alerts during normal failures.
- Screen readers announce status updates.

---

### 5) Label consistency across language packs

#### Problem
Japanese UI currently includes some English action labels.

#### Design
- Normalize action labels in i18n resources:
  - JA: `切り抜き`, `PNGをダウンロード`, `クリップボードにコピー`
  - EN remains current wording.
- Ensure button labels are always set via `applyLanguage`.

#### Acceptance criteria
- No mixed-language primary actions when Japanese is selected.

---

### 6) Show selection dimensions

#### Problem
Users cannot easily confirm output size before cropping.

#### Design
- Show live dimension chip near selection rectangle on source canvas:
  - Format: `WxH px`.
  - Position near top-left of selection, with auto-flip if clipped.
- Mirror current dimension in helper/status text for accessibility.

#### Acceptance criteria
- During drag, dimensions are visible and update in real time.
- Dimensions match produced output (before optional outline/shadow padding).

---

## Implementation Order (recommended)
1. Pointer Events migration (High #1)
2. Crop precondition state + helper text (High #3)
3. Keyboard/focus accessibility improvements (High #2)
4. Inline status system replacing alerts (Medium #4)
5. i18n label normalization (Medium #5)
6. Selection dimension display (Medium #6)

This order minimizes risk while improving core usability first.

---

## Test Plan

### Automated (existing)
- `node --check app.js`
- `node --check edge-mask.js`
- `node --test tests/edge-mask.test.js`

### Manual happy path
- Upload image (click-to-upload), drag selection, crop, download PNG, copy clipboard.

### Manual edge cases
- Mobile-width viewport: drag selection and crop.
- Clipboard upload on supported browser.
- No-selection / tiny-selection behavior (button state + helper/status text).
- Japanese/English switch: verify button labels and status text localization.

