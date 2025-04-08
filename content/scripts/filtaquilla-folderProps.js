
/* replacement for folderPropsOverlay.js */

/* 
// Not permitted in Tb UI anymore
// will be replaced with wx-compatible UI (folder context-menu) for future proofing

function getBundleString(id, defaultText="no default text!", substitions = []) {
  var { ExtensionParent } = ChromeUtils.importESModule("resource://gre/modules/ExtensionParent.sys.mjs");

  let extension = ExtensionParent.GlobalManager.getExtension("filtaquilla@mesquilla.com");
  let localized = extension.localeData.localizeMessage(id, substitions);

  let s = "";
  if (localized) {
    s = localized;
  } else {
    s = defaultText;
    console.warn(`Could not retrieve bundle string: ${id}`);
  }
  return s;
}

function onLoad(activatedWhileWindowOpen) {
  console.log(`Filtaquilla Folderprops\nonLoad(${activatedWhileWindowOpen})`);
  const folder = window.arguments[0].folder;
  // only inject this for IMAP folders:
  if (!folder) return;
  if (folder.incomingServerType != "imap") return;
  const Ci = Components.interfaces;
  if (Ci.nsMsgFolderFlags.Inbox & folder.flags) return;  // no need to patch inbox!
  const previousCheck = document.querySelector("#folderCheckForNewMessages");
  if (previousCheck) {
    const applyIncomingCb = document.createXULElement("checkbox");
    applyIncomingCb.setAttribute("id", "filtaquilla-applyIncomingFilters");
    applyIncomingCb.setAttribute("label", 
      getBundleString("applyIncomingMails", "Run filters on incoming mails")
    );
    applyIncomingCb.addEventListener("command", (event) => {
      const active = event.originalTarget.checked;
      console.log(`Change applyIncomingFilters of ${folder.prettyName} to: ${active}`);
      folder.setStringProperty("applyIncomingFilters", active ? "true" : "");
    });
    if (folder.getStringProperty("applyIncomingFilters")) {
      applyIncomingCb.setAttribute("checked", "true");
    }
    previousCheck.parentNode.insertBefore(applyIncomingCb,previousCheck.nextSibling);
  }
}

function onUnload(isAddOnShutown) {
  console.log(`Filtaquilla Folderprops\nonUnload(${isAddOnShutown})`);
}

*/