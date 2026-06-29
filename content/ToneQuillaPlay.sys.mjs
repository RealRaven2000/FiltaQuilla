/*
 ***** BEGIN LICENSE BLOCK *****
 * This file is part of the application ToneQuilla by Mesquilla.
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

 /*
   globals
     dump
  */

 // for the next ESR (140) we need to convert this to a .sys.msj file because we need to 
 // use Cu.importESModule(...)
 // To Do: create an issue for this [ESMification]

const Cc = Components.classes,
      Ci = Components.interfaces,
      Cu = Components.utils;

// support variables for playing sound
var kDelayToNext = 1200, // was 5000
    kFadeOut = 25;
const kDelayToClear = 3000,  // was 15000
      kStatusIdle = 0,       // not playing anything
      kStatusStart = 1;
      
/* GLOBALS */
let _window = null;
// timer to control delay between play requests
let _playTimer = null;
// nsISound instance to play .wav files
// let _nsISound = Cc["@mozilla.org/sound;1"].createInstance(Ci.nsISound);

// queue of file references for sounds to play
let _playQueue = [];
// queue of already queued file references to ignore
let _ignoreQueue = [];
// status of player
let _status = kStatusIdle;
// timer to control delay to clear ignore queue
let _ignoreTimer = null;
// nsIMIMEService
let _nsIMIMEService = null;

function re(e) {
  dump(e + '\n');
  Cu.reportError(e);
  throw e;
}

function logHighlightDebugOptional(debugOption, txt, format = {}, ...args) {
  const options = String(debugOption)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  format.color = format.color || "white";
  format.background = format.background || "rgb(15, 96, 6)";
  for (let i = 0; i < options.length; i++) {
    let option = options[i];
    const Prefix = "extensions.filtaquilla";
    let isDebug = false;
    try {
      const exactPref = `${Prefix}.debug.${option}`;
      const exactType = Services.prefs.getPrefType(exactPref);
      if (exactType === Ci.nsIPrefBranch.PREF_BOOL) {
        isDebug = Services.prefs.getBoolPref(exactPref, false);
      } else {
        const lowerOption = option.toLowerCase();
        const lowerPref = `${Prefix}.debug.${lowerOption}`;
        const lowerType = Services.prefs.getPrefType(lowerPref);
        if (lowerType === Ci.nsIPrefBranch.PREF_BOOL) {
          isDebug = Services.prefs.getBoolPref(lowerPref, false);
          option = lowerOption;
        }
      }
    } catch {
      isDebug = false;
    }
    if (!isDebug) {
      continue;
    }
    let time = new Date();
    let timeStamp = `${time.getHours()}:${time.getMinutes()}:${time.getSeconds()} - ${time.getMilliseconds()}`;
    console.log(
      `ToneQuilla [${option.toUpperCase()}] ${timeStamp}\n%c${txt}`,
      `color:${format.color};background:${format.background}`,
      ...args
    );
    break;
  }
}



