

var { AppConstants } = ChromeUtils.importESModule("resource://gre/modules/AppConstants.sys.mjs");
var DomContent_ESM = parseInt(AppConstants.MOZ_APP_VERSION, 10) >= 128;

var { ExtensionCommon } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionCommon.sys.mjs"
);

var { ExtensionUtils } = DomContent_ESM
  ? ChromeUtils.importESModule("resource://gre/modules/ExtensionUtils.sys.mjs")
  : ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");

var { ExtensionError } = ExtensionUtils;

var registeredWindows = new Map();

var DomContentScript = class extends ExtensionCommon.ExtensionAPI {
  constructor(extension) {
    super(extension);
    
    this._windowListener = {
      // nsIWindowMediatorListener functions
      onOpenWindow(appWindow) {
        // A new window has opened.
        let domWindow = appWindow.docShell.domWindow;

        /**
         * Set up listeners to run the callbacks on the given window.
         *
         * @param aWindow {nsIDOMWindow}  The window to set up.
         * @param aID {String} Optional.  ID of the new caller that has registered right now.
         */
        domWindow.addEventListener(
          "DOMContentLoaded",
          function() {
            // do stuff
            let windowChromeURL = domWindow.document.location.href;
            if (registeredWindows.has(windowChromeURL)) {
              let jsPath = registeredWindows.get(windowChromeURL);
              Services.scriptloader.loadSubScript(jsPath, domWindow, "UTF-8");
            }
          },
          { once: true }
        );
      },

      onCloseWindow(appWindow) {
        // One of the windows has closed.
        let domWindow = appWindow.docShell.domWindow; // we don't need to do anything (script only loads once)
      },
    };
   
    Services.wm.addListener(this._windowListener);
   
  }
  



  
  onShutdown(isAppShutdown) {
    if (isAppShutdown) {
      return; // the application gets unloaded anyway
    }
    Services.wm.removeListener(this._windowListener);
  } 
  
  getAPI(context) {
    /** API IMPLEMENTATION **/
    return {
      DomContentScript: {
        // only returns something, if a user pref value is set
        registerWindow: async function (windowUrl,jsPath) {
          registeredWindows.set(windowUrl,jsPath);
        }
      },
    };
  }
};
