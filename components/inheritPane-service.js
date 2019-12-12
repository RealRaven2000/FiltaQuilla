/*
 ***** BEGIN LICENSE BLOCK *****
 * This file is part of an application by Mesquilla.
 *
 * This application is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * You should have received a copy of the GNU General Public License
 * along with this application.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mesquilla code.
 *
 * The Initial Developer of the Original Code is
 * Kent James <rkent@mesquilla.com>
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK *****
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
const catMan = Components.classes["@mozilla.org/categorymanager;1"]
                         .getService(Components.interfaces.nsICategoryManager);

function inheritPane() {
}

inheritPane.prototype = {
  name: "inheritPane",
  // This should be the extension that
  //  contains the am-inheritPane.* files
  chromePackageName: "filtaquilla",
  showPanel: function showPanel(server) {
    /*
     * For each inherited property that has been registered with
     *  InheritedPropertiesGrid, the hidefor values are stored in the category
     *  manager as part of the property object.
     */
		 debugger;
     Components.utils.import("resource://" + this.chromePackageName + "/inheritedPropertiesGrid.jsm");
     let catEnum = catMan.enumerateCategory("InheritedPropertiesGrid");
     let type = server.type;
     let show = false; // have we found a non-hidden entry?
     while (!show && catEnum.hasMoreElements()) {
       let entry = catEnum.getNext()
                          .QueryInterface(Components.interfaces.nsISupportsCString)
                          .data;
       let propertyObject = InheritedPropertiesGrid.getPropertyObject(entry);
       if (propertyObject.hidefor.indexOf(type) == -1) // then we should show this entry
         show = true;
     }
    return show;
  },

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIMsgAccountManagerExtension]),
  classDescription: "MesQuilla Inherit Pane Service",
  classID: Components.ID("{f2809396-1cd1-12b2-841b-8e15f007c699}"),
  contractID: "@mozilla.org/accountmanager/extension;1?name=inheritPane",

  _xpcom_categories: [{category: "mailnews-accountmanager-extensions",
                       entry: "mesquilla extension inherit pane"}]
};

if (XPCOMUtils.generateNSGetFactory)
  var NSGetFactory = XPCOMUtils.generateNSGetFactory([inheritPane]);
else
  var NSGetModule= XPCOMUtils.generateNSGetModule([inheritPane]);

// vim: set expandtab tabstop=2 shiftwidth=2:
