/*
 ***** BEGIN LICENSE BLOCK *****
 * This file is part of FiltaQuilla, Custom Filter Actions, by Mesquilla.
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
 *
 * The Original Code is FiltaQuilla code.
 *
 * The Initial Developer of the Original Code is
 * Kent James <rkent@mesquilla.com>
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK *****
 */
 
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
Services.scriptloader.loadSubScript("chrome://filtaquilla/content/filtaquilla-util.js") // FiltaQuilla object
const util = FiltaQuilla.Util;


async function onLoad() {
  // disable items that are not valid in current core version
  const Cc = Components.classes,
        Ci = Components.interfaces,
        Cu = Components.utils;
  
  let haveActionNeedsBody = true,
      haveDetachToFile = true,
      detachElement = document.getElementById("checkDetachAttachmentsEnabled");
      
  detachElement.disabled = (haveDetachToFile || detachElement.checked) ? false : true;

  let javascriptActionBody = document.getElementById("checkJavascriptActionBodyEnabled");
  javascriptActionBody.disabled = haveActionNeedsBody || javascriptActionBody.checked ? false : true;
  let verPanel = document.getElementById("fq-options-header-version");
  await util.VersionProxy();
  verPanel.textContent = util.Version;
  
}

function onVersionClick() {
  let pureVersion = util.VersionSanitized,
      versionPage = "https://quickfilters.quickfolders.org/fq-versions.html#" + pureVersion;
  util.openLinkInTab(versionPage);
  window.close();
}

function loadPreferences() {
  if (typeof Preferences == 'undefined') {
    util.logToConsole("Preferences is not defined - this shouldn't happen!");
    return;
  }	
  util.logDebug("loadPreferences - start:");
  
  let myprefElements = document.querySelectorAll("[preference]");
  let foundElements = {};
  for (let myprefElement of myprefElements) {
    let legacyPrefId = myprefElement.getAttribute("preference");
    foundElements[legacyPrefId] = myprefElement;
  }

  let myprefs = document.getElementsByTagName("preference");
  if (myprefs.length) {
    let prefArray = [];
    for (let it of myprefs) {
      let p = new Object({ id: it.getAttribute('name'), 
                name: it.getAttribute('name'),
                type: it.getAttribute('type') });
      // not supported
      // if (it.getAttribute('instantApply') == "true") p.instantApply = true;
      prefArray.push(p);
        // manually change the shortname in the preference attribute to the actual
      // preference "id" (as in the preference manager)
      foundElements[it.id].setAttribute("preference", it.getAttribute("name"));
    }
    
    
    util.logDebug("Adding " + prefArray.length + " preferences to Preferences loader…")
    if (Preferences)
      Preferences.addAll(prefArray);
  }
  util.logDebug("loadPreferences - finished.");
}

window.addEventListener("load", async () => {
  let val = await onLoad(); // If this pauses, then the onload handler will move onto the next item (it doesn't block).
  // callMyAsyncFunction has been completed.
}, { once: true });


// vim: set expandtab tabstop=2 shiftwidth=2:

