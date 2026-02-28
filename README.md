# paper crop

A lightweight browser tool for cropping images with per-edge shape control. Each side (top, right, bottom, left) can be set to either `Straight` or `Torn`.

- Live: https://moriwaka.github.io/papercrop/
- License: MIT

## Features

- Per-edge shape selection (straight/torn)
- Adjustable tear roughness
- Optional outline and drop shadow
- Checkerboard preview background for transparency checks
- Image input methods:
  - Click-to-upload
  - Drag and drop
  - Clipboard paste
- Output methods:
  - Download as PNG
  - Copy image to clipboard
- UI localization: English / Japanese

## Usage

1. Upload an image (click, drop, or paste).
2. Drag on the source image to define the crop area.
3. Adjust edge shape, roughness, outline, and shadow options.
4. Click `Crop` to render the result.
5. Save with `Download PNG` or `Copy to Clipboard`.

## Run Locally

No build step is required. This is a static web app.

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` in your browser.

## Development Notes

- Core masking logic: `edge-mask.js`
- UI and event handling: `app.js`
- Regression test:

```bash
node --test tests/edge-mask.test.js
```
