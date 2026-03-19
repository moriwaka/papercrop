const fileInput = document.getElementById('fileInput');
const srcCanvas = document.getElementById('srcCanvas');
const outCanvas = document.getElementById('outCanvas');
const cropBtn = document.getElementById('cropBtn');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const resetBtn = document.getElementById('resetBtn');
const newUploadBtn = document.getElementById('newUploadBtn');
const pasteUploadBtn = document.getElementById('pasteUploadBtn');
const roughnessInput = document.getElementById('roughness');
const outlineEnabled = document.getElementById('outlineEnabled');
const shadowEnabled = document.getElementById('shadowEnabled');
const srcDropZone = document.getElementById('srcDropZone');
const srcHint = document.getElementById('srcHint');
const mainDesc = document.getElementById('mainDesc');
const sourceDesc = document.getElementById('sourceDesc');
const edgeTopLabel = document.getElementById('edgeTopLabel');
const edgeRightLabel = document.getElementById('edgeRightLabel');
const edgeBottomLabel = document.getElementById('edgeBottomLabel');
const edgeLeftLabel = document.getElementById('edgeLeftLabel');
const edgeCenterLabel = document.getElementById('edgeCenterLabel');
const edgeHelp = document.getElementById('edgeHelp');
const roughnessLabel = document.getElementById('roughnessLabel');
const outlineLabel = document.getElementById('outlineLabel');
const shadowLabel = document.getElementById('shadowLabel');
const selectionHint = document.getElementById('selectionHint');
const statusMessage = document.getElementById('statusMessage');
const applyAllEdgesBtn = document.getElementById('applyAllEdgesBtn');
const selectedEdgeTitle = document.getElementById('selectedEdgeTitle');
const selectedEdgeName = document.getElementById('selectedEdgeName');
const selectedEdgeDesc = document.getElementById('selectedEdgeDesc');

const edgeTop = document.getElementById('edgeTop');
const edgeRight = document.getElementById('edgeRight');
const edgeBottom = document.getElementById('edgeBottom');
const edgeLeft = document.getElementById('edgeLeft');
const edgeCards = Array.from(document.querySelectorAll('.edge-card'));
const edgeAssignButtons = Array.from(document.querySelectorAll('.edge-assign'));
const edgeValueEls = {
  top: document.querySelector('[data-edge-value="top"]'),
  right: document.querySelector('[data-edge-value="right"]'),
  bottom: document.querySelector('[data-edge-value="bottom"]'),
  left: document.querySelector('[data-edge-value="left"]')
};

const srcCtx = srcCanvas.getContext('2d');
const outCtx = outCanvas.getContext('2d');
const { buildEdgeBounds, applyEdgeMask, findCornerIntersections, sample } = window.PaperCropEdgeMask;
const { hasValidSelection, getSelectionText, getSelectionHintKey } = window.PaperCropUiState;
const SHADOW_COLOR = 'rgba(0, 0, 0, 0.45)';
const SHADOW_BLUR = 14;
const SHADOW_OFFSET_X = 0;
const SHADOW_OFFSET_Y = 6;
const EDGE_SETTINGS_STORAGE_KEY = 'papercrop.edgeSettings.v1';

let img = null;
let dragging = false;
let activePointerId = null;
let startX = 0, startY = 0;
let rect = null;
let currentObjectUrl = null;
let currentLoadToken = 0;
let currentLang = 'en';
let selectedEdgeMode = 'straight';
let canPersistEdgeSettings = false;
let currentSourceFilename = null;

