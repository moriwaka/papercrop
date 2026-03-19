const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

function createEventTarget(){
  return {
    listeners: new Map(),
    addEventListener(type, handler){
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(handler);
    },
    dispatch(type, event = {}){
      for (const handler of this.listeners.get(type) || []){
        handler(event);
      }
    }
  };
}

function createClassList(){
  const set = new Set();
  return {
    toggle(name, force){
      if (force === undefined){
        if (set.has(name)){
          set.delete(name);
          return false;
        }
        set.add(name);
        return true;
      }
      if (force) set.add(name);
      else set.delete(name);
      return force;
    },
    contains(name){
      return set.has(name);
    }
  };
}

function createContextStub(){
  return {
    clearRect(){},
    drawImage(){},
    strokeRect(){},
    setLineDash(){},
    measureText(text){
      return { width: text.length * 7 };
    },
    fillRect(){},
    fillText(){},
    getImageData(){
      return { data: new Uint8ClampedArray(4) };
    },
    putImageData(){},
    beginPath(){},
    moveTo(){},
    lineTo(){},
    closePath(){},
    stroke(){},
    fill(){},
    save(){},
    restore(){},
    translate(){}
  };
}

function createElement(id, extras = {}){
  const target = createEventTarget();
  const element = {
    id,
    textContent: '',
    value: '',
    disabled: false,
    hidden: false,
    checked: false,
    width: 0,
    height: 0,
    files: [],
    style: {},
    className: '',
    classList: createClassList(),
    attributes: {},
    options: [],
    dataset: {},
    clickCalls: 0,
    setAttribute(name, value){
      this.attributes[name] = value;
    },
    getAttribute(name){
      return this.attributes[name];
    },
    click(){
      this.clickCalls += 1;
    },
    contains(){
      return false;
    },
    getContext(){
      return createContextStub();
    },
    getBoundingClientRect(){
      return { left: 0, top: 0, width: this.width || 100, height: this.height || 100 };
    },
    setPointerCapture(){},
    toDataURL(){
      return 'data:image/png;base64,';
    },
    toBlob(callback){
      callback({ type: 'image/png' });
    },
    querySelector(){
      return null;
    },
    ...target
  };
  return Object.assign(element, extras);
}

