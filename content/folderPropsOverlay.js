/*
 ***** BEGIN LICENSE BLOCK *****
 * This file is part of filtaquilla by Mesquilla.
 *
 * This is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * You should have received a copy of the GNU General Public License
 * along with this.  If not, see <http://www.gnu.org/licenses/>.
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
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK *****
 */

 // folder properties overlay. Unfortunately there are not adequate ids in the
 // filter properties xul to make a normal overlay possible, so instead we have
 // to add our xul dynamically.

Components.utils.import("resource://filtaquilla/inheritedPropertiesGrid.jsm");

(function() {
  // global scope variables
  this.filtaquillaFolderProps = {};

  // local shorthand for the global reference
  let self = this.filtaquillaFolderProps;

  // module-level variables
  const Cc = Components.classes;
  const Ci = Components.interfaces;
  const Cu = Components.utils;

  let folder; // nsIMsgFolder passed to the window

  self.onLoad = function onLoad(e) {
    folder = window.arguments[0].folder;

    // setup UI for the "applyIncomingFilters" inherited property, but only for
    // imap non-inbox folders.
    if ( !(folder instanceof Ci.nsIMsgImapMailFolder) ||
          (folder.getFlag(Ci.nsMsgFolderFlags.Inbox)) ||
          (folder.getFlag(Ci.nsMsgFolderFlags.Virtual)) )
      return;

    window.gInheritTarget = folder;

    // create or get the rows from the inherit grid
    let rows = InheritedPropertiesGrid.getInheritRows(document),
        row;
    try {
			row = InheritedPropertiesGrid.createInheritRow("applyIncomingFilters", folder, document);
    } catch (e) {
			Cu.reportError(e);
		}

    if (row) {
      rows.appendChild(row);
      // extend the ondialogaccept attribute
      let dialog = document.getElementsByTagName("dialog")[0];
      dialog.setAttribute("ondialogaccept", "filtaquillaFolderProps.onAcceptInherit();" +
                          dialog.getAttribute("ondialogaccept"));
    }
    else
      throw "row not created for property applyIncomingFilters";
  },

  self.onAcceptInherit = function applyIncomingFiltersOnAcceptInherit()
  {
    InheritedPropertiesGrid.onAcceptInherit("applyIncomingFilters", folder, document);
  }

})();

window.addEventListener("load", function(e) { filtaquillaFolderProps.onLoad(e); }, false);

// vim: set expandtab tabstop=2 shiftwidth=2:
