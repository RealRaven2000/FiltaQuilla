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
    return win.FiltaQuilla.sanitizeName(aName, includesExtension);
  }  

  var FiltaQuilla = class extends ExtensionCommon.ExtensionAPI {
    getAPI(_context) {
      return {
        FiltaQuilla: {
          async saveFile(file, path, fileName) {
            const Cc = Components.classes;
            const Ci = Components.interfaces;
            const newName = sanitizeName(fileName || file.name, true);
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
                "chrome,resizable,centerscreen,width=800px,height=380px",
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
          detachAttachments: async function (messageId, savedAttachments) {
            // probably obsolete. Hence no schema entry.
            console.log(`detachAttachments called for messageId: ${messageId}`);   
            const win = Services.wm.getMostRecentWindow("mail:3pane");
            const extension = win.FiltaQuilla.Util.extension;
            const msgHdr = extension.messageManager.get(messageId); 
            if (!msgHdr) {
              console.warn(`messageManager could not retrieve valid message header from id ${messageId}`);
              return false;
            }
            // 1. Open message via msgDatabase
            const msgDB = msgHdr.folder.msgDatabase;
            if (!msgDB) {
              console.warn(`couldn't retrieve msgDabase for ${msgHdr?.folder?.URI}`);
              return false;
            }
            /*
            var { AttachmentInfo } = ChromeUtils.importESModule(
              "resource:///modules/AttachmentInfo.sys.mjs"
            );
            */

            for (let at of savedAttachments) {
              /*
              const newAttachment = new AttachmentInfo({
                contentType: at.contentType,
                url: "test",
                name: at.partName,
                uri,
                isExternalAttachment,
                message: msgHdr,
                updateAttachmentsDisplayFn: null,
              });
              */
              console.log(`restoring ${at}  from ${at?.path}...`);
              // TODO: implement actual logic
              // 2. Find the stub corresponding to at.partName
              let part = msgDB.getAttachmentInfo(at.partName);
              if (!part) {
                console.warn(`couldn't find part ${at.partName}, skipping`);
                continue;
              }
              // 3. Update headers or metadata to point to at.path
              // 4. Optionally refresh UI or trigger any required events
            }
            return true;
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