function createHarness(options = {}){
  const elementIds = [
    'fileInput', 'srcCanvas', 'outCanvas', 'cropBtn', 'downloadBtn', 'copyBtn',
    'resetBtn', 'newUploadBtn', 'pasteUploadBtn', 'roughness', 'outlineEnabled',
    'shadowEnabled', 'srcDropZone', 'srcHint', 'mainDesc', 'sourceDesc',
    'edgeTopLabel', 'edgeRightLabel', 'edgeBottomLabel', 'edgeLeftLabel',
    'edgeCenterLabel', 'edgeHelp', 'applyAllEdgesBtn', 'selectedEdgeTitle',
    'selectedEdgeName', 'selectedEdgeDesc', 'roughnessLabel', 'outlineLabel',
    'shadowLabel', 'selectionHint', 'statusMessage', 'edgeTop', 'edgeRight',
    'edgeBottom', 'edgeLeft'
  ];
  const elements = Object.fromEntries(elementIds.map((id) => [id, createElement(id)]));
  const modes = ['straight', 'torn', 'deckle', 'wavy', 'stamp'];
  elements.edgeTop.options = modes.map((value) => ({ value, textContent: '' }));
  elements.edgeRight.options = modes.map((value) => ({ value, textContent: '' }));
  elements.edgeBottom.options = modes.map((value) => ({ value, textContent: '' }));
  elements.edgeLeft.options = modes.map((value) => ({ value, textContent: '' }));
  elements.edgeTop.value = 'straight';
  elements.edgeRight.value = 'straight';
  elements.edgeBottom.value = 'straight';
  elements.edgeLeft.value = 'straight';
  elements.roughness.value = '8';
  elements.roughness.min = '2';
  elements.roughness.max = '20';
  elements.outlineEnabled.checked = true;
  elements.shadowEnabled.checked = true;

  const revokedUrls = [];
  const createdUrls = [];
  const pendingImages = [];
  const createdAnchors = [];

  const edgeValueEls = {
    top: createElement('edgeValueTop'),
    right: createElement('edgeValueRight'),
    bottom: createElement('edgeValueBottom'),
    left: createElement('edgeValueLeft')
  };
  const i18nEls = {};
  for (const key of [
    'edgeStraight', 'edgeStraightDesc', 'edgeTorn', 'edgeTornDesc',
    'edgeDeckle', 'edgeDeckleDesc', 'edgeWavy', 'edgeWavyDesc',
    'edgeStamp', 'edgeStampDesc'
  ]){
    i18nEls[key] = createElement(key, { dataset: { i18n: key } });
  }

  const edgeCards = modes.map((mode) => {
    const canvas = createElement(`${mode}Canvas`, { width: 140, height: 88 });
    return createElement(`${mode}Card`, {
      dataset: { mode },
      querySelector(selector){
        return selector === 'canvas' ? canvas : null;
      }
    });
  });
  const edgeAssignButtons = ['top', 'right', 'bottom', 'left'].map((edge) =>
    createElement(`${edge}Assign`, { dataset: { edge } })
  );

  class FakeImage {
    constructor(){
      this.width = 0;
      this.height = 0;
      this.onload = null;
      this.onerror = null;
      pendingImages.push(this);
    }

    set src(value){
      this._src = value;
    }

    get src(){
      return this._src;
    }
  }

  const document = {
    documentElement: { lang: 'ja' },
    getElementById(id){
      return elements[id];
    },
    querySelector(selector){
      const edgeValueMatch = selector.match(/^\[data-edge-value="(top|right|bottom|left)"\]$/);
      if (edgeValueMatch){
        return edgeValueEls[edgeValueMatch[1]];
      }
      return null;
    },
    querySelectorAll(selector){
      if (selector === '.edge-card'){
        return edgeCards;
      }
      if (selector === '.edge-assign'){
        return edgeAssignButtons;
      }
      if (selector === '[data-i18n]'){
        return Object.values(i18nEls);
      }
      return [];
    },
    createElement(tag){
      if (tag === 'canvas') return createElement(`dynamic-${tag}`);
      if (tag === 'a'){
        const anchor = createElement(`dynamic-${tag}`);
        createdAnchors.push(anchor);
        return anchor;
      }
      return createElement(`dynamic-${tag}`);
    }
  };

  const windowTarget = createEventTarget();
  const window = {
    ...windowTarget,
    document,
    PaperCropEdgeMask: {
      buildEdgeBounds(){ return { top: [0], right: [0], bottom: [0], left: [0] }; },
      applyEdgeMask(){},
      findCornerIntersections(){
        return {
          tl: { x: 0, y: 0 },
          tr: { x: 0, y: 0 },
          br: { x: 0, y: 0 },
          bl: { x: 0, y: 0 }
        };
      },
      sample(arr, value){
        return arr[Math.max(0, Math.min(arr.length - 1, Math.round(value)))] || 0;
      }
    },
    PaperCropUiState: require('../ui-state.js'),
    alertCalls: [],
    alert(message){
      this.alertCalls.push(message);
    }
  };

  const navigator = {
    languages: options.languages || ['en-US'],
    language: options.language || 'en-US',
    clipboard: options.clipboard || {
      async read(){
        return [];
      },
      async write(){
        return undefined;
      }
    }
  };

  const URL = {
    createObjectURL(blob){
      const url = `blob:${createdUrls.length + 1}`;
      createdUrls.push({ blob, url });
      return url;
    },
    revokeObjectURL(url){
      revokedUrls.push(url);
    }
  };

  const original = {
    window: Object.getOwnPropertyDescriptor(global, 'window'),
    document: Object.getOwnPropertyDescriptor(global, 'document'),
    navigator: Object.getOwnPropertyDescriptor(global, 'navigator'),
    URL: Object.getOwnPropertyDescriptor(global, 'URL'),
    Image: Object.getOwnPropertyDescriptor(global, 'Image'),
    ClipboardItem: Object.getOwnPropertyDescriptor(global, 'ClipboardItem')
  };

  Object.defineProperty(global, 'window', {
    configurable: true,
    writable: true,
    value: window
  });
  Object.defineProperty(global, 'document', {
    configurable: true,
    writable: true,
    value: document
  });
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    writable: true,
    value: navigator
  });
  Object.defineProperty(global, 'URL', {
    configurable: true,
    writable: true,
    value: URL
  });
  Object.defineProperty(global, 'Image', {
    configurable: true,
    writable: true,
    value: FakeImage
  });
  Object.defineProperty(global, 'ClipboardItem', {
    configurable: true,
    writable: true,
    value: class ClipboardItem {
    constructor(items){
      this.items = items;
    }
    }
  });

  const appPath = path.resolve(__dirname, '../app.js');
  delete require.cache[appPath];
  const app = require(appPath);

  function cleanup(){
    delete require.cache[appPath];
    for (const [name, descriptor] of Object.entries(original)){
      if (descriptor){
        Object.defineProperty(global, name, descriptor);
      } else {
        delete global[name];
      }
    }
  }

  return {
    app,
    elements,
    edgeCards,
    edgeAssignButtons,
    edgeValueEls,
    i18nEls,
    window,
    document,
    navigator,
    pendingImages,
    revokedUrls,
    createdUrls,
    createdAnchors,
    cleanup
  };
}

