var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

Services.scriptloader.loadSubScript("chrome://filtaquilla/content/filtaquilla-util.js", window, "UTF-8");
Services.scriptloader.loadSubScript("chrome://filtaquilla/content/filtaquilla.js", window, "UTF-8");

function onLoad(activatedWhileWindowOpen) {
  window.filtaquilla.onLoad(); // do we get an event to pass?
}

function onUnload(isAddOnShutown) {
  const Cc = Components.classes,
        Ci = Components.interfaces,
        Cu = Components.utils,
        filterService = Cc["@mozilla.org/messenger/services/filters;1"].getService(Ci.nsIMsgFilterService);
        
  
  // filterService
  let ca = [];
  ca = [...filterService.getCustomActions()];
  


}
