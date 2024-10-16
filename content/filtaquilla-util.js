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
	HARDCODED_CURRENTVERSION : "4.0", // will later be overriden call to AddonManager
	HARDCODED_EXTENSION_TOKEN : ".hc",
	ADDON_ID: "filtaquilla@mesquilla.com",
	_prefs: null,
	_consoleService: null,
  _stringBundleSvc: null,
  _properties: null,
	lastTime: 0,
  
  get StringBundleSvc() {
    if (!this._stringBundleSvc)
      this._stringBundleSvc = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
    return this._stringBundleSvc;
  },
  
  
	get prefs () {
    const Ci = Components.interfaces,
          Cc = Components.classes;
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
    let appVer=this.AppverFull.substr(0,3); // only use 1st three letters - that's all we need for compatibility checking!
      this.mAppver = parseFloat(appVer); // quick n dirty!
    }
    return this.mAppver;
  },

  get Application() {
    if (null===this.mAppName) {
    let appInfo = Services.appinfo;
      const FIREFOX_ID = "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}";
      const THUNDERBIRD_ID = "{3550f703-e582-4d05-9a08-453d09bdfdc6}";
      const SEAMONKEY_ID = "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}";
      const POSTBOX_ID = "postbox@postbox-inc.com";
      switch(appInfo.ID) {
        case FIREFOX_ID:
          return this.mAppName='Firefox';
        case THUNDERBIRD_ID:
          return this.mAppName='Thunderbird';
        case SEAMONKEY_ID:
          return this.mAppName='SeaMonkey';
        case POSTBOX_ID:
          return this.mAppName='Postbox';
        default:
          this.mAppName=appInfo.name;
          this.logDebug ( 'Unknown Application: ' + appInfo.name);
          return appInfo.name;
      }
    }
    return this.mAppName;
  },

	get tabmail() {
		let doc = this.getMail3PaneWindow.document,
		    tabmail = doc.getElementById("tabmail");
		return tabmail;
	} ,

  get getMail3PaneWindow() {
    let windowManager = Components.classes['@mozilla.org/appshell/window-mediator;1']
        .getService(Components.interfaces.nsIWindowMediator),
        win3pane = windowManager.getMostRecentWindow("mail:3pane");
    return win3pane;
  } ,

  getTabInfoLength: function getTabInfoLength(tabmail) {
		if (tabmail.tabInfo)
		  return tabmail.tabInfo.length;
	  if (tabmail.tabOwners)
		  return tabmail.tabOwners.length;
		return null;
	} ,

	getTabInfoByIndex: function getTabInfoByIndex(tabmail, idx) {
		if (tabmail.tabInfo)
			return tabmail.tabInfo[idx];
		if (tabmail.tabOwners)
		  return tabmail.tabOwners[idx];  // Postbox
		return null;
	} ,

	getBaseURI: function baseURI(URL) {
		let hashPos = URL.indexOf('#'),
				queryPos = URL.indexOf('?'),
				baseURL = URL;

		if (hashPos>0)
			baseURL = URL.substr(0, hashPos);
		else if (queryPos>0)
			baseURL = URL.substr(0, queryPos);
		if (baseURL.endsWith('/'))
			return baseURL.substr(0, baseURL.length-1); // match "x.com" with "x.com/"
		return baseURL;
	} ,

	openHelpTab: function FiltaQuilla_openHelpTab(fragment) {
		let f = (fragment ? "#" + fragment : ""),
		    URL = "https://quickfilters.quickfolders.org/filtaquilla.html" + f;
		FiltaQuilla.Util.getMail3PaneWindow.window.setTimeout(function() {
			FiltaQuilla.Util.openLinkInTab(URL);
			});
	} ,
  
  openTooltipPopup: function(el) {
    if (el.getAttribute("hasToolTip")) {
      return;
    }
    let txt = el.getAttribute("clickyTooltip");
    if (txt) {
      let tip  = document.createElement("div");
      tip.classList.add('tooltip');
      tip.innerText = txt;
      tip.style.transform =
        'translate(' +
          (el.hasAttribute('tip-left') ? 'calc(-100% - 5px)' : '15px') + ', ' +
          (el.hasAttribute('tip-top') ? '-100%' : '0') +
        ')';
      el.appendChild(tip);
      el.onmousemove = e => {
        tip.style.left = e.clientX + 'px'
        tip.style.top = e.clientY + 'px';
      };
      el.setAttribute("hasToolTip", true); // avoids duplicates
    }
  },

	openLinkInTab : async function(URL) {
		// URL = util.makeUriPremium(URL);

    // use API. 
    // getBaseURI to check if we already opened the page and need to 
    // jump to a different anchor.
    await FiltaQuilla.Util.notifyTools.notifyBackground(
      { 
        func: "openLinkInTab", 
        URL: URL, 
        baseURI: this.getBaseURI(URL)
      }
    );
		return true;
	} ,

	openLinkInBrowser: function(linkURI) {
    const Ci = Components.interfaces,
          Cc = Components.classes
    try {
      this.logDebug("openLinkInBrowser (" + linkURI + ")");
      let service = Cc["@mozilla.org/uriloader/external-protocol-service;1"]
                              .getService(Ci.nsIExternalProtocolService),
          ioservice = Cc["@mozilla.org/network/io-service;1"].
            getService(Ci.nsIIOService),
          uri = ioservice.newURI(linkURI, null, null);
      service.loadURI(uri);
    }
    catch(e) { this.logDebug("openLinkInBrowser (" + linkURI + ") " + e.toString()); }
  },

  logTime: function logTime() {
    let timePassed = '',
        end = new Date(),
        endTime = end.getTime();
    try { // AG added time logging for test
      if (this.lastTime === 0) {
        this.lastTime = endTime;
        return "[logTime init]"
      }
      let elapsed = new String(endTime - this.lastTime); // time in milliseconds
      timePassed = '[' + elapsed + ' ms]   ';
      this.lastTime = endTime; // remember last time
    }
    catch(e) {;}
    return end.getHours() + ':' + end.getMinutes() + ':' + end.getSeconds() + '.' + end.getMilliseconds() + '  ' + timePassed;
  },

  logToConsole: function logToConsole(a) {
    let msg = "FiltaQuilla " + this.logTime() + "\n"; // (optionTag ? '{' + optionTag.toUpperCase() + '} ' : '') + 
    console.log (msg, ...arguments);
  },

  // flags
  // errorFlag    0x0   Error messages. A pseudo-flag for the default, error case.
  // warningFlag    0x1   Warning messages.
  // exceptionFlag  0x2   An exception was thrown for this case - exception-aware hosts can ignore this.
  // strictFlag     0x4
  logError: function logError(aMessage, aSourceName, aSourceLine, aLineNumber, aColumnNumber, aFlags) {
    const Ci = Components.interfaces,
					Cc = Components.classes;
    let aCategory = '',
        scriptError = Cc["@mozilla.org/scripterror;1"].createInstance(Ci.nsIScriptError);
    scriptError.init(aMessage, aSourceName, aSourceLine, aLineNumber, aColumnNumber, aFlags, aCategory);
    Services.console.logMessage(scriptError);
  } ,

  logException: function logException(aMessage, ex) {
    let stack = '';
    if (typeof ex.stack!='undefined')
      stack= ex.stack.replace("@","\n  ");

    let srcName = ex.fileName ? ex.fileName : "";
    this.logError(aMessage + "\n" + ex.message, srcName, stack, ex.lineNumber, 0, 0x1); // use warning flag, as this is an exception we caught ourselves
  } ,

  logDebug: function logDebug(msg) {
    if (this.isDebug)
      this.logToConsole(...arguments);
  },

	logHighlightDebug: function(txt, color="white", background="rgb(80,0,0)", ...args) {
		if (this.isDebug) {
			console.log(`FiltaQuilla\n %c${txt}`, `color:${color};background:${background}`, ...args);
		}
	},  

  isDebug: function isDebug() {
		return this.prefs.getBoolPref("debug");
  },

	isDebugOption: function isDebugOption(o) {
		if(!this.isDebug) return false;
		try {return this.prefs.getBoolPref("debug." + o);}
		catch(e) {return false;}
	},


  logWithOption: function logWithOption(a) {
    arguments[0] =  "FiltaQuilla "
      +  '{' + arguments[0].toUpperCase() + '} ' 
      + QuickFolders.Util.logTime() + "\n";
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
			let options = optionString.split(',');
			for (let i=0; i<options.length; i++) {
				let option = options[i];
				if (this.isDebugOption(option)) {
					this.logWithOption(option, msg);
					break; // only log once, in case multiple log switches are on
				}
			}
		}
		catch(ex) {;}
  },

  toggleBoolPreference: function(cb, noUpdate) {
    const Ci = Components.interfaces,
					Cc = Components.classes;
    let prefString = cb.getAttribute("preference");
    let pref = document.getElementById(prefString);

    if (pref) {
			Services.prefs.setBoolPref(pref.getAttribute('name'), cb.checked);
    }
    if (noUpdate) return true;
    return false // this.updateMainWindow();
  },

  showAboutConfig: function(clickedElement, filter, readOnly) {
    const name = "Preferences:ConfigManager";
          
    let mediator = Services.wm,
        isTbModern = FiltaQuilla.Util.versionGreaterOrEqual(FiltaQuilla.Util.AppverFull, "85"),
        uri = (isTbModern) ? "about:config": "chrome://global/content/config.xhtml?debug";

    let w = mediator.getMostRecentWindow(name),
        win = clickedElement ?
		          (clickedElement.ownerDocument.defaultView ? clickedElement.ownerDocument.defaultView : window)
							: window;
    if (!w) {
      let watcher = Services.ww;
      w = watcher.openWindow(win, uri, name, "dependent,chrome,resizable,centerscreen,alwaysRaised,width=750px,height=450px", null);
    }
    w.focus();
    w.addEventListener('load',
      function () {
        let id = (isTbModern) ? "about-config-search" : "textbox",
            flt = w.document.getElementById(id);
        if (flt) {
          flt.value=filter;
          // make filter box readonly to prevent damage!
          if (!readOnly)
            flt.focus();
          else
            flt.setAttribute('readonly',true);
          if (w.self.FilterPrefs) {
            w.self.FilterPrefs();
          }
        }
      });
  },

	// Tb 66 compatibility.
	loadPreferences: function fq_loadPreferences() {
		if (typeof Preferences == 'undefined') {
			FiltaQuilla.Util.logDebug("Skipping loadPreferences - Preferences object not defined");
			return; // older versions of Thunderbird do not need this.
		}
		let myprefs = document.getElementsByTagName("preference");
		if (myprefs.length) {
			let prefArray = [];
			for (let i=0; i<myprefs.length; i++) {
				let it = myprefs.item(i),
				    p = { id: it.id, name: it.getAttribute('name'), type: it.getAttribute('type') };
				if (it.getAttribute('instantApply') == "true") p.instantApply = true;
				prefArray.push(p);
			}
			if (Preferences)
				Preferences.addAll(prefArray);
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
    }
    else {
      s = defaultText;
      this.logToConsole ("Could not retrieve bundle string: " + id + "");
    }
		return s;
	} ,
  
  localize: function(window, buttons = null) {
    var Services = globalThis.Services || ChromeUtils.import(
      "resource://gre/modules/Services.jsm"
    ).Services;
    var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
    let extension = ExtensionParent.GlobalManager.getExtension("filtaquilla@mesquilla.com");
    Services.scriptloader.loadSubScript(
      extension.rootURI.resolve("content/i18n.js"),
      window,
      "UTF-8"
    );
    window.i18n.updateDocument({extension: extension});
    if (buttons) {
      for (let [name, label] of Object.entries(buttons)) {
        window.document.documentElement.getButton(name).label =  extension.localeData.localizeMessage(label); // apply
      }
    }
  } ,

	get Version() {
		// returns the current FiltaQuilla (full) version number.
    if (FiltaQuilla.Util.addonInfo) {
      return FiltaQuilla.Util.addonInfo.version;
    }
		let current = FiltaQuilla.Util.HARDCODED_CURRENTVERSION + FiltaQuilla.Util.HARDCODED_EXTENSION_TOKEN;
		return current;

	} ,

	get VersionSanitized() {
		function strip(version, token) {
			let cutOff = version.indexOf(token);
			if (cutOff > 0) { 	// make sure to strip of any pre release labels
				return version.substring(0, cutOff);
			}
			return version;
		}

		let pureVersion = strip(FiltaQuilla.Util.Version, 'pre');
		pureVersion = strip(pureVersion, 'beta');
		pureVersion = strip(pureVersion, 'alpha');
		return strip(pureVersion, '.hc');
	},
  
	versionGreaterOrEqual: function(a, b) {
		return (Services.vc.compare(a, b) >= 0);
	} ,

	versionSmaller: function(a, b) {
		return (Services.vc.compare(a, b) < 0);
	} ,	


  // from https://searchfox.org/comm-esr115/rev/27d796e03ef54fe526996bd063d7c3748b7c2d62/mailnews/test/resources/MailTestUtils.jsm#75
  loadMessageToString: function(aFolder, aMsgHdr, aCharset) {
    var data = "";
    let reusable = {};
    let bytesLeft = aMsgHdr.messageSize;
    let stream = aFolder.getMsgInputStream(aMsgHdr, reusable);
    if (aCharset) {
      let cstream = Cc[
        "@mozilla.org/intl/converter-input-stream;1"
      ].createInstance(Ci.nsIConverterInputStream);
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

  
  bodyMimeMatch: function(aMsgHdr, searchValue, searchFlags) {
    let msgBody,
        BodyParts = [], 
        BodyType = [], // if we need multiple bodys (e.g. plain text + html mixed)
        r = false,
        reg,
        isTested = false,
        folder = aMsgHdr.folder;

    function isQuotedPrintable(raw) {
      if (!raw) {
        return false;
      }
      const xxlines = raw.split("\n");
      let cte; // line beginning "content transfer encoding"
      if (!xxlines) return false;
      if (!xxlines.length) return false;

      cte = xxlines.find(l => l.startsWith("Content-Transfer-Encoding"));
      if (!cte) return false;
      const vals = cte.split(":");
      if (vals.length < 2) return false;
      const contentType = vals[1].trim();
      var result = (contentType=="quoted-printable");
      FiltaQuilla.Util.logDebug(`content type from raw message: ${contentType}\nisQuotedPrintable=${result}`);
      return result;
    }
        
    /*** READ body ***/
    // let hasOffline = folder.hasMsgOffline(aMsgHdr.messageKey);
    var data;

    let stream = folder.getMsgInputStream(aMsgHdr, {});
    let isStreamError = false;
    try {
      // [issue #260]
      data = "";
      let available;
      while (available = stream.available() ) {
        data += NetUtil.readInputStreamToString(stream, available);
      }
    } catch (ex) {
      FiltaQuilla.Util.logDebug(`NetUtil.readInputStreamToString FAILED\nStreaming the message in folder ${folder.prettyName} failed.\nMatching body impossible.`, ex);
      isStreamError=true;
      return false; // shit shit shit - reading the message fails.
    } finally {
      stream.close();
    }

    if (!data) {
      FiltaQuilla.Util.logDebug(`No data streamed for body of ${aMsgHdr.subject}, aborting filter condition`);
      return false;
    }
    
    /** EXTRACT MIME PARTS **/
    if (MimeParser.extractMimeMsg) {
      // Tb 91
      let mimeMsg = MimeParser.extractMimeMsg(data, {
        includeAttachments: false  // ,getMimePart: partName
      });
      if (!mimeMsg.parts || !mimeMsg.parts.length) {
        isTested = true;
        msgBody = "";
      } else {
        if (mimeMsg.body && mimeMsg.contentType && mimeMsg.contentType.startsWith("text")) {
          BodyParts.push(mimeMsg.body); // just in case this exists too
          BodyType.push(mimeMsg.contentType || "?")
        } else if (mimeMsg.parts && mimeMsg.parts.length) {
          let origPart = mimeMsg.parts[0];
          if (origPart.body && origPart.contentType && ("" + origPart.contentType).startsWith("text")) {
            msgBody = origPart.body;
            FiltaQuilla.Util.logDebugOptional ("mimeBody","found body element in parts[0]");
            BodyParts.push(msgBody);
            BodyType.push(origPart.contentType || "?")
          }
          if (origPart.parts) {
            for (let p = 0; p<origPart.parts.length; p++)  {
              let o = origPart.parts[p];
              if (o.body && o.contentType && o.contentType.startsWith("text")) {
                FiltaQuilla.Util.logDebugOptional ("mimeBody","found body element in parts[0].parts[" + p + "]", o);
                BodyParts.push(o.body);
                BodyType.push(o.contentType || "?")
              }
            }
          }
        }
        if (!BodyParts.length) {
          isTested=true; // no regex, as it failed.
          FiltaQuilla.Util.logDebug("bodyMimeMatch() : No BodyParts could be extracted.");
        } 
          
      }
       
    } else {
      let [headers, body] = MimeParser.extractHeadersAndBody(data); // headers._rawHeaders?.forEach(e => console.log(e));
      FiltaQuilla.Util.logDebugOptional ("mimeBody","Have to use MimeParser.extractHeadersAndBody() which gets raw data (can be both html and plain text)");
       BodyParts.push(body); // this is only the raw mime crap!
       BodyType.push("?");
    }    
    

    let detectResults = "";
    if (!isTested && BodyParts.length && searchValue) {
      reg = RegExp(searchValue, searchFlags);
      if (BodyParts.length>0) {
        for (let i=0;  i<BodyParts.length; i++) {
          FiltaQuilla.Util.logDebugOptional ("mimeBody","testing part [" + i + "] ct = ", BodyType[i]);
          let p = BodyParts[i];
          // parse Message and decide if its encoded as quotedPrintable
          if (isQuotedPrintable(p)) {
            p = unescape(
              p.replace(/%/g, "=25").replace(new RegExp("=", "g"), "%")
            ).replace(/%\n?\s?\n?/g,""); //  reflow line breaks
          }
          // if it is html, strip out as much as possible:
          // p = p;
          if (p.includes("<html")) {
            // remove html the dirty way
            p = p.replace(/(<style[\w\W]+style>)/g, '').replace(/<[^>]+>/g, '').replace(/(\r\n|\r|\n){2,}/g,"").replace(/(\t){2,}/g,"");
          }
          let found = reg.test(p);
          if (found) {
            let ct=p.contentType || "unknown";
            detectResults += `Detected Regex pattern ${searchValue}\n with content type: ${BodyType[i]}\n`
            FiltaQuilla.Util.logDebug();
            r = true;
            msgBody = p;
            break;
          }
        }
      } else {
        FiltaQuilla.Util.logDebugOptional ("mimeBody","No parts found.");
        r = false;
      }
    }
    
    if (r === true) {
      let count = 0,
          txtResults="",
          results = reg.exec(msgBody); // the winning body part LOL

      while ((results= reg.exec(msgBody)) !== null) {
        txtResults += `Match[${count}]: ${results[0]}\n`
        count++;
      }
      FiltaQuilla.Util.logDebug(`${detectResults} found ${count} ${(count!=1 ? "matches": "match")}: \n ------------ \n ${txtResults} `);
      //  FiltaQuilla.Util.logDebug("Thunderbird 91 will have a new function MimeParser.extractMimeMsg()  which will enable proper body parsing ")
    }    
    return r;
  },

	getFileInitArg: function(win) {
    // [issue 265]
		// [bug 1882701] nsIFilePicker.init() first parameter changed from Tb125
		if (!win) return null;
		if (this.versionGreaterOrEqual(this.AppverFull, "125")) {    
			return win.browsingContext;
		}
		return win;
	}

} // Util

// some scoping for globals
//(function fq_firstRun()
{
  const Ci = Components.interfaces,
        Cc = Components.classes;
        
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
        try { prev = ssPrefs.getStringPref("version"); }
        catch (e) {
          prev = "?";
          FiltaQuilla.Util.logDebugOptional ("firstrun","Could not determine previous version - " + e);
        } ;

        FiltaQuilla.Util.logDebugOptional ("firstrun","try to get setting: getBoolPref(firstrun)");
        try { 
          firstrun = ssPrefs.getBoolPref("firstRun"); 
        } 
        catch (e) { firstrun = true; }

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
