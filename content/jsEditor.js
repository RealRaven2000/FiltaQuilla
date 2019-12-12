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
const LS = '\u2028';

function onLoad() {
  let rootTextbox = window.arguments[0],
      displayValue = "",
      rawString = rootTextbox.value;
      
  for (let i = 0; i < rawString.length; i++)
  {
    let character = rawString.charAt(i);
    // replace new lines with line separators
    if (character == LS)
      character = '\n';
    displayValue += character;
  }
  let textbox = document.getElementById("jscode");
  textbox.value = displayValue;
  sizeToContent();
  window.addEventListener('dialogaccept', 
    function () { 
      onAccept(); 
    }
  );
}

function onAccept() {
  let rootTextbox = window.arguments[0],
      textbox = document.getElementById("jscode"),
      // replace all new lines with line separators
      displayValue = textbox.value,
      rawValue = "";
      
  for (let i = 0; i < displayValue.length; i++)
  {
    let character = displayValue.charAt(i);
    if (character == '\n')
      character = LS;
    rawValue += character;
  }
  rootTextbox.value = rawValue;
  // the textbox forward of value to its parent does not seem to work when
  // I am setting the value from js, so do it manually here.
  rootTextbox.parentNode.setAttribute("value", rawValue);
  rootTextbox.parentNode.value = rawValue;
  return true;
}

// vim: set expandtab tabstop=2 shiftwidth=2:
