var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

Services.scriptloader.loadSubScript("chrome://filtaquilla/content/filtaquilla-util.js", window, "UTF-8");
Services.scriptloader.loadSubScript("chrome://filtaquilla/content/filtaquilla.js", window, "UTF-8");

function onLoad(activatedWhileWindowOpen) {
  //from filtaquilla.xul
  WL.injectElements(`
    <stringbundleset id="stringbundleset">
    <stringbundle id="filtaquilla_strings" src="chrome://filtaquilla/locale/filtaquilla.properties"/>
    </stringbundleset>
  `); // no dtd file, can we load chrome://filtaquilla/locale/filtaquilla.properties ?
  
  window.filtaquilla.onLoad(); // do we get an event to pass?
}

function onUnload(isAddOnShutown) {
}
