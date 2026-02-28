const fileInput = document.getElementById('fileInput');
const srcCanvas = document.getElementById('srcCanvas');
const outCanvas = document.getElementById('outCanvas');
const cropBtn = document.getElementById('cropBtn');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const resetBtn = document.getElementById('resetBtn');
const roughnessInput = document.getElementById('roughness');

const edgeTop = document.getElementById('edgeTop');
const edgeRight = document.getElementById('edgeRight');
const edgeBottom = document.getElementById('edgeBottom');
const edgeLeft = document.getElementById('edgeLeft');
const allStraightBtn = document.getElementById('allStraightBtn');
const allTornBtn = document.getElementById('allTornBtn');

const srcCtx = srcCanvas.getContext('2d');
const outCtx = outCanvas.getContext('2d');

let img = null;
let dragging = false;
let startX = 0, startY = 0;
let rect = null;

const PAD = 32;           // 画像まわりの余白(px)
let imgOX = 0, imgOY = 0; // 画像の描画オフセット

// --- Anisotropy + H (UIなし固定) ---
// 繊維方向 = 上下（vertical）
// left/right: 繊維と平行 (parallel)
// top/bottom: 繊維と直交 (perpendicular)
const H_PAR = 0.70;
const H_PER = 0.62;
const AMP_PAR = 0.85;
const AMP_PER = 1.10;
const BASE_SEED = 12345; // 再現性のため固定

function setAllEdges(mode){
  edgeTop.value = mode;
  edgeRight.value = mode;
  edgeBottom.value = mode;
  edgeLeft.value = mode;
}
allStraightBtn.addEventListener('click', () => setAllEdges('straight'));
allTornBtn.addEventListener('click', () => setAllEdges('torn'));

// ---- deterministic PRNG ----
function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function clamp(n, lo, hi){ return Math.min(Math.max(n, lo), hi); }

// Gaussian-ish noise (Box–Muller)
function gauss(rnd){
  let u = 0, v = 0;
  while (u === 0) u = rnd();
  while (v === 0) v = rnd();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function nextPow2Plus1(minLen){
  let n = 2;
  while (n + 1 < minLen) n <<= 1;
  return n + 1;
}

// 0平均の自己アフィン揺らぎプロファイル（長さ lengthPx+1 の配列を返す）
function fbmMidpointProfile(lengthPx, rough, H, ampMul, seed){
  const rnd = mulberry32(seed);

  const N = nextPow2Plus1(Math.floor(lengthPx) + 1);
  const y = new Array(N).fill(0);
  y[0] = 0;
  y[N - 1] = 0;

  // 初期標準偏差：roughnessに連動（異方性倍率）
  let sigma = rough * 1.0 * ampMul;

  let step = N - 1;
  while (step > 1){
    const half = step >> 1;

    for (let i = 0; i < N - 1; i += step){
      const mid = i + half;
      const avg = 0.5 * (y[i] + y[i + step]);
      y[mid] = avg + gauss(rnd) * sigma;
    }

    step = half;
    sigma *= Math.pow(0.5, H);
  }

  // lengthPx に線形補間でリサンプル
  const out = new Array(lengthPx + 1);
  for (let x = 0; x <= lengthPx; x++){
    const u = (lengthPx === 0) ? 0 : (x / lengthPx);
    const idx = u * (N - 1);
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, N - 1);
    const a = idx - i0;
    out[x] = (1 - a) * y[i0] + a * y[i1];
  }
  return out;
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);

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

srcCanvas.addEventListener('mousedown', (e) => {
  if (!img) return;
  dragging = true;
  const r = srcCanvas.getBoundingClientRect();
  const p = clampToImageArea(e.clientX - r.left, e.clientY - r.top);
  startX = p.x;
  startY = p.y;
});

srcCanvas.addEventListener('mousemove', (e) => {
  if (!dragging || !img) return;
  const r = srcCanvas.getBoundingClientRect();
  const p = clampToImageArea(e.clientX - r.left, e.clientY - r.top);
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

// --- Edge-aware path using self-affine profiles (H fixed, anisotropy by edge) ---
function buildEdgeAwarePath(ctx, w, h, rough, edges){
  const t = Math.min(60, Math.floor(Math.min(w, h) / 3));

  // 帯域内の中心位置（0..t）
  const baseTop = t * 0.25;
  const baseBottom = t * 0.80;
  const baseLeft = t * 0.25;
  const baseRight = t * 0.80;

  // 繊維方向=上下（vertical）: left/right 平行、top/bottom 直交
  const H_top = H_PER, amp_top = AMP_PER;
  const H_bottom = H_PER, amp_bottom = AMP_PER;
  const H_left = H_PAR, amp_left = AMP_PAR;
  const H_right = H_PAR, amp_right = AMP_PAR;

  ctx.moveTo(0, 0);

  // top: (0,0) -> (w,0)
  if (edges.top === 'torn'){
    const prof = fbmMidpointProfile(w, rough, H_top, amp_top, BASE_SEED + 1);
    for (let x = 0; x <= w; x++){
      const y = clamp(baseTop + prof[x], 0, t);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, 0);
  } else {
    ctx.lineTo(w, 0);
  }

  // right: (w,0) -> (w,h)
  if (edges.right === 'torn'){
    const prof = fbmMidpointProfile(h, rough, H_right, amp_right, BASE_SEED + 2);
    for (let y = 0; y <= h; y++){
      const xBand = clamp(baseRight + prof[y], 0, t);
      ctx.lineTo(w - (t - xBand), y);
    }
    ctx.lineTo(w, h);
  } else {
    ctx.lineTo(w, h);
  }

  // bottom: (w,h) -> (0,h)
  if (edges.bottom === 'torn'){
    const prof = fbmMidpointProfile(w, rough, H_bottom, amp_bottom, BASE_SEED + 3);
    for (let x = w; x >= 0; x--){
      const yBand = clamp(baseBottom + prof[x], 0, t);
      ctx.lineTo(x, h - (t - yBand));
    }
    ctx.lineTo(0, h);
  } else {
    ctx.lineTo(0, h);
  }

  // left: (0,h) -> (0,0)
  if (edges.left === 'torn'){
    const prof = fbmMidpointProfile(h, rough, H_left, amp_left, BASE_SEED + 4);
    for (let y = h; y >= 0; y--){
      const xBand = clamp(baseLeft + prof[y], 0, t);
      ctx.lineTo(xBand, y);
    }
    ctx.lineTo(0, 0);
  } else {
    ctx.lineTo(0, 0);
  }

  ctx.closePath();
}

cropBtn.addEventListener('click', () => {
  if (!rect || rect.w < 2 || rect.h < 2) return;

  const w = Math.round(rect.w);
  const h = Math.round(rect.h);
  outCanvas.width = w;
  outCanvas.height = h;
  outCtx.clearRect(0, 0, w, h);

  // 画像座標へ変換（余白オフセットを引く）
  const sx = rect.x - imgOX;
  const sy = rect.y - imgOY;

  outCtx.save();
  const rough = Number(roughnessInput.value);

  outCtx.beginPath();
  buildEdgeAwarePath(outCtx, w, h, rough, {
    top: edgeTop.value,
    right: edgeRight.value,
    bottom: edgeBottom.value,
    left: edgeLeft.value
  });
  outCtx.clip();

  outCtx.drawImage(img, sx, sy, rect.w, rect.h, 0, 0, w, h);
  outCtx.restore();

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
