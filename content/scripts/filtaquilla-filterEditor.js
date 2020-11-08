var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

Services.scriptloader.loadSubScript("chrome://filtaquilla/content/filtaquilla-util.js", window, "UTF-8");


function onLoad(activatedWhileWindowOpen) {
  
  let layout2 = WL.injectCSS("../../skin/filtaquilla.css");

}

function onUnload(isAddOnShutown) {
}
