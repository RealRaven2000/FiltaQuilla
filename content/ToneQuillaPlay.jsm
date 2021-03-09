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

var EXPORTED_SYMBOLS = ["ToneQuillaPlay"];

const Cc = Components.classes,
      Ci = Components.interfaces,
      Cu = Components.utils;

// support variables for playing sound
const kDelayToNext = 1200,   // was 5000
      kDelayToClear = 3000,  // was 15000
      kStatusIdle = 0,       // not playing anything
      kStatusStart = 1;

function re(e) {
  dump(e + '\n');
  Cu.reportError(e);
  throw e;
}


var ToneQuillaPlay = {
  
  logDebug: function logDebug(txt) {
    const Prefix = "extensions.filtaquilla.",
          service = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch),  
          consoleService = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);
    let isDebug = service.getBoolPref(Prefix + 'debug');
    if (isDebug)
      consoleService.logStringMessage("FiltaQuilla (toneQuillaPlay module)\n" + txt);
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

  // nsIIOService
  _nsIIOService: null,

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
  init: function ToneQuillaPlay_init() { 
    // new utility function to unpack a file from the xpi
    function copyDataURLToFile(aURL, file, callback) {
      let step = 0;
      try {
        let uri = Services.io.newURI(aURL),
            newChannelFun = Services.io.newChannelFromURI.bind(Services.io);
        step = 1;
        let channel = newChannelFun(uri,
                      null,
                      Services.scriptSecurityManager.getSystemPrincipal(),
                      null,
                      Ci.nsILoadInfo.SEC_REQUIRE_SAME_ORIGIN_DATA_INHERITS,
                      Ci.nsIContentPolicy.TYPE_OTHER);      
        
        step = 2;
        NetUtil.asyncFetch(channel, function(istream) {
          var ostream = Cc["@mozilla.org/network/file-output-stream;1"].
                        createInstance(Ci.nsIFileOutputStream);
          ostream.init(file, -1, -1, Ci.nsIFileOutputStream.DEFER_OPEN);
          NetUtil.asyncCopy(istream, ostream, function(result) {
            callback && callback(file, result);
          });
        });
      }
      catch(ex) {
        let msg = "ToneQuillaPlay_init failed at step " + step;
        ToneQuillaPlay.logDebug(msg);
      }
    }  
  
    function makePath() {
      let path = new Array("extensions", "filtaquilla"); // was: tonequilla
      return FileUtils.getDir("ProfD", path, true);
    }
  
    function getLocalFile(fileName) {
      // get the "menuOnTop.json" file in the profile/extensions directory
      let path = new Array("extensions", "filtaquilla", fileName);  // was: tonequilla
      // http://dxr.mozilla.org/comm-central/source/mozilla/toolkit/modules/FileUtils.jsm?from=FileUtils.jsm&case=true#41
      return FileUtils.getFile("ProfD", path); // implements nsIFile
    } 

    const { NetUtil }  = Cu.import("resource://gre/modules/NetUtil.jsm"),
          { FileUtils } = Cu.import("resource://gre/modules/FileUtils.jsm"),
          { Services } = Cu.import('resource://gre/modules/Services.jsm');
  
    try {
      that._playTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      that._ignoreTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      that._nsIIOService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
      that._nsISound = Cc["@mozilla.org/sound;1"].createInstance(Ci.nsISound);
      that._nsIMIMEService = Cc["@mozilla.org/mime;1"].getService(Ci.nsIMIMEService);
      // new code to unpack sounds...    
      
      let dir = makePath();
      if (dir) {
        that.soundsDirectory = dir;
        let fileList = ['applause.mp3', 'duogourd.mp3', 'Freedom.mp3', 'nightingale.mp3', 
          'squishbeat.mp3', 'TheBrightestStar.mp3', 'squeak.wav', 'notify-1.wav', 'pour-1.wav',
          'maybe-one-day-584.mp3', 'hold-your-horses-468.mp3', 'scratch-389.mp3', 'your-turn-491.mp3', 'knob-458.mp3', 'worthwhile-438.mp3', 'scissors-423.mp3'];
        
        for (let i=0; i<fileList.length; i++) {
          let name = fileList[i],
              file = getLocalFile(name);
          //Services.dirsvc.get("TmpD", Ci.nsIFile);
          // file.append("applause.wav");
          try {
            if (file && !file.exists()) {
              ToneQuillaPlay.logDebug("Try to copy " + name + " to " + file.path + "...");
              copyDataURLToFile("chrome://filtaquilla/content/sounds/" + name, file); // was  tonequilla/content/sounds/
            }
            else
              ToneQuillaPlay.logDebug("File exists: " + file.path);
          }
          catch(ex) {
            re(ex);
          }
        }
      }
    } 
    catch (e) {re(e);}
  },

  // function to play the next queued sound
  _nextSound: function ToneQuillaPlay_nextSound() {
    that.logDebug("nextSound()");
    let soundSpec = that._playQueue.shift();
    if (soundSpec)
    {
      that._status = kStatusStart;
      that._playTimer.initWithCallback(that._nextSound,
                                       kDelayToNext,
                                       Ci.nsITimer.TYPE_ONE_SHOT);
      that.play(soundSpec);
    }
    else
    {
      that._ignoreTimer.initWithCallback(that._clearIgnore,
                                         kDelayToClear,
                                         Ci.nsITimer.TYPE_ONE_SHOT);
      that._status = kStatusIdle;
    }
  },

  play: function ToneQuillaPlay_play(aSpec) {
    that.logDebug("play() ...");
    let playSpec = aSpec;
    // initialize module if needed
    if (!that._playTimer)
      that.init();

    let dotIndex = aSpec.lastIndexOf("."),
        extension = "";
    if (dotIndex >= 0)
      extension = aSpec.substr(dotIndex + 1).toLowerCase();
    let mimeType = "";
    if (extension == "wav") {
      mimeType = "audio/wav";
    }
    else {
      try {
        mimeType = that._nsIMIMEService.getTypeFromExtension(extension);
      }
      catch (e) {
      }  // ignore errors, since that probably means not defined
    }
    let uriSpec = aSpec.startsWith("file:") ? aSpec : "file:///" + aSpec,
        nsIFileURL = that._nsIIOService
                         .newURI(uriSpec, null, null);
                         
    nsIFileURL = nsIFileURL.QueryInterface(Ci.nsIFileURL);

    // If the profile gets moved, then the file URL will no longer
    //  be valid. Fix that at least for our shipped files by
    //  also checking the default location.
    if (!nsIFileURL.file.exists())
    {
      let directory = that.soundsDirectory,
          newURL = that._nsIIOService.newFileURI(directory)
                       .QueryInterface(Ci.nsIURL);
      newURL.fileName = nsIFileURL.QueryInterface(Ci.nsIURL).fileName;
      uriSpec = newURL.QueryInterface(Ci.nsIURI).spec;  // playSpec
      nsIFileURL = that._nsIIOService
                       .newURI(uriSpec, null, null)    // playSpec
                       .QueryInterface(Ci.nsIFileURL);
      if (!nsIFileURL.file.exists()) {
        Cu.reportError("ToneQuilla file to play " + aSpec + " does not exist");
        return;
      }
    }

    // Macs can use nsISound to play aiff files
    if (that.window.navigator.platform.indexOf("Mac") >= 0 && mimeType == "audio/aiff")
      mimeType = "audio/wav";
    
    that.logDebug("determined mimeType = " + mimeType);

    switch (mimeType) {
      case "video/ogg":
      case "audio/ogg":
      case "audio/mpeg":
        that._audioElement = new that.window.Audio(uriSpec);
        that._audioElement.autoplay = true;
        that._audioElement.load(); // plays twice!
        // that._nsISound.play(Services.io.newURI(playSpec));
        break;
      case "audio/wav":
      case "audio/x-wav":
        let url = that._nsIIOService
                      .newURI(uriSpec, null, null)
                      .QueryInterface(Ci.nsIURL);
        that._nsISound.play(url);
        break;
      default:
        // We're going to blindly let the OS handle this
        nsIFileURL.file
                  .QueryInterface(Ci.nsIFile)
                  .launch();
    }
  },

  // clear all file references from the ignore queue
  _clearIgnore: function ToneQuillaPlay_clearIgnore()
  {
    that.logDebug("_clearIgnore()");
    while (that._ignoreQueue.pop())
      ;
  },

  // add a file URL spec to the play queue, unless already queued or ignored
  queueToPlay: function ToneQuillaPlay_queueToPlay(aSpec)  {
    that.logDebug("_queueToPlay(" + aSpec + ")");
    // This function is designed to allow multiple emails to request playing
    // a sound, without getting the same sound multiple times, nor overlapping.
    // Multiple sounds are delayed to allow each to be heard. Any sounds
    // that recur during an ignore period are ignored.

    // initialize module if needed
    if (!that._playTimer)
      that.init();

    // ignore recently queued sounds
    if (that._ignoreQueue.indexOf(aSpec) >= 0)
    {
      that.logDebug("ignoring this sound, it was already played recently.");
      return;
    }

    let urlIndex = that._playQueue.indexOf(aSpec);
    if (urlIndex < 0)
    {
      that.logDebug("queueing sound, status = " + that._status);
      that._playQueue.push(aSpec);
      that._ignoreQueue.push(aSpec);
    }

    if (that._status == kStatusIdle)
    {
      that.logDebug("starting next sound...");
      that._status = kStatusStart;
      that._nextSound();
    }
  },
}

// shorthand notation for the current module
var that = ToneQuillaPlay;
that.name = "ToneQuillaPlay";
