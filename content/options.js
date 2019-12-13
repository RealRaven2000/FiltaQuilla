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
 
var {FiltaQuilla} = Components.utils.import("chrome://filtaquilla/content/filtaquilla-util.js"); // FiltaQuilla object
const util = FiltaQuilla.Util;

function onLoad() {
  // disable items that are not valid in current core version
  const Cc = Components.classes,
        Ci = Components.interfaces,
        Cu = Components.utils,
        THUNDERBIRD_ID = "{3550f703-e582-4d05-9a08-453d09bdfdc6}",
        SEAMONKEY_ID = "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}";
  
  let appInfo = Cc["@mozilla.org/xre/app-info;1"]
                  .getService(Ci.nsIXULAppInfo),
      versionChecker = Cc["@mozilla.org/xpcom/version-comparator;1"]
                         .getService(Ci.nsIVersionComparator),
      version = appInfo.version;

  let haveActionNeedsBody,
      haveDetachToFile;
  // Thunderbird version checks
  if(appInfo.ID == THUNDERBIRD_ID) {
    haveActionNeedsBody =
      (versionChecker.compare(version, "3.1b2pre") >= 0)  ? true : false;
    haveDetachToFile =
      (versionChecker.compare(version, "3.1b2pre") >= 0)  ? true : false;
  }

  // SeaMonkey version checks
  if(appInfo.ID == SEAMONKEY_ID) {
    haveActionNeedsBody =
      (versionChecker.compare(version, "2.1a1pre") >= 0)  ? true : false;
    haveDetachToFile =
      (versionChecker.compare(version, "2.1a1pre") >= 0)  ? true : false;
  }

  let detachElement = document.getElementById("checkDetachAttachmentsEnabled");
  detachElement.disabled = haveDetachToFile || detachElement.checked ? false : true;

  let javascriptActionBody = document.getElementById("checkJavascriptActionBodyEnabled");
  javascriptActionBody.disabled = haveActionNeedsBody || javascriptActionBody.checked ? false : true;
  let verPanel = document.getElementById("fq-options-header-version");
  verPanel.textContent = util.Version;

}

function onVersionClick() {
  let pureVersion = util.VersionSanitized,
      versionPage = "http://quickfilters.mozdev.org/fq-versions.html#" + pureVersion;
  util.openLinkInTab(versionPage);
  window.close();
}

// vim: set expandtab tabstop=2 shiftwidth=2:
