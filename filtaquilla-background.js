

(async () => {

  // main background script for FiltaQuilla
  messenger.WindowListener.registerDefaultPrefs("defaults/preferences/filtaquilla.js");
  // dropped ["resource", "filtaquilla",           "skin/"],

  messenger.WindowListener.registerChromeUrl([ 
      ["resource", "filtaquilla",           "content/"],  
      ["resource", "filtaquilla-skin",      "skin/"],  // make a separate resource (we can't have 2 different resources mapped to to the same name)
      ["content",  "filtaquilla",           "content/"],
      ["locale",   "filtaquilla", "en",     "locale/en/"],
      ["locale",   "filtaquilla", "sv",     "locale/sv/"],
      ["locale",   "filtaquilla", "de",     "locale/de/"],
      ["locale",   "filtaquilla", "nl",     "locale/nl/"],
      ["locale",   "filtaquilla", "ru",     "locale/ru/"]
    ]
  );  
  
  messenger.WindowListener.registerOptionsPage("chrome://filtaquilla/content/options.xhtml"); 
    
  
  /* OVERLAY CONVERSIONS */
  
  // overlay  chrome://messenger/content/messenger.xul chrome://filtaquilla/content/filtaquilla.xul 
  messenger.WindowListener.registerWindow("chrome://messenger/content/messenger.xhtml", "content/scripts/filtaquilla-messenger.js");
  
  // overlay  chrome://messenger/content/FilterEditor.xul chrome://filtaquilla/content/filterEditorOverlay.xul
  messenger.DomContentScript.registerWindow("chrome://messenger/content/FilterEditor.xhtml", "chrome://filtaquilla/content/fq_FilterEditor.js");
  messenger.WindowListener.registerWindow("chrome://messenger/content/FilterEditor.xhtml", "content/scripts/filtaquilla-filterEditor-css.js");
  
  // overlay  chrome://messenger/content/SearchDialog.xul chrome://filtaquilla/content/filterEditorOverlay.xul
  messenger.DomContentScript.registerWindow("chrome://messenger/content/SearchDialog.xhtml", "chrome://filtaquilla/content/fq_FilterEditor.js");
  messenger.WindowListener.registerWindow("chrome://messenger/content/SearchDialog.xhtml", "content/scripts/filtaquilla-filterEditor-css.js");
  
  // overlay  chrome://messenger/content/mailViewSetup.xul chrome://filtaquilla/content/filterEditorOverlay.xul
  messenger.DomContentScript.registerWindow("chrome://messenger/content/mailViewSetup.xhtml", "chrome://filtaquilla/content/fq_FilterEditor.js");
  messenger.WindowListener.registerWindow("chrome://messenger/content/mailViewSetup.xhtml", "content/scripts/filtaquilla-filterEditor-css.js");
  
  // overlay  chrome://messenger/content/virtualFolderProperties.xul chrome://filtaquilla/content/filterEditorOverlay.xul
  messenger.DomContentScript.registerWindow("chrome://messenger/content/virtualFolderProperties.xhtml", "chrome://filtaquilla/content/fq_FilterEditor.js");
  messenger.WindowListener.registerWindow("chrome://messenger/content/virtualFolderProperties.xhtml", "content/scripts/filtaquilla-filterEditor-css.js");
  
  messenger.NotifyTools.onNotifyBackground.addListener(async (data) => {
    const Legacy_Root = "extensions.filtaquilla." 
          PrintingTools_Addon_Name = "PrintingToolsNG@cleidigh.kokkini.net" 
          SmartTemplates_Name = "smarttemplate4@thunderbird.extension";
    
    let isLog = await messenger.LegacyPrefs.getPref(Legacy_Root + "debug.notifications");
    if (isLog && data.func) {
      console.log ("================================\n" +
                   "FQ BACKGROUND LISTENER received: " + data.func + "\n" +
                   "================================");
    }
    switch (data.func) {
      case "printMessage": // [issue 152] - PrintingTools NG support
        {
          // third "options" parameter must be passed to be able to have extensionId as 1st parameter , not sure whether it requires a particular format, or null is allowed
          let options = {},
              msgKey = data.msgKey;
          let isPrintLog = await messenger.LegacyPrefs.getPref(Legacy_Root + "debug.PrintingToolsNG");
          if (isPrintLog) {
            console.log("printMessage", `( '${msgKey.subject}' - ${msgKey.date.toLocaleDateString()} ${msgKey.date.toLocaleTimeString()} )`);
          }
          let result = await messenger.runtime.sendMessage(
            PrintingTools_Addon_Name, 
            { command: "printMessage", messageHeader: msgKey },
            options 
          );
        }
        break;
      case "forwardMessageST": // [issue 153] - Implement new filter action "Forward with SmartTemplate"
        {
          
          let isSTlog = await messenger.LegacyPrefs.getPref(Legacy_Root + "debug.SmartTemplates");
          let result = await messenger.runtime.sendMessage(
            SmartTemplates_Name, 
            { command: "forwardMessageWithTemplate", messageHeader: data.msgKey, templateURL: data.fileURL }
          );
          if (isSTlog) {
            console.log("FQ: after sending forwardMessageWithTemplate");
          }
        }
        break;
      case "replyMessageST": // [issue 153]
        {
          let isSTlog = await messenger.LegacyPrefs.getPref(Legacy_Root + "debug.SmartTemplates");
          let result = await messenger.runtime.sendMessage(
            SmartTemplates_Name, 
            { command: "replyMessageWithTemplate", messageHeader: data.msgKey, templateURL: data.fileURL }
          );
          if (isSTlog) {
            console.log("FQ: after sending replyMessageWithTemplate");
          }
        }
        break;
        
    }
  });
  
  
  messenger.WindowListener.startListening();

})();