const PAD = 32;           // 画像まわりの余白(px)
let imgOX = 0, imgOY = 0; // 画像の描画オフセット
const EDGE_MODE_KEYS = {
  straight: { name: 'edgeStraight', desc: 'edgeStraightDesc' },
  torn: { name: 'edgeTorn', desc: 'edgeTornDesc' },
  deckle: { name: 'edgeDeckle', desc: 'edgeDeckleDesc' },
  wavy: { name: 'edgeWavy', desc: 'edgeWavyDesc' },
  stamp: { name: 'edgeStamp', desc: 'edgeStampDesc' }
};
const I18N = {
  ja: {
    mainDesc: '画像を四角形で切り抜くツール。上下左右のエッジ形状を個別に指定できる。',
    edgeTopLabel: '上エッジ',
    edgeRightLabel: '右エッジ',
    edgeBottomLabel: '下エッジ',
    edgeLeftLabel: '左エッジ',
    edgeCenterLabel: 'エッジ形状',
    edgeHelp: '見本を選んでから、上右下左のどこに適用するかを指定します。',
    roughnessLabel: 'エッジ強度',
    outlineLabel: '輪郭線',
    shadowLabel: 'ドロップシャドウ',
    applyAllEdgesBtn: '全辺に適用',
    selectedEdgeTitle: '選択中',
    sourceDesc: '画像上でドラッグして切り抜き範囲を指定する。余白上でドラッグしても、選択領域は画像を越えない。',
    newUploadBtn: '新規アップロード',
    pasteUploadBtn: 'クリップボードから貼り付け',
    resetBtn: 'リセット',
    srcHint: 'ここをクリック / ドロップで画像をアップロード',
    cropBtn: '切り抜き',
    downloadBtn: 'PNGをダウンロード',
    copyBtn: 'クリップボードにコピー',
    edgeStraight: '直線',
    edgeStraightDesc: 'まっすぐ切ったような整った縁。',
    edgeTorn: '紙を破った風',
    edgeTornDesc: '大きく荒い破れ跡が残るラフな縁。',
    edgeDeckle: '手漉き紙風',
    edgeDeckleDesc: '細かく柔らかな紙耳が続く上品な縁。',
    edgeWavy: 'たわみ紙風',
    edgeWavyDesc: '湿りで少したわんだようなゆるいうねり。',
    edgeStamp: '半券ミシン目風',
    edgeStampDesc: '半券を切り離した後のような反復ノッチ。',
    alertLoadFail: '画像の読み込みに失敗しました',
    alertClipboardUnsupported: 'このブラウザではクリップボード読み取りに対応していません',
    alertClipboardNoImage: 'クリップボードに画像がありません',
    alertClipboardReadFail: 'クリップボードからの読み取りに失敗しました',
    alertClipboardCopyFail: 'クリップボードへのコピーに失敗しました',
    statusCopySuccess: 'クリップボードにコピーしました',
    hintNoImage: '画像をアップロードして開始してください。',
    hintNeedSelection: '画像上をドラッグして切り抜き範囲を選択してください。',
    hintSelectionTooSmall: '選択範囲が小さすぎます。もう少し大きく選択してください。',
    hintReady: '切り抜き可能です。',
    dropzoneAriaLabel: '画像をアップロード',
    alertNeedSelection: '切り抜き範囲を先に選択してください。'
  },
  en: {
    mainDesc: 'A tool to crop images into rectangular regions with per-edge shape control.',
    edgeTopLabel: 'Top Edge',
    edgeRightLabel: 'Right Edge',
    edgeBottomLabel: 'Bottom Edge',
    edgeLeftLabel: 'Left Edge',
    edgeCenterLabel: 'Edge Shape',
    edgeHelp: 'Choose a sample, then apply it to the top, right, bottom, or left edge.',
    roughnessLabel: 'Edge Intensity',
    outlineLabel: 'Outline',
    shadowLabel: 'Drop Shadow',
    applyAllEdgesBtn: 'Apply to All Edges',
    selectedEdgeTitle: 'Selected',
    sourceDesc: 'Drag on the image to select a crop region. Dragging over margin is clamped to image bounds.',
    newUploadBtn: 'Upload New Image',
    pasteUploadBtn: 'Paste from Clipboard',
    resetBtn: 'Reset',
    srcHint: 'Click or drop an image here to upload',
    cropBtn: 'Crop',
    downloadBtn: 'Download PNG',
    copyBtn: 'Copy to Clipboard',
    edgeStraight: 'Straight',
    edgeStraightDesc: 'A clean edge as if cut with a straight blade.',
    edgeTorn: 'Torn Paper',
    edgeTornDesc: 'A rough edge with larger, more obvious tear marks.',
    edgeDeckle: 'Deckle Edge',
    edgeDeckleDesc: 'A soft handmade-paper edge with fine paper fibers.',
    edgeWavy: 'Wavy Paper',
    edgeWavyDesc: 'A gentle waviness like paper that has slightly warped.',
    edgeStamp: 'Ticket Stub',
    edgeStampDesc: 'A repeated notch pattern like a torn ticket stub.',
    alertLoadFail: 'Failed to load image',
    alertClipboardUnsupported: 'Clipboard read is not supported in this browser',
    alertClipboardNoImage: 'No image found in clipboard',
    alertClipboardReadFail: 'Failed to read from clipboard',
    alertClipboardCopyFail: 'Failed to copy to clipboard',
    statusCopySuccess: 'Copied to clipboard',
    hintNoImage: 'Upload an image to start.',
    hintNeedSelection: 'Drag on the image to select a crop area.',
    hintSelectionTooSmall: 'Selection is too small. Drag a larger area.',
    hintReady: 'Ready to crop.',
    dropzoneAriaLabel: 'Upload an image',
    alertNeedSelection: 'Please select a crop region first.'
  }
};

