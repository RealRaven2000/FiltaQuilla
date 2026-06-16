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
    .replace(/\{bold\}/g, "<b>")
    .replace(/\{\/bold\}/g, "</b>")
    .replace(/\{hr\}/g, "<hr>")
    .replace(/\{italic\}/g, "<i>")
    .replace(/\{\/italic\}/g, "</i>")
    .replace(/\{U\}/g, "<ul>")
    .replace(/\{\/U\}/g, "</ul>")
    .replace(/\{L\}/g, "<li>")
    .replace(/\{\/L\}/g, "</li>")
    .replace(/\{s\}/g, "<code class='syntax'>")
    .replace(/\{\/s\}/g, "</code>")
    .replace(/\{P(?:\s+([^}]+))?\}/g, (_, attrs) => {
      return attrs ? `<p ${attrs}>` : "<p>";
    })
    .replace(/\{\/P\}/g, "</p>")
    .replace(
      /\{ARelease\}/g,
      "<a href='https://blog.thunderbird.net/2025/03/thunderbird-release-channel-update/'>",
    )
    .replace(
      /\{AcompatCheck\}/g,
      "<a href='https://addons.thunderbird.net/thunderbird/addon/addon-compatibility-check/' class='native'>",
    )
    .replace(
      /\{A-QF\}/g,
      "<a href='https://addons.thunderbird.net/thunderbird/addon/quickfolders-tabbed-folders/' class='native'>",
    )
    .replace(
      /\{A-qI\}/g,
      "<a href='https://addons.thunderbird.net/thunderbird/addon/quickFilters/' class='native'>",
    )
    .replace(
      /\{A-ST\}/g,
      "<a href='https://addons.thunderbird.net/thunderbird/addon/smarttemplate4/' class='native'>",
    )
    .replace(/\{\/A\}/g, "</a>")
    .replace(/\{A\}/g, "</a>")
    .replace(/\{br\}/g, "<br>")
    .replace(/\[issue (\d+)\]/g, "<a class='issue' no=$1 href='#'>[issue $1]</a>")
    .replace(/\[Bug (\d+)\]/g, "<a class='bug' no=$1 href='#'>[Bug $1]</a>")
    .replace(/\[(.)\]/g, "<code class='keystroke'>$1</code>")
    .replace(/\[(F\d+)\]/g, "<code class='keystroke'>$1</code>")
    .replace(/\[(CTRL|ALT|SHIFT)\]/g, "<code class='keystroke'>$1</code>");
};

/**
 * Strips pseudo-tags / HTML from a formatted string for blind users.
 * Useful for aria-label, clickyTooltip, or screen readers.
 *
 * Keeps meaningful content like keystrokes or issue numbers,
 * removes formatting tags, HTML links, and other decorative pseudo-tags.
 *
 * @param {string} txt - The formatted text from i18n bundle
 * @returns {string} Plain text suitable for accessibility
 */
// eslint-disable-next-line no-unused-vars
const formatScrub = (txt) => {
  if (!txt) {
    return "";
  }

  let clean = txt
    // Remove formatting tags
    .replace(/\{\/?bold\}/g, "")
    .replace(/\{\/?italic\}/g, "")
    .replace(/\{U\}/g, "")
    .replace(/\{\/U\}/g, "")
    .replace(/\{L\}/g, "")
    .replace(/\{\/L\}/g, "")
    .replace(/\{s\}/g, "")
    .replace(/\{\/s\}/g, "")
    .replace(/\{P(?:\s+[^}]+)?\}/g, "")
    .replace(/\{\/P\}/g, "")
    .replace(/\{hr\}/g, "")
    .replace(/\{br\}/g, "\n") // line breaks ok

    // Keep link text but remove the tag
    .replace(/\{A(?:Release|compatCheck|-QF|qI|ST)?\}/g, "")
    .replace(/\{\/A\}/g, "")

    // Keep issue/Bug brackets
    .replace(/\[issue (\d+)\]/gi, "[issue $1]")
    .replace(/\[Bug (\d+)\]/gi, "[Bug $1]")

    // Keep keystrokes as simple bracketed text
    .replace(/\[(F\d+|CTRL|ALT|SHIFT|.)\]/g, "[$1]")

    // Collapse any leftover curly-brace placeholders
    .replace(/\{[^}]+\}/g, "")

    .trim();

  return clean;
};


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

/**
 * Safely inserts formatted HTML into a container element.
 * The content can contain pseudo-tags like {s}…{/s} that are converted by formatAll().
 * Existing content is replaced only if the new HTML contains nodes.
 *
 * @param {Element} container - The DOM element to receive the HTML content.
 * @param {string|Node} html - HTML string or Node to be inserted safely.
 * @returns {boolean} True if content was inserted, false otherwise.
 */
// eslint-disable-next-line no-unused-vars
var insertHtmlSafely = (container, html) => {
  if (!container || !html) {
    return;
  }

  // Create a document fragment from the HTML string or Node
  let frag;
  if (typeof html === "string") {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    frag = document.createDocumentFragment();

    const sanitizeNode = (node) => {
      if (node.nodeType !== 1) {
        return node; // ELEMENT_NODE only
      }

      if (node.tagName.toLowerCase() === "script") {
        return null;
      }

      const dangerousAttrs = [
        "onclick",
        "onchange",
        "oninput",
        "onmouseover",
        "onload",
        "onerror",
        "onfocus",
        "onblur",
        "onmousedown",
        "onmouseup",
        "onmouseenter",
        "onmouseleave",
      ];

      [...node.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim().toLowerCase();
        if (dangerousAttrs.includes(name) || value.startsWith("javascript:")) {
          node.removeAttribute(attr.name);
        }
      });

      Array.from(node.childNodes).forEach((child) => {
        const sanitized = sanitizeNode(child);
        if (!sanitized) {
          child.remove();
        }
      });

      return node;
    };

    for (const node of Array.from(doc.body.childNodes)) {
      const sanitized = sanitizeNode(node);
      if (sanitized) {
        frag.appendChild(sanitized);
      }
    }
  } else if (html.nodeType) {
    frag = document.createDocumentFragment();
    while (html.firstChild) {
      frag.appendChild(html.firstChild);
    }
  } else {
    return false;
  }

  // Only replace existing content if we have something to insert
  if (frag && frag.childNodes.length > 0) {
    container.replaceChildren(frag);
  }

  return true;
};

