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

  function buildEdgeBounds(w, h, rough, edges){
    const t = Math.min(60, Math.floor(Math.min(w, h) / 3));

    const baseTop = t * 0.25;
    const baseBottom = t * 0.80;
    const baseLeft = t * 0.25;
    const baseRight = t * 0.80;

    const topProf = edges.top === 'torn' ? fbmMidpointProfile(w, rough, H_PER, AMP_PER, BASE_SEED + 1) : null;
    const rightProf = edges.right === 'torn' ? fbmMidpointProfile(h, rough, H_PAR, AMP_PAR, BASE_SEED + 2) : null;
    const bottomProf = edges.bottom === 'torn' ? fbmMidpointProfile(w, rough, H_PER, AMP_PER, BASE_SEED + 3) : null;
    const leftProf = edges.left === 'torn' ? fbmMidpointProfile(h, rough, H_PAR, AMP_PAR, BASE_SEED + 4) : null;

    const topY = (x) => topProf ? clamp(baseTop + topProf[x], 0, t) : 0;
    const rightX = (y) => rightProf ? (w - (t - clamp(baseRight + rightProf[y], 0, t))) : w;
    const bottomY = (x) => bottomProf ? (h - (t - clamp(baseBottom + bottomProf[x], 0, t))) : h;
    const leftX = (y) => leftProf ? clamp(baseLeft + leftProf[y], 0, t) : 0;

    const top = new Array(w + 1);
    const bottom = new Array(w + 1);
    const left = new Array(h + 1);
    const right = new Array(h + 1);

    for (let x = 0; x <= w; x++){
      top[x] = topY(x);
      bottom[x] = bottomY(x);
    }
    for (let y = 0; y <= h; y++){
      left[y] = leftX(y);
      right[y] = rightX(y);
    }

    return { top, right, bottom, left };
  }

  function applyEdgeMask(imageData, bounds, w, h){
    const { top, right, bottom, left } = bounds;
    const data = imageData.data;

    for (let y = 0; y < h; y++){
      const l = left[y];
      const r = right[y];
      const rowOffset = y * w * 4;
      for (let x = 0; x < w; x++){
        const inside =
          y >= top[x] &&
          y <= bottom[x] &&
          x >= l &&
          x <= r;
        if (!inside){
          data[rowOffset + x * 4 + 3] = 0;
        }
      }
    }
  }

  return {
    buildEdgeBounds,
    applyEdgeMask
  };
});
