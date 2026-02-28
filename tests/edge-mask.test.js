const test = require('node:test');
const assert = require('node:assert/strict');

const { buildEdgeBounds, applyEdgeMask } = require('../edge-mask.js');

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
