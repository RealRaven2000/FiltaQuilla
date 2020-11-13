// replaces filterEditorOverlay.xul
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

Services.scriptloader.loadSubScript("chrome://filtaquilla/content/fq_FilterEditor.js", window, "UTF-8");


function onLoad(activatedWhileWindowOpen) {
  let layout2 = WL.injectCSS("resource://filtaquilla-skin/filtaquilla.css");
}

function onUnload(isAddOnShutown) {
  // debugger;
}
