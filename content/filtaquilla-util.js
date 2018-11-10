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

FiltaQuilla.Util = {
  mAppName: null,
  mAppver: null,
	
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
	
  getMail3PaneWindow: function getMail3PaneWindow() {
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
					// focus on tabmail ?
					
					return true;
				}
			}
		}
		return false;
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
						let mail3PaneWindow = this.getMail3PaneWindow();
						if (mail3PaneWindow) {
							tabmail = mail3PaneWindow.document.getElementById("tabmail");
							mail3PaneWindow.focus();
						}
					}
					// note: findMailTab will activate the tab if it is already open
					if (tabmail && (!util.findMailTab(tabmail, URL))) {
						sTabMode = (util.Application === "Thunderbird" && util.Appver >= 3) ? "contentTab" : "3pane";
						tabmail.openTab(sTabMode,
						{ contentPage: URL}); // , clickHandler: "specialTabs.siteClickHandler(event, FiltaQuilla_TabURIregexp._thunderbirdRegExp);"
					}
					else {
						window.openDialog("chrome://messenger/content/", "_blank",
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
          this.getMail3PaneWindow().window.openDialog(getBrowserURL(), "_blank", "all,dialog=no", linkURI, null, 'QuickFilters');
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
	
	
}

