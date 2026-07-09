/*
globals
  i18n,
  formatAll,
  formatScrub,
  insertHtmlSafely
  */


/**
 * Updates a tooltip button with a localized message containing formatted HTML.
 * The tooltip content is inserted safely and will only display when triggered.
 *
 * @param {string} buttonId - ID of the tooltip button element.
 * @param {string} bundleKey - i18n key for the tooltip text.
 */
const updateHtmlTooltips = (buttonId, bundleKey) => {
  const btn = document.getElementById(buttonId);
  const bubble = btn?.nextElementSibling; // assuming div.tooltip-bubble follows the button
  if (!btn || !bubble) {
    return;
  }

  const txt = messenger.i18n.getMessage(bundleKey);

  // clickytooltip / aria-label: plain text for accessibility
  btn.setAttribute("clickyTooltip", txt);
  btn.setAttribute("aria-label", formatScrub(txt));

  // div.tooltip-bubble: can contain formatted HTML via pseudo-tags
  const htmlCode = formatAll(txt);
  insertHtmlSafely(bubble, htmlCode);
};

/**
 * Updates the inner HTML of a DOM element with localized and formatted content.
 * Uses formatAll() to process pseudo-tags such as {s}…{/s}.
 * Content is sanitized via insertHtmlSafely().
 *
 * @param {string} selector - CSS selector for the target element.
 * @param {string} bundleKey - i18n key for the localized string to display.
 */
const updateHtmlContents = (selector, bundleKey) => {
  const element = document.querySelector(selector);
  if (!element) {
    return;
  }
  const txt = messenger.i18n.getMessage(bundleKey);
  const htmlCode = formatAll(txt);
  insertHtmlSafely(element, htmlCode);
};  

// add event listeners for tabs
const activateTab = (event) => {
  const tabSheets = document.querySelectorAll(".tabcontent-container section"),
    tabs = document.querySelectorAll("#FiltaQuilla-Options-Tabbox button");
  let btn = event.target;
  Array.from(tabSheets).forEach(tabSheet => {
    tabSheet.classList.remove("active");
  });
  Array.from(tabs).forEach(button => {
    button.classList.remove("active");
    button.parentElement.removeAttribute("aria-selected");
  });
  

  const { target: { value: activeTabSheetId = "" } } = event;
  if (activeTabSheetId) {
    document.getElementById(activeTabSheetId).classList.add("active");
    btn.classList.add("active");
    btn.parentElement.setAttribute("aria-selected", true); // li
    // store last selected tab
    browser.LegacyPrefs.setPref(
      "extensions.filtaquilla.lastSelectedOptionsTab",
      btn.value
    );
  }
}

const initPrefs = async () => {
  // checkboxes
  const checkboxes = document.querySelectorAll("input[type=checkbox][data-pref-name]");
  for (const el of checkboxes) {
    const prefName = el.getAttribute("data-pref-name");
    const value = await messenger.LegacyPrefs.getPref(prefName);
    el.checked = !!value;

    el.addEventListener("change", () => {
      messenger.LegacyPrefs.setPref(prefName, el.checked);
    });
  }

  // text / number inputs
  const inputs = document.querySelectorAll(
    "input[type=text][data-pref-name], input[type=number][data-pref-name]"
  );
  for (const el of inputs) {
    const prefName = el.getAttribute("data-pref-name");
    const value = await messenger.LegacyPrefs.getPref(prefName);
    el.value = value ?? "";

    el.addEventListener("input", () => {
      messenger.LegacyPrefs.setPref(prefName, el.type === "number" ? Number(el.value) : el.value);
    });
  }
  document.getElementById("changeLog").textContent = messenger.i18n.getMessage(
    "message.btn.changeLog", ""
  );

  updateHtmlContents("#multiline_anchors", "fq.regex.multilineanchors");
  updateHtmlTooltips("regex-caseInsensitive", "fq.regex.caseInsensitive.tip");
  

};