function t(key){
  const pack = I18N[currentLang] || I18N.ja;
  return pack[key] || key;
}

function getEdgeModeName(mode){
  const keys = EDGE_MODE_KEYS[mode] || EDGE_MODE_KEYS.straight;
  return t(keys.name);
}

function getEdgeModeDescription(mode){
  const keys = EDGE_MODE_KEYS[mode] || EDGE_MODE_KEYS.straight;
  return t(keys.desc);
}

function isValidEdgeMode(mode){
  return Object.hasOwn(EDGE_MODE_KEYS, mode);
}

function loadStoredEdgeSettings(){
  try{
    const raw = window.localStorage.getItem(EDGE_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (e){
    return null;
  }
}

function saveEdgeSettings(){
  if (!canPersistEdgeSettings) return;
  try{
    window.localStorage.setItem(EDGE_SETTINGS_STORAGE_KEY, JSON.stringify({
      selectedEdgeMode,
      roughness: Number(roughnessInput.value),
      outlineEnabled: outlineEnabled.checked,
      shadowEnabled: shadowEnabled.checked,
      edges: getEdgeValues()
    }));
  } catch (e){
    // Ignore storage failures such as private browsing restrictions.
  }
}

function restoreEdgeSettings(){
  const stored = loadStoredEdgeSettings();
  if (!stored) return;

  const nextEdges = stored.edges && typeof stored.edges === 'object' ? stored.edges : {};
  const edgeMap = {
    top: edgeTop,
    right: edgeRight,
    bottom: edgeBottom,
    left: edgeLeft
  };

  for (const [edge, input] of Object.entries(edgeMap)){
    const mode = nextEdges[edge];
    if (isValidEdgeMode(mode)){
      input.value = mode;
    }
  }

  const nextSelectedMode = stored.selectedEdgeMode;
  if (isValidEdgeMode(nextSelectedMode)){
    selectedEdgeMode = nextSelectedMode;
  }

  const roughness = Number(stored.roughness);
  const min = Number(roughnessInput.min);
  const max = Number(roughnessInput.max);
  if (Number.isFinite(roughness)){
    roughnessInput.value = String(Math.min(Math.max(roughness, min), max));
  }

  if (typeof stored.outlineEnabled === 'boolean'){
    outlineEnabled.checked = stored.outlineEnabled;
  }
  if (typeof stored.shadowEnabled === 'boolean'){
    shadowEnabled.checked = stored.shadowEnabled;
  }
}

function buildDownloadFilename(){
  if (!currentSourceFilename){
    return 'paper-crop.png';
  }

  const lastDot = currentSourceFilename.lastIndexOf('.');
  if (lastDot <= 0){
    return `${currentSourceFilename}-papercrop.png`;
  }

  const basename = currentSourceFilename.slice(0, lastDot);
  return `${basename}-papercrop.png`;
}

function applyLanguage(lang){
  if (!I18N[lang]) lang = 'ja';
  currentLang = lang;
  document.documentElement.lang = lang;
  mainDesc.textContent = t('mainDesc');
  edgeTopLabel.textContent = t('edgeTopLabel');
  edgeRightLabel.textContent = t('edgeRightLabel');
  edgeBottomLabel.textContent = t('edgeBottomLabel');
  edgeLeftLabel.textContent = t('edgeLeftLabel');
  edgeCenterLabel.textContent = t('edgeCenterLabel');
  edgeHelp.textContent = t('edgeHelp');
  roughnessLabel.textContent = t('roughnessLabel');
  outlineLabel.textContent = t('outlineLabel');
  shadowLabel.textContent = t('shadowLabel');
  applyAllEdgesBtn.textContent = t('applyAllEdgesBtn');
  selectedEdgeTitle.textContent = t('selectedEdgeTitle');
  sourceDesc.textContent = t('sourceDesc');
  newUploadBtn.textContent = t('newUploadBtn');
  pasteUploadBtn.textContent = t('pasteUploadBtn');
  resetBtn.textContent = t('resetBtn');
  srcHint.textContent = t('srcHint');
  cropBtn.textContent = t('cropBtn');
  downloadBtn.textContent = t('downloadBtn');
  copyBtn.textContent = t('copyBtn');
  srcDropZone.setAttribute('aria-label', t('dropzoneAriaLabel'));
  updateSelectionUi();
  for (const el of document.querySelectorAll('[data-i18n]')){
    el.textContent = t(el.dataset.i18n);
  }
  updateEdgeUi();
  renderEdgeGalleryPreviews();
}

function getInitialLanguage(){
  const preferred = navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language || ''];
  for (const lang of preferred){
    if (String(lang).toLowerCase().startsWith('ja')) return 'ja';
  }
  return 'en';
}

function setAllEdges(mode){
  edgeTop.value = mode;
  edgeRight.value = mode;
  edgeBottom.value = mode;
  edgeLeft.value = mode;
  updateEdgeUi();
  saveEdgeSettings();
  if (img) redrawSource();
  renderOutputPreview();
}

function getEdgeValues(){
  return {
    top: edgeTop.value,
    right: edgeRight.value,
    bottom: edgeBottom.value,
    left: edgeLeft.value
  };
}

function updateEdgeUi(){
  for (const card of edgeCards){
    const isSelected = card.dataset.mode === selectedEdgeMode;
    card.setAttribute('aria-checked', isSelected ? 'true' : 'false');
  }
  for (const [edge, el] of Object.entries(edgeValueEls)){
    if (el) el.textContent = getEdgeModeName(getEdgeValues()[edge]);
  }
  selectedEdgeName.textContent = getEdgeModeName(selectedEdgeMode);
  selectedEdgeDesc.textContent = getEdgeModeDescription(selectedEdgeMode);
}

function selectEdgeMode(mode){
  selectedEdgeMode = EDGE_MODE_KEYS[mode] ? mode : 'straight';
  updateEdgeUi();
  saveEdgeSettings();
}

function applySelectedModeToEdge(edge){
  const map = { top: edgeTop, right: edgeRight, bottom: edgeBottom, left: edgeLeft };
  const input = map[edge];
  if (!input) return;
  input.value = selectedEdgeMode;
  updateEdgeUi();
  saveEdgeSettings();
  if (img) redrawSource();
  renderOutputPreview();
}

function renderEdgeCardPreview(card){
  const canvas = card.querySelector('canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const mode = card.dataset.mode || 'straight';
  const bounds = buildEdgeBounds(w - 28, h - 24, Number(roughnessInput.value), {
    top: mode,
    right: 'straight',
    bottom: 'straight',
    left: 'straight'
  });

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ebefe6';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#d5ddcf';
  ctx.fillRect(0, h * 0.55, w, h * 0.45);

  ctx.save();
  ctx.translate(14, 12);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#f8f5ec';
  drawEdgePath(ctx, bounds, w - 28, h - 24, 0, 0);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(14, 12);
  ctx.strokeStyle = 'rgba(40, 40, 40, 0.35)';
  ctx.lineWidth = 1.2;
  drawEdgePath(ctx, bounds, w - 28, h - 24, 0, 0);
  ctx.stroke();
  ctx.restore();
}

function renderEdgeGalleryPreviews(){
  for (const card of edgeCards){
    renderEdgeCardPreview(card);
  }
}

function revokeCurrentObjectUrl(){
  if (currentObjectUrl){
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

function updateSourceState(){
  srcDropZone.classList.toggle('has-image', Boolean(img));
}

function clearOutput(){
  outCtx.clearRect(0, 0, outCanvas.width, outCanvas.height);
  downloadBtn.disabled = true;
  copyBtn.disabled = true;
}

function renderOutputPreview(){
  if (!img || !hasValidSelection(rect, 2)) {
    clearOutput();
    return;
  }

  const w = Math.round(rect.w);
  const h = Math.round(rect.h);
  const withShadow = shadowEnabled.checked;
  const withOutline = outlineEnabled.checked;
  const insets = computeOutputInsets(withShadow, withOutline);
  const outW = w + insets.left + insets.right;
  const outH = h + insets.top + insets.bottom;
  outCanvas.width = outW;
  outCanvas.height = outH;
  outCtx.clearRect(0, 0, outW, outH);

  const sx = rect.x - imgOX;
  const sy = rect.y - imgOY;
  const rough = Number(roughnessInput.value);
  const bounds = buildEdgeBounds(w, h, rough, getEdgeValues());

  const maskedCanvas = document.createElement('canvas');
  maskedCanvas.width = w;
  maskedCanvas.height = h;
  const maskedCtx = maskedCanvas.getContext('2d');
  maskedCtx.drawImage(img, sx, sy, rect.w, rect.h, 0, 0, w, h);
  const imageData = maskedCtx.getImageData(0, 0, w, h);
  applyEdgeMask(imageData, bounds, w, h);
  maskedCtx.putImageData(imageData, 0, 0);

  if (withShadow){
    outCtx.save();
    outCtx.shadowColor = SHADOW_COLOR;
    outCtx.shadowBlur = SHADOW_BLUR;
    outCtx.shadowOffsetX = SHADOW_OFFSET_X;
    outCtx.shadowOffsetY = SHADOW_OFFSET_Y;
    outCtx.drawImage(maskedCanvas, insets.left, insets.top);
    outCtx.restore();
  }

  outCtx.drawImage(maskedCanvas, insets.left, insets.top);

  if (withOutline){
    outCtx.save();
    outCtx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    outCtx.lineWidth = 1.5;
    outCtx.lineJoin = 'round';
    outCtx.lineCap = 'round';
    outCtx.miterLimit = 2;
    drawEdgePath(outCtx, bounds, w, h, insets.left, insets.top);
    outCtx.stroke();
    outCtx.restore();
  }

  downloadBtn.disabled = false;
  copyBtn.disabled = false;
}

function showStatus(key, type, autoHideMs){
  const text = t(key);
  statusMessage.hidden = false;
  statusMessage.textContent = text;
  statusMessage.className = `status-message ${type || 'info'}`;
  if (showStatus._timer){
    clearTimeout(showStatus._timer);
    showStatus._timer = null;
  }
  if (autoHideMs){
    showStatus._timer = setTimeout(() => {
      statusMessage.hidden = true;
      statusMessage.textContent = '';
      statusMessage.className = 'status-message';
      showStatus._timer = null;
    }, autoHideMs);
  }
}

function updateSelectionUi(){
  const canCrop = hasValidSelection(rect, 2);
  const key = getSelectionHintKey(Boolean(img), rect, 2);
  let text = t(key);
  const dims = getSelectionText(rect);
  if (dims && canCrop){
    text = `${text} (${dims})`;
  }
  selectionHint.textContent = text;
  cropBtn.disabled = !canCrop;
  if (canCrop){
    renderOutputPreview();
  } else {
    clearOutput();
  }
}

function loadImageFromBlob(blob, sourceFilename){
  currentSourceFilename = sourceFilename || null;
  revokeCurrentObjectUrl();
  const url = URL.createObjectURL(blob);
  const loadToken = ++currentLoadToken;
  currentObjectUrl = url;

  const nextImg = new Image();
  nextImg.onload = () => {
    if (loadToken !== currentLoadToken) {
      URL.revokeObjectURL(url);
      return;
    }
    img = nextImg;
    imgOX = PAD;
    imgOY = PAD;

    srcCanvas.width  = img.width  + PAD * 2;
    srcCanvas.height = img.height + PAD * 2;

    srcCtx.clearRect(0, 0, srcCanvas.width, srcCanvas.height);
    srcCtx.drawImage(img, imgOX, imgOY);

    rect = null;
    updateSelectionUi();
    clearOutput();
    updateSourceState();
    if (currentObjectUrl === url){
      URL.revokeObjectURL(url);
      currentObjectUrl = null;
    }
  };
  nextImg.onerror = () => {
    if (loadToken !== currentLoadToken) {
      URL.revokeObjectURL(url);
      return;
    }
    showStatus('alertLoadFail', 'error');
    updateSourceState();
    if (currentObjectUrl === url){
      URL.revokeObjectURL(url);
      currentObjectUrl = null;
    }
  };
  nextImg.src = url;
}

function loadImageFromFile(file){
  if (!file || !file.type.startsWith('image/')) return;
  loadImageFromBlob(file, file.name || null);
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  loadImageFromFile(file);
});

newUploadBtn.addEventListener('click', () => {
  fileInput.value = '';
  fileInput.click();
});

srcDropZone.addEventListener('click', () => {
  if (img) return;
  fileInput.value = '';
  fileInput.click();
});

srcDropZone.addEventListener('keydown', (e) => {
  if (img) return;
  if (e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault();
  fileInput.value = '';
  fileInput.click();
});

function setDragState(on){
  srcDropZone.classList.toggle('dragover', on);
}

srcDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  setDragState(true);
});
srcDropZone.addEventListener('dragenter', (e) => {
  e.preventDefault();
  setDragState(true);
});
srcDropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  if (!srcDropZone.contains(e.relatedTarget)) setDragState(false);
});
srcDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  setDragState(false);
  const file = e.dataTransfer?.files?.[0];
  if (file) loadImageFromFile(file);
});

