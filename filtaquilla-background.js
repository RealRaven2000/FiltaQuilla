

(async () => {

  // main background script for FiltaQuilla
  messenger.WindowListener.registerDefaultPrefs("defaults/preferences/filtaquilla.js");
  messenger.WindowListener.registerChromeUrl([ 
      ["content",  "filtaquilla",           "content/"],
      ["resource", "filtaquilla",           "skin/"],
      ["resource", "filtaquilla",           "content/"],
      ["locale",   "filtaquilla", "en",     "locale/en-US/"],
      ["locale",   "filtaquilla", "sv",     "locale/sv-SE/"],
      ["locale",   "filtaquilla", "de",     "locale/de/"],
      ["locale",   "filtaquilla", "nl",     "locale/nl/"]
    ]
  );  
  
  /* OVERLAY CONVERSIONS */
  
  /* overlay  chrome://messenger/content/messenger.xul chrome://filtaquilla/content/filtaquilla.xul */
  messenger.WindowListener.registerWindow("chrome://messenger/content/messenger.xhtml", "content/scripts/filtaquilla-messenger.js");
  
  // overlay  chrome://messenger/content/FilterEditor.xul chrome://filtaquilla/content/filterEditorOverlay.xul
  messenger.WindowListener.registerWindow("chrome://messenger/content/FilterEditor.xhtml", "content/scripts/filtaquilla-filterEditor.js");
  
  // overlay  chrome://messenger/content/SearchDialog.xul chrome://filtaquilla/content/filterEditorOverlay.xul
  // .. ??
  
  // overlay  chrome://messenger/content/mailViewSetup.xul chrome://filtaquilla/content/filterEditorOverlay.xul
  // .. ??
  
  // overlay  chrome://messenger/content/virtualFolderProperties.xul chrome://filtaquilla/content/filterEditorOverlay.xul
  // .. ??
  
  messenger.WindowListener.startListening();

})();