export const ToneQuillaPlay = {
  logDebug: function (txt) {
    const Prefix = "extensions.filtaquilla.";
    let isDebug = Services.prefs.getBoolPref(Prefix + "debug");
    if (isDebug) {
      Services.console.logStringMessage("FiltaQuilla (toneQuillaPlay module)\n" + txt);
    }
  },


  // the window used to construct the Audio object
  window: null,

  // path string for the sounds directory
  soundsDirectory: null,

  MY_ID: "tonequilla@mesquilla.com",

  //function to initialize variables
  init: async function (win = null) {
    async function getAddonVersionForDebug() {
      try {
        const { AddonManager } = ChromeUtils.importESModule(
          "resource://gre/modules/AddonManager.sys.mjs"
        );
        const addon = await AddonManager.getAddonByID(that.MY_ID);
        return addon?.version || "<unknown>";
      } catch (ex) {
        logHighlightDebugOptional(
          "sounds",
          "init() could not resolve add-on version from AddonManager",
          { background: "rgb(95, 48, 0)", color: "yellow" },
          { name: ex?.name, message: ex?.message, result: ex?.result }
        );
        return "<unavailable>";
      }
    }

    const initMarker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const addonVersion = await getAddonVersionForDebug();
    logHighlightDebugOptional(
      "sounds",
      "INIT ENTRY: ToneQuillaPlay.init() invoked",
      { background: "rgb(0, 74, 94)", color: "white" },
      {
        initMarker,
        addonId: that.MY_ID,
        addonVersion,
      }
    );

    // new utility function to unpack a file from the xpi
    async function copyDataURLToFile(aURL, file) {
      let step = 0;
      try {
        let uri = Services.io.newURI(aURL),
          newChannelFun = Services.io.newChannelFromURI.bind(Services.io);
        let securityFlags =
          Ci.nsILoadInfo.SEC_REQUIRE_SAME_ORIGIN_DATA_INHERITS ||
          Ci.nsILoadInfo.SEC_REQUIRE_SAME_ORIGIN_INHERITS_SEC_CONTEXT;

        step = 1;
        let channel = newChannelFun(
          uri,
          null,
          Services.scriptSecurityManager.getSystemPrincipal(),
          null,
          securityFlags,
          Ci.nsIContentPolicy.TYPE_OTHER
        );

        step = 2;
        const istream = await new Promise((resolve, reject) => {
          NetUtil.asyncFetch(channel, (inputStream, status) => {
            if (Components.isSuccessCode(status)) {
              resolve(inputStream);
            } else {
              reject(Components.Exception("Failed to fetch channel", status));
            }
          });
        });

        let ostream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(
          Ci.nsIFileOutputStream
        );
        ostream.init(file, -1, -1, Ci.nsIFileOutputStream.DEFER_OPEN);

        await new Promise((resolve, reject) => {
          NetUtil.asyncCopy(istream, ostream, (result) => {
            if (Components.isSuccessCode(result)) {
              resolve();
            } else {
              reject(Components.Exception("Failed to copy stream", result));
            }
          });
        });
      } catch (ex) {
        let msg = "ToneQuillaPlay copyDataURLToFile() failed at step " + step + ": " + ex.message;
        ToneQuillaPlay.logDebug(msg);
        logHighlightDebugOptional(
          "sounds",
          "copyDataURLToFile() failed",
          { background: "rgb(130, 0, 0)", color: "white" },
          {
            step,
            sourceURL: aURL,
            targetPath: file?.path,
            name: ex?.name,
            message: ex?.message,
            result: ex?.result,
            stack: ex?.stack,
          }
        );
        throw ex; // or return false if you prefer to handle error silently
      }
    }

    if (win && win.document && win.document.createElement) {
      // Use the passed window if valid
      _window = win;
    } else {
      // Fallback to main 3-pane window
      _window = Services.wm.getMostRecentWindow("mail:3pane");
      if (!_window) {
        throw new Error("Unable to find main mail window for audio playback");
      }
    }

    function makePath() {
      // let path = new Array("extensions", "filtaquilla"); // was: tonequilla
      // return FileUtils.getDir("ProfD", path, true);
      let profileDir = PathUtils.profileDir;
      if (!profileDir) {
        console.warn("PathUtils.profileDir empty → fallback to dirsvc ProfD");
        profileDir = Services.dirsvc.get("ProfD", Ci.nsIFile).path;
      }      
      if (!profileDir) {
        console.error("ToneQuillaPlay - empty profile Directory!", {
          profileDir: PathUtils.profileDir,
          type: typeof profileDir
        });
        return null;
      }
      let path = PathUtils.join(profileDir, "extensions", "filtaquilla");
      logHighlightDebugOptional(
        "sounds",
        "init.makePath()",
        {},
        { profileDir, path }
      );
      return path;
    }

    const profileDirForDebug = PathUtils.profileDir || Services.dirsvc.get("ProfD", Ci.nsIFile).path;
    logHighlightDebugOptional(
      "sounds",
      "INIT CONTEXT: startup paths",
      { background: "rgb(0, 74, 94)", color: "white" },
      {
        profileDir: profileDirForDebug,
        stopAtDir: profileDirForDebug,
      }
    );

    async function ensureDirectoryExists(dir, stopAtDir) {
      if (!dir) {
        logHighlightDebugOptional("sounds", "ensureDirectoryExists(): empty dir argument");
        return false;
      }

      const stopAtNormalized = stopAtDir.replace(/[\\/]+$/, "").toLowerCase();
      logHighlightDebugOptional(
        "sounds",
        "ensureDirectoryExists() start",
        {},
        { dir, stopAtDir, stopAtNormalized }
      );

      // FIX: no split(), no reconstruction
      const fullPaths = [];
      let current = dir.replace(/[\\/]+$/, "");

      while (true) {
        fullPaths.unshift(current);

        const parent = PathUtils.parent(current);
        if (!parent || parent === current) {
          break;
        }
        current = parent;
      }

      logHighlightDebugOptional(
        "sounds",
        "ensureDirectoryExists() candidate path chain",
        {},
        fullPaths
      );

      // Work backwards to find the first existing parent
      let startIndex = fullPaths.length - 1;
      let notFoundCount = 0;
      let lastNotFound = null;
      for (; startIndex >= 0; startIndex--) {
        try {
          const stat = await IOUtils.stat(fullPaths[startIndex]);
          if (stat.type === "directory") {
            logHighlightDebugOptional(
              "sounds",
              "ensureDirectoryExists() found existing parent",
              {},
              { existingPath: fullPaths[startIndex], statType: stat.type }
            );
            break;
          }
        } catch (ex) {
          if (ex.name === "NotFoundError") {
            notFoundCount++;
            lastNotFound = {
              path: fullPaths[startIndex],
              name: ex.name,
              message: ex.message,
              result: ex.result,
            };
            continue;
          }
          logHighlightDebugOptional(
            "sounds",
            "ensureDirectoryExists() unexpected IOUtils.stat failure",
            { background: "rgb(130, 0, 0)", color: "white" },
            { path: fullPaths[startIndex], name: ex.name, message: ex.message, result: ex.result }
          );
          if (ex.name !== "NotFoundError") {
            throw ex;
          }
        }
      }

      if (notFoundCount > 0) {
        logHighlightDebugOptional(
          "sounds",
          "ensureDirectoryExists() NotFoundError summary while walking parents",
          {},
          { notFoundCount, lastNotFound, startIndex }
        );
      }

      // Create missing folders
      for (let i = startIndex + 1; i < fullPaths.length; i++) {
        const thisDir = fullPaths[i];

        if (thisDir.toLowerCase().startsWith(stopAtNormalized)) {
          logHighlightDebugOptional(
            "sounds",
            "ensureDirectoryExists() creating directory",
            {},
            { thisDir, stopAtNormalized }
          );
          try {
            await IOUtils.makeDirectory(thisDir);
            logHighlightDebugOptional(
              "sounds",
              "ensureDirectoryExists() created directory",
              {},
              { thisDir }
            );
          } catch (ex) {
            logHighlightDebugOptional(
              "sounds",
              "ensureDirectoryExists() makeDirectory failed",
              { background: "rgb(130, 0, 0)", color: "white" },
              { thisDir, name: ex.name, message: ex.message, result: ex.result }
            );
            throw ex;
          }
        } else {
          console.warn(`Stopped creating at ${thisDir}, beyond allowed root.`);
          logHighlightDebugOptional(
            "sounds",
            "ensureDirectoryExists() stopped by root guard",
            { background: "rgb(95, 48, 0)", color: "yellow" },
            { thisDir, stopAtNormalized, dir }
          );
          break;
        }
      }

      logHighlightDebugOptional("sounds", "ensureDirectoryExists() complete", {}, { dir });

      return true;
    }

    const findFirstExistingParent = async (path) => {
      logHighlightDebugOptional("sounds", "findFirstExistingParent() start", {}, { path });
      while (true) {
        try {
          const stat = await IOUtils.stat(path);
          if (stat.isDir) {
            logHighlightDebugOptional(
              "sounds",
              "findFirstExistingParent() found directory",
              {},
              { path }
            );
            return path; // Found the first existing parent directory
          } else {
            // It's a file, not a directory — go up one level
            logHighlightDebugOptional(
              "sounds",
              "findFirstExistingParent() encountered file, moving up",
              {},
              { path }
            );
            path = path.replace(/[/\\][^/\\]+$/, "");
          }
        } catch (ex) {
          if (ex.name === "NotFoundError") {
            // Remove the last segment of the path and try again
            logHighlightDebugOptional(
              "sounds",
              "findFirstExistingParent() NotFoundError, moving up",
              {},
              { path, message: ex.message, result: ex.result }
            );
            path = path.replace(/[/\\][^/\\]+$/, "");
            if (!path || /^[a-zA-Z]:\\?$/.test(path)) {
              // Reached root (e.g., C:\)
              logHighlightDebugOptional(
                "sounds",
                "findFirstExistingParent() reached root, returning null",
                { background: "rgb(95, 48, 0)", color: "yellow" }
              );
              return null;
            }
          } else {
            throw ex;
          }
        }
      }
    };

    async function getLocalFile(fileName) {
      // get the "menuOnTop.json" file in the profile/extensions directory
      const profileDir = PathUtils.profileDir || profileDirForDebug;
      // let path = new Array("extensions", "filtaquilla", fileName);  // was: tonequilla
      // http://dxr.mozilla.org/comm-central/source/mozilla/toolkit/modules/FileUtils.jsm?from=FileUtils.jsm&case=true#41
      // return FileUtils.getFile("ProfD", path); // implements nsIFile
      // [bug 920187] = getFile was deprecated. Use IOUtils / PathUtils
      if (!profileDir) {
        logHighlightDebugOptional(
          "sounds",
          "getLocalFile() could not resolve profile directory",
          { background: "rgb(130, 0, 0)", color: "white" },
          { fileName }
        );
        return null;
      }

      let path = PathUtils.join(profileDir, "extensions", "filtaquilla", fileName);
      logHighlightDebugOptional("sounds.files", "getLocalFile() checking", {}, { fileName, path });
      try {
        const stat = await IOUtils.stat(path); // returns FileInfo
        logHighlightDebugOptional("sounds", "getLocalFile() exists", {}, { path, stat });
        return {
          path,
          fileInfo: stat,
        };
      } catch (ex) {
        if (ex.name === "NotFoundError") {
          // File doesn't exist, but return the path anyway
          logHighlightDebugOptional(
            "sounds.files",
            "getLocalFile() file missing",
            {},
            { fileName, path, message: ex.message, result: ex.result }
          );
          return {
            path,
            fileInfo: null, // or undefined, depending on your logic
          };
        }
        logHighlightDebugOptional(
          "sounds",
          "getLocalFile() unexpected failure",
          { background: "rgb(130, 0, 0)", color: "white" },
          { fileName, path, name: ex.name, message: ex.message, result: ex.result }
        );
        return null;
      }
    }

    const { NetUtil } = ChromeUtils.importESModule("resource://gre/modules/NetUtil.sys.mjs");

    try {
      _playTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      _ignoreTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      // that._nsIIOService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
      // _nsISound = Cc["@mozilla.org/sound;1"].createInstance(Ci.nsISound);
      _nsIMIMEService = Cc["@mozilla.org/mime;1"].getService(Ci.nsIMIMEService);
      // new code to unpack sounds...

      let dir = makePath();
      logHighlightDebugOptional("sounds", "init() target sound directory", {}, { dir });
      if (dir) {
        let isDirectory = await ensureDirectoryExists(dir, profileDirForDebug);
        logHighlightDebugOptional(
          "sounds",
          "init() ensureDirectoryExists result",
          {},
          { dir, isDirectory }
        );
        if (!isDirectory) {
          that.soundsDirectory = await findFirstExistingParent(dir);
        } else {
          that.soundsDirectory = dir;
        }
        logHighlightDebugOptional(
          "sounds",
          "init() soundsDirectory resolved",
          {},
          { soundsDirectory: that.soundsDirectory }
        );
        logHighlightDebugOptional(
          "sounds",
          "INIT CONTEXT: resolved output directory",
          { background: "rgb(0, 74, 94)", color: "white" },
          {
            profileDir: profileDirForDebug,
            targetDir: dir,
            soundsDirectory: that.soundsDirectory,
            ensuredDirectory: isDirectory,
          }
        );
        let fileList = [
          "applause.ogg",
          "duogourd.ogg",
          "Freedom.ogg",
          "nightingale.ogg",
          "squishbeat.ogg",
          "TheBrightestStar.ogg",
          "squeak.wav",
          "notify-1.wav",
          "pour-1.wav",
          "maybe-one-day-584.ogg",
          "hold-your-horses-468.ogg",
          "scratch-389.ogg",
          "your-turn-491.ogg",
          "knob-458.ogg",
          "worthwhile-438.ogg",
          "scissors-423.ogg",
        ];
        let unpackedCount = 0;
        let failedCount = 0;

        for (const name of fileList) {
          try {
            logHighlightDebugOptional("sounds.files", "init() checking sound asset", {}, { name });
            const file = await getLocalFile(name);
            if (!file) {
              throw new Error(`Couldn't resolve local file path for: ${name}`);
            }

            if (!file.fileInfo) {
              ToneQuillaPlay.logDebug(`Copying ${name} to ${file.path}...`);
              logHighlightDebugOptional("sounds.files", "init() copying missing sound file", {}, { name, path: file.path });

              let localFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
              localFile.initWithPath(file.path);
              await copyDataURLToFile("chrome://filtaquilla/content/sounds/" + name, localFile);
              unpackedCount++;
              logHighlightDebugOptional("sounds", "init() copy completed", {}, { name, path: file.path });
            } else {
              ToneQuillaPlay.logDebug(`File already exists: ${file.path}`);
              logHighlightDebugOptional("sounds", "init() sound already present", {}, { name, path: file.path });
            }
          } catch (ex) {
            failedCount++;
            logHighlightDebugOptional(
              "sounds",
              "init() failed while processing sound asset",
              { background: "rgb(130, 0, 0)", color: "white" },
              { name, message: ex.message, result: ex.result, stack: ex.stack }
            );
            // Non-fatal: user can still supply their own sounds.
            continue;
          }
        }

        logHighlightDebugOptional(
          "sounds",
          "init() installed sound files",
          { background: "rgb(0, 74, 94)", color: "white" },
          {
            unpackedCount,
            failedCount,
            totalFiles: fileList.length,
            targetFolder: that.soundsDirectory,
          }
        );
      }
    } catch (e) {
      logHighlightDebugOptional(
        "sounds",
        "init() fatal failure",
        { background: "rgb(130, 0, 0)", color: "white" },
        { name: e?.name, message: e?.message, result: e?.result, stack: e?.stack }
      );
      re(e);
    }
  },

  // function to play the next queued sound
  nextSound: async function () {
    let soundSpec = _playQueue.shift();
    if (!soundSpec) {
      logHighlightDebugOptional("sounds", "ToneQuillaPlay: queue empty, nothing to play.");
      // only clear _ignoreQueue once the queue is fully empty
      _ignoreTimer.initWithCallback(
        that._clearIgnore,
        kDelayToClear,
        Ci.nsITimer.TYPE_ONE_SHOT
      );
      _status = kStatusIdle;
      return;
    }

    logHighlightDebugOptional("sounds", `nextSound - Playing: ${soundSpec}`);
    if (soundSpec) {
      _status = kStatusStart;
      await that.play(soundSpec);
      // tiny delay, but avoid recursion
      Promise.resolve().then(() => that.nextSound());
      // that._playTimer.initWithCallback(that.nextSound, kDelayToNext, Ci.nsITimer.TYPE_ONE_SHOT);
    }
  },

  play: async function (aSpec) {
    if (!_window) {
      // [issue 258]
      console.log("ToneQuillaPlay.play() - window instance not initialized!;");
      _window = Services.wm.getMostRecentWindow("mail:3pane");
      console.log("initialized '_window' with Servies", { window: _window, that: that });
    }
    logHighlightDebugOptional("sounds", `play(${aSpec}) ...`);
    // initialize module if needed
    if (!_playTimer) {
      await that.init();
    }

    let dotIndex = aSpec.lastIndexOf("."),
      extension = "";
    if (dotIndex >= 0) {
      extension = aSpec.substr(dotIndex + 1).toLowerCase();
    }
    let mimeType = "";
    if (extension == "wav") {
      mimeType = "audio/wav";
    } else {
      try {
        mimeType = _nsIMIMEService.getTypeFromExtension(extension);
      } catch { ; } // ignore errors, since that probably means not defined
    }
    let uriSpec = aSpec.startsWith("file:")
      ? aSpec
      : (() => {
          let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
          file.initWithPath(aSpec);
          return Services.io.newFileURI(file).spec;
        })();

    const nsIFileURL = Services.io.newURI(uriSpec).QueryInterface(Ci.nsIFileURL);
    // that._nsIIOService.newURI(uriSpec, null, null);
    //nsIFileURL = nsIFileURL.QueryInterface(Ci.nsIFileURL);

    if (!nsIFileURL.file.exists()) {
      Cu.reportError("FiltaQuilla cannot play sound file  " + aSpec + " - it does not exist");
      return;
    }

    // Macs can use nsISound to play aiff files
    if (_window.navigator.platform.indexOf("Mac") >= 0 && mimeType == "audio/aiff") {
      mimeType = "audio/wav";
    }

    const startTime = new Date();
    that.logDebug("determined mimeType = " + mimeType);
    const audio = _window.document.createElement("audio");
    const source = _window.document.createElement("source");

    switch (mimeType) {
      case "video/ogg":
      case "audio/ogg":
      case "application/ogg":
      case "application/mpeg":
      case "audio/mpeg":
      case "audio/wav":
      case "audio/x-wav":
        source.setAttribute("type", mimeType);
        source.setAttribute("src", uriSpec);
        audio.appendChild(source);
        try {
          await new Promise((resolve) => {
            audio.addEventListener("loadedmetadata", resolve, { once: true });
          });
          const duration = isNaN(audio.duration) ? 0 : audio.duration * 1000; // ms
          await audio.play();
          logHighlightDebugOptional(
            "sounds",
            `Audio playback started: ${uriSpec} - should take ${duration}ms`
          );
          // Wait until the audio ends before proceeding
          if (!duration) {
            await new Promise((resolve) => {
              audio.addEventListener("ended", resolve, { once: true });
            });
          }
          const remainingDuration = duration - (new Date() - startTime);
          if (remainingDuration > 0) {
            logHighlightDebugOptional(
              "sounds",
              `After sound ended we still have ${remainingDuration} to wait!`
            );
            const r = duration - (new Date() - startTime) + kDelayToNext;
            // even with "latency compensation" - (negative kDelayToNext) enforce a min time of 20ms
            await new Promise((resolve) => _window.setTimeout(resolve, Math.max(20, r)));
          }
        } catch (err) {
          logHighlightDebugOptional("sounds", `Error playing ${uriSpec}:`, {}, err);
        }
        break;
      default:
        // We're going to blindly let the OS handle this?
        nsIFileURL.file.QueryInterface(Ci.nsIFile).launch();
    }
  },

  fadeOut: function (audio, duration = 150) {
    if (!audio) {
      return;
    }

    if (duration <= 0) {
      // No fade, stop immediately
      audio.volume = 0;
      return;
    }

    // fade out the clip, then stop it
    const steps = 35;
    const stepTime = duration / steps;
    let volumeStep = audio.volume / steps;

    const fade = setInterval(() => {
      if (audio.volume > volumeStep) {
        audio.volume -= volumeStep;
      } else {
        clearInterval(fade);
        audio.volume = 1; // reset volume
        audio.pause();
        audio.currentTime = 0;
      }
    }, stepTime);
  },

  stop: function (audio) {
    if (!audio) {
      return;
    }

    if (kFadeOut > 0) {
      this.fadeOut(audio, kFadeOut);
    } else {
      audio.pause();
    }
    audio.currentTime = 0;
  },

  // clear all file references from the ignore queue
  _clearIgnore: function () {
    that.logDebug("_clearIgnore()");
    while (_ignoreQueue.pop()) { ; }
  },

  // add a file URL spec to the play queue, unless already queued or ignored
  queueToPlay: function (aSpec) {
    logHighlightDebugOptional("sounds", `Queueing: ${aSpec}`, {
      background: "rgb(146, 88, 0)",
      color: "yellow",
    });
    // This function is designed to allow multiple emails to request playing
    // a sound, without getting the same sound multiple times, nor overlapping.
    // Multiple sounds are delayed to allow each to be heard. Any sounds
    // that recur during an ignore period are ignored.
    // refresh delay (global):
    kDelayToNext = Services.prefs.getIntPref("extensions.filtaquilla.tonequilla.soundDelay");
    kFadeOut = Services.prefs.getIntPref("extensions.filtaquilla.tonequilla.fadeOut");

    // initialize module if needed
    if (!_playTimer) {
      that.init();
    }

    // ignore recently queued sounds
    if (_ignoreQueue.indexOf(aSpec) >= 0) {
      that.logDebug("ignoring this sound, it was already played recently.");
      return;
    }

    let urlIndex = _playQueue.indexOf(aSpec);
    if (urlIndex < 0) {
      _playQueue.push(aSpec);
      _ignoreQueue.push(aSpec);
    }
    if (_status == kStatusIdle) {
      _status = kStatusStart;
      that.nextSound(); // starts a new play queue
    } // if !idle,  then playback is already running & the queue will take care of it
  },
};

// shorthand notation for the current module
var that = ToneQuillaPlay;
that.name = "ToneQuillaPlay";