async function uploadFromClipboard(){
  if (!navigator.clipboard || !navigator.clipboard.read){
    showStatus('alertClipboardUnsupported', 'error');
    return;
  }
  try{
    const items = await navigator.clipboard.read();
    for (const item of items){
      const type = item.types.find((t) => t.startsWith('image/'));
      if (type){
        const blob = await item.getType(type);
        loadImageFromBlob(blob);
        return;
      }
    }
    showStatus('alertClipboardNoImage', 'error');
  } catch (e){
    showStatus('alertClipboardReadFail', 'error');
  }
}

pasteUploadBtn.addEventListener('click', () => {
  uploadFromClipboard();
});

window.addEventListener('paste', (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items){
    if (item.type.startsWith('image/')){
      const blob = item.getAsFile();
      if (blob) loadImageFromBlob(blob);
      e.preventDefault();
      return;
    }
  }
});

function clampToImageArea(x, y){
  const minX = imgOX;
  const minY = imgOY;
  const maxX = imgOX + img.width;
  const maxY = imgOY + img.height;
  return {
    x: Math.min(Math.max(x, minX), maxX),
    y: Math.min(Math.max(y, minY), maxY)
  };
}

function getCanvasPoint(e){
  const r = srcCanvas.getBoundingClientRect();
  const scaleX = srcCanvas.width / r.width;
  const scaleY = srcCanvas.height / r.height;
  return {
    x: (e.clientX - r.left) * scaleX,
    y: (e.clientY - r.top) * scaleY
  };
}

