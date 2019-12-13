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
var EXPORTED_SYMBOLS = ['FiltaQuilla'];


FiltaQuilla.Util = {
  mAppName: null,
  mAppver: null,
	mExtensionVer: null,
  VersionProxyRunning: false,
	HARDCODED_CURRENTVERSION : "2.0", // will later be overriden call to AddonManager
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
  
  get Properties() {
    if (!this._properties)
      this._properties = this.StringBundleSvc.createBundle("chrome://filtaquilla/locale/filtaquilla.properties")
        .QueryInterface(Components.interfaces.nsIStringBundle);
    return this._properties;
  },
  
  
	get prefs () {
    const Ci = Components.interfaces,
          Cc = Components.classes;
		if (this._prefs) return this._prefs;
		var prefs = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);
		this._prefs = prefs.getBranch("extensions.filtaquilla.");
		return this._prefs;
	},

  get AppverFull() {
    let appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
            .getService(Components.interfaces.nsIXULAppInfo);
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
    let appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
            .getService(Components.interfaces.nsIXULAppInfo);
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

	findMailTab: function findMailTab(tabmail, URL) {
		const util = FiltaQuilla.Util;
		// mail: tabmail.tabInfo[n].browser
		let baseURL = util.getBaseURI(URL),
				numTabs = util.getTabInfoLength(tabmail);

		for (let i = 0; i < numTabs; i++) {
			let info = util.getTabInfoByIndex(tabmail, i);
			if (info.browser && info.browser.currentURI) {
				let tabUri = util.getBaseURI(info.browser.currentURI.spec);
				if (tabUri == baseURL) {
					tabmail.switchToTab(i);
					info.browser.loadURI(URL);
					return true;
				}
			}
		}
		return false;
	} ,

	openHelpTab: function FiltaQuilla_openHelpTab(fragment) {
		let f = (fragment ? "#" + fragment : ""),
		    URL = "http://quickfilters.mozdev.org/filtaquilla.html" + f;
		util.getMail3PaneWindow.window.setTimeout(function() {
			FiltaQuilla.Util.openLinkInTab(URL);
			});
	} ,

	openLinkInTab : function FiltaQuilla_openLinkInTab(URL) {
		const util = FiltaQuilla.Util;
		// URL = util.makeUriPremium(URL);
		try {
			switch(util.Application) {
				case "SeaMonkey":
					util.openLinkInBrowserForced(URL);
					return;
				case "Thunderbird":
					let sTabMode="",
							tabmail = this.tabmail;
					if (!tabmail) {
						// Try opening new tabs in an existing 3pane window
						let mail3PaneWindow = this.getMail3PaneWindow;
						if (mail3PaneWindow) {
							tabmail = mail3PaneWindow.document.getElementById("tabmail");
							mail3PaneWindow.setTimeout(function()
									{	mail3PaneWindow.focus();
									},
									250
								);
						}
					}
					// note: findMailTab will activate the tab if it is already open
					if (tabmail) {
						if (!util.findMailTab(tabmail, URL)) {
							sTabMode = (util.Application === "Thunderbird") ? "contentTab" : "3pane";
							tabmail.openTab(sTabMode,
							{ contentPage: URL}); // , clickHandler: "specialTabs.siteClickHandler(event, FiltaQuilla_TabURIregexp._thunderbirdRegExp);"
						}
					}
					else {
						util.getMail3PaneWindow.window.openDialog("chrome://messenger/content/", "_blank",
											"chrome,dialog=no,all", null,
							{ tabType: "contentTab",
								tabParams: {contentPage: URL, id:"FiltaQuilla_Weblink"}   // , clickHandler: "specialTabs.siteClickHandler(event, FiltaQuilla_TabURIregexp._thunderbirdRegExp);",
							}
						);
					}
			}
		}
		catch(e) { return false; }
		return true;
	} ,

	openLinkInBrowserForced: function openLinkInBrowserForced(linkURI) {
    const Ci = Components.interfaces,
          Cc = Components.classes,
					util = FiltaQuilla.Util;
    try {
      this.logDebug("openLinkInBrowserForced (" + linkURI + ")");
      if (util.Application==='SeaMonkey') {
        let windowManager = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator),
            browserWin = windowManager.getMostRecentWindow( "navigator:browser" );
        if (browserWin) {
          let URI = linkURI;
          setTimeout(function() {
						let tabBrowser = browserWin.getBrowser(),
						    params = {"selected":true};
					  browserWin.currentTab = tabBrowser.addTab(URI, params);
						if (browserWin.currentTab.reload) browserWin.currentTab.reload();
						// activate last tab
						if (tabBrowser && tabBrowser.tabContainer)
							tabBrowser.tabContainer.selectedIndex = tabBrowser.tabContainer.childNodes.length-1;
					}, 250);
        }
        else {
          this.getMail3PaneWindow.window.openDialog(getBrowserURL(), "_blank", "all,dialog=no", linkURI, null, 'FiltaQuilla');
        }

        return;
      }
      let service = Cc["@mozilla.org/uriloader/external-protocol-service;1"]
                              .getService(Ci.nsIExternalProtocolService),
          ioservice = Cc["@mozilla.org/network/io-service;1"].
            getService(Ci.nsIIOService),
          uri = ioservice.newURI(linkURI, null, null);
      service.loadURI(uri);
    }
    catch(e) { this.logDebug("openLinkInBrowserForced (" + linkURI + ") " + e.toString()); }
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

  logToConsole: function logToConsole(msg, optionTag) {
    let consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
    consoleService.logStringMessage("FiltaQuilla "
			+ (optionTag ? '{' + optionTag.toUpperCase() + '} ' : '')
			+ this.logTime() + "\n"+ msg);
  },

  // flags
  // errorFlag    0x0   Error messages. A pseudo-flag for the default, error case.
  // warningFlag    0x1   Warning messages.
  // exceptionFlag  0x2   An exception was thrown for this case - exception-aware hosts can ignore this.
  // strictFlag     0x4
  logError: function logError(aMessage, aSourceName, aSourceLine, aLineNumber, aColumnNumber, aFlags) {
    const Ci = Components.interfaces,
					Cc = Components.classes;
    let consoleService = Cc["@mozilla.org/consoleservice;1"]
                                   .getService(Ci.nsIConsoleService),
        aCategory = '',
        scriptError = Cc["@mozilla.org/scripterror;1"].createInstance(Ci.nsIScriptError);
    scriptError.init(aMessage, aSourceName, aSourceLine, aLineNumber, aColumnNumber, aFlags, aCategory);
    consoleService.logMessage(scriptError);
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
      this.logToConsole(msg);
  },

  isDebug: function isDebug() {
		return this.prefs.getBoolPref("debug");
  },

	isDebugOption: function isDebugOption(o) {
		if(!this.isDebug) return false;
		try {return this.prefs.getBoolPref("debug." + o);}
		catch(e) {return false;}
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
					this.logToConsole(msg, option);
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

    if (pref)
			Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch).setBoolPref(pref.getAttribute('name'), cb.checked);
    if (noUpdate)
      return true;
    return false // this.updateMainWindow();
  },

  showAboutConfig: function(clickedElement, filter, readOnly) {
    const name = "Preferences:ConfigManager",
		      util = FiltaQuilla.Util;
    let uri = "chrome://global/content/config.xul";
		if (util.Application)
			uri += "?debug";

    let mediator = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
    let w = mediator.getMostRecentWindow(name);

    let win = clickedElement ?
		          (clickedElement.ownerDocument.defaultView ? clickedElement.ownerDocument.defaultView : window)
							: window;
    if (!w) {
      let watcher = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].getService(Components.interfaces.nsIWindowWatcher);
      w = watcher.openWindow(win, uri, name, "dependent,chrome,resizable,centerscreen,alwaysRaised,width=500px,height=350px", null);
    }
    w.focus();
    w.addEventListener('load',
      function () {
        let flt = w.document.getElementById("textbox");
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
		const util = FiltaQuilla.Util;
		if (typeof Preferences == 'undefined') {
			util.logDebug("Skipping loadPreferences - Preferences object not defined");
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

  getBundleString: function getBundleString(id, defaultText) { 
		let s="";
		try {
			s= this.Properties.GetStringFromName(id);
		}
		catch(e) {
			s = defaultText;
			this.logToConsole ("Could not retrieve bundle string: " + id + "");
		}
		return s;
	} ,
  
	VersionProxy: function VersionProxy(win) {
    const util = FiltaQuilla.Util,
          Cu = Components.utils;
		try {
      if (!win) {
        try {
          win = window;
        }
        catch(ex) {
          util.logException("VersionProxy", ex);
          return;
        }
      }
			util.logDebugOptional("firstrun", "Util.VersionProxy() started.\n mExtensionVer=" + util.mExtensionVer);
			if (util.mExtensionVer // early exit, we got the version!
				||
			    util.VersionProxyRunning) // no recursion...
				return;
			util.VersionProxyRunning = true;
			if (Cu.import) {
				
				let versionCallback = function(addon) {
					let versionLabel = win.document.getElementById("fq-options-header-version");
					if (versionLabel) versionLabel.setAttribute("value", addon.version);

					util.mExtensionVer = addon.version;
					util.logDebug("AddonManager: FiltaQuilla extension's version is " + addon.version);
					util.logDebugOptional("firstrun", "FiltaQuilla.VersionProxy() - DETECTED FiltaQuilla Version " + util.mExtensionVer);
					// make sure we are not in options window
					if (!versionLabel)
						util.FirstRun.init();
				}
				
				Cu.import("resource://gre/modules/AddonManager.jsm");
				const addonId = util.ADDON_ID;
        AddonManager.getAddonByID(addonId).then(function(addonId) { versionCallback(addonId); } ); // this function is now a promise
			}
			util.logDebugOptional("firstrun", "AddonManager.getAddonByID .. added callback for setting extensionVer.");

		}
		catch(ex) {
			util.logToConsole("FiltaQuilla VersionProxy failed - are you using an old version of " + util.Application + "?"
				+ "\n" + ex);
		}
		finally {
			util.VersionProxyRunning=false;
		}
	},

	get Version() {
    const util = FiltaQuilla.Util;
		// returns the current FiltaQuilla (full) version number.
		if (util.mExtensionVer)
			return util.mExtensionVer; // set asynchronously
		let current = util.HARDCODED_CURRENTVERSION + util.HARDCODED_EXTENSION_TOKEN;
		// Addon Manager: use Proxy code to retrieve version asynchronously
		util.VersionProxy(); // modern Mozilla builds.
											// these will set mExtensionVer (eventually)
											// also we will delay FirstRun.init() until we _know_ the version number
		return current;

	} ,

	get VersionSanitized() {
    const util = FiltaQuilla.Util;
		function strip(version, token) {
			let cutOff = version.indexOf(token);
			if (cutOff > 0) { 	// make sure to strip of any pre release labels
				return version.substring(0, cutOff);
			}
			return version;
		}

		let pureVersion = strip(util.Version, 'pre');
		pureVersion = strip(pureVersion, 'beta');
		pureVersion = strip(pureVersion, 'alpha');
		return strip(pureVersion, '.hc');
	},
  
	versionGreaterOrEqual: function(a, b) {
		let versionComparator = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
														.getService(Components.interfaces.nsIVersionComparator);
		return (versionComparator.compare(a, b) >= 0);
	} ,

	versionSmaller: function(a, b) {
		let versionComparator = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
														.getService(Components.interfaces.nsIVersionComparator);
		 return (versionComparator.compare(a, b) < 0);
	} ,	


} // Util

// some scoping for globals
//(function fq_firstRun()
{
  const util = FiltaQuilla.Util,
        Ci = Components.interfaces,
        Cc = Components.classes;
        
  FiltaQuilla.Util.FirstRun = {
    init: function init() {
      const prefBranchString = "extensions.filtaquilla.",
            svc = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService),
            ssPrefs = svc.getBranch(prefBranchString),
            versionComparator = Cc["@mozilla.org/xpcom/version-comparator;1"].getService(Ci.nsIVersionComparator);

      let prev = -1, 
          firstrun = true, 
          showFirsts = true,     // set false - use this to disable any filtaquilla tabs
          debugFirstRun = false;
          
      try { 
        debugFirstRun = Boolean(ssPrefs.getBoolPref("debug.firstrun")); 
      } 
      catch (e) { debugFirstRun = false; }
      
      util.logDebugOptional ("firstrun","Util.FirstRun.init()");
      // Version: this gettetr will call VersionProxy to determine Add-on version asynchronously
      let current = util.Version;
      util.logDebugOptional("firstrun", "Current FiltaQuilla Version: " + current);
      
      
      try {
        util.logDebugOptional ("firstrun","try to get setting: getStringPref(version)");
        try { prev = ssPrefs.getStringPref("version"); }
        catch (e) {
          prev = "?";
          util.logDebugOptional ("firstrun","Could not determine previous version - " + e);
        } ;

        util.logDebugOptional ("firstrun","try to get setting: getBoolPref(firstrun)");
        try { 
          firstrun = ssPrefs.getBoolPref("firstRun"); 
        } 
        catch (e) { firstrun = true; }

        util.logDebugOptional ("firstrun", "Settings retrieved:"
            + "\nprevious version=" + prev
            + "\ncurrent version=" + current
            + "\nfirstrun=" + firstrun
            + "\nshowfirstruns=" + showFirsts
            + "\ndebugFirstRun=" + debugFirstRun);

      }
      catch(e) {
        util.alert("FiltaQuilla exception in filtaquilla-util.js: " + e.message
          + "\n\ncurrent: " + current
          + "\nprev: " + prev
          + "\nfirstrun: " + firstrun
          + "\ndebugFirstRun: " + debugFirstRun);
      }
      finally {
        util.logDebugOptional ("firstrun","finally - firstrun=" + firstrun);
        let suppressVersionScreen = false,
            // if this is a pre-release, cut off everything from "pre" on... e.g. 1.9pre11 => 1.9
            pureVersion = util.VersionSanitized;
        util.logDebugOptional ("firstrun","finally - pureVersion=" + pureVersion);
        
        // STORE CURRENT VERSION NUMBER!
        if (prev!=pureVersion && current!='?' && (current.indexOf(util.HARDCODED_EXTENSION_TOKEN) < 0)) {
          util.logDebugOptional ("firstrun","Store current version " + current);
          ssPrefs.setStringPref("version", pureVersion); // store sanitized version! (no more alert on pre-Releases + betas!)
        }
        else {
          util.logDebugOptional ("firstrun","Can't store current version: " + current
            + "\nprevious: " + prev.toString()
            + "\ncurrent!='?' = " + (current!='?').toString()
            + "\nprev!=current = " + (prev!=current).toString()
            + "\ncurrent.indexOf(" + util.HARDCODED_EXTENSION_TOKEN + ") = " + current.indexOf(util.HARDCODED_EXTENSION_TOKEN).toString());
        }
        // NOTE: showfirst-check is INSIDE both code-blocks, because prefs need to be set no matter what.
        if (firstrun){  // FIRST TIME INSTALL
          util.logDebugOptional ("firstrun","set firstrun=false");
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
            util.logDebugOptional ("firstrun","setTimeout for content tab (filtaquilla.html)");
            util.getMail3PaneWindow.window.setTimeout(function() {
              util.openLinkInTab("http://quickfilters.mozdev.org/filtaquilla.html");
            }, 1500); 
          }
        }
        else { 
          /** minor version upgrades / sales  **/
          // if (pureVersion.indexOf('2.1') == 0 && prev.indexOf("2.0") == 0) suppressVersionScreen = true;
          let versionPage = "http://quickfilters.mozdev.org/fq-versions.html#" + pureVersion;
          
          // SILENT UPDATES
          // Check for Maintenance updates (no donation screen when updating to 3.12.1, 3.12.2, etc.)
          //  same for 3.14.1, 3.14.2 etc - no donation screen
          if (prev!=pureVersion && current.indexOf(util.HARDCODED_EXTENSION_TOKEN) < 0) {
            util.logDebugOptional ("firstrun","prev!=current -> upgrade case.");
            // upgrade case!!

            if (showFirsts) {
              // version is different => upgrade (or conceivably downgrade)
              // VERSION HISTORY PAGE
              // display version history - disable by right-clicking label above show history panel
              if (!suppressVersionScreen) {
                util.logDebugOptional ("firstrun","open tab for version history, FQ " + current);
                util.getMail3PaneWindow.window.setTimeout(function(){ 
                  util.openLinkInTab(versionPage); 
                }, 2200);
              }
            }

          }
          
          util.loadPlatformStylesheet(window);
        }
        util.logDebugOptional ("firstrun","finally { } ends.");
      } // end finally      

      
    }
  }

}
//)();


// vim: set expandtab tabstop=2 shiftwidth=2:
