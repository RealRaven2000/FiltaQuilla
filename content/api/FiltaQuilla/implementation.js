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
          readAudioFile: async function (path) {
            const Ci = Components.interfaces;
            if (!path || typeof path !== "string") {
              throw new Error("readAudioFile: invalid path");
            }

            const bytes = await lazy.IOUtils.read(path);
            const ext = path.includes(".") ? path.split(".").pop().toLowerCase() : "";
            const fallbackMimeByExt = {
              mp3: "audio/mpeg",
              mpeg: "audio/mpeg",
              wav: "audio/wav",
              wave: "audio/wav",
              ogg: "audio/ogg",
              aiff: "audio/aiff",
              aif: "audio/aiff",
            };
            let mimeType = "audio/ogg";
            try {
              if (ext) {
                const mimeService = Components.classes["@mozilla.org/mime;1"].getService(
                  Ci.nsIMIMEService
                );
                mimeType = mimeService.getTypeFromExtension(ext) || fallbackMimeByExt[ext] || mimeType;
              }
            } catch {
              mimeType = fallbackMimeByExt[ext] || mimeType;
            }

            return {
              bytes: Array.from(bytes),
              mimeType,
            };
          },
          unpackSampleSounds: async function (path = "") {
            const Cc = Components.classes;
            const Ci = Components.interfaces;
            const { NetUtil } = ChromeUtils.importESModule("resource://gre/modules/NetUtil.sys.mjs");
            const profileDir = PathUtils.profileDir || Services.dirsvc.get("ProfD", Ci.nsIFile).path;
            const defaultTargetDir = PathUtils.join(profileDir, "extensions", "filtaquilla");

            let targetDir = defaultTargetDir;
            if (typeof path === "string" && path.trim()) {
              const candidate = path.trim();
              const isAbsolute = /^[a-zA-Z]:[\\/]|^\\\\|^\//.test(candidate);
              if (isAbsolute) {
                targetDir = candidate;
              } else {
                const normalized = candidate.replace(/^[\\/]+/, "");
                targetDir = PathUtils.join(profileDir, normalized);
              }
            }

            await lazy.IOUtils.makeDirectory(targetDir, { createAncestors: true, ignoreExisting: true });

            const fileList = [
              "applause.ogg",
              "duogourd.ogg",
              "Freedom.ogg",
              "hold-your-horses-468.ogg",
              "knob-458.ogg",
              "maybe-one-day-584.ogg",
              "nightingale.ogg",
              "notification-squeak.wav",
              "notify-1.wav",
              "pour-1.wav",
              "pour-2.ogg",
              "scissors-423.ogg",
              "scratch-389.ogg",
              "squeak.wav",
              "squishbeat.ogg",
              "TheBrightestStar.ogg",
              "worthwhile-438.ogg",
              "your-turn-491.ogg",
            ];

            async function copyDataURLToPath(sourceURL, targetPath) {
              const uri = Services.io.newURI(sourceURL);
              const securityFlags =
                Ci.nsILoadInfo.SEC_REQUIRE_SAME_ORIGIN_DATA_INHERITS ||
                Ci.nsILoadInfo.SEC_REQUIRE_SAME_ORIGIN_INHERITS_SEC_CONTEXT;
              const channel = Services.io.newChannelFromURI(
                uri,
                null,
                Services.scriptSecurityManager.getSystemPrincipal(),
                null,
                securityFlags,
                Ci.nsIContentPolicy.TYPE_OTHER
              );

              const istream = await new Promise((resolve, reject) => {
                NetUtil.asyncFetch(channel, (inputStream, status) => {
                  if (Components.isSuccessCode(status)) {
                    resolve(inputStream);
                  } else {
                    reject(Components.Exception("Failed to fetch source sound", status));
                  }
                });
              });

              const outFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
              outFile.initWithPath(targetPath);
              const ostream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(
                Ci.nsIFileOutputStream
              );
              ostream.init(outFile, -1, -1, Ci.nsIFileOutputStream.DEFER_OPEN);

              await new Promise((resolve, reject) => {
                NetUtil.asyncCopy(istream, ostream, (result) => {
                  if (Components.isSuccessCode(result)) {
                    resolve();
                  } else {
                    reject(Components.Exception("Failed to copy sound file", result));
                  }
                });
              });
            }

            let copied = 0;
            let skipped = 0;
            let failed = 0;

            for (const name of fileList) {
              const targetPath = PathUtils.join(targetDir, name);
              try {
                await lazy.IOUtils.stat(targetPath);
                skipped++;
                continue;
              } catch (ex) {
                if (ex.name !== "NotFoundError") {
                  failed++;
                  continue;
                }
              }

              try {
                await copyDataURLToPath(`chrome://filtaquilla/content/sounds/${name}`, targetPath);
                copied++;
              } catch {
                failed++;
              }
            }

            return { copied, skipped, failed, targetDir };
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