function getCanvasDisplayScale(canvas){
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height){
    return { x: 1, y: 1, max: 1 };
  }
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: scaleX,
    y: scaleY,
    max: Math.max(scaleX, scaleY)
  };
}

function getGuaranteedVisibleRect(){
  if (!hasValidSelection(rect, 2)) return null;

  const w = Math.round(rect.w);
  const h = Math.round(rect.h);
  const bounds = buildEdgeBounds(w, h, Number(roughnessInput.value), getEdgeValues());
  const safeTop = Math.max(...bounds.top);
  const safeBottom = Math.min(...bounds.bottom);
  const safeLeft = Math.max(...bounds.left);
  const safeRight = Math.min(...bounds.right);

  if (safeRight <= safeLeft || safeBottom <= safeTop){
    return null;
  }

  return {
    x: rect.x + safeLeft,
    y: rect.y + safeTop,
    w: safeRight - safeLeft,
    h: safeBottom - safeTop
  };
}

srcCanvas.addEventListener('pointerdown', (e) => {
  if (!img || dragging) return;
  dragging = true;
  activePointerId = e.pointerId;
  srcCanvas.setPointerCapture(e.pointerId);
  const pt = getCanvasPoint(e);
  const p = clampToImageArea(pt.x, pt.y);
  startX = p.x;
  startY = p.y;
  rect = { x: startX, y: startY, w: 0, h: 0 };
  redrawSource();
  updateSelectionUi();
});

