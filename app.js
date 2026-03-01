const fileInput = document.getElementById('fileInput');
const srcCanvas = document.getElementById('srcCanvas');
const outCanvas = document.getElementById('outCanvas');
const cropBtn = document.getElementById('cropBtn');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const resetBtn = document.getElementById('resetBtn');
const newUploadBtn = document.getElementById('newUploadBtn');
const pasteUploadBtn = document.getElementById('pasteUploadBtn');
const langSelect = document.getElementById('langSelect');
const roughnessInput = document.getElementById('roughness');
const outlineEnabled = document.getElementById('outlineEnabled');
const shadowEnabled = document.getElementById('shadowEnabled');
const srcDropZone = document.getElementById('srcDropZone');
const srcHint = document.getElementById('srcHint');
const mainDesc = document.getElementById('mainDesc');
const sourceDesc = document.getElementById('sourceDesc');
const langLabel = document.getElementById('langLabel');
const edgeTopLabel = document.getElementById('edgeTopLabel');
const edgeRightLabel = document.getElementById('edgeRightLabel');
const edgeBottomLabel = document.getElementById('edgeBottomLabel');
const edgeLeftLabel = document.getElementById('edgeLeftLabel');
const edgeCenterLabel = document.getElementById('edgeCenterLabel');
const roughnessLabel = document.getElementById('roughnessLabel');
const outlineLabel = document.getElementById('outlineLabel');
const shadowLabel = document.getElementById('shadowLabel');
const selectionHint = document.getElementById('selectionHint');
const statusMessage = document.getElementById('statusMessage');

const edgeTop = document.getElementById('edgeTop');
const edgeRight = document.getElementById('edgeRight');
const edgeBottom = document.getElementById('edgeBottom');
const edgeLeft = document.getElementById('edgeLeft');
const allStraightBtn = document.getElementById('allStraightBtn');
const allTornBtn = document.getElementById('allTornBtn');

const srcCtx = srcCanvas.getContext('2d');
const outCtx = outCanvas.getContext('2d');
const { buildEdgeBounds, applyEdgeMask, findCornerIntersections, sample } = window.PaperCropEdgeMask;
const { hasValidSelection, getSelectionText, getSelectionHintKey } = window.PaperCropUiState;
const SHADOW_COLOR = 'rgba(0, 0, 0, 0.45)';
const SHADOW_BLUR = 14;
const SHADOW_OFFSET_X = 0;
const SHADOW_OFFSET_Y = 6;

let img = null;
let dragging = false;
let activePointerId = null;
let startX = 0, startY = 0;
let rect = null;
let currentObjectUrl = null;
let currentLang = 'ja';

const PAD = 32;           // 画像まわりの余白(px)
let imgOX = 0, imgOY = 0; // 画像の描画オフセット
const I18N = {
  ja: {
    langLabel: '言語',
    mainDesc: '画像を四角形で切り抜くツール。上下左右のエッジ形状を個別に指定できる。',
    edgeTopLabel: '上エッジ',
    edgeRightLabel: '右エッジ',
    edgeBottomLabel: '下エッジ',
    edgeLeftLabel: '左エッジ',
    edgeCenterLabel: 'エッジ形状',
    roughnessLabel: '破れ強度',
    outlineLabel: '輪郭線',
    shadowLabel: 'ドロップシャドウ',
    allStraightBtn: '全て直線',
    allTornBtn: '全て破れ',
    sourceDesc: '画像上でドラッグして切り抜き範囲を指定する。余白上でドラッグしても、選択領域は画像を越えない。',
    newUploadBtn: '新規アップロード',
    pasteUploadBtn: 'クリップボードから貼り付け',
    resetBtn: 'リセット',
    srcHint: 'ここをクリック / ドロップで画像をアップロード',
    cropBtn: '切り抜き',
    downloadBtn: 'PNGをダウンロード',
    copyBtn: 'クリップボードにコピー',
    edgeStraight: '直線',
    edgeTorn: '紙を破った風',
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
    dropzoneAriaLabel: '画像をアップロード'
  },
  en: {
    langLabel: 'Language',
    mainDesc: 'A tool to crop images into rectangular regions with per-edge shape control.',
    edgeTopLabel: 'Top Edge',
    edgeRightLabel: 'Right Edge',
    edgeBottomLabel: 'Bottom Edge',
    edgeLeftLabel: 'Left Edge',
    edgeCenterLabel: 'Edge Shape',
    roughnessLabel: 'Tear Roughness',
    outlineLabel: 'Outline',
    shadowLabel: 'Drop Shadow',
    allStraightBtn: 'All Straight',
    allTornBtn: 'All Torn',
    sourceDesc: 'Drag on the image to select a crop region. Dragging over margin is clamped to image bounds.',
    newUploadBtn: 'Upload New Image',
    pasteUploadBtn: 'Paste from Clipboard',
    resetBtn: 'Reset',
    srcHint: 'Click or drop an image here to upload',
    cropBtn: 'Crop',
    downloadBtn: 'Download PNG',
    copyBtn: 'Copy to Clipboard',
    edgeStraight: 'Straight',
    edgeTorn: 'Torn Paper',
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
    dropzoneAriaLabel: 'Upload an image'
  }
};

