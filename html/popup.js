"use strict";
/* 
  BEGIN LICENSE BLOCK

    This file is part of FiltaQuilla, Custom Filter Actions
    rereleased by Axel Grude (original project by R Kent James
    under the Mesquilla Project)
  
    /FiltaQuilla is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
  
    You should have received a copy of the GNU General Public License
    along with FiltaQuilla.  If not, see <http://www.gnu.org/licenses/>.
  
    Software distributed under the License is distributed on an "AS IS" basis,
    WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
    for the specific language governing rights and limitations under the
    License.

  END LICENSE BLOCK 
*/

// eslint-disable-next-line no-unused-vars
function hide(id) {
  let el = document.getElementById(id);
  if (!el) {
    return null;
  }
  el.setAttribute("collapsed", true);
  return el;
}

// eslint-disable-next-line no-unused-vars
function hideSelectorItems(cId) {
  let elements = document.querySelectorAll(cId);
  for (let el of elements) {
    el.setAttribute("collapsed", true);
  }
}

// eslint-disable-next-line no-unused-vars
function show(id) {
  let el = document.getElementById(id);
  if (!el) {
    return null;
  }
  el.setAttribute("collapsed", false);
  return el;
}

const formatAll = (txt) => {
  let localizedMsg = txt;
  return localizedMsg
    .replace(/\{boldStart\}/g, "<b>")
    .replace(/\{boldEnd\}/g, "</b>")
    .replace(/\{hr\}/g, "<hr>")
    .replace(/\{italicStart\}/g, "<i>")
    .replace(/\{italicEnd\}/g, "</i>")
    .replace(/\{U1\}/g, "<ul>")
    .replace(/\{U2\}/g, "</ul>")
    .replace(/\{L1\}/g, "<li>")
    .replace(/\{L2\}/g, "</li>")
    .replace(/\{P1(?:\s+([^}]+))?\}/g, (_, attrs) => {
      // attrs will be undefined if no class specified
      return attrs ? `<p ${attrs}>` : "<p>";
    })
    .replace(
      /\{ARelease\}/g,
      "<a href='https://blog.thunderbird.net/2025/03/thunderbird-release-channel-update/'>"
    )
    .replace(
      /\{AcompatCheck\}/g,
      "<a href='https://addons.thunderbird.net/thunderbird/addon/addon-compatibility-check/' class='native'>"
    )
    .replace(
      /\{A-QF\}/g,
      "<a href='https://addons.thunderbird.net/thunderbird/addon/quickfolders-tabbed-folders/' class='native'>"
    )
    .replace(
      /\{A-qI\}/g,
      "<a href='https://addons.thunderbird.net/thunderbird/addon/quickFilters/' class='native'>"
    )
    .replace(
      /\{A-ST\}/g,
      "<a href='https://addons.thunderbird.net/thunderbird/addon/smarttemplate4/' class='native'>"
    )
    .replace(/\{P2\}/g, "</p>")
    .replace(/\{A2\}/g, "</a>")
    .replace(/\{br\}/g, "<br>")
    .replace(/\{A\}/g, "</a>")
    .replace(/\[issue (\d*)\]/g, "<a class=issue no=$1 href='#'>[issue $1]</a>")
    .replace(/\[(.)\]/g, "<code class='keystroke'>$1</code>") // single keys
    .replace(/\[(F\d*)\]/g, "<code class='keystroke'>$1</code>") // F10
    .replace(/\[(CTRL|ALT)\]/g, "<code class='keystroke'>$1</code>"); // single keys
}

// eslint-disable-next-line no-unused-vars
async function insertLocalizedMessage(element, rawMessage) {
  try {
    const html = formatAll(rawMessage); // Expand custom tags into HTML
    const fragment = parseHTMLFragment(html); // Safely parse into a DocumentFragment
    element.textContent = ""; // Clear existing content

    element.appendChild(fragment); // Inject parsed content
  } catch (ex) {
    console.error("Failed to parse localized message:", ex);
    element.textContent = rawMessage; // Fallback: insert raw text only
  }
}

// replace unsafe innerHTML injections
// note: this will add closing tags and other markup ,e.g. <tr> or <table>
function parseHTMLFragment(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");

  // Spread childNodes to an array to avoid live list mutation issues
  const nodes = [...doc.body.childNodes];
  const fragment = document.createDocumentFragment();
  // appendChild moves nodes from doc.body to fragment (not cloned)
  nodes.forEach((node) => fragment.appendChild(node));
  return fragment;
}

// copy a html structure into [multiple] elements
// eslint-disable-next-line no-unused-vars
function updateWithSafeHtml(selector, htmlString) {
  const elements = document.querySelectorAll(selector);
  for (const el of elements) {
    el.textContent = "";
    el.appendChild(parseHTMLFragment(htmlString));
  }
}

// eslint-disable-next-line no-unused-vars
async function resizeWindow()  { // was in updateActions()
  // resize to contents if necessary...
  try {
    const win = await browser.windows.getCurrent();
    let wrapper = document.getElementById("messageCanvas"),
      r = wrapper.getBoundingClientRect(),
      newHeight = Math.round(r.height) + 80,
      maxHeight = window.screen.height;

    let { os } = await messenger.runtime.getPlatformInfo(); // mac / win / linux
    wrapper.setAttribute("os", os);

    if (newHeight > maxHeight) {
      newHeight = maxHeight - 15;
    }
    browser.windows.update(win.id, { height: newHeight });
    } catch(e) {
    console.error("Failed to resize window:", e);
    return;
  }
}