srcCanvas.addEventListener('pointermove', (e) => {
  if (!dragging || !img || e.pointerId !== activePointerId) return;
  const pt = getCanvasPoint(e);
  const p = clampToImageArea(pt.x, pt.y);
  const x = p.x;
  const y = p.y;

  rect = {
    x: Math.min(startX, x),
    y: Math.min(startY, y),
    w: Math.abs(x - startX),
    h: Math.abs(y - startY)
  };
  redrawSource();
  updateSelectionUi();
});

function releasePointerDrag(e){
  if (!dragging || e.pointerId !== activePointerId) return;
  dragging = false;
  activePointerId = null;
  updateSelectionUi();
}

srcCanvas.addEventListener('pointerup', releasePointerDrag);
srcCanvas.addEventListener('pointercancel', releasePointerDrag);

function redrawSource(){
  if (!img) return;
  srcCtx.clearRect(0, 0, srcCanvas.width, srcCanvas.height);
  srcCtx.drawImage(img, imgOX, imgOY);

  if (rect){
    const displayScale = getCanvasDisplayScale(srcCanvas);
    const strokeWidth = Math.min(8, Math.max(2, displayScale.max * 2));
    const dashOn = Math.max(6, displayScale.max * 6);
    const dashOff = Math.max(4, displayScale.max * 4);
    const fontSize = Math.min(28, Math.max(12, displayScale.max * 12));
    const labelPadding = Math.max(6, displayScale.max * 6);
    const labelHeight = Math.max(20, Math.round(fontSize * 1.55));
    const labelOffset = Math.max(4, displayScale.max * 4);

    srcCtx.strokeStyle = 'rgba(0, 255, 0, 0.9)'; // 緑の点線
    srcCtx.lineWidth = strokeWidth;
    srcCtx.setLineDash([dashOn, dashOff]);
    srcCtx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    srcCtx.setLineDash([]);
    const safeRect = getGuaranteedVisibleRect();
    if (safeRect){
      srcCtx.save();
      srcCtx.fillStyle = 'rgba(255, 215, 0, 0.12)';
      srcCtx.strokeStyle = 'rgba(255, 215, 0, 0.95)';
      srcCtx.lineWidth = Math.max(1.5, strokeWidth * 0.8);
      srcCtx.fillRect(safeRect.x, safeRect.y, safeRect.w, safeRect.h);
      srcCtx.strokeRect(safeRect.x, safeRect.y, safeRect.w, safeRect.h);
      srcCtx.restore();
    }
    const dims = getSelectionText(rect);
    if (dims){
      srcCtx.font = `${fontSize}px sans-serif`;
      const metrics = srcCtx.measureText(dims);
      const bw = metrics.width + labelPadding * 2;
      const bh = labelHeight;
      let bx = rect.x;
      let by = rect.y - bh - labelOffset;
      if (by < 0) by = rect.y + labelOffset;
      if (bx + bw > srcCanvas.width) bx = srcCanvas.width - bw - 2;
      srcCtx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      srcCtx.fillRect(bx, by, bw, bh);
      srcCtx.fillStyle = '#ffffff';
      srcCtx.textBaseline = 'middle';
      srcCtx.fillText(dims, bx + labelPadding, by + bh * 0.5);
    }
  }
}

