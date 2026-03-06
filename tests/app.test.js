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
    save(){},
    restore(){}
  };
}

function createElement(id){
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
    ...target
  };
  return element;
}

function createHarness(options = {}){
  const elementIds = [
    'fileInput', 'srcCanvas', 'outCanvas', 'cropBtn', 'downloadBtn', 'copyBtn',
    'resetBtn', 'newUploadBtn', 'pasteUploadBtn', 'roughness', 'outlineEnabled',
    'shadowEnabled', 'srcDropZone', 'srcHint', 'mainDesc', 'sourceDesc',
    'edgeTopLabel', 'edgeRightLabel', 'edgeBottomLabel', 'edgeLeftLabel',
    'edgeCenterLabel', 'roughnessLabel', 'outlineLabel', 'shadowLabel',
    'selectionHint', 'statusMessage', 'edgeTop', 'edgeRight', 'edgeBottom',
    'edgeLeft', 'allStraightBtn', 'allTornBtn'
  ];
  const elements = Object.fromEntries(elementIds.map((id) => [id, createElement(id)]));
  elements.edgeTop.options = [{ value: 'straight' }, { value: 'torn' }];
  elements.edgeRight.options = [{ value: 'straight' }, { value: 'torn' }];
  elements.edgeBottom.options = [{ value: 'straight' }, { value: 'torn' }];
  elements.edgeLeft.options = [{ value: 'straight' }, { value: 'torn' }];
  elements.roughness.value = '8';
  elements.outlineEnabled.checked = true;
  elements.shadowEnabled.checked = true;

  const revokedUrls = [];
  const createdUrls = [];
  const pendingImages = [];

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
    querySelectorAll(selector){
      if (selector === 'select option[value="straight"]'){
        return ['edgeTop', 'edgeRight', 'edgeBottom', 'edgeLeft'].map((id) => elements[id].options[0]);
      }
      if (selector === 'select option[value="torn"]'){
        return ['edgeTop', 'edgeRight', 'edgeBottom', 'edgeLeft'].map((id) => elements[id].options[1]);
      }
      return [];
    },
    createElement(tag){
      if (tag === 'canvas') return createElement(`dynamic-${tag}`);
      if (tag === 'a') return createElement(`dynamic-${tag}`);
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
    window,
    document,
    navigator,
    pendingImages,
    revokedUrls,
    createdUrls,
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

test('applyLanguage updates visible labels and select option text', () => {
  const harness = createHarness({ languages: ['ja-JP'] });
  try{
    harness.app.applyLanguage('en');
    assert.equal(harness.document.documentElement.lang, 'en');
    assert.equal(harness.elements.cropBtn.textContent, 'Crop');
    assert.equal(harness.elements.srcDropZone.getAttribute('aria-label'), 'Upload an image');
    assert.equal(harness.elements.edgeTop.options[0].textContent, 'Straight');
    assert.equal(harness.elements.edgeTop.options[1].textContent, 'Torn Paper');
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
