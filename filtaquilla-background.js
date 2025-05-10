

(async () => {
  // main background script for FiltaQuilla
  messenger.WindowListener.registerDefaultPrefs("defaults/preferences/filtaquilla.js");
  // dropped ["resource", "filtaquilla",           "skin/"],

  messenger.WindowListener.registerChromeUrl([
    ["resource", "filtaquilla", "content/"], // resource://
    ["resource", "filtaquilla-skin", "skin/"], // make a separate resource (we can't have 2 different resources mapped to to the same name)
    ["content", "filtaquilla", "content/"], // chrome://path
  ]);

  messenger.WindowListener.registerOptionsPage("chrome://filtaquilla/content/options.xhtml");

  /* OVERLAY CONVERSIONS */

  // overlay  chrome://messenger/content/messenger.xul chrome://filtaquilla/content/filtaquilla.xul
  messenger.WindowListener.registerWindow(
    "chrome://messenger/content/messenger.xhtml",
    "content/scripts/filtaquilla-messenger.js"
  );

  // overlay  chrome://messenger/content/FilterEditor.xul chrome://filtaquilla/content/filterEditorOverlay.xul
  messenger.DomContentScript.registerWindow(
    "chrome://messenger/content/FilterEditor.xhtml",
    "chrome://filtaquilla/content/fq_FilterEditor.js"
  );
  messenger.WindowListener.registerWindow(
    "chrome://messenger/content/FilterEditor.xhtml",
    "content/scripts/filtaquilla-filterEditor-css.js"
  );

  // overlay  chrome://messenger/content/SearchDialog.xul chrome://filtaquilla/content/filterEditorOverlay.xul
  messenger.DomContentScript.registerWindow(
    "chrome://messenger/content/SearchDialog.xhtml",
    "chrome://filtaquilla/content/fq_FilterEditor.js"
  );
  messenger.WindowListener.registerWindow(
    "chrome://messenger/content/SearchDialog.xhtml",
    "content/scripts/filtaquilla-filterEditor-css.js"
  );

  // overlay  chrome://messenger/content/mailViewSetup.xul chrome://filtaquilla/content/filterEditorOverlay.xul
  messenger.DomContentScript.registerWindow(
    "chrome://messenger/content/mailViewSetup.xhtml",
    "chrome://filtaquilla/content/fq_FilterEditor.js"
  );
  messenger.WindowListener.registerWindow(
    "chrome://messenger/content/mailViewSetup.xhtml",
    "content/scripts/filtaquilla-filterEditor-css.js"
  );

  // overlay  chrome://messenger/content/virtualFolderProperties.xul chrome://filtaquilla/content/filterEditorOverlay.xul
  messenger.DomContentScript.registerWindow(
    "chrome://messenger/content/virtualFolderProperties.xhtml",
    "chrome://filtaquilla/content/fq_FilterEditor.js"
  );
  messenger.WindowListener.registerWindow(
    "chrome://messenger/content/virtualFolderProperties.xhtml",
    "content/scripts/filtaquilla-filterEditor-css.js"
  );

  /*
  messenger.WindowListener.registerWindow(
    "chrome://messenger/content/folderProps.xhtml",
    "content/scripts/filtaquilla-folderProps.js"
  );
  */

  function greaterThan(versionA, versionB) {
    const clean = (v) =>
      v
        .split(/[^\d]+/)
        .filter(Boolean)
        .map(Number);
    const a = clean(versionA);
    const b = clean(versionB);

    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const numA = a[i] || 0;
      const numB = b[i] || 0;
      if (numA > numB) return true;
      if (numA < numB) return false;
    }
    return false; // equal
  }

  // recursively fetches a header of matching partName. pass in the msg.parts
  // attachments should have a "content-disposition" header
  function getHeaders(parts, partName) {
    for (let part of parts) {
      if (part.partName == partName) {
        return part.headers;
      }
      if (partName.startsWith(part.partName)) {
        return getHeaders(part.parts, partName);
      }
    }
    return null;
  }

  async function addHeaders(attachments, messageId) {
    // only release version supports the contentDisposition attribute
    // so we add it manually in 128esr
    const msg = await browser.messages.getFull(messageId);
    for (const a of attachments) {
      const headers = getHeaders(msg.parts, a?.partName);
      if (
        !a.contentDisposition &&
        headers["content-disposition"] &&
        headers["content-disposition"].length &&
        headers["content-disposition"][0]?.startsWith("attachment")
      ) {
        a.contentDisposition = "attachment";
      }

      if (!a.headers) {
        a.headers = headers;
      }
    }
  }

  messenger.NotifyTools.onNotifyBackground.addListener(async (data) => {
    const Legacy_Root = "extensions.filtaquilla.",
      PrintingTools_Addon_Name = "PrintingToolsNG@cleidigh.kokkini.net",
      SmartTemplates_Name = "smarttemplate4@thunderbird.extension";

    let isLog = await messenger.LegacyPrefs.getPref(Legacy_Root + "debug.notifications");
    if (isLog && data.func) {
      console.log(
        "================================\n" +
          "FQ BACKGROUND LISTENER received: " +
          data.func +
          "\n" +
          "================================"
      );
    }
    switch (data.func) {
      case "printMessage": // [issue 152] - PrintingTools NG support
        {
          // third "options" parameter must be passed to be able to have extensionId as 1st parameter , not sure whether it requires a particular format, or null is allowed
          let options = {},
            msgKey = data.msgKey;
          let isPrintLog = await messenger.LegacyPrefs.getPref(
            Legacy_Root + "debug.PrintingToolsNG"
          );
          if (isPrintLog) {
            console.log(
              "printMessage",
              `( '${
                msgKey.subject
              }' - ${msgKey.date.toLocaleDateString()} ${msgKey.date.toLocaleTimeString()} )`
            );
          }
          let result = await messenger.runtime.sendMessage(
            PrintingTools_Addon_Name,
            {
              command: "printMessage",
              messageHeader: msgKey,
            },
            options
          );
        }
        break;
      case "forwardMessageST": // [issue 153] - Implement new filter action "Forward with SmartTemplate"
        {
          let isSTlog = await messenger.LegacyPrefs.getPref(Legacy_Root + "debug.SmartTemplates");
          let result = await messenger.runtime.sendMessage(SmartTemplates_Name, {
            command: "forwardMessageWithTemplate",
            messageHeader: data.msgKey,
            templateURL: data.fileURL,
          });
          if (isSTlog) {
            console.log("FQ: after sending forwardMessageWithTemplate");
          }
        }
        break;
      case "replyMessageST": // [issue 153]
        {
          let isSTlog = await messenger.LegacyPrefs.getPref(Legacy_Root + "debug.SmartTemplates");
          let result = await messenger.runtime.sendMessage(SmartTemplates_Name, {
            command: "replyMessageWithTemplate",
            messageHeader: data.msgKey,
            templateURL: data.fileURL,
          });
          if (isSTlog) {
            console.log("FQ: after sending replyMessageWithTemplate");
          }
        }
        break;
      case "getAddonInfo": // needed for version no.
        {
          let info = await messenger.management.getSelf();
          return info;
        }
        break;
      case "openLinkInTab":
        // https://webextension-api.thunderbird.net/en/stable/tabs.html#query-queryinfo
        {
          let baseURI = data.baseURI || data.URL;
          let found = await browser.tabs.query({ url: baseURI });
          if (found.length) {
            let tab = found[0]; // first result
            await browser.tabs.update(tab.id, { active: true, url: data.URL });
            return;
          }
          browser.tabs.create({ active: true, url: data.URL });
        }
        break;
      case "saveAttachments":
        const attachments = await browser.messages.listAttachments(data.messageHeader.id);
        const results = [];
        const isDebugAttachments = await messenger.LegacyPrefs.getPref(
          Legacy_Root + "debug.attachments"
        );
        // (filter out inline attachments)
        // we need to be careful already detach attachments are not included.
        // what contentDisposition do they have?
        // this attribute is not supported by the MessageAttachment API in Tb 128!
        const info = await browser.runtime.getBrowserInfo();
        const isPrerelease = !greaterThan(info.version, "135.0");
        if (isPrerelease) {
          await addHeaders(attachments, data.messageHeader.id);
        }
        let attachmentsToSave = attachments.filter((a) => a.contentDisposition === "attachment");
        if (isDebugAttachments) {
          console.log(`FILTAQUILLA - saveAttachments(): ${attachmentsToSave.length} attachments to save...`);
        }
        // check for attached messages to include _their_ attachments, and append those.
        for (const at of attachmentsToSave) {
          if (at.message && at.message.id) {
            let recursiveAttachments = await browser.messages.listAttachments(at.message.id);
            for (let rA of recursiveAttachments) {
              rA.myMessageId = at.message.id; // force msg id of attachment mail!
            }
            if (!recursiveAttachments?.length) continue;
            if (isPrerelease) {
              await addHeaders(recursiveAttachments, at.message.id);
            }
            // add contained attachments within attached eml.
            attachmentsToSave.push (
              ...recursiveAttachments.filter((a) => a.contentDisposition === "attachment")
            )
          }
        }        

        for (const at of attachmentsToSave) {
          if (isDebugAttachments) console.log(at);
          // myMessageId is used to identify an attached eml that contains the found attachment
          let file = await browser.messages.getAttachmentFile(at?.myMessageId || data.messageHeader.id, at.partName);
          let savedItem = {
            fileName: file.name,
            fileType: file.type,
            size: file.size,
            modified: file.lastModified,
            headers: at.headers,
          };
          if (isDebugAttachments) console.log(`Save Item: ${file.name}`, {savedItem});
          // experimental api, async!
          const altered = savedItem.headers["x-mozilla-altered"];
          const detachedInfo =
            altered && altered.length
              ? altered.find((x) => x.startsWith("AttachmentDetached"))
              : null;
          let attachmentURL;
          if (detachedInfo) {
            const attUrls = savedItem.headers["x-mozilla-external-attachment-url"];
            if (attUrls && attUrls.length) {
              attachmentURL = attUrls[0];
              console.log(`trying to save detached attachment, from: ${attachmentURL}`);
            }
          }
          savedItem.success = await messenger.FiltaQuilla.saveFile(file, data.path);
          results.push(savedItem);
        }
        return results;
      case "scriptEditor":
        {
          let editorWindow;
          // First, set up the tab update listener to catch the tab creation or update
          browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (tab.windowId === editorWindow.id && changeInfo.status === "complete") {
              // Send the initial script content to the popup's tab once it's fully loaded
              browser.tabs.sendMessage(tabId, {
                action: "initActionScript",
                script: data.script,
              });
            }
          });

          // Open the editor in a popup window
          const url = browser.runtime.getURL("content/jsEditor.html");
          let screenH = window.screen.height,
            windowHeight = screenH / 2 > 600 ? 600 : screenH / 2;
          editorWindow = await browser.windows.create({
            url,
            type: "popup",
            width: 600,
            height: windowHeight, // Or use your desired height
            allowScriptsToClose: true, // Optional, allows script to close the window from within
          });

          // After the window is created, bring it into focus (using `browser.windows.update`)
          await browser.windows.update(editorWindow.id, { focused: true });
        }
        break;
    } // switch
  });

  // modern message handler (from content script)
  // avoid notifytools in the future!
  messenger.runtime.onMessage.addListener(async (data, sender, sendResponse) => {
    switch (data.command) {
      case "updateActionScript":
        // => send this to fq_FilterEditor.js
        console.log(`Send edited Script to Filter Editor:\n---------------\n${data.script}`);
        messenger.NotifyTools.notifyExperiment({
          event: "updateFilterScript",
          script: data.script,
        });
        break;
    }
  });

  messenger.WindowListener.startListening();
})();