test('updateSelectionUi keeps crop disabled until selection is valid', () => {
  const harness = createHarness();
  try{
    harness.app._setImage({ width: 100, height: 80 });
    harness.app._setRect(null);
    harness.app.updateSelectionUi();
    assert.equal(harness.elements.cropBtn.disabled, true);
    assert.equal(harness.elements.selectionHint.textContent, 'Drag on the image to select a crop area.');

    harness.app._setRect({ x: 10, y: 10, w: 1, h: 5 });
    harness.app.updateSelectionUi();
    assert.equal(harness.elements.cropBtn.disabled, true);
    assert.equal(harness.elements.selectionHint.textContent, 'Selection is too small. Drag a larger area.');

    harness.app._setRect({ x: 10, y: 10, w: 12, h: 9 });
    harness.app.updateSelectionUi();
    assert.equal(harness.elements.cropBtn.disabled, false);
    assert.equal(harness.elements.selectionHint.textContent, 'Ready to crop. (12×9px)');
  } finally {
    harness.cleanup();
  }
});

test('applyLanguage updates visible labels and edge gallery text', () => {
  const harness = createHarness({ languages: ['ja-JP'] });
  try{
    harness.app.applyLanguage('en');
    assert.equal(harness.document.documentElement.lang, 'en');
    assert.equal(harness.elements.cropBtn.textContent, 'Crop');
    assert.equal(harness.elements.srcDropZone.getAttribute('aria-label'), 'Upload an image');
    assert.equal(harness.elements.applyAllEdgesBtn.textContent, 'Apply to All Edges');
    assert.equal(harness.i18nEls.edgeStraight.textContent, 'Straight');
    assert.equal(harness.i18nEls.edgeStamp.textContent, 'Ticket Stub');
    assert.equal(harness.edgeValueEls.top.textContent, 'Straight');
  } finally {
    harness.cleanup();
  }
});

test('direct edge select changes update the visible edge assignment summary', () => {
  const harness = createHarness();
  try{
    harness.elements.edgeTop.value = 'torn';
    harness.elements.edgeTop.dispatch('change');

    assert.equal(harness.edgeValueEls.top.textContent, 'Torn Paper');
  } finally {
    harness.cleanup();
  }
});

test('download uses a png filename even when the source extension differs', () => {
  const harness = createHarness();
  try{
    harness.app.loadImageFromBlob({ name: 'source' }, 'photo.jpg');
    const [image] = harness.pendingImages;
    image.width = 120;
    image.height = 80;
    image.onload();

    harness.elements.downloadBtn.dispatch('click');

    assert.equal(harness.createdAnchors.length, 1);
    assert.equal(harness.createdAnchors[0].download, 'photo-papercrop.png');
    assert.equal(harness.createdAnchors[0].href, 'data:image/png;base64,');
  } finally {
    harness.cleanup();
  }
});

test('loadImageFromBlob ignores stale image callbacks from older uploads', () => {
  const harness = createHarness();
  try{
    harness.app.loadImageFromBlob({ name: 'first' });
    harness.app.loadImageFromBlob({ name: 'second' });

    assert.equal(harness.pendingImages.length, 2);

    const [firstImage, secondImage] = harness.pendingImages;
    firstImage.width = 100;
    firstImage.height = 80;
    secondImage.width = 200;
    secondImage.height = 120;

    firstImage.onload();
    assert.equal(harness.app._getState().img, null);
    assert.equal(harness.elements.srcDropZone.classList.contains('has-image'), false);

    secondImage.onload();
    const state = harness.app._getState();
    assert.equal(state.img, secondImage);
    assert.equal(harness.elements.srcCanvas.width, 264);
    assert.equal(harness.elements.srcCanvas.height, 184);
    assert.equal(harness.elements.srcDropZone.classList.contains('has-image'), true);
    assert.deepEqual(harness.revokedUrls, ['blob:1', 'blob:1', 'blob:2']);
  } finally {
    harness.cleanup();
  }
});

test('uploadFromClipboard shows an error when clipboard images are unavailable', async () => {
  const harness = createHarness({
    clipboard: {
      async read(){
        return [{ types: ['text/plain'] }];
      },
      async write(){
        return undefined;
      }
    }
  });

  try{
    await harness.app.uploadFromClipboard();
    assert.equal(harness.elements.statusMessage.hidden, false);
    assert.equal(harness.elements.statusMessage.textContent, 'No image found in clipboard');
    assert.equal(harness.elements.statusMessage.className, 'status-message error');
  } finally {
    harness.cleanup();
  }
});
