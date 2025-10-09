"use strict";


/*
const christophers_code = async () => {
  let attPartName = att.url.match(/part=([.0-9]+)&?/)[1];
  let attFile = await getAttachmentFile(aMsgHdr, attPartName);
  let fileData = await fileToUint8Array(attFile);
  await IOUtils.write(attDirContainerClone.path, fileData);
};
*/

/*
 globals
   ExtensionCommon,
   */

// Using a closure to not leak anything but the API to the outside world.
(function (exports) {
  const lazy = {};
  var { XPCOMUtils } = ChromeUtils.importESModule("resource://gre/modules/XPCOMUtils.sys.mjs");
  // const thunderbirdVersion = parseInt(Services.appinfo.version.split(".")[0], 10);
  const getters = ["FileReader", "IOUtils"];
  XPCOMUtils.defineLazyGlobalGetters(lazy, getters);  

  function sanitizeName(aName, includesExtension = false) {
    const win = Services.wm.getMostRecentWindow("mail:3pane");
    return win.FiltaQuilla.sanitizeName(aName, includesExtension, true);
  }  

  var FiltaQuilla = class extends ExtensionCommon.ExtensionAPI {
    getAPI(_context) {
      return {
        FiltaQuilla: {
          async saveFile(file, path) {
            const Cc = Components.classes;
            const Ci = Components.interfaces;
            const newName = sanitizeName(file.name, true);
            const win = Services.wm.getMostRecentWindow("mail:3pane");
            const util = win.FiltaQuilla.Util;
            util.logDebug(`new file name would be: ${newName}`, util);

            const pathFile = await lazy.IOUtils.createUniqueFile(path, newName, 0o600);
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
              await lazy.IOUtils.write(pathFile, bytes);
              return true;
            } catch (ex) {
              console.error(ex, "FiltaQuilla.saveFile()", path);
              return false;
            }
          },
          showOptions: function () {
            // legacy options will be removed later
            const win = Services.wm.getMostRecentWindow("mail:3pane");
            win
              .openDialog(
                "chrome://filtaquilla/content/options.xhtml",
                "filtaquilla-options",
                "chrome,titlebar,centerscreen,resizable,alwaysRaised,instantApply"
              )
              .focus();
          },
          showAboutConfig: function (filter) {
            const name = "Preferences:ConfigManager",
              mediator = Services.wm,
              uri = "about:config";

            let w = mediator.getMostRecentWindow(name),
              win = mediator.getMostRecentWindow("mail:3pane");

            if (!w) {
              let watcher = Services.ww;
              w = watcher.openWindow(
                win,
                uri,
                name,
                "chrome,resizable,centerscreen,width=600px,height=350px",
                null
              );
            }
            w.focus();
            w.addEventListener("load", function () {
              let id = "about-config-search",
                flt = w.document.getElementById(id);
              if (flt) {
                flt.value = filter;
                // make filter box readonly to prevent damage!
                flt.setAttribute("readonly", true);
                if (w.self.FilterPrefs) {
                  w.self.FilterPrefs();
                }
              }
            });
          },
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
