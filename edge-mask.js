(function(root, factory){
  if (typeof module !== 'undefined' && module.exports){
    module.exports = factory();
  } else {
    root.PaperCropEdgeMask = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  const H_PAR = 0.70;
  const H_PER = 0.62;
  const AMP_PAR = 0.85;
  const AMP_PER = 1.10;
  const BASE_SEED = 12345;
  const EDGE_MODES = new Set(['straight', 'torn', 'deckle', 'wavy', 'stamp']);

  function mulberry32(seed){
    let t = seed >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(n, lo, hi){
    return Math.min(Math.max(n, lo), hi);
  }

  function lerp(a, b, t){
    return a + (b - a) * t;
  }

  function smoothstep(t){
    const u = clamp(t, 0, 1);
    return u * u * (3 - 2 * u);
  }

  function gauss(rnd){
    let u = 0;
    let v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  function nextPow2Plus1(minLen){
    let n = 2;
    while (n + 1 < minLen) n <<= 1;
    return n + 1;
  }

  function fbmMidpointProfile(lengthPx, rough, H, ampMul, seed){
    const rnd = mulberry32(seed);

    const N = nextPow2Plus1(Math.floor(lengthPx) + 1);
    const y = new Array(N).fill(0);
    y[0] = 0;
    y[N - 1] = 0;

    let sigma = rough * ampMul;
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

    const out = new Array(lengthPx + 1);
    for (let x = 0; x <= lengthPx; x++){
      const u = lengthPx === 0 ? 0 : (x / lengthPx);
      const idx = u * (N - 1);
      const i0 = Math.floor(idx);
      const i1 = Math.min(i0 + 1, N - 1);
      const a = idx - i0;
      out[x] = (1 - a) * y[i0] + a * y[i1];
    }
    return out;
  }

  function taperProfile(profile, amount){
    if (!amount) return profile;
    const last = profile.length - 1;
    if (last <= 1) return profile;
    for (let i = 0; i <= last; i++){
      const u = i / last;
      const edgeDist = Math.min(u, 1 - u);
      const fade = smoothstep(clamp(edgeDist / amount, 0, 1));
      profile[i] *= fade;
    }
    return profile;
  }

  function buildCurveProfile(lengthPx, amplitude, minSeg, maxSeg, seed){
    const rnd = mulberry32(seed);
    const anchors = [{ x: 0, y: 0 }];
    let x = 0;

    while (x < lengthPx){
      const seg = clamp(Math.round(lerp(minSeg, maxSeg, rnd())), 2, Math.max(2, lengthPx));
      x = Math.min(lengthPx, x + seg);
      anchors.push({ x, y: (rnd() * 2 - 1) * amplitude });
    }
    anchors[anchors.length - 1].y = 0;

    const out = new Array(lengthPx + 1).fill(0);
    let index = 0;
    for (let i = 0; i < anchors.length - 1; i++){
      const a = anchors[i];
      const b = anchors[i + 1];
      const span = Math.max(1, b.x - a.x);
      while (index <= b.x){
        const t = (index - a.x) / span;
        out[index] = lerp(a.y, b.y, smoothstep(t));
        index++;
      }
    }

    return out;
  }

  function buildStampProfile(lengthPx, rough, baseAmplitude, seed){
    const rnd = mulberry32(seed);
    const period = clamp(Math.round(lerp(18, 10, (rough - 2) / 18)), 8, 24);
    const notchWidth = clamp(Math.round(period * lerp(0.3, 0.46, rnd())), 3, Math.max(3, period - 3));
    const notchDepth = baseAmplitude * lerp(0.45, 1.05, (rough - 2) / 18);
    const tearNoise = buildCurveProfile(lengthPx, Math.max(0.6, baseAmplitude * 0.28), 5, 10, seed + 17);
    const out = new Array(lengthPx + 1).fill(0);

    for (let x = 0; x <= lengthPx; x++){
      const local = x % period;
      const center = period * 0.5;
      let notch = 0;
      if (Math.abs(local - center) <= notchWidth * 0.5){
        const u = 1 - Math.abs(local - center) / (notchWidth * 0.5 || 1);
        notch = notchDepth * Math.pow(smoothstep(u), 0.85);
      }
      const tearMix = rnd() < 0.18 ? 1.0 : 0.55;
      out[x] = notch + tearNoise[x] * tearMix;
    }

    return taperProfile(out, 0.12);
  }

  function buildModeProfile(lengthPx, rough, mode, seed, axisAmpMul){
    if (!EDGE_MODES.has(mode) || mode === 'straight'){
      return new Array(lengthPx + 1).fill(0);
    }

    const intensity = clamp((rough - 2) / 18, 0, 1);
    const baseAmplitude = rough * axisAmpMul;

    if (mode === 'torn'){
      return taperProfile(
        fbmMidpointProfile(lengthPx, rough, axisAmpMul === AMP_PER ? H_PER : H_PAR, axisAmpMul, seed),
        0.10
      );
    }

    if (mode === 'deckle'){
      const coarse = buildCurveProfile(lengthPx, baseAmplitude * lerp(0.22, 0.42, intensity), 5, 12, seed + 31);
      const fine = buildCurveProfile(lengthPx, baseAmplitude * lerp(0.08, 0.18, intensity), 2, 5, seed + 37);
      const out = new Array(lengthPx + 1);
      for (let i = 0; i <= lengthPx; i++){
        out[i] = coarse[i] + fine[i];
      }
      return taperProfile(out, 0.16);
    }

    if (mode === 'wavy'){
      const rnd = mulberry32(seed + 53);
      const cycles = lerp(1.1, 2.6, intensity) * lerp(0.85, 1.15, rnd());
      const amp = baseAmplitude * lerp(0.22, 0.48, intensity);
      const drift = buildCurveProfile(lengthPx, amp * 0.25, Math.max(10, lengthPx / 6), Math.max(18, lengthPx / 3), seed + 59);
      const flutter = buildCurveProfile(lengthPx, amp * 0.08, 8, 16, seed + 61);
      const phase = rnd() * Math.PI * 2;
      const out = new Array(lengthPx + 1);
      for (let i = 0; i <= lengthPx; i++){
        const u = lengthPx === 0 ? 0 : i / lengthPx;
        out[i] = Math.sin(phase + u * Math.PI * 2 * cycles) * amp + drift[i] + flutter[i];
      }
      return taperProfile(out, 0.22);
    }

    return buildStampProfile(lengthPx, rough, Math.max(1, baseAmplitude * 0.7), seed + 71);
  }

  function buildSingleEdge(lengthPx, rough, mode, baseInset, maxInset, seed, axisAmpMul, invert){
    const profile = buildModeProfile(lengthPx, rough, mode, seed, axisAmpMul);
    const out = new Array(lengthPx + 1);
    for (let i = 0; i <= lengthPx; i++){
      const value = clamp(baseInset + profile[i], 0, maxInset);
      out[i] = invert ? invert - value : value;
    }
    return out;
  }

  function buildEdgeBounds(w, h, rough, edges){
    const t = Math.min(60, Math.floor(Math.min(w, h) / 3));

    const top = buildSingleEdge(w, rough, edges.top, t * 0.22, t, BASE_SEED + 1, AMP_PER, null);
    const right = buildSingleEdge(h, rough, edges.right, t * 0.22, t, BASE_SEED + 2, AMP_PAR, w);
    const bottom = buildSingleEdge(w, rough, edges.bottom, t * 0.22, t, BASE_SEED + 3, AMP_PER, h);
    const left = buildSingleEdge(h, rough, edges.left, t * 0.22, t, BASE_SEED + 4, AMP_PAR, null);

    if (edges.top === 'straight'){
      top.fill(0);
    }
    if (edges.right === 'straight'){
      right.fill(w);
    }
    if (edges.bottom === 'straight'){
      bottom.fill(h);
    }
    if (edges.left === 'straight'){
      left.fill(0);
    }

    return { top, right, bottom, left };
  }

  function sample(arr, t){
    const lo = 0;
    const hi = arr.length - 1;
    if (t <= lo) return arr[lo];
    if (t >= hi) return arr[hi];
    const i0 = Math.floor(t);
    const i1 = Math.min(i0 + 1, hi);
    const a = t - i0;
    return (1 - a) * arr[i0] + a * arr[i1];
  }

  function findCornerIntersections(bounds, w, h){
    const { top, right, bottom, left } = bounds;

    function solveTL(){
      let x = 0;
      let y = top[0];
      for (let i = 0; i < 12; i++){
        y = sample(top, x);
        x = sample(left, y);
      }
      return { x, y };
    }

    function solveTR(){
      let x = w;
      let y = top[w];
      for (let i = 0; i < 12; i++){
        y = sample(top, x);
        x = sample(right, y);
      }
      return { x, y };
    }

    function solveBR(){
      let x = w;
      let y = bottom[w];
      for (let i = 0; i < 12; i++){
        y = sample(bottom, x);
        x = sample(right, y);
      }
      return { x, y };
    }

    function solveBL(){
      let x = 0;
      let y = bottom[0];
      for (let i = 0; i < 12; i++){
        y = sample(bottom, x);
        x = sample(left, y);
      }
      return { x, y };
    }

    return {
      tl: solveTL(),
      tr: solveTR(),
      br: solveBR(),
      bl: solveBL()
    };
  }

  function applyEdgeMask(imageData, bounds, w, h){
    const { top, right, bottom, left } = bounds;
    const data = imageData.data;
    const corners = findCornerIntersections(bounds, w, h);

    for (let y = 0; y < h; y++){
      const rowOffset = y * w * 4;
      for (let x = 0; x < w; x++){
        const px = x + 0.5;
        const py = y + 0.5;
        let inside = true;

        if ((px < corners.tl.x && py < corners.tl.y) ||
            (px > corners.tr.x && py < corners.tr.y) ||
            (px > corners.br.x && py > corners.br.y) ||
            (px < corners.bl.x && py > corners.bl.y)){
          inside = false;
        }

        if (px >= corners.tl.x && px <= corners.tr.x){
          inside = inside && py >= sample(top, px);
        }
        if (px >= corners.bl.x && px <= corners.br.x){
          inside = inside && py <= sample(bottom, px);
        }
        if (py >= corners.tl.y && py <= corners.bl.y){
          inside = inside && px >= sample(left, py);
        }
        if (py >= corners.tr.y && py <= corners.br.y){
          inside = inside && px <= sample(right, py);
        }

        if (!inside){
          data[rowOffset + x * 4 + 3] = 0;
        }
      }
    }
  }

  return {
    buildEdgeBounds,
    applyEdgeMask,
    findCornerIntersections,
    sample
  };
});
