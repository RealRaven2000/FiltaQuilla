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
var kDelayToNext = 1200;   // was 5000
const kDelayToClear = 3000,  // was 15000
      kStatusIdle = 0,       // not playing anything
      kStatusStart = 1;

function re(e) {
  dump(e + '\n');
  Cu.reportError(e);
  throw e;
}


export const ToneQuillaPlay = {
  logDebug: function (txt) {
    const Prefix = "extensions.filtaquilla.";
    let isDebug = Services.prefs.getBoolPref(Prefix + "debug");
    if (isDebug) {
      Services.console.logStringMessage("FiltaQuilla (toneQuillaPlay module)\n" + txt);
    }
  },

  logHighlightDebugOptional: function (debugOption, txt, format={}, ...args) {
    const options = debugOption.split(",");
    format.color = format.color ||  "white";
    format.background = format.background || "rgb(15, 96, 6)";
    for (let i = 0; i < options.length; i++) {
      let option = options[i];
      const Prefix = "extensions.filtaquilla";
      let isDebug = Services.prefs.getBoolPref(`${Prefix}.debug.${option}`);
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
  },

  // nsISound instance to play .wav files
  _nsISound: null,

  // queue of file references for sounds to play
  _playQueue: [],

  // queue of already queued file references to ignore
  _ignoreQueue: [],

  // status of player
  _status: kStatusIdle,

  // timer to control delay between play requests
  _playTimer: null,

  // timer to control delay to clear ignore queue
  _ignoreTimer: null,

  // nsIMIMEService
  _nsIMIMEService: null,

  // active audio element
  _audioElement: null,

  // the window used to construct the Audio object
  window: null,

  // nsIFile for the sounds directory
  soundsDirectory: null,

  MY_ID: "tonequilla@mesquilla.com",

  //function to initialize variables
  init: async function () {
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
        throw ex; // or return false if you prefer to handle error silently
      }
    }

    function makePath() {
      // let path = new Array("extensions", "filtaquilla"); // was: tonequilla
      // return FileUtils.getDir("ProfD", path, true);
      const profileDir = PathUtils.profileDir;
      let path = PathUtils.join(profileDir, "extensions", "filtaquilla");
      return path;
    }

    async function ensureDirectoryExists(dir, stopAtDir) {
      const parts = dir.split(/[\\/]/);
      const stopAtNormalized = stopAtDir.replace(/[\\/]+$/, "").toLowerCase();

      // Build the list of directories from root to target
      let buildPath = parts[0];
      const fullPaths = [];

      for (let i = 1; i < parts.length; i++) {
        buildPath = PathUtils.join(buildPath, parts[i]);
        fullPaths.push(buildPath);
      }

      // Work backwards to find the first existing parent
      let startIndex = fullPaths.length - 1;
      for (; startIndex >= 0; startIndex--) {
        try {
          const stat = await IOUtils.stat(fullPaths[startIndex]);
          if (stat.type === "directory") {
            break;
          } // found the first existing parent
        } catch (ex) {
          console.error("Error in IOUtils.stat - throwing again:", ex);
          if (ex.name !== "NotFoundError") {
            throw ex;
          }
        }
      }

      // Now create missing folders from the first non-existing after stopAtDir
      for (let i = startIndex + 1; i < fullPaths.length; i++) {
        const thisDir = fullPaths[i];
        if (thisDir.toLowerCase().startsWith(stopAtNormalized)) {
          await IOUtils.makeDirectory(thisDir);
        } else {
          // Prevent going outside profileDir
          console.warn(`Stopped creating at ${thisDir}, beyond allowed root.`);
          break;
        }
      }

      return true;
    }

    const findFirstExistingParent = async (path) => {
      while (true) {
        try {
          const stat = await IOUtils.stat(path);
          if (stat.isDir) {
            return path; // Found the first existing parent directory
          } else {
            // It's a file, not a directory — go up one level
            path = path.replace(/[/\\][^/\\]+$/, "");
          }
        } catch (ex) {
          if (ex.name === "NotFoundError") {
            // Remove the last segment of the path and try again
            path = path.replace(/[/\\][^/\\]+$/, "");
            if (!path || /^[a-zA-Z]:\\?$/.test(path)) {
              // Reached root (e.g., C:\)
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
      const profileDir = PathUtils.profileDir;
      // let path = new Array("extensions", "filtaquilla", fileName);  // was: tonequilla
      // http://dxr.mozilla.org/comm-central/source/mozilla/toolkit/modules/FileUtils.jsm?from=FileUtils.jsm&case=true#41
      // return FileUtils.getFile("ProfD", path); // implements nsIFile
      // [bug 920187] = getFile was deprecated. Use IOUtils / PathUtils
      let path = PathUtils.join(profileDir, "extensions", "filtaquilla", fileName);
      try {
        const stat = await IOUtils.stat(path); // returns FileInfo
        return {
          path,
          fileInfo: stat,
        };
      } catch (ex) {
        if (ex.name === "NotFoundError") {
          // File doesn't exist, but return the path anyway
          return {
            path,
            fileInfo: null, // or undefined, depending on your logic
          };
        }
        console.warn(`ToneQuillaPlay file not found: ${path}`, ex);
        return null;
      }
    }

    const { NetUtil } = ChromeUtils.importESModule("resource://gre/modules/NetUtil.sys.mjs");

    // Services is already global
    // const { Services } =
    //   globalThis.Services || ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

    try {
      that._playTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      that._ignoreTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      // that._nsIIOService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
      that._nsISound = Cc["@mozilla.org/sound;1"].createInstance(Ci.nsISound);
      that._nsIMIMEService = Cc["@mozilla.org/mime;1"].getService(Ci.nsIMIMEService);
      // new code to unpack sounds...

      let dir = makePath();
      if (dir) {
        let isDirectory = await ensureDirectoryExists(dir, PathUtils.profileDir);
        if (!isDirectory) {
          that.soundsDirectory = await findFirstExistingParent(dir);
        } else {
          that.soundsDirectory = dir;
        }
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

        for (const name of fileList) {
          try {
            const file = await getLocalFile(name);
            if (!file) {
              throw new Error(`Couldn't resolve local file path for: ${name}`);
            }

            if (!file.fileInfo) {
              ToneQuillaPlay.logDebug(`Copying ${name} to ${file.path}...`);

              let localFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
              localFile.initWithPath(file.path);
              await copyDataURLToFile("chrome://filtaquilla/content/sounds/" + name, localFile);
            } else {
              ToneQuillaPlay.logDebug(`File already exists: ${file.path}`);
            }
          } catch (ex) {
            re(`Error copying ${name}: ${ex.message ?? ex}`);
          }
        }
      }
    } catch (e) {
      re(e);
    }
  },

  // function to play the next queued sound
  nextSound: async function () {
    let soundSpec = that._playQueue.shift();
    if (!soundSpec) {
      that.logHighlightDebugOptional("sounds", "ToneQuillaPlay: queue empty, nothing to play.");
      // only clear _ignoreQueue once the queue is fully empty
      that._ignoreTimer.initWithCallback(
        that._clearIgnore,
        kDelayToClear,
        Ci.nsITimer.TYPE_ONE_SHOT
      );
      that._status = kStatusIdle;
      return;
    }

    that.logHighlightDebugOptional("sounds", `nextSound - Playing: ${soundSpec}`);  
    if (soundSpec) {
      that._status = kStatusStart;
      await that.play(soundSpec);
      // tiny delay, but avoid recursion
      Promise.resolve().then(() => that.nextSound());
      // that._playTimer.initWithCallback(that.nextSound, kDelayToNext, Ci.nsITimer.TYPE_ONE_SHOT);
    } 
  },

  play: async function (aSpec) {
    if (!that.window) {
      // [issue 258]
      console.log("ToneQuillaPlay.play() - window instance not initialized!;");
      that.window = Services.wm.getMostRecentWindow("mail:3pane");
      console.log("initialized 'that.window' with Servies", { window: that.window, that: that });
    }
    that.logHighlightDebugOptional("sounds", `play(${aSpec}) ...`);  
    // initialize module if needed
    if (!that._playTimer) {
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
        mimeType = that._nsIMIMEService.getTypeFromExtension(extension);
      } catch (e) {
        void e;
      } // ignore errors, since that probably means not defined
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
    if (that.window.navigator.platform.indexOf("Mac") >= 0 && mimeType == "audio/aiff") {
      mimeType = "audio/wav";
    }

    that.logDebug("determined mimeType = " + mimeType);
    const audio = that.window.document.createElement("audio");
    const source = that.window.document.createElement("source");

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
          const startTime = new Date();
          await audio.play();
          that.logHighlightDebugOptional("sounds", `Audio playback started: ${uriSpec} - should take ${duration}ms`);
          // Wait until the audio ends before proceeding
          if (!duration) {
            await new Promise((resolve) => {
              audio.addEventListener("ended", resolve, { once: true });
            });
          }
          const remainingDuration = duration - (new Date() - startTime);
          if (remainingDuration > 0) {
            that.logHighlightDebugOptional("sounds", `After sound ended we still have ${remainingDuration} to wait!`);
            const r = duration - (new Date() - startTime) + kDelayToNext;
            await new Promise((resolve) => setTimeout(resolve, r));
          }
        } catch (err) {
          that.logHighlightDebugOptional("sounds", `Error playing ${uriSpec}:`, {}, err);
        }
        break;
      default:
        // We're going to blindly let the OS handle this?
        nsIFileURL.file.QueryInterface(Ci.nsIFile).launch();
    }
  },

  fadeOut: function (audio, duration = 350) {
    // fade out the clip, then stop it
    const steps = 35;
    const stepTime = duration / steps;
    let volumeStep = audio.volume / steps;

    const fade = setInterval(() => {
      if (audio.volume > volumeStep) {
        audio.volume -= volumeStep;
      } else {
        audio.volume = 0;
        this.stop(audio);
        clearInterval(fade);
      }
    }, stepTime);
  },

  stop: function (audio) {
    audio.pause();
    audio.currentTime = 0;
  },

  // clear all file references from the ignore queue
  _clearIgnore: function () {
    that.logDebug("_clearIgnore()");
    while (that._ignoreQueue.pop()) {;}
  },

  // add a file URL spec to the play queue, unless already queued or ignored
  queueToPlay: function (aSpec) {
    this.logHighlightDebugOptional("sounds", `Queueing: ${aSpec}`);
    // This function is designed to allow multiple emails to request playing
    // a sound, without getting the same sound multiple times, nor overlapping.
    // Multiple sounds are delayed to allow each to be heard. Any sounds
    // that recur during an ignore period are ignored.

    // initialize module if needed
    if (!that._playTimer) {
      that.init();
    }

    // ignore recently queued sounds
    if (that._ignoreQueue.indexOf(aSpec) >= 0) {
      that.logDebug("ignoring this sound, it was already played recently.");
      return;
    }

    let urlIndex = that._playQueue.indexOf(aSpec);
    if (urlIndex < 0) {
      that._playQueue.push(aSpec);
      that._ignoreQueue.push(aSpec);
    }

    if (that._status == kStatusIdle) {
      // refresh delay:
      kDelayToNext = Services.prefs.getIntPref("extensions.filtaquilla.tonequilla.soundDelay");
      that._status = kStatusStart;
      that.nextSound(); // starts a new play queue
    } // if !idle,  then playback is already running & the queue will take care of it
  },
};

// shorthand notation for the current module
var that = ToneQuillaPlay;
that.name = "ToneQuillaPlay";
