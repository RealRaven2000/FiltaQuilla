

(async () => {
  // main background script for FiltaQuilla
  messenger.WindowListener.registerDefaultPrefs("defaults/preferences/filtaquilla.js");
  // dropped ["resource", "filtaquilla",           "skin/"],

  function compareVersions(v1, v2) {
    const v1Parts = v1.split(".").map(Number);
    const v2Parts = v2.split(".").map(Number);

    const maxLength = Math.max(v1Parts.length, v2Parts.length);

    for (let i = 0; i < maxLength; i++) {
      const part1 = v1Parts[i] || 0; // Default to 0 if segment is missing
      const part2 = v2Parts[i] || 0;

      if (part1 > part2) {
        return 1;
      } // v1 > v2
      if (part1 < part2) {
        return -1;
      } // v1 < v2
    }

    return 0; // v1 == v2
  }

  // eslint-disable-next-line no-unused-vars
  function versionGreaterOrEqual(v1, v2) {
    return compareVersions(v1, v2) >= 0;
  }

  // eslint-disable-next-line no-unused-vars
  function versionGreater(v1, v2) {
    return compareVersions(v1, v2) > 0;
  }

  // eslint-disable-next-line no-unused-vars
  function versionEqual(v1, v2) {
    return compareVersions(v1, v2) === 0;
  }

  // helper function to deal with Mime decoded file names
  async function getSafeAttachmentName(at) {
    let filename = at.name;
    if (!filename) {
      // No name provided — return null/falsy so calling code can skip
      return null;
    }

    if (browser.messengerUtilities?.decodeMimeHeader) {
      try {
        const [decoded] = await browser.messengerUtilities.decodeMimeHeader("name", [filename]);
        if (decoded) {
          filename = decoded;
        }
      } catch (ex) {
        console.error("Could not decode attachment name, using original:", ex);
        // fall back to original filename
      }
    }

    // If it's an attached email, ensure it ends with .eml
    if (at.contentType === "message/rfc822" && !/\.(eml|msg)$/i.test(filename)) {
      filename += ".eml";
    }

    return filename;
  }

  async function filterAttachments(attachmentsList, isDebug, messageId) {
    // the contentDisposition attribute is not supported by the MessageAttachment API in Tb 128!
    const info = await browser.runtime.getBrowserInfo();
    const isPrerelease = !greaterThan(info.version, "135.0");

    const filtered = [];

    for (const at of attachmentsList) {
      const name = at.name?.toLowerCase() || "";
      const type = at.contentType?.toLowerCase() || "";

      if (name.endsWith(".asc") || name.endsWith(".sig") || type === "application/pgp-signature") {
        if (isDebug) {
          console.log(`filterAttachments - Skipping PGP signature attachment: ${at.name}`);
        }
        continue;
      }

      filtered.push(at);
    }

    if (isPrerelease) {
      await addHeaders(filtered, messageId);
    }
    // zip files can sometimes be included as "inline" attachments
    return filtered.filter(
      (a) =>
        a.contentDisposition === "attachment" ||
        (a.contentDisposition === "inline" && a.contentType.startsWith("application/"))
    );
  }



  messenger.WindowListener.registerChromeUrl([
    ["resource", "filtaquilla", "content/"], // resource://
    ["resource", "filtaquilla-skin", "skin/"], // make a separate resource (we can't have 2 different resources mapped to to the same name)
    ["content", "filtaquilla", "content/"], // chrome://path
  ]);

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
      if (numA > numB) {
        return true;
      }
      if (numA < numB) {
        return false;
      }
    }
    return false; // equal
  }

  // recursively fetches a header of matching partName. pass in the msg.parts
  // attachments should have a "content-disposition" header
  function getHeaders(parts, partName) {
    if (!parts) {
      return null;
    }
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
    if (!msg) {
      console.warn(`FiltaQuilla addHeaders()\nCould not retrieve full message ${messageId}`);
      return;
    }
    if (!msg.parts) {
      console.warn(
        `FiltaQuilla addHeaders()\nCould not retrieve parts of ${messageId} - likely extracting attachments will fail.`
      );
      return;
    }
    for (const a of attachments) {
      const headers = getHeaders(msg.parts, a?.partName);
      if (!headers) {
        continue;
      }
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
          // eslint-disable-next-line no-unused-vars
          let _result = await messenger.runtime.sendMessage(
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
          // eslint-disable-next-line no-unused-vars
          let _result = await messenger.runtime.sendMessage(SmartTemplates_Name, {
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
          // eslint-disable-next-line no-unused-vars
          let _result = await messenger.runtime.sendMessage(SmartTemplates_Name, {
            command: "replyMessageWithTemplate",
            messageHeader: data.msgKey,
            templateURL: data.fileURL,
          });
          if (isSTlog) {
            console.log("FQ: after sending replyMessageWithTemplate");
          }
        }
        break;
      case "getAddonInfo": {
        // needed for version no.
        let info = await messenger.management.getSelf();
        return info;
      }
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
      case "detachAttachments": { // old test code
        const isDebugAttachments = await messenger.LegacyPrefs.getPref(
          Legacy_Root + "debug.attachments"
        );
        const attachmentsList = await browser.messages.listAttachments(data.messageHeader.id);
        const attachmentsToDetach = await filterAttachments(
          attachmentsList,
          isDebugAttachments,
          data.messageHeader.id
        );
        if (isDebugAttachments) {
          console.log(
            `FILTAQUILLA - detachAttachments(): ${attachmentsToDetach.length} attachments to save...`
          );
        }
        const savedMetaAttachments = [];
        for (const at of attachmentsToDetach) {
          const safeName = await getSafeAttachmentName(at);
          if (!safeName) {
            continue; // skip parts without a proper name
          }

          savedMetaAttachments.push({
            partName: at.partName,
            fileName: safeName,
            path: at.path || "", // add path if available or leave empty
            size: at.size,
            contentType: at.contentType,
            headers: at.headers || {},
          });
        }
        // const results = [];

        if (savedMetaAttachments.length) {
          // we now need to delete (only) the attachments that were saved successfully...
          // const partNames = savedMetaAttachments.map((a) => a.partName);
          // await browser.messages.deleteAttachments(data.messageHeader.id, partNames);
          // experimental hook
          // this should replace the "stubs" the API has generated with real links to the file system
          await messenger.FiltaQuilla.detachAttachments(
            data.messageHeader.id,
            savedMetaAttachments
          );
          // can we return a results array?
        }
        break;
      }
      case "tryDetachAttachments": {
        // is the message signed? then we cannot detach anything from the message
        // contentType ==="multipart/signed"
        // 1. messages.getFull(id,{decrypt:false}) => returns the complete mime tree of a message
        //                 supports a 2nd parameter to get encrypted parts too. needs messagesRead permission
        // asking for the original (encrypted) part
        // => branch to background, and check for being signed
        // 2. parts.some( (part) => part.contentType ==="multipart/signed"))
        //  ==> means it is signed, and we can save from the background and skip detachment.
        const fullMsg = await browser.messages.getFull(data.messageHeader.id, { decrypt: false });
        if (!(fullMsg.parts.some((part) => part.contentType === "multipart/signed"))) {
          // message not signed, let's return this result and leave detachment to the caller (core code)
          const result = {
            success: true,
            reason: "message not signed, detachment possible",
            action: ""
          }
          return result;
        }      
        // signed message - do not detach, just save instead!
        // use the fallthrough mechanism

      }
      // eslint-disable-next-line no-fallthrough
      case "saveAttachments": {
        /*
        we can use browser.messages.deleteAttachments(messageId, [partNames]) once they are saved?
        */
        const isDetachFailed = (data.func === "tryDetachAttachments");
        const isDebugAttachments = await messenger.LegacyPrefs.getPref(
          Legacy_Root + "debug.attachments"
        );
        const attachmentsList = await browser.messages.listAttachments(data.messageHeader.id);
        const attachmentsToSave = await filterAttachments(
          attachmentsList,
          isDebugAttachments,
          data.messageHeader.id
        );
        const results = [];
        if (isDebugAttachments) {
          console.log(
            `FILTAQUILLA - saveAttachments(${data.messageHeader.subject}):\n` +
              `${attachmentsToSave.length} attachments of ${attachmentsList.length} to save...`
          );
        }
        // check for attached messages to include _their_ attachments, and append those.
        for (const at of attachmentsToSave) {
          // If the attachment itself *is* a message (message/rfc822),
          // treat it as a normal attachment (an .eml file) — don't recurse into it.
          const safeName = await getSafeAttachmentName(at);
          if (!safeName) {
            continue; // skip attachments without name - these could be mMime parts
          }
          if (at.contentType === "message/rfc822") {
            if (isDebugAttachments) {
              console.log(`Found attached email: ${safeName}`);
            }
            // Ensure it will be saved as an .eml file if it lacks an extension
            if (!/\.(eml|msg)$/i.test(safeName)) {
              at.name = safeName + ".eml";
            }
          }
          // Old recursion logic removed: we no longer inspect at.message.id or push nested attachments.
          if (isDebugAttachments) {
            console.log(at);
          }
          // myMessageId is used to identify an attached eml that contains the found attachment
          let file = await browser.messages.getAttachmentFile(
            at?.myMessageId || data.messageHeader.id,
            at.partName
          );
          let savedItem = {
            fileName: file.name,
            fileType: file.type,
            size: file.size,
            modified: file.lastModified,
            headers: at.headers,
          };
          if (isDebugAttachments) {
            console.log(`Save Item: ${file.name}`, { savedItem });
          }
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
          // this returns an array of decoded strings
          let processed = false;
          if (browser.messengerUtilities?.decodeMimeHeader) {
            // API added only in 137
            try {
              let [name] = await browser.messengerUtilities.decodeMimeHeader("name", [file.name]);
              console.log(`Decoded attachment name: ${name}`);
              if (name) {
                savedItem.success = await messenger.FiltaQuilla.saveFile(file, data.path, name);
                processed = true;
              }
            } catch (ex) {
              console.error("Could not decode attachment name", ex);
            }
          }
          if (!processed) {
            console.log(`Using raw attachment name: ${file.name}`);
            savedItem.success = await messenger.FiltaQuilla.saveFile(file, data.path);
          }

          results.push(savedItem);
        }
        const result = {
          attachments: results,
          reason: isDetachFailed ? "detachment not possible, message signed" : "saved",
          action: isDetachFailed ? "savedInBackground" : "saved",
          success: true,
        };
        return result;
      }
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
      case "showMessage": {
        const message = data.msg,
          messageIds = data.msgIds,
          mode = data.mode || "standard",
          features = data.features || ["ok"]; // minimum: an ok button. make array mutable

        switch (mode) {
          case "standard": {
            let heading = "";
            if (data.msgIds === "whats-new-list" && data.forceShow !== true) {
              const versionPart =
                " " +
                messenger.i18n.getMessage("versionPart", browser.runtime.getManifest().version);
              heading = messenger.i18n.getMessage("whats-new-head") + " " + versionPart;
            }
            return showFQmessage(messageIds, features, message, heading);
          }
          case "news":
            return displayUpdateMessage();
          default:
            return "unknown";
        }
      }
    } // switch
  });

  // modern message handler (from content script)
  // avoid notifytools in the future!
  messenger.runtime.onMessage.addListener(async (data, _sender, _sendResponse) => {
    switch (data.command) {
      case "updateActionScript":
        // => send this to fq_FilterEditor.js
        console.log(`Send edited Script to Filter Editor:\n---------------\n${data.script}`);
        messenger.NotifyTools.notifyExperiment({
          event: "updateFilterScript",
          script: data.script,
        });
        break;
      case "showAboutConfig":
        messenger.FiltaQuilla.showAboutConfig(data.filter);
        break;
      case "showMessage":{
        const message = data.msg,
          messageIds = data.msgIds,
          mode = data.mode || "standard",
          features = data.features || ["ok"]; // minimum: an ok button. make array mutable

        switch (mode) {
          case "standard":
            return showFQmessage(messageIds, features, message);
          case "news":
            return displayUpdateMessage();
          default:
            return "unknown";
        }
      } 

    }
  });

  messenger.WindowListener.startListening();

  messenger.runtime.onInstalled.addListener(async (data) => {
    let { reason, previousVersion, temporary } = data;
    const isDebug = await messenger.LegacyPrefs.getPref("extensions.filtaquilla.debug");
    const manifest = await messenger.runtime.getManifest();

    if (isDebug) {
      console.log("%FiltaQuilla onInstalled:", "background: black; color: yellow;", {
        reason,
        previousVersion,
        temporary,
        installed_ver: manifest.version,
      });
    }

    switch (reason) {
      case "install":
        break;
      case "update":
        displayUpdateMessage();
        break;
    }

    await createFiltaQuillaMenus();
  });

  messenger.runtime.onStartup.addListener(async () => {
    await createFiltaQuillaMenus();
  });

  async function createFiltaQuillaMenus() {
    const isDebug = await messenger.LegacyPrefs.getPref("extensions.filtaquilla.debug");
    if (isDebug) { 
      console.log("Creating FiltaQuilla menus..."); 
    }

    // Remove any previous menu entries just to be safe during reloads
    await browser.menus.removeAll();

    /* [issue 366] convert settings to html */
    await messenger.menus.create({
      id: "filtaquilla-preferences",
      contexts: ["browser_action_menu"], // attach to toolbar button
      icons: "../skin/settings.svg",
      onclick: () => {
        browser.tabs.create({ url: "html/fq-settings.html" });
      },
      title: messenger.i18n.getMessage("prefwindow.title"),
    });

    await messenger.menus.create({
      id: "filtaquilla-news",
      contexts: ["browser_action_menu"],
      icons: "../skin/new.svg",
      onclick: async () => {
        const result = await showFQmessage("newsMsgForced", ["ok", "changeLog"], "");
        if (result === "changeLog") {
          // display the changelog
          showFQmessage("whats-new-list", ["ok"]);
        }
      },
      title: messenger.i18n.getMessage("newsHead"),
    });

    const versionPart = " " +  
      messenger.i18n.getMessage("versionPart", browser.runtime.getManifest().version);
    await messenger.menus.create({
      id: "filtaquilla-changelog",
      contexts: ["browser_action_menu"],
      icons: "../skin/changelog.svg",
      onclick: () => {
        showFQmessage("whats-new-list", ["ok"], null, 
          messenger.i18n.getMessage("whats-new-head") + " " + versionPart);
      },
      title: messenger.i18n.getMessage("message.btn.changeLog", versionPart),
    });    

    await messenger.menus.create({
      id: "filtaquilla-support",
      contexts: ["browser_action_menu"],
      icons: "../skin/help.svg",
      onclick: async () => {
        const URL = "https://quickfilters.quickfolders.org/filtaquilla.html";
        let tabs = await messenger.tabs.query({});
        let existingTab = tabs.find((t) => t.url === URL);
        if (existingTab) {
          await messenger.tabs.update(existingTab.id, { active: true, url: URL });
        } else {
          await messenger.tabs.create({ url: URL });
        }
      },
      title: messenger.i18n.getMessage("supportPage"),
    });    

    await messenger.menus.create({
      id: "filtaquilla-github",
      contexts: ["browser_action_menu"],
      icons: "../skin/github.svg",
      onclick: async () => {
        const URL = "https://github.com/RealRaven2000/FiltaQuilla/issues";
        let tabs = await messenger.tabs.query({});
        let existingTab = tabs.find((t) => t.url === URL);
        if (existingTab) {
          await messenger.tabs.update(existingTab.id, { active: true, url: URL });
        } else {
          await messenger.tabs.create({ url: URL });
        }
      },
      title: messenger.i18n.getMessage("githubPage"),
    });
    

    // Force rebuild
    await browser.menus.refresh();
    if (isDebug) {
      console.log("Menus created.");
    }    
  }
  

  // ************* messages  ****/

  const MESSAGE_STORAGE_KEY = "FiltaQuilla_Message_Key";
  const HEADING_STORAGE_KEY = "FiltaQuilla_Heading_Key";
  const showFQmessage = async (messageIds, features, message = "", heading = "") => {
    const url = new URL(browser.runtime.getURL("html/fq-message.html"));
    if (message) {
      // Store message + header globally
      await browser.storage.local.set({ [MESSAGE_STORAGE_KEY]: message });
      url.searchParams.set("msg_storage", "true");
    }
    if (messageIds == "whats-new-list" && !heading) {
      heading = messenger.i18n.getMessage("whats-new-head") + " " +
        messenger.i18n.getMessage(
          "versionPart",
          browser.runtime.getManifest().version
        );
    }

    if (heading) {
      await browser.storage.local.set({ [HEADING_STORAGE_KEY]: heading });
      url.searchParams.set("msg_header_stored", "true");
    }
    if (messageIds) {
      url.searchParams.set("msgId", messageIds);
    }
    url.searchParams.set("features", features.join(","));
    // smallest size as start
    const windowProperties = {
      width: 750,
      height: 520,
    };
    const ids = messageIds.split(",").map((s) => s.trim());
    if (ids.includes("newsMsgForced")) { // it's a long one...
      windowProperties.height = 400;
      windowProperties.width = 810;
    }
    if (messageIds.includes("whats-new-list")) {
      windowProperties.width = Math.max(windowProperties.width, 810);
    }

    if (features.includes("restart")) {
      windowProperties.height+=60;
    }

    const createData = {
      type: "popup",
      url: url.toString(),
      allowScriptsToClose: true,
      titlePreface: "",
      width: windowProperties.width,
      height: windowProperties.height,
    };

    const winRet = await messenger.windows.create(createData);
    console.log(` new FiltaQuilla Message: Tab = ${winRet.tabs[0].id}`);
    const tabId = winRet.tabs[0].id;
    // set up to wait for a button press. using promises/ ...
    // we need to return "ok" when ok is pushed
    // we need to return "cancel" (provided the feature is requested) when "cancel" button or ESC key is pushed
    return new Promise((resolve) => {
      const listener = async (message, sender) => {
        if (sender.tab && sender.tab.id === tabId && message.command === "filtaquilla-message") {
          browser.runtime.onMessage.removeListener(listener);
          resolve(message.result);

          if (winRet.id) {
            try {
              await messenger.windows.remove(winRet.id);
              // eslint-disable-next-line no-unused-vars
            } catch (_e) {
              // Window already closed, ignore
            }
          }
        }
      };

      browser.runtime.onMessage.addListener(listener);
    });
  };

  let retryScheduled = false; // session flag to avoid repeat re-scheduling
  const RETRY_MINUTES = 20;
  const LATEST_UPDATEMSG = "6.2"; // latest version with special message (forced display)
  async function displayUpdateMessage() {
    const messageIds = "newsMsgForced",
      isDebug = await messenger.LegacyPrefs.getPref("extensions.filtaquilla.debug");

    const logDebug = (...args) => {
      if (!isDebug) {
        return;
      }
      console.log("FQ displayUpdateMessage()\n", ...args);
    };

    const features = ["ok", "cancel","restart","changeLog"];

    // reflects last addon version installed with a msg.
    let lastMessage =
      (await messenger.LegacyPrefs.getPref("extensions.filtaquilla.lastUpdateMessage")) || "0";
    logDebug(`Last update message version: ${lastMessage}`);

    if (versionGreaterOrEqual(lastMessage, LATEST_UPDATEMSG)) {
      logDebug(`Message already shown for ${LATEST_UPDATEMSG} – skipping.`);
      return;
    }
    logDebug(`Preparing message for version ${LATEST_UPDATEMSG}`);
    const transmitIds = messageIds || "";
    logDebug(
      "Calling showFQmessage(msgIds, features, msg='', 'displayUpdateMessage')",
      transmitIds,
      features
    );

    try {
      const result = await showFQmessage(transmitIds, features, "");
      if (result) {
        const manifest = await messenger.runtime.getManifest();
        const installedVersion = manifest.version.replace(/pre.*/, "").replace(/\.$/, "");
        await messenger.LegacyPrefs.setPref(
          "extensions.filtaquilla.lastUpdateMessage",
          installedVersion
        );
        logDebug("Message shown successfully – version flag saved.");
        switch(result) {
          case "changeLog":
            // display the changelog
            await showFQmessage("whats-new-list", ["ok"]);
            break;
        }
      } else {
        logDebug("Message display was cancelled or failed (no result).");
        scheduleRetry(); // try again later
      }
    } catch (ex) {
      console.error("displayUpdateMessage() failed:", ex);
      scheduleRetry();
    }

    function scheduleRetry() {
      if (retryScheduled) {
        return;
      }
      retryScheduled = true;
      logDebug("Scheduling one-time retry in 20 minutes…");
      setTimeout(() => {
        displayUpdateMessage().catch((e) =>
          console.error("Retry of displayUpdateMessage() failed:", e)
        );
      }, RETRY_MINUTES * 60 * 1000); // 20 minutes
    }
  }
})();

