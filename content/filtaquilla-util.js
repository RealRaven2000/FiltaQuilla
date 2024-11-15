"use strict";

/*
 ***** BEGIN LICENSE BLOCK *****
 * This file is part of FiltaQuilla, Custom Filter Actions
 * rereleased by Axel Grude (original project by R Kent James
 * under the Mesquilla Project)
 *
 * FiltaQuilla is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * You should have received a copy of the GNU General Public License
 * along with FiltaQuilla.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 */

var FiltaQuilla = {};

FiltaQuilla.TabURIregexp = {
  get _thunderbirdRegExp() {
    delete this._thunderbirdRegExp;
    return this._thunderbirdRegExp = new RegExp("^https://quickfilters.quickfolders.org/");
  }
};


FiltaQuilla.Util = {
  mAppName: null,
  mAppver: null,
  HARDCODED_CURRENTVERSION: "4.0", // will later be overriden call to AddonManager
  HARDCODED_EXTENSION_TOKEN: ".hc",
  ADDON_ID: "filtaquilla@mesquilla.com",
  _prefs: null,
  _consoleService: null,
  _stringBundleSvc: null,
  _properties: null,
  lastTime: 0,

  get StringBundleSvc() {
    if (!this._stringBundleSvc)
      this._stringBundleSvc = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(
        Components.interfaces.nsIStringBundleService
      );
    return this._stringBundleSvc;
  },

  get prefs() {
    if (this._prefs) return this._prefs;
    this._prefs = Services.prefs.getBranch("extensions.filtaquilla.");
    return this._prefs;
  },

  get AppverFull() {
    let appInfo = Services.appinfo;
    return appInfo.version;
  },

  get Appver() {
    if (null === this.mAppver) {
      let appVer = this.AppverFull.substr(0, 3); // only use 1st three letters - that's all we need for compatibility checking!
      this.mAppver = parseFloat(appVer); // quick n dirty!
    }
    return this.mAppver;
  },

  get Application() {
    if (null === this.mAppName) {
      let appInfo = Services.appinfo;
      const FIREFOX_ID = "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}";
      const THUNDERBIRD_ID = "{3550f703-e582-4d05-9a08-453d09bdfdc6}";
      const SEAMONKEY_ID = "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}";
      const POSTBOX_ID = "postbox@postbox-inc.com";
      switch (appInfo.ID) {
        case FIREFOX_ID:
          return (this.mAppName = "Firefox");
        case THUNDERBIRD_ID:
          return (this.mAppName = "Thunderbird");
        case SEAMONKEY_ID:
          return (this.mAppName = "SeaMonkey");
        case POSTBOX_ID:
          return (this.mAppName = "Postbox");
        default:
          this.mAppName = appInfo.name;
          this.logDebug("Unknown Application: " + appInfo.name);
          return appInfo.name;
      }
    }
    return this.mAppName;
  },

  get tabmail() {
    let doc = this.getMail3PaneWindow.document,
      tabmail = doc.getElementById("tabmail");
    return tabmail;
  },

  get getMail3PaneWindow() {
    let windowManager = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(
        Components.interfaces.nsIWindowMediator
      ),
      win3pane = windowManager.getMostRecentWindow("mail:3pane");
    return win3pane;
  },

  getTabInfoLength: function getTabInfoLength(tabmail) {
    if (tabmail.tabInfo) return tabmail.tabInfo.length;
    if (tabmail.tabOwners) return tabmail.tabOwners.length;
    return null;
  },

  getTabInfoByIndex: function getTabInfoByIndex(tabmail, idx) {
    if (tabmail.tabInfo) return tabmail.tabInfo[idx];
    if (tabmail.tabOwners) return tabmail.tabOwners[idx]; // Postbox
    return null;
  },

  getBaseURI: function baseURI(URL) {
    let hashPos = URL.indexOf("#"),
      queryPos = URL.indexOf("?"),
      baseURL = URL;

    if (hashPos > 0) baseURL = URL.substr(0, hashPos);
    else if (queryPos > 0) baseURL = URL.substr(0, queryPos);
    if (baseURL.endsWith("/")) return baseURL.substr(0, baseURL.length - 1); // match "x.com" with "x.com/"
    return baseURL;
  },

  openHelpTab: function FiltaQuilla_openHelpTab(fragment) {
    let f = fragment ? "#" + fragment : "",
      URL = "https://quickfilters.quickfolders.org/filtaquilla.html" + f;
    FiltaQuilla.Util.getMail3PaneWindow.window.setTimeout(function () {
      FiltaQuilla.Util.openLinkInTab(URL);
    });
  },

  openTooltipPopup: function (el) {
    if (el.getAttribute("hasToolTip")) {
      return;
    }
    let txt = el.getAttribute("clickyTooltip");
    if (txt) {
      let tip = document.createElement("div");
      tip.classList.add("tooltip");
      tip.innerText = txt;
      tip.style.transform =
        "translate(" +
        (el.hasAttribute("tip-left") ? "calc(-100% - 5px)" : "15px") +
        ", " +
        (el.hasAttribute("tip-top") ? "-100%" : "0") +
        ")";
      el.appendChild(tip);
      el.onmousemove = (e) => {
        tip.style.left = e.clientX + "px";
        tip.style.top = e.clientY + "px";
      };
      el.setAttribute("hasToolTip", true); // avoids duplicates
    }
  },

  openLinkInTab: async function (URL) {
    // URL = util.makeUriPremium(URL);

    // use API.
    // getBaseURI to check if we already opened the page and need to
    // jump to a different anchor.
    await FiltaQuilla.Util.notifyTools.notifyBackground({
      func: "openLinkInTab",
      URL: URL,
      baseURI: this.getBaseURI(URL),
    });
    return true;
  },

  openLinkInBrowser: function (linkURI) {
    const Ci = Components.interfaces,
      Cc = Components.classes;
    try {
      this.logDebug("openLinkInBrowser (" + linkURI + ")");
      let service = Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(
          Ci.nsIExternalProtocolService
        ),
        ioservice = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService),
        uri = ioservice.newURI(linkURI, null, null);
      service.loadURI(uri);
    } catch (e) {
      this.logDebug("openLinkInBrowser (" + linkURI + ") " + e.toString());
    }
  },

  logTime: function logTime() {
    let timePassed = "",
      end = new Date(),
      endTime = end.getTime();
    try {
      // AG added time logging for test
      if (this.lastTime === 0) {
        this.lastTime = endTime;
        return "[logTime init]";
      }
      let elapsed = new String(endTime - this.lastTime); // time in milliseconds
      timePassed = "[" + elapsed + " ms]   ";
      this.lastTime = endTime; // remember last time
    } catch (e) {}
    return (
      end.getHours() +
      ":" +
      end.getMinutes() +
      ":" +
      end.getSeconds() +
      "." +
      end.getMilliseconds() +
      "  " +
      timePassed
    );
  },

  logToConsole: function logToConsole(a) {
    let msg = "FiltaQuilla " + this.logTime() + "\n"; // (optionTag ? '{' + optionTag.toUpperCase() + '} ' : '') +
    console.log(msg, ...arguments);
  },

  // flags
  // errorFlag    0x0   Error messages. A pseudo-flag for the default, error case.
  // warningFlag    0x1   Warning messages.
  // exceptionFlag  0x2   An exception was thrown for this case - exception-aware hosts can ignore this.
  // strictFlag     0x4
  logError: function logError(
    aMessage,
    aSourceName,
    aSourceLine,
    aLineNumber,
    aColumnNumber,
    aFlags
  ) {
    const Ci = Components.interfaces,
      Cc = Components.classes;
    let aCategory = "",
      scriptError = Cc["@mozilla.org/scripterror;1"].createInstance(Ci.nsIScriptError);
    scriptError.init(
      aMessage,
      aSourceName,
      aSourceLine,
      aLineNumber,
      aColumnNumber,
      aFlags,
      aCategory
    );
    Services.console.logMessage(scriptError);
  },

  logException: function logException(aMessage, ex) {
    let stack = "";
    if (typeof ex.stack != "undefined") stack = ex.stack.replace("@", "\n  ");

    let srcName = ex.fileName ? ex.fileName : "";
    this.logError(aMessage + "\n" + ex.message, srcName, stack, ex.lineNumber, 0, 0x1); // use warning flag, as this is an exception we caught ourselves
  },

  logDebug: function logDebug(msg) {
    if (this.isDebug) {
      this.logToConsole(...arguments);
    }
  },

  logHighlightDebug: function (txt, color = "white", background = "rgb(80,0,0)", ...args) {
    if (this.isDebug) {
      console.log(`FiltaQuilla\n %c${txt}`, `color:${color};background:${background}`, ...args);
    }
  },

  isDebug: function isDebug() {
    return this.prefs.getBoolPref("debug");
  },

  isDebugOption: function isDebugOption(o) {
    if (!this.isDebug) return false;
    try {
      return this.prefs.getBoolPref("debug." + o);
    } catch (e) {
      return false;
    }
  },

  logWithOption: function logWithOption(a) {
    arguments[0] =
      "FiltaQuilla " + "{" + arguments[0].toUpperCase() + "} " + QuickFolders.Util.logTime() + "\n";
    console.log(...arguments);
  },

  /**
   * only logs if debug mode is set and specific debug option are active
   *
   * @optionString {string}: comma delimited options
   * @msg {string}: text to log
   */
  logDebugOptional: function logDebugOptional(optionString, msg) {
    try {
      let options = optionString.split(",");
      for (let i = 0; i < options.length; i++) {
        let option = options[i];
        if (this.isDebugOption(option)) {
          this.logWithOption(option, msg);
          break; // only log once, in case multiple log switches are on
        }
      }
    } catch (ex) {}
  },

  toggleBoolPreference: function (cb, noUpdate) {
    let prefString = cb.getAttribute("preference");
    let pref = document.getElementById(prefString);

    if (pref) {
      Services.prefs.setBoolPref(pref.getAttribute("name"), cb.checked);
    }
    if (noUpdate) return true;
    return false; // this.updateMainWindow();
  },

  showAboutConfig: function (clickedElement, filter, readOnly) {
    const name = "Preferences:ConfigManager";

    let mediator = Services.wm,
      isTbModern = FiltaQuilla.Util.versionGreaterOrEqual(FiltaQuilla.Util.AppverFull, "85"),
      uri = isTbModern ? "about:config" : "chrome://global/content/config.xhtml?debug";

    let w = mediator.getMostRecentWindow(name),
      win = clickedElement
        ? clickedElement.ownerDocument.defaultView
          ? clickedElement.ownerDocument.defaultView
          : window
        : window;
    if (!w) {
      let watcher = Services.ww;
      w = watcher.openWindow(
        win,
        uri,
        name,
        "dependent,chrome,resizable,centerscreen,alwaysRaised,width=750px,height=450px",
        null
      );
    }
    w.focus();
    w.addEventListener("load", function () {
      let id = isTbModern ? "about-config-search" : "textbox",
        flt = w.document.getElementById(id);
      if (flt) {
        flt.value = filter;
        // make filter box readonly to prevent damage!
        if (!readOnly) flt.focus();
        else flt.setAttribute("readonly", true);
        if (w.self.FilterPrefs) {
          w.self.FilterPrefs();
        }
      }
    });
  },

  // Tb 66 compatibility.
  loadPreferences: function fq_loadPreferences() {
    if (typeof Preferences == "undefined") {
      FiltaQuilla.Util.logDebug("Skipping loadPreferences - Preferences object not defined");
      return; // older versions of Thunderbird do not need this.
    }
    let myprefs = document.getElementsByTagName("preference");
    if (myprefs.length) {
      let prefArray = [];
      for (let i = 0; i < myprefs.length; i++) {
        let it = myprefs.item(i),
          p = { id: it.id, name: it.getAttribute("name"), type: it.getAttribute("type") };
        if (it.getAttribute("instantApply") == "true") p.instantApply = true;
        prefArray.push(p);
      }
      if (Preferences) Preferences.addAll(prefArray);
    }
  },

  // l10n
  getBundleString: function getBundleString(id, defaultText, substitions = []) {
    var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
    let extension = ExtensionParent.GlobalManager.getExtension("filtaquilla@mesquilla.com");
    let localized = extension.localeData.localizeMessage(id, substitions);

    let s = "";
    if (localized) {
      s = localized;
    } else {
      s = defaultText;
      this.logToConsole("Could not retrieve bundle string: " + id + "");
    }
    return s;
  },

  getRegex: function (aSearchValue) {
    const regexpCaseInsensitiveEnabled = this.prefs.getBoolPref("regexpCaseInsensitive.enabled");
    const REGEX_CASE_SENSITIVE_FLAG = "c";
    let searchValue = aSearchValue,
      searchFlags = "",
      searchOptions = [];
    if (aSearchValue.charAt(0) == "/") {
      let lastSlashIndex = aSearchValue.lastIndexOf("/");
      searchValue = aSearchValue.substring(1, lastSlashIndex);
      searchFlags = aSearchValue.substring(lastSlashIndex + 1);
      let sw = searchFlags.match(/{.*}/) || [];
      if (sw && sw.length) {
        const startOptions = searchFlags.indexOf(sw[0]),
          optionString = searchFlags.substring(startOptions + 1, startOptions + sw[0].length - 1);
        searchOptions = optionString.split(",");

        searchFlags = searchFlags.substring(0, startOptions);
      }
    }

    if (
      regexpCaseInsensitiveEnabled &&
      !searchFlags.includes("i") &&
      !searchFlags.includes(REGEX_CASE_SENSITIVE_FLAG)
    ) {
      searchFlags += "i";
    }

    return [searchValue, searchFlags, searchOptions];
  },

  localize: function (window, buttons = null) {
    var Services =
      globalThis.Services || ChromeUtils.import("resource://gre/modules/Services.jsm").Services;
    var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
    let extension = ExtensionParent.GlobalManager.getExtension("filtaquilla@mesquilla.com");
    Services.scriptloader.loadSubScript(
      extension.rootURI.resolve("content/i18n.js"),
      window,
      "UTF-8"
    );
    window.i18n.updateDocument({ extension: extension });
    if (buttons) {
      for (let [name, label] of Object.entries(buttons)) {
        window.document.documentElement.getButton(name).label =
          extension.localeData.localizeMessage(label); // apply
      }
    }
  },

  get Version() {
    // returns the current FiltaQuilla (full) version number.
    if (FiltaQuilla.Util.addonInfo) {
      return FiltaQuilla.Util.addonInfo.version;
    }
    let current =
      FiltaQuilla.Util.HARDCODED_CURRENTVERSION + FiltaQuilla.Util.HARDCODED_EXTENSION_TOKEN;
    return current;
  },

  get VersionSanitized() {
    function strip(version, token) {
      let cutOff = version.indexOf(token);
      if (cutOff > 0) {
        // make sure to strip of any pre release labels
        return version.substring(0, cutOff);
      }
      return version;
    }

    let pureVersion = strip(FiltaQuilla.Util.Version, "pre");
    pureVersion = strip(pureVersion, "beta");
    pureVersion = strip(pureVersion, "alpha");
    return strip(pureVersion, ".hc");
  },

  versionGreaterOrEqual: function (a, b) {
    return Services.vc.compare(a, b) >= 0;
  },

  versionSmaller: function (a, b) {
    return Services.vc.compare(a, b) < 0;
  },

  // from https://searchfox.org/comm-esr115/rev/27d796e03ef54fe526996bd063d7c3748b7c2d62/mailnews/test/resources/MailTestUtils.jsm#75
  loadMessageToString: function (aFolder, aMsgHdr, aCharset) {
    const Ci = Components.interfaces,
      Cc = Components.classes;
    var data = "";
    let bytesLeft = aMsgHdr.messageSize;
    const reusable = {},
      stream = aFolder.getMsgInputStream(aMsgHdr, reusable);
    if (aCharset) {
      let cstream = Cc["@mozilla.org/intl/converter-input-stream;1"].createInstance(
        Ci.nsIConverterInputStream
      );
      cstream.init(stream, aCharset, 4096, 0x0000);
      let str = {};
      let bytesToRead = Math.min(bytesLeft, 4096);
      while (cstream.readString(bytesToRead, str) != 0) {
        data += str.value;
        bytesLeft -= bytesToRead;
        if (bytesLeft <= 0) {
          break;
        }
        bytesToRead = Math.min(bytesLeft, 4096);
      }
      cstream.close();
    } else {
      var sstream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(
        Ci.nsIScriptableInputStream
      );

      sstream.init(stream);

      let bytesToRead = Math.min(bytesLeft, 4096);
      var str = sstream.read(bytesToRead);
      bytesLeft -= str.length;
      while (str.length > 0) {
        data += str;
        if (bytesLeft <= 0) {
          break;
        }
        bytesToRead = Math.min(bytesLeft, 4096);
        str = sstream.read(bytesToRead);
        bytesLeft -= str.length;
      }
      sstream.close();
    }
    stream.close();

    return data;
  },

  stripQuotes: function (val) {
    if (!isNaN(val)) {
      return val;
    }
    if (val.startsWith("'")) {
      return val.substring(1, val.lastIndexOf("'"));
    }
    if (val.startsWith('"')) {
      return val.substring(1, val.lastIndexOf('"'));
    }
    return val.trim();
  },

  // Helper function to get content type and attributes
  getContentAttributes: function (line) {
    const conData = line.split(":")[1];
    if (!conData) {
      return ["?", {}]; // no attributes found
    }
    const attributes = {};
    const contArray = conData.trim().split(";");
    for (let i = 1; i < contArray.length; i++) {
      let keyval = contArray[i].split("=");
      if (keyval.length > 1) {
        attributes[keyval[0].trim()] = FiltaQuilla.Util.stripQuotes(keyval[1]); // attribute = value
      }
    }

    return [contArray[0].trim(), attributes];
  },

  // Main function to split MIME parts
  splitBodyParts: function (raw) {
    if (!raw) return [];

    const bodies = []; // Array of objects containing each type + raw MIME part.
    const xxlines = raw
      .replaceAll("\r\n", "\n")
      .replaceAll(/(Content-.*:.*;)(\n)(.*=.*)/g, "$1$3")
      .split("\n")
      .filter((line) => line.trim() !== "");
    // remove empty elements (if email starts with line breaks)
    while (!xxlines[0] && xxlines.length) {
      xxlines.splice(0, 1);
    }

    if (!xxlines.length) return [];
    if (xxlines[0].startsWith("This is an OpenPGP/MIME signed message")) {
    } else if (
      !xxlines[0].startsWith("This is a multi-part message") &&
      !xxlines[0].startsWith("--")
    ) {
      FiltaQuilla.Util.logDebugOptional("mimeBody", "not a multipart message:" + subject);
      return [{ contentType: "?", body: raw }];
    }

    // Regex to identify boundaries
    const boundaryRegex = /--+[_\=\.A-Za-z0-9]+$/;
    let part = "",
      contentType = "",
      contentEncoding = "",
      contentAttributes = {},
      isAttachment = false;

    // Helper to reset part attributes
    const resetPartAttributes = () => {
      part = "";
      contentEncoding = "";
      contentType = "";
      contentAttributes = {};
      isAttachment = false;
    };

    // Helper to push a complete part
    const pushPart = () => {
      if (part && !part.startsWith("This is a multi-part message")) {
        bodies.push({
          contentType: contentType || "?",
          encoding: contentEncoding,
          contentAttributes,
          isAttachment,
          body: part.trim(),
        });
      }
    };

    let isBoundaryLine = false;

    for (let l = 0; l < xxlines.length; l++) {
      const line = xxlines[l].trim();
      // Boundary check
      if (boundaryRegex.test(line)) {
        pushPart(); // Push the current part before starting a new one
        resetPartAttributes();
        continue;
      }

      // Content-Type header
      if (line.startsWith("Content-Type:")) {
        [contentType, contentAttributes] = FiltaQuilla.Util.getContentAttributes(line);
        continue;
      }

      if (line.startsWith("Content-Transfer-Encoding:")) {
        contentEncoding = line.split(":")[1]?.trim();
        continue;
      }

      // Content-Disposition header
      if (line.startsWith("Content-Disposition")) {
        const [cDis, cAtt] = FiltaQuilla.Util.getContentAttributes(
          line + (xxlines[l + 1]?.startsWith("\t") ? xxlines[++l] : "")
        );
        contentAttributes.contentDisposition = cDis.toLowerCase();
        if (cAtt.filename) contentAttributes.fileName = cAtt.filename;
        isAttachment = contentAttributes.contentDisposition === "attachment";
        continue;
      }

      // Skip unwanted types (e.g., images, vCard)
      if (contentType.startsWith("image/") || contentType.startsWith("text/vcard")) {
        continue;
      }

      // Accumulate the part content
      part += (part ? "\n" : "") + line; // Add newline for the part body
    }

    // Push the last part if it exists
    pushPart();

    return bodies;
  },

  // Helper to check whether source has quoted printable attribute
  isQuotedPrintable: function (raw) {
    if (!raw) {
      return false;
    }
    let cte; // line beginning "content transfer encoding"
    if (typeof raw == "object") {
      if (raw?.encoding == "Content-Transfer-Encoding") {
        return true;
      }
      return false;
    }
    const xxlines = raw.split("\n");
    if (!xxlines) return false;
    if (!xxlines.length) return false;

    cte = xxlines.find((l) => l.startsWith("Content-Transfer-Encoding"));
    if (!cte) return false;
    const vals = cte.split(":");
    if (vals.length < 2) return false;
    const contentType = vals[1].trim();
    var result = contentType == "quoted-printable";
    FiltaQuilla.Util.logDebug(
      `subject=${subject}\n` +
        `content type from raw message: ${contentType}\n` +
        `isQuotedPrintable=${result}`
    );
    return result;
  },

  // reflow decoded printabl
  decodeQuotedPrintable: function (cleanedInput) {
    // Step 1: Remove soft line breaks (=`\n` or `=` at the end of lines)
    // let cleanedInput = input.replace(/=\r?\n/g, "");

    // Step 2: Decode quoted-printable characters
    let decoded = cleanedInput.replace(/=([A-Fa-f0-9]{2})/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    return decoded;
  },

  // remove all STYLE blacks:
  removeStyleTags: function (markUp) {
    // using character class + negation \w\W makes sure that line breaks are included
    // ? makes the expression non-greedy to avoid swallowing content between multiple style blocks.
    let newMarkup = markUp.replace(/(<style[\w\W]*?\/style>)/gm, "");
    return newMarkup;
  },

  removeQuotes: function (markUp) {
    // removed (?<=^|\s) from start..
    // [\s\S] hack to make sure that line breaks are included
    let newMarkup = markUp.replace(/<blockquote[\s\S]*?>[\s\S]*?<\/blockquote>/g, "");
    return newMarkup;
  },

  // Optimized function to return plain text
  // as strings with consecutive sections of same quote level separated by double lines
  // type="u" - return unquoted sections
  // type="q" - return quoted sections
  // type="both" - return [unquoted sections, quoted sections]
  extractQuotesPlainText: function (body, type = "both") {
    const unquoted = [];
    const quoted = [];
    let currentQuoteLevel = "";
    let currentText = "";
    let consecutiveEmptyLines = 0;

    // Split lines with any newline type
    let input = body.split(/\r\n|\n|\r/);
    input.forEach((line) => {
      const trimmedLine = line.trim();

      // Check for empty lines to preserve paragraph breaks
      if (trimmedLine === "") {
        consecutiveEmptyLines++;
        if (consecutiveEmptyLines >= 1) {
          // Push current text when encountering at least one empty line
          if (currentText) {
            // Reinsert the quote level only at the beginning of the paragraph
            if (currentQuoteLevel) {
              currentText = currentQuoteLevel + currentText;
            }
            if (currentQuoteLevel === "" && (type === "both" || type === "u")) {
              unquoted.push(currentText);
            } else if (type === "both" || type === "q") {
              quoted.push(currentText);
            }
            currentText = ""; // Reset for a new paragraph
          }
        }
        return; // Skip further processing for this line
      }

      // Reset empty line counter on non-empty line
      consecutiveEmptyLines = 0;

      // Match the initial quote level using regex
      const quoteLevel = trimmedLine.match(/^(>\s*)*/)?.[0] || ""; // Extract quote level
      const text = trimmedLine.replace(/^(>\s*)*/, ""); // Strip quote marks

      // When quote level changes, push accumulated text to the appropriate array
      if (quoteLevel !== currentQuoteLevel) {
        if (currentText) {
          // Reinsert the quote level only at the beginning of the paragraph
          if (currentQuoteLevel) {
            currentText = currentQuoteLevel + currentText;
          }
          if (currentQuoteLevel === "" && (type === "both" || type === "u")) {
            unquoted.push(currentText);
          } else if (type === "both" || type === "q") {
            quoted.push(currentText);
          }
          currentText = ""; // Reset for the new group
        }
      }

      // Accumulate text for the current quote level
      if (
        type === "both" ||
        (type === "u" && quoteLevel === "") ||
        (type === "q" && quoteLevel !== "")
      ) {
        currentText += (currentText ? " " : "") + text;
      }
      currentQuoteLevel = quoteLevel;
    });

    // Push the last accumulated text after the loop ends
    if (currentText) {
      if (currentQuoteLevel === "" && (type === "both" || type === "u")) {
        unquoted.push(currentText);
      } else if (type === "both" || type === "q") {
        quoted.push(currentText);
      }
    }

    // Return results based on type
    if (type === "u") return unquoted.join("\n\n");
    if (type === "q") return quoted.join("\n\n");
    return [quoted.join("\n\n"), unquoted.join("\n\n")];
  },

  // removing HTML markup the dirty way:
  // this removes all HTML tags but leaves the content untouched.
  removeHTML: function (markUp) {
    // note: when removing tags, ideally we should add white space because
    // tags with block level layout can separate content: "text</p>more text"
    // the same does not apply to inline elements!
    // we could add heuristics and assume at least </div and </p to create
    // white space or add an "\n" although strictly this may not always /apply
    let newMarkup = markUp
      .replace(/<br\s?\\?>/g, " ")
      .replace(/<\/[^>]+>/g, " ")
      .replace(/<[^>]+>/g, "") // remove tags
      // .replace(/(\n){1}/g, " ")
      .replace(/(\t){2,}/g, "  ");
    return newMarkup;
  },

  // collapses all whitespace in a html code part
  collapseWhiteSpace: function (markUp, includeBR = false) {
    // note as  /$^/ matches NOTHING, replace shortcuts and does not burn any performance
    let newMarkup = markUp
      .replace(includeBR ? /<br\s?\/?>/g : /$^/, "\n") // Replace <br> tags only if includeBR is true
      .replace(/\n{2,}/g, "¶") // Temporarily replace double newlines with a marker
      .replace(/\s+/g, " ") // Collapse whitespace to a single space
      .replace(/¶/g, "\n\n"); // Restore double newlines

    return newMarkup;
  },

  bodyMimeMatch: function (aMsgHdr, searchValue, searchFlags, searchOptions = []) {
    let reg,
      folder = aMsgHdr.folder,
      subject = aMsgHdr.subject;

    /*** READ body ***/
    // let hasOffline = folder.hasMsgOffline(aMsgHdr.messageKey);
    var data;

    let stream = folder.getMsgInputStream(aMsgHdr, {});
    let isStreamError = false;
    try {
      // [issue #260]
      data = "";
      let available;
      while ((available = stream.available())) {
        data += NetUtil.readInputStreamToString(stream, available);
      }
    } catch (ex) {
      FiltaQuilla.Util.logDebug(
        `NetUtil.readInputStreamToString FAILED\nStreaming the message in folder ${folder.prettyName} failed.\nMatching body impossible.`,
        ex
      );
      isStreamError = true;
      return false; // shit shit shit - reading the message fails.
    } finally {
      stream.close();
    }

    if (!data) {
      FiltaQuilla.Util.logDebug(
        `No data streamed for body of ${aMsgHdr.subject}, aborting filter condition`
      );
      return false;
    }

    var ExtractMimeMsgEmitter = {
      getAttachmentName(part) {
        if (!part || !part.hasOwnProperty("headers")) {
          return "";
        }

        if (part.headers.hasOwnProperty("content-disposition")) {
          let filename = MimeParser.getParameter(
            part.headers["content-disposition"][0],
            "filename"
          );
          if (filename) {
            return filename;
          }
        }

        if (part.headers.hasOwnProperty("content-type")) {
          let name = MimeParser.getParameter(part.headers["content-type"][0], "name");
          if (name) {
            return name;
          }
        }

        return "";
      },

      // All parts of content-disposition = "attachment" are returned as attachments.
      // For content-disposition = "inline", all parts except those with content-type
      // text/plain, text/html and text/enriched are returned as attachments.
      isAttachment(part) {
        if (!part) {
          return false;
        }

        let contentType = part.contentType || "text/plain";
        if (contentType.search(/^multipart\//i) === 0) {
          return false;
        }

        let contentDisposition = "";
        if (
          Array.isArray(part.headers["content-disposition"]) &&
          part.headers["content-disposition"].length > 0
        ) {
          contentDisposition = part.headers["content-disposition"][0];
        }

        if (
          contentDisposition.search(/^attachment/i) === 0 ||
          contentType.search(/^text\/plain|^text\/html|^text\/enriched/i) === -1
        ) {
          return true;
        }

        return false;
      },

      isBodyPart(part) {
        if (!part) {
          return false;
        }

        let contentType = part.contentType || "text/plain";
        if (contentType.search(/^multipart\//i) === 0) {
          return false;
        }

        if (part.headers["content-disposition"]) {
          // it's an attachment
          return false;
        }

        if (contentType.search(/^text\/plain|^text\/html|^text\/enriched/i) === -1) {
          return false;
        }

        return true;
      },

      /** JSMime API */
      startMessage() {
        this.mimeTree = {
          partName: "",
          contentType: "message/rfc822",
          parts: [],
          size: 0,
          headers: {},
          attachments: [],
          bodyParts: [],
          // No support for encryption.
          isEncrypted: false,
        };

        // partsPath is a hierarchical stack of parts from the root to the
        // current part.
        this.partsPath = [this.mimeTree];
        this.options = this.options || {};
      },

      endMessage() {
        // Prepare the mimeMsg object, which is the final output of the emitter.
        this.mimeMsg = null;
        if (this.mimeTree.parts.length == 0) {
          return;
        }

        // Check if only a specific mime part has been requested.
        if (this.options.getMimePart) {
          if (this.mimeTree.parts[0].partName == this.options.getMimePart) {
            this.mimeMsg = this.mimeTree.parts[0];
          }
          return;
        }

        this.mimeTree.attachments.sort((a, b) => a.partName > b.partName);
        this.mimeMsg = this.mimeTree;
      },

      startPart(partNum, headerMap) {
        let contentType = headerMap.contentType?.type ? headerMap.contentType.type : "text/plain";

        let headers = {};
        for (let [headerName, headerValue] of headerMap._rawHeaders) {
          // MsgHdrToMimeMessage always returns an array, even for single values.
          let valueArray = Array.isArray(headerValue) ? headerValue : [headerValue];
          // Return a binary string, to mimic MsgHdrToMimeMessage.
          headers[headerName] = valueArray.map((value) => {
            return MailStringUtils.stringToByteString(value);
          });
        }

        // Get the most recent part from the hierarchical parts stack, which is the
        // parent of the new part to by added.
        let parentPart = this.partsPath[this.partsPath.length - 1];

        // Add a leading 1 to the partNum and convert the "$" sub-message deliminator.
        let partName = "1" + (partNum ? "." : "") + partNum.replaceAll("$", ".1");

        // MsgHdrToMimeMessage differentiates between the message headers and the
        // headers of the first part. jsmime.js however returns all headers of
        // the message in the first multipart/* part: Merge all headers into the
        // parent part and only keep content-* headers.
        if (parentPart.contentType.startsWith("message/")) {
          for (let [k, v] of Object.entries(headers)) {
            if (!parentPart.headers[k]) {
              parentPart.headers[k] = v;
            }
          }
          headers = Object.fromEntries(
            Object.entries(headers).filter((h) => h[0].startsWith("content-"))
          );
        }

        // Add default content-type header.
        if (!headers.hasOwnProperty("content-type")) {
          headers["content-type"] = ["text/plain"];
        }

        let newPart = {
          partName,
          body: "",
          headers,
          contentType,
          size: 0,
          parts: [],
          // No support for encryption.
          isEncrypted: false,
        };

        // Add nested new part.
        parentPart.parts.push(newPart);
        // Push the newly added part into the hierarchical parts stack.
        this.partsPath.push(newPart);
      },

      endPart(partNum) {
        let deleteBody = false;
        // Get the most recent part from the hierarchical parts stack.
        let currentPart = this.partsPath[this.partsPath.length - 1];

        // Add size.
        let size = currentPart.body.length;
        currentPart.size += size;
        let partSize = currentPart.size;

        if (this.isAttachment(currentPart)) {
          currentPart.name = this.getAttachmentName(currentPart);
          this.mimeTree.attachments.push({ ...currentPart });
          deleteBody = !this.options.getMimePart;
        }

        if (this.isBodyPart(currentPart)) {
          // create a flat list of part objects for top leve access
          this.mimeTree.bodyParts.push({ ...currentPart });
        }

        if (deleteBody || currentPart.body == "") {
          delete currentPart.body;
        }

        // Remove content-disposition and content-transfer-encoding headers.
        currentPart.headers = Object.fromEntries(
          Object.entries(currentPart.headers).filter(
            (h) => !["content-disposition", "content-transfer-encoding"].includes(h[0])
          )
        );

        // Set the parent of this part to be the new current part.
        this.partsPath.pop();

        // Add the size of this part to its parent as well.
        currentPart = this.partsPath[this.partsPath.length - 1];
        currentPart.size += partSize;
      },

      /**
       * The data parameter is either a string or a Uint8Array.
       */
      deliverPartData(partNum, data) {
        // Get the most recent part from the hierarchical parts stack.
        let currentPart = this.partsPath[this.partsPath.length - 1];

        if (typeof data === "string") {
          currentPart.body += data;
        } else {
          currentPart.body += MailStringUtils.uint8ArrayToByteString(data);
        }
      },
    };

    function extractMimeMsg(input, options) {
      let emitter = Object.create(ExtractMimeMsgEmitter);

      // Set default options and merge with any provided options
      emitter.options = {
        getMimePart: "",
        decodeSubMessages: true,
        ...options, // adds the enumerated options object members
      };

      MimeParser.parseSync(input, emitter, {
        // jsmime does not use the "1." prefix for the partName.
        // jsmime uses "$." as sub-message deliminator.
        pruneat: emitter.options.getMimePart.split(".").slice(1).join(".").replaceAll(".1.", "$."),
        decodeSubMessages: emitter.options.decodeSubMessages,
        bodyformat: "decode",
        stripcontinuations: true,
        strformat: "unicode",
      });
      // we need to implement emitter.mimeTree and startMessage() + endMessage()? See
      // https://searchfox.org/comm-esr115/source/mailnews/mime/src/mimeParser.jsm#75
      return emitter.mimeMsg;
    }

    const isContentTypeFilter = searchOptions.some((e) => e.startsWith("type:"));
    const isIncludeAttachments =
      isContentTypeFilter && searchOptions.some((e) => e == "type:vcard");

    // new code, using my own emitter.
    let mimeMsg = extractMimeMsg(data, {
      includeAttachments: isIncludeAttachments, // ,getMimePart: partName
    });

    reg = RegExp(searchValue, searchFlags);

    /** EXTRACT MIME PARTS **/
    const isDebugDetail = FiltaQuilla.Util.isDebugOption("regexBody");
    if (mimeMsg) {
      let detectResults = "";
      // MimeParser.extractMimeMsg
      let isFoundContentParts = false;

      // bodyParts only includes text types:
      // Common: text/plain, text/html, text/calendar, text/vcard
      // Less Common: text/richtext, text/enriched, text/x-amp-html
      // Rarely Used: text/markdown, text/xml, text/css, text/javascript
      // attaching with Tb creates the format text/x-vcard !
      let parts = [...mimeMsg.bodyParts];
      if (isIncludeAttachments) {
        parts.push(
          ...mimeMsg.attachments.filter(
            (p) => p?.contentType?.endsWith("/vcard") || p?.contentType?.endsWith("/x-vcard")
          )
        );
      }

      for (let bp of parts) {
        let p = bp.body, q=""; // put quoted part separate (plaintext)
        let isTagsRemoved = false;
        let isFoundQuoted = false;
        if (bp.contentType.includes("html")) {
          if (isContentTypeFilter && !searchOptions.includes("type:html")) {
            // skip html
            continue;
          }
          isFoundContentParts = true;
          if (searchOptions.includes("-html")) {
            // remove html tags (must include contents of style, as such rules are not content!)
            p = this.collapseWhiteSpace(this.removeHTML(this.removeStyleTags(p)), true);
            isTagsRemoved = true;
          }

          if (!isTagsRemoved && searchOptions.includes("-style")) {
            // (only) remove style tags
            p = this.removeStyleTags(p);
          }
          if (!isTagsRemoved && searchOptions.includes("-quotes")) {
            // (only) remove style tags
            p = this.removeQuotes(p);
          }
          if (searchOptions.includes("-whitespace")) {
            p = this.collapseWhiteSpace(p, true);
          }
        } else if (bp.contentType.includes("plain")) {
          if (isContentTypeFilter && !searchOptions.includes("type:plain")) {
            // skip plain text
            continue;
          }
          isFoundContentParts = true;

          if (searchOptions.includes("-quotes")) {
            p = this.extractQuotesPlainText(p, "u"); // only the unquoted part (optimize out quoted parts)
            // we don't want to extract whitespace as paragraphs are in single lines anyway. (optimized out)
          } else {
            // parse everything (plain text)
            [q, p] = this.extractQuotesPlainText(p, "both");
          }
          if (searchOptions.includes("-whitespace")) {
            p = this.collapseWhiteSpace(p);
            q = this.collapseWhiteSpace(q);
          }
        } else if (bp.contentType.includes("vcard") && searchOptions.includes("type:vcard")) {
          isFoundContentParts = true;
          if (searchOptions.includes("-whitespace")) {
            p = this.collapseWhiteSpace(p);
          }
        }

        let found = reg.test(p);
        if (!found && q) {
          found = reg.test(q);
          if (found) { isFoundQuoted = true; }
        }
        if (found) {
          detectResults += `Detected Regex pattern ${searchValue}\n with content type: ${bp.contentType}\n`;
          if (isFoundQuoted) { 
            detectResults += "Found in quoted part.\n";
          };

          if (FiltaQuilla.Util.isDebug && isDebugDetail) {
            // do a match in debug mode, with some performance penalty
            const matches = p.match(reg);
            detectResults += `\nFirst match: ${matches[0]}`;
          }
          FiltaQuilla.Util.logDebug(
            `Searched Message "${subject}"\n`,
            { reg, searchOptions },
            detectResults
          );
          return true;
        }
      }
      let txtDebug =
        `Searched Message "${subject}"\n` +
        `Regex pattern ${searchValue} not found.` +
        isFoundContentParts
          ? ""
          : "No matching text contentType found";

      FiltaQuilla.Util.logDebug(txtDebug);
      return false;
    }

    FiltaQuilla.Util.logDebug("mime parser retrieved no data!");
    return false;
  },

  getFileInitArg: function (win) {
    // [issue 265]
    // [bug 1882701] nsIFilePicker.init() first parameter changed from Tb125
    if (!win) return null;
    if (this.versionGreaterOrEqual(this.AppverFull, "125")) {
      return win.browsingContext;
    }
    return win;
  },
}; // Util

// some scoping for globals
//(function fq_firstRun()
{
        
  FiltaQuilla.Util.FirstRun = {
    init: async function init() {
      const prefBranchString = "extensions.filtaquilla.",
            ssPrefs = Services.prefs.getBranch(prefBranchString);

      let prev = -1, 
          firstrun = true, 
          showFirsts = true,     // set false - use this to disable any filtaquilla tabs
          debugFirstRun = false;
          
      try { 
        debugFirstRun = Boolean(ssPrefs.getBoolPref("debug.firstrun")); 
      } 
      catch (e) { debugFirstRun = false; }
      
      FiltaQuilla.Util.logDebugOptional ("firstrun","Util.FirstRun.init()");
      FiltaQuilla.Util.addonInfo = await FiltaQuilla.Util.notifyTools.notifyBackground({ func: "getAddonInfo" });
      // await util.VersionProxy();
      let current = FiltaQuilla.Util.Version;
      FiltaQuilla.Util.logDebugOptional("firstrun", "Current FiltaQuilla Version: " + current);
      
      
      try {
        FiltaQuilla.Util.logDebugOptional ("firstrun","try to get setting: getStringPref(version)");
        try { 
          prev = ssPrefs.getStringPref("version"); 
        } catch (e) {
          prev = "?";
          FiltaQuilla.Util.logDebugOptional ("firstrun","Could not determine previous version - " + e);
        }

        FiltaQuilla.Util.logDebugOptional ("firstrun","try to get setting: getBoolPref(firstrun)");
        try { 
          firstrun = ssPrefs.getBoolPref("firstRun"); 
        }  catch (e) { 
          firstrun = true; 
				}

        FiltaQuilla.Util.logDebugOptional ("firstrun", "Settings retrieved:"
            + "\nprevious version=" + prev
            + "\ncurrent version=" + current
            + "\nfirstrun=" + firstrun
            + "\nshowfirstruns=" + showFirsts
            + "\ndebugFirstRun=" + debugFirstRun);

      }
      catch(e) {
        FiltaQuilla.Util.alert("FiltaQuilla exception in filtaquilla-util.js: " + e.message
          + "\n\ncurrent: " + current
          + "\nprev: " + prev
          + "\nfirstrun: " + firstrun
          + "\ndebugFirstRun: " + debugFirstRun);
      }
      finally {
        FiltaQuilla.Util.logDebugOptional ("firstrun","finally - firstrun=" + firstrun);
        let suppressVersionScreen = false,
            // if this is a pre-release, cut off everything from "pre" on... e.g. 1.9pre11 => 1.9
            pureVersion = FiltaQuilla.Util.VersionSanitized;
        FiltaQuilla.Util.logDebugOptional ("firstrun","finally - pureVersion=" + pureVersion);
        
        // STORE CURRENT VERSION NUMBER!
        if (prev!=pureVersion && current!='?' && (current.indexOf(FiltaQuilla.Util.HARDCODED_EXTENSION_TOKEN) < 0)) {
          FiltaQuilla.Util.logDebugOptional ("firstrun","Store current version " + current);
          ssPrefs.setStringPref("version", pureVersion); // store sanitized version! (no more alert on pre-Releases + betas!)
        } else {
          FiltaQuilla.Util.logDebugOptional ("firstrun","Can't store current version: " + current
            + "\nprevious: " + prev.toString()
            + "\ncurrent!='?' = " + (current!='?').toString()
            + "\nprev!=current = " + (prev!=current).toString()
            + "\ncurrent.indexOf(" + FiltaQuilla.Util.HARDCODED_EXTENSION_TOKEN + ") = " + current.indexOf(FiltaQuilla.Util.HARDCODED_EXTENSION_TOKEN).toString());
        }
        // NOTE: showfirst-check is INSIDE both code-blocks, because prefs need to be set no matter what.
        if (firstrun){  // FIRST TIME INSTALL
          FiltaQuilla.Util.logDebugOptional ("firstrun","set firstrun=false");
          ssPrefs.setBoolPref("firstRun",false);
          // store first install date 
          let date = new Date(),
              dateString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000 ))
                            .toISOString()
                            .split("T")[0];
          ssPrefs.setStringPref("installDate", dateString);
          
          // 
          if (showFirsts) {
            // on very first run, we go to the index page - welcome blablabla
            FiltaQuilla.Util.logDebugOptional ("firstrun","setTimeout for content tab (filtaquilla.html)");
            FiltaQuilla.Util.getMail3PaneWindow.window.setTimeout(function() {
              FiltaQuilla.Util.openLinkInTab("https://quickfilters.quickfolders.org/filtaquilla.html");
            }, 1500); 
          }
        }
        else { 
          /** minor version upgrades / sales  **/
          // if (pureVersion.indexOf('2.1') == 0 && prev.indexOf("2.0") == 0) suppressVersionScreen = true;
          let versionPage = "https://quickfilters.quickfolders.org/fq-versions.html#" + pureVersion;
          
          // SILENT UPDATES
          // Check for Maintenance updates (no donation screen when updating to 3.12.1, 3.12.2, etc.)
          //  same for 3.14.1, 3.14.2 etc - no donation screen
          if (prev!=pureVersion && current.indexOf(FiltaQuilla.Util.HARDCODED_EXTENSION_TOKEN) < 0) {
            FiltaQuilla.Util.logDebugOptional ("firstrun","prev!=current -> upgrade case.");
            // upgrade case!!

            if (showFirsts) {
              // version is different => upgrade (or conceivably downgrade)
              // VERSION HISTORY PAGE
              // display version history - disable by right-clicking label above show history panel
              if (!suppressVersionScreen) {
                FiltaQuilla.Util.logDebugOptional ("firstrun","open tab for version history, FQ " + current);
                FiltaQuilla.Util.getMail3PaneWindow.window.setTimeout(function(){ 
                  FiltaQuilla.Util.openLinkInTab(versionPage); 
                }, 2200);
              }
            }

          }
          
        }
        FiltaQuilla.Util.logDebugOptional ("firstrun","finally { } ends.");
      } // end finally      

      
    }
  }

}
//)();


// vim: set expandtab tabstop=2 shiftwidth=2:

// the following adds the notifyTools API as a util method to communicate with the background page
// this mechanism will be used to replace legacy code with API calls.
var Services = globalThis.Services || ChromeUtils.import(
  "resource://gre/modules/Services.jsm"
).Services;
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var { MimeParser } = ChromeUtils.import("resource:///modules/mimeParser.jsm");
FiltaQuilla.Util.extension = ExtensionParent.GlobalManager.getExtension("filtaquilla@mesquilla.com");
Services.scriptloader.loadSubScript(
  FiltaQuilla.Util.extension.rootURI.resolve("content/scripts/notifyTools.js"),
  FiltaQuilla.Util,
  "UTF-8"
);