function drawEdgePath(ctx, bounds, w, h, ox, oy){
  const corners = findCornerIntersections(bounds, w, h);

  const topStart = Math.max(0, Math.ceil(corners.tl.x));
  const topEnd = Math.min(w, Math.floor(corners.tr.x));
  const rightStart = Math.max(0, Math.ceil(corners.tr.y));
  const rightEnd = Math.min(h, Math.floor(corners.br.y));
  const bottomStart = Math.max(0, Math.floor(corners.br.x));
  const bottomEnd = Math.min(w, Math.ceil(corners.bl.x));
  const leftStart = Math.max(0, Math.floor(corners.bl.y));
  const leftEnd = Math.min(h, Math.ceil(corners.tl.y));

  ctx.beginPath();
  ctx.moveTo(ox + corners.tl.x, oy + corners.tl.y);

  for (let x = topStart; x <= topEnd; x++){
    ctx.lineTo(ox + x, oy + sample(bounds.top, x));
  }
  ctx.lineTo(ox + corners.tr.x, oy + corners.tr.y);

  for (let y = rightStart; y <= rightEnd; y++){
    ctx.lineTo(ox + sample(bounds.right, y), oy + y);
  }
  ctx.lineTo(ox + corners.br.x, oy + corners.br.y);

  for (let x = bottomStart; x >= bottomEnd; x--){
    ctx.lineTo(ox + x, oy + sample(bounds.bottom, x));
  }
  ctx.lineTo(ox + corners.bl.x, oy + corners.bl.y);

  for (let y = leftStart; y >= leftEnd; y--){
    ctx.lineTo(ox + sample(bounds.left, y), oy + y);
  }
  ctx.lineTo(ox + corners.tl.x, oy + corners.tl.y);
  ctx.closePath();
}

