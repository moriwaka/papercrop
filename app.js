const fileInput = document.getElementById('fileInput');
const srcCanvas = document.getElementById('srcCanvas');
const outCanvas = document.getElementById('outCanvas');
const cropBtn = document.getElementById('cropBtn');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const resetBtn = document.getElementById('resetBtn');
const roughnessInput = document.getElementById('roughness');
const outlineEnabled = document.getElementById('outlineEnabled');
const shadowEnabled = document.getElementById('shadowEnabled');

const edgeTop = document.getElementById('edgeTop');
const edgeRight = document.getElementById('edgeRight');
const edgeBottom = document.getElementById('edgeBottom');
const edgeLeft = document.getElementById('edgeLeft');
const allStraightBtn = document.getElementById('allStraightBtn');
const allTornBtn = document.getElementById('allTornBtn');

const srcCtx = srcCanvas.getContext('2d');
const outCtx = outCanvas.getContext('2d');
const { buildEdgeBounds, applyEdgeMask, findCornerIntersections, sample } = window.PaperCropEdgeMask;
const SHADOW_COLOR = 'rgba(0, 0, 0, 0.45)';
const SHADOW_BLUR = 14;
const SHADOW_OFFSET_X = 0;
const SHADOW_OFFSET_Y = 6;

let img = null;
let dragging = false;
let startX = 0, startY = 0;
let rect = null;
let currentObjectUrl = null;

const PAD = 32;           // 画像まわりの余白(px)
let imgOX = 0, imgOY = 0; // 画像の描画オフセット

function setAllEdges(mode){
  edgeTop.value = mode;
  edgeRight.value = mode;
  edgeBottom.value = mode;
  edgeLeft.value = mode;
}
allStraightBtn.addEventListener('click', () => setAllEdges('straight'));
allTornBtn.addEventListener('click', () => setAllEdges('torn'));

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  if (currentObjectUrl){
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
  const url = URL.createObjectURL(file);
  currentObjectUrl = url;

  img = new Image();
  img.onload = () => {
    imgOX = PAD;
    imgOY = PAD;

    srcCanvas.width  = img.width  + PAD * 2;
    srcCanvas.height = img.height + PAD * 2;

    srcCtx.clearRect(0, 0, srcCanvas.width, srcCanvas.height);
    srcCtx.drawImage(img, imgOX, imgOY);

    rect = null;
    cropBtn.disabled = false;
    downloadBtn.disabled = true;
    copyBtn.disabled = true;
    outCtx.clearRect(0, 0, outCanvas.width, outCanvas.height);
    if (currentObjectUrl === url){
      URL.revokeObjectURL(url);
      currentObjectUrl = null;
    }
  };
  img.onerror = () => {
    if (currentObjectUrl === url){
      URL.revokeObjectURL(url);
      currentObjectUrl = null;
    }
  };
  img.src = url;
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

srcCanvas.addEventListener('mousedown', (e) => {
  if (!img) return;
  dragging = true;
  const pt = getCanvasPoint(e);
  const p = clampToImageArea(pt.x, pt.y);
  startX = p.x;
  startY = p.y;
});

srcCanvas.addEventListener('mousemove', (e) => {
  if (!dragging || !img) return;
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
});

srcCanvas.addEventListener('mouseup', () => dragging = false);
srcCanvas.addEventListener('mouseleave', () => dragging = false);

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
        alert('Clipboard copy failed');
        return;
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch (e){
      alert('Clipboard copy failed');
    }
  });
});

resetBtn.addEventListener('click', () => {
  rect = null;
  if (img) redrawSource();
  outCtx.clearRect(0, 0, outCanvas.width, outCanvas.height);
  downloadBtn.disabled = true;
  copyBtn.disabled = true;
});