function t(key){
  const pack = I18N[currentLang] || I18N.ja;
  return pack[key] || key;
}

function applyLanguage(lang){
  if (!I18N[lang]) lang = 'ja';
  currentLang = lang;
  document.documentElement.lang = lang;
  langSelect.value = lang;
  try {
    localStorage.setItem('papercrop_lang', lang);
  } catch (e){
    // ignore storage errors
  }

  langLabel.textContent = t('langLabel');
  mainDesc.textContent = t('mainDesc');
  edgeTopLabel.textContent = t('edgeTopLabel');
  edgeRightLabel.textContent = t('edgeRightLabel');
  edgeBottomLabel.textContent = t('edgeBottomLabel');
  edgeLeftLabel.textContent = t('edgeLeftLabel');
  edgeCenterLabel.textContent = t('edgeCenterLabel');
  roughnessLabel.textContent = t('roughnessLabel');
  outlineLabel.textContent = t('outlineLabel');
  shadowLabel.textContent = t('shadowLabel');
  allStraightBtn.textContent = t('allStraightBtn');
  allTornBtn.textContent = t('allTornBtn');
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

  for (const option of document.querySelectorAll('select option[value="straight"]')){
    option.textContent = t('edgeStraight');
  }
  for (const option of document.querySelectorAll('select option[value="torn"]')){
    option.textContent = t('edgeTorn');
  }
}

function getInitialLanguage(){
  try {
    const saved = localStorage.getItem('papercrop_lang');
    if (saved && I18N[saved]) return saved;
  } catch (e){
    // ignore storage errors
  }
  const navLang = (navigator.language || '').toLowerCase();
  if (navLang.startsWith('ja')) return 'ja';
  return 'en';
}

function setAllEdges(mode){
  edgeTop.value = mode;
  edgeRight.value = mode;
  edgeBottom.value = mode;
  edgeLeft.value = mode;
}
allStraightBtn.addEventListener('click', () => setAllEdges('straight'));
allTornBtn.addEventListener('click', () => setAllEdges('torn'));

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
  const key = getSelectionHintKey(Boolean(img), rect, 2);
  let text = t(key);
  const dims = getSelectionText(rect);
  if (dims && hasValidSelection(rect, 2)){
    text = `${text} (${dims})`;
  }
  selectionHint.textContent = text;
  cropBtn.disabled = !img || !hasValidSelection(rect, 2);
}

function loadImageFromBlob(blob){
  revokeCurrentObjectUrl();
  const url = URL.createObjectURL(blob);
  currentObjectUrl = url;

  const nextImg = new Image();
  nextImg.onload = () => {
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
  loadImageFromBlob(file);
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
    srcCtx.strokeStyle = 'rgba(0, 255, 0, 0.9)'; // 緑の点線
    srcCtx.lineWidth = 2;
    srcCtx.setLineDash([6,4]);
    srcCtx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    srcCtx.setLineDash([]);
    const dims = getSelectionText(rect);
    if (dims){
      srcCtx.font = '12px sans-serif';
      const labelPadding = 6;
      const metrics = srcCtx.measureText(dims);
      const bw = metrics.width + labelPadding * 2;
      const bh = 20;
      let bx = rect.x;
      let by = rect.y - bh - 4;
      if (by < 0) by = rect.y + 4;
      if (bx + bw > srcCanvas.width) bx = srcCanvas.width - bw - 2;
      srcCtx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      srcCtx.fillRect(bx, by, bw, bh);
      srcCtx.fillStyle = '#ffffff';
      srcCtx.fillText(dims, bx + labelPadding, by + 14);
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
  if (!rect || rect.w < 2 || rect.h < 2) return;

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

  // 画像座標へ変換（余白オフセットを引く）
  const sx = rect.x - imgOX;
  const sy = rect.y - imgOY;

  const rough = Number(roughnessInput.value);
  const bounds = buildEdgeBounds(w, h, rough, {
    top: edgeTop.value,
    right: edgeRight.value,
    bottom: edgeBottom.value,
    left: edgeLeft.value
  });

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
});

downloadBtn.addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = outCanvas.toDataURL('image/png');
  a.download = 'paper-crop.png';
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

srcCanvas.width = 960;
srcCanvas.height = 420;
updateSourceState();
applyLanguage(getInitialLanguage());
updateSelectionUi();
langSelect.addEventListener('change', () => {
  applyLanguage(langSelect.value);
});
