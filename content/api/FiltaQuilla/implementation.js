"use strict";


/*
const christophers_code = async () => {
  let attPartName = att.url.match(/part=([.0-9]+)&?/)[1];
  let attFile = await getAttachmentFile(aMsgHdr, attPartName);
  let fileData = await fileToUint8Array(attFile);
  await IOUtils.write(attDirContainerClone.path, fileData);
};
*/



// Using a closure to not leak anything but the API to the outside world.
(function (exports) {
  var lazy = {};
  var { XPCOMUtils } = ChromeUtils.importESModule("resource://gre/modules/XPCOMUtils.sys.mjs");
  XPCOMUtils.defineLazyGlobalGetters(lazy, ["FileReader"]);  

  function sanitizeName(aName, includesExtension = false) {
    const win = Services.wm.getMostRecentWindow("mail:3pane");
    return win.FiltaQuilla.sanitizeName(aName, includesExtension);
  }  

  var FiltaQuilla = class extends ExtensionCommon.ExtensionAPI {
    getAPI(context) {
      return {
        FiltaQuilla: {
          async saveFile(file, path) {
            const newName = sanitizeName(file.name, true);
            const win = Services.wm.getMostRecentWindow("mail:3pane");
            const util = win.FiltaQuilla.Util;
            util.logDebug(`new file name would be: ${newName}`, win.FiltaQuilla.Util);

            const pathFile = await IOUtils.createUniqueFile(path, newName, 0o600);
            const saveFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
            saveFile.initWithPath(pathFile);
            util.logDebugOptional("attachments", `Saving to path: ${pathFile}...`);

            try {
              // Check if FileReader is defined as an object (WebExtension context)
              // ============================== RELEASE CODE ====================== 
              const bytes = await new Promise(function (resolve, reject) {
                const reader = new lazy.FileReader();
                reader.onloadend = function () {
                  resolve(new Uint8Array(reader.result));
                };
                reader.onerror = function () {
                  reject(new Error("FileReader error"));
                };
                reader.readAsArrayBuffer(file);
              });
              await IOUtils.write(pathFile, bytes);
              return true;
            } catch (ex) {
              console.error(ex, "FiltaQuilla.saveFile()", path);
              return false;
            } finally {
            }
          }

        },
      };
    }

    onShutdown(isAppShutdown) {
      if (isAppShutdown) {
        return; // the application gets unloaded anyway
      }

      // Flush all caches.
      Services.obs.notifyObservers(null, "startupcache-invalidate");
    }
  };
  exports.FiltaQuilla = FiltaQuilla;
})(this);