/**** FLOATING TOOLTIPS ===> **** */
function toggleTooltip(button) {
  const row = button.closest(".option-horizontal");
  if (!row) {
    return;
  }

  const tooltip = row.querySelector(".tooltip-bubble");
  if (!tooltip) {
    return;
  }

  // Hide all other tooltips first
  document.querySelectorAll(".tooltip-bubble").forEach((t) => {
    if (t !== tooltip) {
      t.hidden = true;
    }
  });
  document.querySelectorAll(".tooltipBtn").forEach((t) => {
    t.removeAttribute("tooltipshown");
  });

  // Toggle this one
  tooltip.hidden = !tooltip.hidden;
  if (tooltip.hidden) {
    button.removeAttribute("tooltipshown");
  } else {
    button.setAttribute("tooltipshown", true);
  }
}


const initEventListeners = async () => {
  for (let button of document.querySelectorAll("#FiltaQuilla-Options-Tabbox button")) {
    button.addEventListener("click", activateTab);
  }

  // Tooltip buttons
  for (let btn of document.querySelectorAll(".tooltipBtn")) {
    btn.addEventListener("click", () => {
      toggleTooltip(btn);
    });
  }

  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".helpLink") || ev.target.closest(".tooltipBtn");
    if (!btn) {
      return;
    }
    if (btn.classList.contains("helpLink")) {
      const topic = btn.getAttribute("helptopic");
      if (!topic) {
        return;
      }
      FiltaQuilla.Util.openHelpTab(topic);
    }
  });

  addConfigEvent(document.getElementById("debug-options"), "extensions.filtaquilla.debug");
  // this will allow reading cusomt headers but force needsBody on all regex Header methods:
  addConfigEvent(
    document.getElementById("hdr-regex-options"),
    "extensions.filtaquilla.regexpHeader.allowRawHeaders"
  );
  // safety: this will toggle needsBody for javascript search term
  addConfigEvent(
    document.getElementById("javascript-search-options"),
    "extensions.filtaquilla.JavascriptEnabled.needsBody"
  );

  document
    .getElementById("fq-options-header-version")
    .addEventListener("click", (event) => onVersionClick(event.target));

  const changeLog = document.getElementById("changeLog");
  changeLog.addEventListener("click", (_event) => {
    messenger.runtime.sendMessage({
      command: "showMessage",
      msgIds: "whats-new-list",
      mode: "standard",
      features: ["ok"],
    });
    window.close();
  });

  const unpackBtn = document.getElementById("unpackSounds");
  if (unpackBtn) {
    unpackBtn.addEventListener("click", async () => {
      const originalTitle = unpackBtn.getAttribute("title") || "";
      unpackBtn.disabled = true;
      try {
        const result = await messenger.runtime.sendMessage({ command: "unpackSounds" });
        if (result && typeof result === "object") {
          unpackBtn.setAttribute(
            "title",
            `${originalTitle}\nCopied: ${result.copied}, Existing: ${result.skipped}, Failed: ${result.failed}`
          );
        }
      } catch (ex) {
        console.error("unpackSounds failed", ex);
      } finally {
        unpackBtn.disabled = false;
      }
    });
  }
}

async function dispatchAboutConfig(filter, readOnly, updateUI = false) {
  // we put the notification listener into quickfolders-tablistener.js - should only happen in ONE main window!
  // el - cannot be cloned! let's throw it away and get target of the event
  messenger.runtime.sendMessage({
    command: "showAboutConfig",
    filter: filter,
    readOnly: readOnly,
    updateUI: updateUI,
  });
}

async function onVersionClick(el) {
  let pureVersion = await FiltaQuilla.Util.getVersionSanitized(el.textContent),
    versionPage = "https://quickfilters.quickfolders.org/fq-versions.html#" + pureVersion;
  FiltaQuilla.Util.openLinkInTab(versionPage);
}

function addConfigEvent(el, filterConfig) {
  // add right-click event to containing label
  if (!el) {
    return;
  }
  // Use closest to find the nearest .configSettings button, or fallback to parent if not found
  let eventNode = el.closest(".hasConfigEvent").querySelector(".configSettings");
  let eventType;
  if (eventNode) {
    eventType = "click";
  } else {
    eventNode = el.parentNode;
    eventType = "contextmenu";
  }
  eventNode.addEventListener(eventType, async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await dispatchAboutConfig(filterConfig, true, true);
    // if (null!=retVal) return retVal;
  });
}


const startup = async () => {
  i18n.updateDocument();
  await initEventListeners();
  await initPrefs();

  const verPanel = document.getElementById("fq-options-header-version");
  const manifest = browser.runtime.getManifest();
  verPanel.textContent = manifest.version;

}
startup();