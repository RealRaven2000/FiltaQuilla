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

/*
 globals
   insertLocalizedMessage,
   formatAll,
   resizeWindow,
   i18n
  */

function showElements(buttonList) {
  const buttons = buttonList.map((s) => s.trim());
  ["ok", "yes", "no", "cancel", "restart", "changeLog"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }
    el.hidden = !buttons.includes(id);
  });
}

// Helper to get query parameters
function getQueryParams() {
  return Object.fromEntries(new URLSearchParams(window.location.search));
}

// helper to marshall a formatted message without using
// queryParameter directly!
async function getStoredMessage(key, hasMessage) {
  if (!hasMessage) {
    return "";
  }
  try {
    const result = await browser.storage.local.get(key);
    await browser.storage.local.remove(key);
    if (result && typeof result === "object" && key in result) {
      return result[key] || "";
    }
    return `We seem to be missing a stored message in ${key}`;
  } catch (e) {
    console.error("Failed to get or remove message from storage", e);
    return "getStoredMessage failed!";
  }
}

window.addEventListener("load", async () => {
  const MESSAGE_STORAGE_KEY = "FiltaQuilla_Message_Key";
  const params = getQueryParams();
  const features = (params.features || "ok").split(","); // fallback to "ok"

  if (features.includes("changeLog")) {
    document.getElementById("titleBox").textContent = messenger.i18n.getMessage("whats-new-head");
  }

  /**** Passed Message or message id(s) to retrieve from l10n ****/
  // retrieve an arbitrary message text from storagem
  // but only if the queryparameter msg_storage was set!
  let message = await getStoredMessage(MESSAGE_STORAGE_KEY, !!params.msg_storage);
  let messageIdList = [];
  if (params.msgId) {
    // allow multiple ids as a comma separated string of localized message ids
    messageIdList =
      typeof params.msgId === "string" && params.msgId.includes(",")
        ? params.msgId.split(",").map((s) => s.trim())
        : [params.msgId];

    for (const id of messageIdList) {
      message += messenger.i18n.getMessage(id); // Each returns HTML with <p> or {P1}{P2} as needed
    }
  }
  // we need to display _something_
  if (!message) {
    message = messenger.i18n.getMessage("message.placeholder");
  }

  // find all features relating to buttons:
  const buttonsList = features.filter((b) =>
    ["ok", "cancel", "yes", "no", "restart", "changeLog"].includes(b)
  );

  // Set message text
  const messageContainer = document.getElementById("innerMessage");
  // generate HTML markup
  await insertLocalizedMessage(messageContainer, message);

  i18n.updateDocument();
  showElements(buttonsList);

  // Show buttons according to features
  const elements = {
    ok: document.getElementById("ok"),
    yes: document.getElementById("yes"),
    no: document.getElementById("no"),
    cancel: document.getElementById("cancel"),
    changeLog: document.getElementById("changeLog"),
    // these are optional sections
    restart: document.getElementById("restart"),
    changeLogIntro: document.getElementById("changeLogIntro"),
  }

  if (messageIdList.includes("whats-new-list")) {
    elements.changeLogIntro?.removeAttribute("hidden");
    const introMsg = formatAll(browser.i18n.getMessage("whats-new-intro"));
    insertLocalizedMessage(elements.changeLogIntro, introMsg);
  }

  // Setup button handlers:
  elements.ok?.addEventListener("click", () => {
    messenger.runtime.sendMessage({ command: "filtaquilla-message", result: "ok" });
  });
  elements.cancel?.addEventListener("click", () => {
    messenger.runtime.sendMessage({ command: "filtaquilla-message", result: "cancel" });
  });
  elements.yes?.addEventListener("click", () => {
    messenger.runtime.sendMessage({ command: "filtaquilla-message", result: "yes" });
  });
  elements.no?.addEventListener("click", () => {
    messenger.runtime.sendMessage({ command: "filtaquilla-message", result: "no" });
  });
  elements.changeLog?.addEventListener("click", () => {
    messenger.runtime.sendMessage({ command: "filtaquilla-message", result: "changeLog" });
  });

  addEventListener("click", async (event) => {
    if (event.target.classList.contains("issue")) {
      let issueId = event.target.getAttribute("no");
      if (issueId) {
        event.preventDefault();
        messenger.windows.openDefaultBrowser(
          `https://github.com/RealRaven2000/FiltaQuilla/issues/${issueId}`
        );
      }
    }
  });

  // always allow hitting ESC to cancel
  window.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      messenger.runtime
        .sendMessage({ command: "filtaquilla-message", result: "cancel" })
        .finally(() => {
          // Delay close slightly to let browser finalize message
          setTimeout(() => window.close(), 150);
        });
    }
  });

  // make sure add-on links stay in Thunderbird!
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a.native");
    if (link) {
      event.preventDefault();
      browser.tabs.create({ url: link.href });
      link.classList.add("link-visited");
      // Find or create the status span next to the link
      let status = link.nextElementSibling;
      if (!status || !status.classList.contains("link-visited")) {
        status = document.createElement("span");
        status.className = "link-visited";
        link.parentNode.insertBefore(status, link.nextSibling);
      }
      status.textContent = " " + messenger.i18n.getMessage("message.linkInTab");
    }
  });
  resizeWindow();
});
