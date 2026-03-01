const test = require('node:test');
const assert = require('node:assert/strict');

const { hasValidSelection, getSelectionText, getSelectionHintKey } = require('../ui-state.js');

test('hasValidSelection enforces minimum size', () => {
  assert.equal(hasValidSelection(null, 2), false);
  assert.equal(hasValidSelection({ w: 1, h: 3 }, 2), false);
  assert.equal(hasValidSelection({ w: 2, h: 2 }, 2), true);
});

test('getSelectionText returns rounded dimensions', () => {
  assert.equal(getSelectionText(null), '');
  assert.equal(getSelectionText({ w: 20.2, h: 10.6 }), '20×11px');
});

test('getSelectionHintKey returns state-specific key', () => {
  assert.equal(getSelectionHintKey(false, null, 2), 'hintNoImage');
  assert.equal(getSelectionHintKey(true, null, 2), 'hintNeedSelection');
  assert.equal(getSelectionHintKey(true, { w: 1, h: 5 }, 2), 'hintSelectionTooSmall');
  assert.equal(getSelectionHintKey(true, { w: 5, h: 5 }, 2), 'hintReady');
});
