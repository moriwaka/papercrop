(function (root, factory){
  if (typeof module !== 'undefined' && module.exports){
    module.exports = factory();
    return;
  }
  root.PaperCropUiState = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function (){
  function hasValidSelection(rect, minSize){
    const threshold = Number.isFinite(minSize) ? minSize : 2;
    if (!rect) return false;
    return Number(rect.w) >= threshold && Number(rect.h) >= threshold;
  }

  function getSelectionText(rect){
    if (!rect) return '';
    const w = Math.round(Math.abs(Number(rect.w) || 0));
    const h = Math.round(Math.abs(Number(rect.h) || 0));
    if (!w && !h) return '';
    return `${w}×${h}px`;
  }

  function getSelectionHintKey(hasImage, rect, minSize){
    if (!hasImage) return 'hintNoImage';
    if (!rect) return 'hintNeedSelection';
    if (!hasValidSelection(rect, minSize)) return 'hintSelectionTooSmall';
    return 'hintReady';
  }

  return {
    hasValidSelection,
    getSelectionText,
    getSelectionHintKey
  };
}));
