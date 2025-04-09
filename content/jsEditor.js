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
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK *****
 */


// The unicode line separator \u2028 is recognized by js as a line terminator,
//  but survives the storage in a filter editor file without getting
//  truncated. So we use it to store the newlines.
const LS = "\u2028"; // this is used to encode linebreaks.

function encodeScript(script) {
  // Re-encode (newlines to LS) before returning
  return script.replace(/\n/g, LS);
}

function decodeScript(script) {
  // Replace the line separator (LS) with actual newlines
  return script.replace(new RegExp(LS, "g"), "\n");
}

// Function to send the updated script to the background page
function sendUpdatedScript(textarea) {
  const rawScript = textarea.value;
  const encodedScript = encodeScript(rawScript); // Encode if needed: replace line breaks!

  // Send the updated script back to the background page
  messenger.runtime.sendMessage({
    command: "updateActionScript",
    script: encodedScript,
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const textarea = document.getElementById("jscode");
  const accept = document.getElementById("accept");
  const cancel = document.getElementById("cancel");

  accept.addEventListener("click", () => {
    sendUpdatedScript(textarea);
    window.close();
  });

  document.getElementById("cancel").addEventListener("click", () => {
    window.close();
  });

  const manifest = await messenger.runtime.getManifest(),
    addonName = manifest.name;    
  document.getElementById("pageHead").textContent = messenger.i18n.getMessage(
    "filtaquilla.editJavascript",
    addonName
  );
  cancel.textContent = messenger.i18n.getMessage("regex.cancel", addonName);
});

browser.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "initActionScript") {
    // Decode stored string (replace LS with real newlines)
    // textarea.value = rawString.replace(new RegExp(LS, "g"), "\n");

    const script = decodeScript(request.script);
    document.getElementById("jscode").value = script || ""; // Set the initial script value
  }
});