function computeOutputInsets(withShadow, withOutline){
  let left = 0;
  let right = 0;
  let top = 0;
  let bottom = 0;

  if (withOutline){
    const outlineInset = 2;
    left = Math.max(left, outlineInset);
    right = Math.max(right, outlineInset);
    top = Math.max(top, outlineInset);
    bottom = Math.max(bottom, outlineInset);
  }

  if (withShadow){
    const spread = Math.ceil(SHADOW_BLUR * 2);
    left = Math.max(left, spread + Math.max(0, -SHADOW_OFFSET_X));
    right = Math.max(right, spread + Math.max(0, SHADOW_OFFSET_X));
    top = Math.max(top, spread + Math.max(0, -SHADOW_OFFSET_Y));
    bottom = Math.max(bottom, spread + Math.max(0, SHADOW_OFFSET_Y));
  }

  return { left, right, top, bottom };
}

cropBtn.addEventListener('click', () => {
  if (!hasValidSelection(rect, 2)) {
    window.alert(t('alertNeedSelection'));
    return;
  }
  renderOutputPreview();
});

downloadBtn.addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = outCanvas.toDataURL('image/png');
  a.download = buildDownloadFilename();
  a.click();
});

copyBtn.addEventListener('click', async () => {
  outCanvas.toBlob(async (blob) => {
    try{
      if (!blob){
        showStatus('alertClipboardCopyFail', 'error');
        return;
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showStatus('statusCopySuccess', 'success', 3000);
    } catch (e){
      showStatus('alertClipboardCopyFail', 'error');
    }
  });
});

resetBtn.addEventListener('click', () => {
  rect = null;
  if (img) redrawSource();
  clearOutput();
  updateSelectionUi();
});

applyAllEdgesBtn.addEventListener('click', () => {
  setAllEdges(selectedEdgeMode);
});

for (const card of edgeCards){
  card.addEventListener('click', () => {
    selectEdgeMode(card.dataset.mode || 'straight');
  });
}

for (const button of edgeAssignButtons){
  button.addEventListener('click', () => {
    applySelectedModeToEdge(button.dataset.edge);
  });
}

for (const input of [edgeTop, edgeRight, edgeBottom, edgeLeft]){
  input.addEventListener('change', () => {
    updateEdgeUi();
    saveEdgeSettings();
    if (img) redrawSource();
    renderOutputPreview();
  });
}

roughnessInput.addEventListener('input', () => {
  saveEdgeSettings();
  if (img) redrawSource();
  renderEdgeGalleryPreviews();
  renderOutputPreview();
});
outlineEnabled.addEventListener('change', renderOutputPreview);
shadowEnabled.addEventListener('change', renderOutputPreview);
outlineEnabled.addEventListener('change', saveEdgeSettings);
shadowEnabled.addEventListener('change', saveEdgeSettings);
window.addEventListener('resize', () => {
  if (img) redrawSource();
});

srcCanvas.width = 960;
srcCanvas.height = 420;
restoreEdgeSettings();
updateSourceState();
applyLanguage(getInitialLanguage());
selectEdgeMode(selectedEdgeMode);
updateSelectionUi();
canPersistEdgeSettings = true;
saveEdgeSettings();

if (typeof module !== 'undefined' && module.exports){
  module.exports = {
    applyLanguage,
    getInitialLanguage,
    updateSelectionUi,
    loadImageFromBlob,
    uploadFromClipboard,
    setAllEdges,
    _getState(){
      return {
        img,
        rect,
        currentLang,
        currentLoadToken,
        currentObjectUrl
      };
    },
    _setRect(nextRect){
      rect = nextRect;
    },
    _setImage(nextImg){
      img = nextImg;
      updateSourceState();
    }
  };
}
