const test = require('node:test');
const assert = require('node:assert/strict');

const { buildEdgeBounds, applyEdgeMask } = require('../edge-mask.js');
const EDGE_MODES = ['torn', 'deckle', 'wavy', 'stamp'];

function createImageData(w, h){
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++){
    data[i * 4 + 3] = 255;
  }
  return { data };
}

function alphaAt(imageData, w, x, y){
  return imageData.data[(y * w + x) * 4 + 3];
}

function getRange(values){
  let min = Infinity;
  let max = -Infinity;
  for (const value of values){
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return max - min;
}

function countSlopeTurns(values){
  let turns = 0;
  let prev = 0;
  for (let i = 1; i < values.length; i++){
    const delta = values[i] - values[i - 1];
    const sign = delta === 0 ? 0 : delta > 0 ? 1 : -1;
    if (sign && prev && sign !== prev){
      turns++;
    }
    if (sign) prev = sign;
  }
  return turns;
}

function findStampPeaks(values, threshold){
  const peaks = [];
  for (let i = 1; i < values.length - 1; i++){
    if (values[i] > threshold && values[i] >= values[i - 1] && values[i] >= values[i + 1]){
      peaks.push(i);
    }
  }
  return peaks;
}

function longestRunAtValue(values, target, epsilon, start = 0, end = values.length - 1){
  let longest = 0;
  let current = 0;
  for (let i = start; i <= end; i++){
    if (Math.abs(values[i] - target) <= epsilon){
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

test('straight edges keep full alpha mask', () => {
  const w = 24;
  const h = 18;
  const imageData = createImageData(w, h);
  const bounds = buildEdgeBounds(w, h, 8, {
    top: 'straight',
    right: 'straight',
    bottom: 'straight',
    left: 'straight'
  });

  applyEdgeMask(imageData, bounds, w, h);

  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      assert.equal(alphaAt(imageData, w, x, y), 255);
    }
  }
});

test('all torn edges remove all four corner pixels', () => {
  const w = 64;
  const h = 64;
  const imageData = createImageData(w, h);
  const bounds = buildEdgeBounds(w, h, 8, {
    top: 'torn',
    right: 'torn',
    bottom: 'torn',
    left: 'torn'
  });

  applyEdgeMask(imageData, bounds, w, h);

  assert.equal(alphaAt(imageData, w, 0, 0), 0);
  assert.equal(alphaAt(imageData, w, w - 1, 0), 0);
  assert.equal(alphaAt(imageData, w, 0, h - 1), 0);
  assert.equal(alphaAt(imageData, w, w - 1, h - 1), 0);
});

test('strong torn edges stay irregular without long clipped straight sections', () => {
  const bounds = buildEdgeBounds(160, 96, 20, {
    top: 'torn',
    right: 'straight',
    bottom: 'straight',
    left: 'straight'
  });

  const midStart = Math.floor(bounds.top.length * 0.1);
  const midEnd = Math.ceil(bounds.top.length * 0.9);
  const longestZeroRun = longestRunAtValue(bounds.top, 0, 1e-9, midStart, midEnd);

  assert.ok(longestZeroRun <= 2, 'torn edge should not flatten into a long straight segment after offset normalization');
});

test('edge bounds are deterministic for same inputs', () => {
  const a = buildEdgeBounds(80, 50, 12, {
    top: 'torn',
    right: 'straight',
    bottom: 'torn',
    left: 'straight'
  });
  const b = buildEdgeBounds(80, 50, 12, {
    top: 'torn',
    right: 'straight',
    bottom: 'torn',
    left: 'straight'
  });

  assert.deepEqual(a, b);
});

test('new edge modes are deterministic for same inputs', () => {
  for (const mode of EDGE_MODES){
    const a = buildEdgeBounds(110, 74, 11, {
      top: mode,
      right: 'straight',
      bottom: mode,
      left: 'straight'
    });
    const b = buildEdgeBounds(110, 74, 11, {
      top: mode,
      right: 'straight',
      bottom: mode,
      left: 'straight'
    });

    assert.deepEqual(a, b, `${mode} should be deterministic`);
  }
});

test('edge bounds stay non-crossing per scanline/column', () => {
  const w = 96;
  const h = 72;
  const bounds = buildEdgeBounds(w, h, 20, {
    top: 'torn',
    right: 'torn',
    bottom: 'torn',
    left: 'torn'
  });

  for (let x = 0; x <= w; x++){
    assert.ok(bounds.top[x] <= bounds.bottom[x]);
  }
  for (let y = 0; y <= h; y++){
    assert.ok(bounds.left[y] <= bounds.right[y]);
  }
});

test('all edge modes stay non-crossing per scanline/column', () => {
  const w = 128;
  const h = 96;

  for (const mode of EDGE_MODES){
    const bounds = buildEdgeBounds(w, h, 18, {
      top: mode,
      right: mode,
      bottom: mode,
      left: mode
    });

    for (let x = 0; x <= w; x++){
      assert.ok(bounds.top[x] <= bounds.bottom[x], `${mode} should not cross vertically`);
    }
    for (let y = 0; y <= h; y++){
      assert.ok(bounds.left[y] <= bounds.right[y], `${mode} should not cross horizontally`);
    }
  }
});

test('corner connector wedges are masked out', () => {
  const w = 96;
  const h = 72;
  const imageData = createImageData(w, h);
  const bounds = buildEdgeBounds(w, h, 16, {
    top: 'torn',
    right: 'torn',
    bottom: 'torn',
    left: 'torn'
  });

  applyEdgeMask(imageData, bounds, w, h);

  // Points near each corner where old logic could leave triangular artifacts.
  assert.equal(alphaAt(imageData, w, w - 2, 1), 0);
  assert.equal(alphaAt(imageData, w, 1, 1), 0);
  assert.equal(alphaAt(imageData, w, w - 2, h - 2), 0);
  assert.equal(alphaAt(imageData, w, 1, h - 2), 0);
});

test('all edge modes mask corner wedges without artifacts', () => {
  const w = 104;
  const h = 80;

  for (const mode of EDGE_MODES){
    const imageData = createImageData(w, h);
    const bounds = buildEdgeBounds(w, h, 14, {
      top: mode,
      right: mode,
      bottom: mode,
      left: mode
    });

    applyEdgeMask(imageData, bounds, w, h);

    assert.equal(alphaAt(imageData, w, 1, 1), 0, `${mode} top-left corner should be masked`);
    assert.equal(alphaAt(imageData, w, w - 2, 1), 0, `${mode} top-right corner should be masked`);
    assert.equal(alphaAt(imageData, w, 1, h - 2), 0, `${mode} bottom-left corner should be masked`);
    assert.equal(alphaAt(imageData, w, w - 2, h - 2), 0, `${mode} bottom-right corner should be masked`);
  }
});

test('deckle stays subtler than torn while remaining visibly irregular', () => {
  const torn = buildEdgeBounds(120, 80, 14, {
    top: 'torn',
    right: 'straight',
    bottom: 'straight',
    left: 'straight'
  });
  const deckle = buildEdgeBounds(120, 80, 14, {
    top: 'deckle',
    right: 'straight',
    bottom: 'straight',
    left: 'straight'
  });

  const tornRange = getRange(torn.top);
  const deckleRange = getRange(deckle.top);
  assert.ok(deckleRange > 1.5, 'deckle should not collapse to a straight edge');
  assert.ok(deckleRange < tornRange, 'deckle should be subtler than torn');
});

test('wavy stays low-frequency rather than turning into jagged noise', () => {
  const wavy = buildEdgeBounds(140, 88, 15, {
    top: 'wavy',
    right: 'straight',
    bottom: 'straight',
    left: 'straight'
  });
  const torn = buildEdgeBounds(140, 88, 15, {
    top: 'torn',
    right: 'straight',
    bottom: 'straight',
    left: 'straight'
  });

  const wavyTurns = countSlopeTurns(wavy.top);
  const tornTurns = countSlopeTurns(torn.top);
  assert.ok(wavyTurns >= 2, 'wavy should still have visible undulation');
  assert.ok(wavyTurns < tornTurns, 'wavy should have fewer slope reversals than torn');
});

test('stamp repeats structured notches without becoming perfectly periodic', () => {
  const bounds = buildEdgeBounds(144, 90, 16, {
    top: 'stamp',
    right: 'straight',
    bottom: 'straight',
    left: 'straight'
  });

  const threshold = Math.min(...bounds.top) + getRange(bounds.top) * 0.55;
  const peaks = findStampPeaks(bounds.top, threshold);
  assert.ok(peaks.length >= 5, 'stamp should create several notch peaks');

  const spacings = [];
  for (let i = 1; i < peaks.length; i++){
    spacings.push(peaks[i] - peaks[i - 1]);
  }
  const minSpacing = Math.min(...spacings);
  const maxSpacing = Math.max(...spacings);
  assert.ok(minSpacing >= 6, 'stamp peaks should be spaced apart');
  assert.ok(maxSpacing <= 22, 'stamp peaks should stay roughly periodic');

  const uniqueSamples = new Set(bounds.top.slice(12, 36).map((value) => value.toFixed(2)));
  assert.ok(uniqueSamples.size > 6, 'stamp should keep torn variation inside the repeated structure');
});
