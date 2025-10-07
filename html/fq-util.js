/* 
 globals
  */

// var FiltaQuilla = FiltaQuilla || {};
console.log("Loading fq-util.js");
FiltaQuilla.Util = {
  getBaseURI: function (URL) {
    let hashPos = URL.indexOf("#");
    let queryPos = URL.indexOf("?");
    let baseURL = URL;

    if (hashPos > 0) {
      baseURL = URL.substring(0, hashPos);
    } else if (queryPos > 0) {
      baseURL = URL.substring(0, queryPos);
    }

    if (baseURL.endsWith("/")) {
      baseURL = baseURL.substring(0, baseURL.length - 1);
    }

    return baseURL;
  },

  openHelpTab: async (fragment) => {
    let f = fragment ? `#${fragment}` : "";
    let URL = `https://quickfilters.quickfolders.org/filtaquilla.html${f}`;
    await FiltaQuilla.Util.openLinkInTab(URL);
  },

  openLinkInTab: async (URL) => {
    try {
      let baseURI = FiltaQuilla.Util.getBaseURI(URL);
      let tabs = await messenger.tabs.query({});

      // Check if a FiltaQuilla help tab is already open
      let existingTab = tabs.find((t) => t.url && FiltaQuilla.Util.getBaseURI(t.url) === baseURI);

      if (existingTab) {
        await messenger.tabs.update(existingTab.id, { active: true, url: URL });
      } else {
        await messenger.tabs.create({ url: URL });
      }
    } catch (ex) {
      console.error("FiltaQuilla.Util.openLinkInTab() failed: ", ex);
    }
  },

  getVersionSanitized: (Version) => {
    function strip(version, token) {
      let cutOff = version.indexOf(token);
      if (cutOff > 0) {
        // make sure to strip of any pre release labels
        return version.substring(0, cutOff);
      }
      return version;
    }


    let pureVersion = strip(Version, "pre");
    pureVersion = strip(pureVersion, "beta");
    pureVersion = strip(pureVersion, "alpha");
    return strip(pureVersion, ".hc");    
  },
};
