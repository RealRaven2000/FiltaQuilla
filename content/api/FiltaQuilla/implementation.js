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

  var FiltaQuilla = class extends ExtensionCommon.ExtensionAPI {
    getAPI(context) {
      return {
        FiltaQuilla: {
          async saveFile(file, path) {

            const pathFile = await IOUtils.createUniqueFile(
              path,
              file.name.replaceAll(/[/:*?\"<>|]/g, "_"),
              0o600
            );

            const saveFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
            saveFile.initWithPath(pathFile);

            try {
              const bytes = await new Promise(function (resolve) {
                const reader = new FileReader();
                reader.onloadend = function () {
                  resolve(new Uint8Array(reader.result));
                };
                reader.readAsArrayBuffer(file);
              });

              await IOUtils.write(pathFile, bytes);              
              return true;
            } catch(ex) {
              console.error(ex, path)
              return false;
            } finally {

             
            }
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
