// "use strict";

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


(function filtaQuilla()
{
 
  Components.utils.import("resource://filtaquilla/inheritedPropertiesGrid.jsm");
  var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
  var { MimeParser } = ChromeUtils.import("resource:///modules/mimeParser.jsm");
  var { MailUtils } = ChromeUtils.import("resource:///modules/MailUtils.jsm");
  
  Services.scriptloader.loadSubScript("chrome://filtaquilla/content/filtaquilla-util.js") // FiltaQuilla object


  const Cc = Components.classes,
        Ci = Components.interfaces,
        Cu = Components.utils,
				util = FiltaQuilla.Util,
        regexUtil = FiltaQuilla.RegexUtil
        ;


  // parameters for MoveLater
  //  delay (in milliseconds) between calls to move later
  const MOVE_LATER_DELAY = 5000,
        //  Maximum number of callbacks before we just go ahead and move it.
        MOVE_LATER_LIMIT = 12;

  // global scope variables
  this.filtaquilla = {}; // use strict leads to "this is undefined" error

  // local shorthand for the global reference
  var self = this.filtaquilla;

  self.initialized = false;
  self.name = filtaQuilla;
  
  var { MailServices } = ChromeUtils.import(
    "resource:///modules/MailServices.jsm"
  );
  const headerParser = MailServices.headerParser,
        tagService = Cc["@mozilla.org/messenger/tagservice;1"].getService(Ci.nsIMsgTagService),
        abManager = Cc["@mozilla.org/abmanager;1"].getService(Ci.nsIAbManager),
        // cache the values of commonly used search operators
        nsMsgSearchOp = Ci.nsMsgSearchOp,
				Contains = nsMsgSearchOp.Contains,
				DoesntContain = nsMsgSearchOp.DoesntContain,
				Is = nsMsgSearchOp.Is,
				Isnt = nsMsgSearchOp.Isnt,
				IsEmpty = nsMsgSearchOp.IsEmpty,
				IsntEmpty = nsMsgSearchOp.IsntEmpty,
				BeginsWith = nsMsgSearchOp.BeginsWith,
				EndsWith = nsMsgSearchOp.EndsWith,
				Matches = nsMsgSearchOp.Matches,
				DoesntMatch = nsMsgSearchOp.DoesntMatch;

  const REGEX_CASE_SENSITIVE_FLAG = "c", //use this to override global case insensitive flag 
                                         //(js doesnt have that, but tcl does)
        REGEX_SHOW_ALERT_SUCCESS_VALUE = "a" //use this to trigger dialog box with matched value
        ;
        
  let maxThreadScan = 20; // the largest number of thread messages that we will examine
  
  // Enabling of filter actions.
  let subjectAppendEnabled = false,
      subjectSuffixEnabled = false,
      removeKeywordEnabled = false,
      removeFlaggedEnabled = false,
      noBiffEnabled = false,
      markUnreadEnabled = false,
      markRepliedEnabled = false,
      copyAsReadEnabled = false,
      launchFileEnabled = false,
      runFileEnabled = false,
      trainAsJunkEnabled = false,
      trainAsGoodEnabled = false,
      printEnabled = false,
      addSenderEnabled = false,
      saveAttachmentEnabled = false,
      detachAttachmentsEnabled = false,
      javascriptActionEnabled = false,
      javascriptActionBodyEnabled = false,
      tonequillaEnabled = false,
      saveMessageAsFileEnabled = false,
      moveLaterEnabled = false,
 
      regexpCaseInsensitiveEnabled = false;

  // Enabling of search terms.
  let SubjectRegexEnabled = false,
      HeaderRegexEnabled = false,
      JavascriptEnabled = false,
      SearchBccEnabled = false,
      ThreadHeadTagEnabled = false,
      ThreadAnyTagEnabled = false,
      FolderNameEnabled = false;
      
  let 
      BodyRegexEnabled = false,
      SubjectBodyRegexEnabled = false,
      regexShowAlertSuccessValueEnabled = false
  ;
  
	// [#5] AG new condition - attachment name regex
	let AttachmentRegexEnabled = false,
      moveLaterTimers = {}, // references to timers used in moveLater action
      moveLaterIndex = 0; // next index to use to store timers

  let printQueue = [],
      printingMessage = false;

  // inherited property object
  let applyIncomingFilters = {
    defaultValue: function defaultValue(aFolder) {
      return false;
    },
    name: util.getBundleString("filtaquilla.applyIncomingFilters"),
    accesskey: util.getBundleString("filtaquilla.applyIncomingFilters.accesskey"),
    property: "applyIncomingFilters",
    hidefor: "nntp,none,pop3,rss" // That is, this is only valid for imap.
  };

  // javascript mime emitter functions
  //self._mimeMsg = {};
  //Cu.import("resource:///modules/gloda/mimemsg.js", self._mimeMsg);
  
  self._mimeMsg = ChromeUtils.import("resource:///modules/gloda/MimeMessage.jsm"); // Tb78

  self._init = function() {
    // self.strings = filtaquillaStrings;

    /*
     * custom action implementations
     */

    // prepend to subject. This was called "append" due to an earlier bug
    self.subjectAppend =
    {
      id: "filtaquilla@mesquilla.com#subjectAppend",
      name: util.getBundleString("fq.subjectprepend"),

      applyAction: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        for (let msgHdr of aMsgHdrs)
        {
          var appSubject = _mimeAppend(aActionValue, msgHdr.subject, true);
          msgHdr.subject = appSubject;
        }
      },
      
      apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        let msgHdrs = [];
        for (var i = 0; i < aMsgHdrs.length; i++) {
          msgHdrs.push (aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }
        this.applyAction(msgHdrs, aActionValue, aListener, aType, aMsgWindow);
      },

      isValidForType: function(type, scope) {return subjectAppendEnabled;},

      validateActionValue: function(value, folder, type) { return null;},

      allowDuplicates: false,
      needsBody: false,
      isAsync: false
    };

    // Suffix to subject
    self.subjectSuffix =
    {
      id: "filtaquilla@mesquilla.com#subjectSuffix",
      name: util.getBundleString("fq.subjectappend"),

      applyAction: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        for (let msgHdr of aMsgHdrs)
        {
          var appSubject = _mimeAppend(aActionValue, msgHdr.subject, false);
          msgHdr.subject = appSubject;
        }
      },
      
      apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        let msgHdrs = [];
        for (var i = 0; i < aMsgHdrs.length; i++) {
          msgHdrs.push (aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }
        this.applyAction(msgHdrs, aActionValue, aListener, aType, aMsgWindow);
      },
 
      isValidForType: function(type, scope) {return subjectSuffixEnabled;},

      validateActionValue: function(value, folder, type) { return null;},

      allowDuplicates: false,
      needsBody: false,
      isAsync: false
    };

    // remove keyword
    self.removeKeyword =
    {
      id: "filtaquilla@mesquilla.com#removeTag",
      name: util.getBundleString("fq.removekeyword"),
      applyAction: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow) {
        aMsgHdrs[0].folder.removeKeywordsFromMessages(aMsgHdrs, aActionValue);
      },

      apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        let msgHdrs = [];
        for (var i = 0; i < aMsgHdrs.length; i++) {
          msgHdrs.push (aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }
        this.applyAction(msgHdrs, aActionValue, aListener, aType, aMsgWindow);
      },
      
      isValidForType: function(type, scope) {return removeKeywordEnabled;},
      validateActionValue: function(value, folder, type) { return null;},
      allowDuplicates: true,
      needsBody: false
    };

    // remove star
    self.removeFlagged =
    {
      id: "filtaquilla@mesquilla.com#removeStar",
      name: util.getBundleString("fq.removeflagged"),
      applyAction: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow) {
        aMsgHdrs[0].folder.markMessagesFlagged(aMsgHdrs, false);
      },
      apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        let msgHdrs = [];
        for (var i = 0; i < aMsgHdrs.length; i++) {
          msgHdrs.push (aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }
        this.applyAction(msgHdrs, aActionValue, aListener, aType, aMsgWindow);
      },
      isValidForType: function(type, scope) { return removeFlaggedEnabled;},
      validateActionValue: function(value, folder, type) { return null;},

    }; // end removeFlagged

    // mark as unread
    self.markUnread =
    {
      id: "filtaquilla@mesquilla.com#markUnread",
      name: util.getBundleString("fq.markUnread"),
      applyAction: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow) {
        aMsgHdrs[0].folder.markMessagesRead(aMsgHdrs, false);
      },
      apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        let msgHdrs = [];
        for (var i = 0; i < aMsgHdrs.length; i++) {
          msgHdrs.push (aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }
        this.applyAction(msgHdrs, aActionValue, aListener, aType, aMsgWindow);
      },
      isValidForType: function(type, scope) {return markUnreadEnabled;},
      validateActionValue: function(value, folder, type) { return null;},
    }; // end markUnread

    // mark as replied
    self.markReplied =
    {
      id: "filtaquilla@mesquilla.com#markReplied",
      name: util.getBundleString("fq.markReplied"),
      applyAction: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow) {
        // what a pain, the folder function does not take an array like all others!
        for (let msgHdr of aMsgHdrs)
        {
          msgHdr.folder.addMessageDispositionState(msgHdr, Ci.nsIMsgFolder.nsMsgDispositionState_Replied);
        }
      },
      apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        let msgHdrs = [];
        for (var i = 0; i < aMsgHdrs.length; i++) {
          msgHdrs.push (aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }
        this.applyAction(msgHdrs, aActionValue, aListener, aType, aMsgWindow);
      },
      isValidForType: function(type, scope) {return markRepliedEnabled;},
      validateActionValue: function(value, folder, type) { return null;},
    }; // end markUnread

    // noBiff action
    self.noBiff =
    {
      id: "filtaquilla@mesquilla.com#noBiff",
      name: util.getBundleString("fq.nobiff"),
      applyAction: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow) {
        let folder = aMsgHdrs[0].folder,
            numNewMessages = folder.getNumNewMessages(false);
            hdrCount = aMsgHdrs.length;
        numNewMessages = numNewMessages - hdrCount;
        folder.setNumNewMessages(numNewMessages);
      },
      apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        let msgHdrs = [];
        for (var i = 0; i < aMsgHdrs.length; i++) {
          msgHdrs.push (aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }
        this.applyAction(msgHdrs, aActionValue, aListener, aType, aMsgWindow);
      },
      isValidForType: function(type, scope) { return noBiffEnabled;},
      validateActionValue: function(value, folder, type) { return null;},

    }; // end noBiff

    // copyAsRead action
    (function()
    {
      self.copyAsRead =
      {
        id: "filtaquilla@mesquilla.com#copyAsRead",
        name: util.getBundleString("fq.copyAsRead"),
        applyAction: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow) {
          _aListener = aListener;
          var srcFolder = aMsgHdrs[0].folder;
          _dstFolder = MailUtils.getExistingFolder(aActionValue, false);
          // store the messages Ids to use post-copy
          _messageIds = [];
          for (let msgHdr of aMsgHdrs)
            _messageIds.push(msgHdr.messageId); // are these used later?

          const copyService = MailServices.copy  // Tb91
            || Cc["@mozilla.org/messenger/messagecopyservice;1"].getService(Ci.nsIMsgCopyService); // older
                                
          copyService.CopyMessages(srcFolder, aMsgHdrs, _dstFolder, false /*isMove*/,
                                   _localListener, aMsgWindow, false /*allowUndo*/);

        },
        apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
        {
          let msgHdrs = [];
          for (var i = 0; i < aMsgHdrs.length; i++) {
            msgHdrs.push (aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
          }
          this.applyAction(msgHdrs, aActionValue, aListener, aType, aMsgWindow);
        },        
        
        isValidForType: function(type, scope) { return type == Ci.nsMsgFilterType.Manual && copyAsReadEnabled;},
        validateActionValue: function(aActionValue, aFilterFolder, type) {
          var msgFolder = MailUtils.getExistingFolder(aActionValue, false);
          if (!msgFolder || !msgFolder.canFileMessages)
          {
            return util.getBundleString("fq.filtaquilla.mustSelectFolder");
          }
          return null;
        },
        allowDuplicates: true,
        needsBody: false,
        isAsync: true
      }

      // local variables and methods
      var _messageIds = null,
          _dstFolder = null,
          _aListener = null;

      var _localListener =
      {
        OnStartCopy: function() {
          if (_aListener)
            _aListener.OnStartCopy();
        },
        OnProgress: function(aProgress, aProgressMax) {
          if (_aListener)
            _aListener.OnProgress(aProgress, aProgressMax);
        },
        SetMessageKey: function(aKey) {
          if (_aListener)
            _aListener.SetMessageKey(aKey);
        },
        SetMessageId: function(aMessageId) {
          if (_aListener)
            _aListener.SetMessageId(aMessageId);
        },
        OnStopCopy: function(aStatus) {
          // local folders can be set unread now. Imap folders must be loaded
          if (_dstFolder.URI.substr(0, 4) == "imap")
          {
            var mailSession = Cc["@mozilla.org/messenger/services/session;1"]
                                .getService(Ci.nsIMsgMailSession);
            mailSession.AddFolderListener(_folderListener, Ci.nsIFolderListener.event);
            _dstFolder.updateFolder(null);
          }
          else
          {
            _setRead(aStatus);
          }
        },
      };

      var _setRead = function (aStatus) {
        var dstMessages = Cc["@mozilla.org/array;1"]
                          .createInstance(Ci.nsIMutableArray);
        var dstDb = _dstFolder.msgDatabase;
        for (var i = 0; i < _messageIds.length; i++) {
          var hdr = dstDb.getMsgHdrForMessageID(_messageIds[i]);
          if (hdr)
            dstMessages.appendElement(dstDb.getMsgHdrForMessageID(_messageIds[i]), false);
          else
            throw("Couldn't find messageId <" + _messageIds[i] + "> in Copy as Unread custom action");
        }

        _dstFolder.markMessagesRead(dstMessages, true);
        _dstFolder = null;
        _messageIds = null;
        if (_aListener)
          _aListener.OnStopCopy(aStatus);
      };

      var _folderListener =
      {
        OnItemAdded: function(parentItem, item) {},
        OnItemRemoved: function(parentItem, item) {},
        OnItemPropertyChanged: function(item, property, oldValue, newValue) {},
        OnItemIntPropertyChanged: function(item, property, oldValue, newValue) {},
        OnItemBoolPropertyChanged: function(item, property, oldValue, newValue) {},
        OnItemUnicharPropertyChanged: function(item, property, oldValue, newValue){},
        OnItemPropertyFlagChanged: function(item, property, oldFlag, newFlag) {},
        OnItemEvent: function(folder, event) {
          var eventType = event.toString();

          if (eventType == "FolderLoaded") {
            if (_dstFolder && folder && folder.URI == _dstFolder.URI)
            {
              var mailSession = Cc["@mozilla.org/messenger/services/session;1"]
                                .getService(Ci.nsIMsgMailSession);
              mailSession.RemoveFolderListener(_folderListener);
              _setRead(null);
            }
          }
        },
      };
    })(); // end copyAsRead

    // launch file
    self.launchFile =
    {
      id: "filtaquilla@mesquilla.com#launchFile",
      name: util.getBundleString("fq.launchFile"),
      applyAction: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile || Ci.nsIFile);
        file.initWithPath(aActionValue);
        file.launch();
      },
      apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        let msgHdrs = []; // not used in this case...
        for (var i = 0; i < aMsgHdrs.length; i++) {
          msgHdrs.push (aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }
        this.applyAction(msgHdrs, aActionValue, aListener, aType, aMsgWindow);
      },        

      isValidForType: function(type, scope) {return launchFileEnabled;},
      validateActionValue: function(value, folder, type) { return null;},
      allowDuplicates: true,
      needsBody: false
    }; // end launchFile

    // run file
    self.runFile =
    {
      id: "filtaquilla@mesquilla.com#runFile",
      name: util.getBundleString("fq.runFile"),
      applyAction: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow) {
        var file = Cc["@mozilla.org/file/local;1"]
                     .createInstance(Ci.nsILocalFile || Ci.nsIFile);
        // the action value string consists of comma-separated fields. The
        // first field is the file URL for the process to run. Subsequent
        // fields are parameter strings to pass to the file. These parameters
        // may contain one of the following replacable parameters from header fields:
        //   @SUBJECT@  subject
        //   @MESSAGEID@ message Id
        //   @AUTHOR@ author
        //   @RECIPIENTS@ recipients
        //   @DATE@ date (local string)
        //   @CCLIST@ cc list
        //   @DATEINSECONDS@ date in seconds
        //   @MESSAGEURI@ URI for the message
        //   @PROPERTY@somedbproperty@ uses .getStringProperty("somedbproperty")

        var args = aActionValue.split(','),
            fileURL = args[0],
            parmCount = args.length - 1;
            
        file.initWithPath(fileURL);
        for (var messageIndex = 0; messageIndex < aMsgHdrs.length; messageIndex++) {
          let theProcess = Cc["@mozilla.org/process/util;1"]
                           .createInstance(Ci.nsIProcess);
          theProcess.init(file);
          let parameters = new Array(parmCount);
          for (var i = 0; i < parmCount; i++)
            parameters[i] = _replaceParameters(aMsgHdrs[messageIndex], args[i + 1]);
          theProcess.run(false, parameters, parmCount);
        }
      },
      apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        let msgHdrs = [];
        for (var i = 0; i < aMsgHdrs.length; i++) {
          msgHdrs.push (aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }
        this.applyAction(msgHdrs, aActionValue, aListener, aType, aMsgWindow);
      },        
      

      isValidForType: function(type, scope) {return runFileEnabled;},
      validateActionValue: function(value, folder, type) { return null;},
      allowDuplicates: true,
      needsBody: false
    }; // end runFile

    // train as junk
    self.trainAsJunk =
    {
      id: "filtaquilla@mesquilla.com#trainAsJunk",
      name: util.getBundleString("fq.trainJunk"),
      applyAction: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow) {
        _trainJunkFilter(true, aMsgHdrs, aMsgWindow);
      },
      apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        let msgHdrs = [];
        for (var i = 0; i < aMsgHdrs.length; i++) {
          msgHdrs.push (aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }
        this.applyAction(msgHdrs, aActionValue, aListener, aType, aMsgWindow);
      },
      isValidForType: function(type, scope) {return trainAsJunkEnabled;},
      validateActionValue: function(value, folder, type) { return null;},
      allowDuplicates: false,
      needsBody: true
    }; // end trainAsJunk

    // train as good
    self.trainAsGood =
    {
      id: "filtaquilla@mesquilla.com#trainAsGood",
      name: util.getBundleString("fq.trainGood"),
      applyAction: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow) {
        _trainJunkFilter(false, aMsgHdrs, aMsgWindow);
      },
      apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        let msgHdrs = [];
        for (var i = 0; i < aMsgHdrs.length; i++) {
          msgHdrs.push (aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }
        this.applyAction(msgHdrs, aActionValue, aListener, aType, aMsgWindow);
      },
      isValidForType: function(type, scope) {return trainAsGoodEnabled;},
      validateActionValue: function(value, folder, type) { return null;},
      allowDuplicates: false,
      needsBody: true
    }; // end trainAsJunk

    // print messages
    self.print =
    {
      id: "filtaquilla@mesquilla.com#print",
      name: util.getBundleString("fq.print"),
      applyAction: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow) {
        // print me
        let count = aMsgHdrs.length;
        for (let i = 0; i < count; i++) {
          let hdr = aMsgHdrs[i];
          printQueue.push(hdr);
        }
        /*
         * Message printing always assumes that we want to put up a print selection
         *  dialog, which we really don't want to do for filters. We can override
         *  that, but it is a global setting. I'll do it here, but hopefully I can
         *  add a future backend hook to allow me to specify that. I'll override that
         *  in setup.
         *
         */
        let rootprefs = Cc["@mozilla.org/preferences-service;1"]
                           .getService(Ci.nsIPrefService)
                           .getBranch("");

        function printNextMessage() {
          if (printingMessage || !printQueue.length)
            return;
          printingMessage = true;
          let timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
          timer.initWithCallback(function _printNextMessage() {
            let hdr = printQueue.shift();
            let uri = hdr.folder.generateMessageURI(hdr.messageKey);
            Services.console.logStringMessage("Queue filter request to print message: " + hdr.subject);
            let printSilentBackup = rootprefs.getBoolPref("print.always_print_silent");
            rootprefs.setBoolPref("print.always_print_silent", true);
            let printDialog =
              window.openDialog("chrome://messenger/content/msgPrintEngine.xhtml", "",
                                "chrome,dialog=no,all,centerscreen",
                                1, [uri], statusFeedback,
                                false, Ci.nsIMsgPrintEngine.MNAB_PRINT_MSG, window);
            printDialog.addEventListener("DOMWindowClose", function (e) {
              Services.console.logStringMessage("Finished printing message: " + hdr.subject);
              printingMessage = false;
              // [issue 97] try to restore the setting
              rootprefs.setBoolPref("print.always_print_silent", printSilentBackup); // try to restore previous setting
              
              printNextMessage();
            }, true);
          }, 10, Ci.nsITimer.TYPE_ONE_SHOT);
        }
        printNextMessage();
      },
      apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        let msgHdrs = [];
        for (var i = 0; i < aMsgHdrs.length; i++) {
          msgHdrs.push (aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }
        this.applyAction(msgHdrs, aActionValue, aListener, aType, aMsgWindow);
      },
      isValidForType: function(type, scope) {return printEnabled;},
      validateActionValue: function(value, folder, type) { return null;},
      allowDuplicates: false,
      needsBody: true
    }; // end print messages
    // reset the always_print_silent value at startup
    // XXX to do : add a hook to base so that this is not needed
/*    
    // [issue 97] do not reset this setting generally!!!
    let rootprefs = Cc["@mozilla.org/preferences-service;1"]
                      .getService(Ci.nsIPrefService)
                      .getBranch("");
    try {
      rootprefs.clearUserPref("print.always_print_silent");
    } catch (e) {}
    */

    // add sender to a specific address book
    self.addSender =
    {
      id: "filtaquilla@mesquilla.com#addSender",
      name: util.getBundleString("fq.addSender"),
      applyAction: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow) {
        
        // Helper function, removed in Tb78
        function parseHeadersWithArray(aHeader, aAddrs, aNames, aFullNames) {
          let addrs = [],
            names = [],
            fullNames = [];
          let allAddresses = headerParser.parseEncodedHeader(aHeader, undefined, false);

          // Don't index the dummy empty address.
          if (aHeader.trim() == "") {
            allAddresses = [];
          }
          for (let address of allAddresses) {
            addrs.push(address.email);
            names.push(address.name || null);
            fullNames.push(address.toString());
          }

          aAddrs.value = addrs;
          aNames.value = names;
          aFullNames.value = fullNames;
          return allAddresses.length;
        }
        
        let dir = abManager.getDirectory(aActionValue);
        if (!dir) {
          Cu.reportError("During filter action, can't find directory: " + aActionValue);
          return;
        }

        let count = aMsgHdrs.length;
        for (let i = 0; i < count; i++) {
          let hdr = aMsgHdrs[i];
          let addresses = {}, names = {};
          parseHeadersWithArray(hdr.mime2DecodedAuthor, addresses, names, {});
          names = names.value;
          addresses = addresses.value;
          if (addresses.length)
          {
            // don't add the address if it already exists. Mailing lists seem to
            // detect this themselves.
            if (!dir.isMailList && dir.cardForEmailAddress(addresses[0])) {
              continue;
            }

            let card = Cc["@mozilla.org/addressbook/cardproperty;1"]
                          .createInstance(Ci.nsIAbCard);
            card.primaryEmail = addresses[0];
            card.displayName = names[0];
            dir.addCard(card);
          }
        }
      },
      apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        let msgHdrs = [];
        for (var i = 0; i < aMsgHdrs.length; i++) {
          msgHdrs.push (aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }
        this.applyAction(msgHdrs, aActionValue, aListener, aType, aMsgWindow);
      },
      isValidForType: function(type, scope) {return addSenderEnabled;},
      validateActionValue: function(value, folder, type) { return null;},
      allowDuplicates: true,
      needsBody: false
    }; // end add Sender

    self.saveAttachment =
    {
      id: "filtaquilla@mesquilla.com#saveAttachment",
      name: util.getBundleString("fq.saveAttachment"),
      applyAction: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        let directory = Cc["@mozilla.org/file/local;1"]
                           .createInstance(Ci.nsILocalFile || Ci.nsIFile);
				try {
					directory.initWithPath(aActionValue);
					if (directory.exists()) {
						util.logDebug("saveAttachment() - target directory exists:\n" + aActionValue);
					}
					let callbackObject = new SaveAttachmentCallback(directory, false);

					for (let i = 0; i < aMsgHdrs.length; i++) {
						try {
							var msgHdr = aMsgHdrs[i];
							self._mimeMsg.MsgHdrToMimeMessage(msgHdr, callbackObject, callbackObject.callback,
																								false /* allowDownload */);
						}
						catch (ex) {
							util.logException("FiltaQuilla.saveAttachment - converting message headers failed.", ex);
						}
					}
				}
				catch (ex) {
					util.logException("FiltaQuilla.saveAttachment - initWithPath", ex);
				}
      },
      apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        let msgHdrs = [];
        for (var i = 0; i < aMsgHdrs.length; i++) {
          msgHdrs.push (aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }
        this.applyAction(msgHdrs, aActionValue, aListener, aType, aMsgWindow);
      },
      
      isValidForType: function(type, scope) {return saveAttachmentEnabled;},
      validateActionValue: function(value, folder, type) { return null;},
      allowDuplicates: true,
      needsBody: true,
    };

    // local object used for callback
    function SaveAttachmentCallback(aDirectory, aDetach) {
      this.directory = aDirectory;
      this.detach = aDetach;
      this.msgURI = null;
      this.attachments = null;
      this.saveAttachmentListener = null;
    }

    SaveAttachmentCallback.prototype = {
      callback: function saveAttachmentCallback_callback(aMsgHdr, aMimeMessage) {
				let txtStackedDump = "";
        this.msgURI = aMsgHdr.folder.generateMessageURI(aMsgHdr.messageKey);
        this.attachments = aMimeMessage.allAttachments;
        let messenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
				try {
          let ds = aMsgHdr.date / 1000,
              msgDate = new Date(ds),  // this is cast to string for some stupid reason, so it's not useful.
              msgSubject = aMsgHdr.subject;
          if (util.isDebug) {
            util.logDebug('saveAttachmentCallback_callback');
            debugger;
          }
          // note: for some reason I could not use msgDate as it is treated here as a string not a Date object...
          // the only workaround was to create new date objects at each step and call its functions directly:
          let nicedate = " " + (new Date(ds)).getFullYear() + "-" + ((new Date(ds)).getMonth()+1) + "-" + (new Date(ds)).getDate()  + " " +  (new Date(ds)).getHours() + ":" + (new Date(ds)).getMinutes();
					if (!this.detach) {
						for (let j = 0; j < this.attachments.length; j++) {
              try {
                let attachment = this.attachments[j];
                if (attachment.url.startsWith("file:")) {
                  util.logToConsole("Attachment for '" + msgSubject + "' from " 
                    + nicedate + " was already removed from mail - last seen at this location:\n" 
                    + attachment.url);
                  continue;
                }
                // create a unique file for this attachment
                let uniqueFile = this.directory.clone();
                uniqueFile.append(attachment.name);
                let txt = "Save attachment [" + j + "] to " + uniqueFile.path +
                    "...\n msgURI=" + this.msgURI +
                    "\n att.url=" + attachment.url +
                    "\n att.ncontentType=" + attachment.contentType;
                util.logDebug(txt);
                txtStackedDump += txtStackedDump + txt + "\n";
                uniqueFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0o600);
                messenger.saveAttachmentToFile(uniqueFile, attachment.url, this.msgURI,
                                               attachment.contentType, null);
              }
              catch (ex) {
                util.logException("SaveAttachmentCallback\n" + txtStackedDump, ex);
              }
						}
					}
					else
					{
						if (this.attachments.length > 0) {
							let msgURIs = [],
							    contentTypes = [],
							    urls = [],
							    displayNames = [];
							for (let j = 0; j < this.attachments.length; j++) {
								let attachment = this.attachments[j];
                if (attachment.url.startsWith("file:")) {
                  util.logToConsole("Attachment for '" + msgSubject + "' from " + nicedate 
                    + " was already removed from mail - last seen at this location:\n" 
                    + attachment.url);
                  continue;
                }
                
								msgURIs.push(this.msgURI);
								contentTypes.push(attachment.contentType);
								urls.push(attachment.url);
								displayNames.push(attachment.name);
								let txt = "Detach attachment [" + j + "] to " + this.directory.path +
										"...\n msgURI=" + this.msgURI +
										"\n att.url=" + attachment.url +
										"\n att.ncontentType=" + attachment.contentType;
								util.logDebug(txt);
								txtStackedDump += txtStackedDump + txt + "\n";

							}
							messenger.detachAttachmentsWOPrompts(this.directory,
																			contentTypes, urls, displayNames, msgURIs, null);
						}
					}
				}
				catch (ex) {
					util.logException("SaveAttachmentCallback\n" + txtStackedDump, ex);
				}
      }
    },
    // end save Attachment

    self.detachAttachments =
    {
      id: "filtaquilla@mesquilla.com#detachAttachments",
      name: util.getBundleString("fq.detachAttachments"),
      applyAction: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        let directory = Cc["@mozilla.org/file/local;1"]
                           .createInstance(Ci.nsILocalFile || Ci.nsIFile);
				try {
					directory.initWithPath(aActionValue);
					if (directory.exists()) {
						util.logDebug("detachAttachments() - target directory exists:\n" + aActionValue);
					}

					let callbackObject = new SaveAttachmentCallback(directory, true);
					for (let i = 0; i < aMsgHdrs.length; i++) {
						try {
							var msgHdr = aMsgHdrs[i];
							self._mimeMsg.MsgHdrToMimeMessage(msgHdr, callbackObject, callbackObject.callback,
																								false /* allowDownload */);
						}
						catch (ex) {
							util.logException("FiltaQuilla.detachAttachments - converting message headers failed.", ex);
						}
					}
				}
				catch (ex) {
					util.logException("FiltaQuilla.saveAttachment - initWithPath", ex);
				}
      },
      apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        let msgHdrs = [];
        for (var i = 0; i < aMsgHdrs.length; i++) {
          msgHdrs.push (aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }
        this.applyAction(msgHdrs, aActionValue, aListener, aType, aMsgWindow);
      },
      isValidForType: function(type, scope) {return detachAttachmentsEnabled;},
      validateActionValue: function(value, folder, type) { return null;},
      allowDuplicates: false,
      needsBody: true
    },
    // end detach Attachments

    self.javascriptAction =
    {
      id: "filtaquilla@mesquilla.com#javascriptAction",
      name: util.getBundleString("filtaquilla.javascriptAction.name"),
      applyAction: function(msgHdrs, actionValue, copyListener, filterType, msgWindow) {
        return eval(actionValue);
      },
      apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        let msgHdrs = [];
        for (var i = 0; i < aMsgHdrs.length; i++) {
          msgHdrs.push (aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }
        this.applyAction(msgHdrs, aActionValue, aListener, aType, aMsgWindow);
      },
      isValidForType: function(type, scope) {return javascriptActionEnabled;},
      validateActionValue: function(value, folder, type) { return null;},
      allowDuplicates: true,
      needsBody: false
    },

    self.javascriptActionBody =
    {
      id: "filtaquilla@mesquilla.com#javascriptActionBody",
      name: util.getBundleString("filtaquilla.javascriptActionBody.name"),
      applyAction: function(msgHdrs, actionValue, copyListener, filterType, msgWindow) {
        return eval(actionValue);
      },
      apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        let msgHdrs = [];
        for (var i = 0; i < aMsgHdrs.length; i++) {
          msgHdrs.push (aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }
        this.applyAction(msgHdrs, aActionValue, aListener, aType, aMsgWindow);
      },
      isValidForType: function(type, scope) {return javascriptActionBodyEnabled;},
      validateActionValue: function(value, folder, type) { return null;},
      allowDuplicates: true,
      needsBody: true
    },

    self.saveMessageAsFile =
    {
      id: "filtaquilla@mesquilla.com#saveMessageAsFile",
      name: util.getBundleString("fq.saveMsgAsFile"),
      applyAction: function(msgHdrs, actionValue, copyListener, filterType, msgWindow) {
        // allow specifying directory with suffix of |htm
        let type = "eml";
        let path = actionValue;
        if (/\|/.test(actionValue)) {
          let matches = /(^[^\|]*)\|(.*$)/.exec(actionValue);
          path = matches[1];
          type = matches[2];
        }

        let directory = Cc["@mozilla.org/file/local;1"]
                           .createInstance(Ci.nsILocalFile || Ci.nsIFile);
        directory.initWithPath(path);
        for (let i = 0; i < msgHdrs.length; i++) {
          var msgHdr = msgHdrs[i];
          _incrementMoveLaterCount(msgHdr);
          _saveAs(msgHdr, directory, type);
        }
      },
      apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        let msgHdrs = [];
        for (var i = 0; i < aMsgHdrs.length; i++) {
          msgHdrs.push (aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }
        this.applyAction(msgHdrs, aActionValue, aListener, aType, aMsgWindow);
      },
      isValidForType: function(type, scope) {return saveMessageAsFileEnabled;},
      validateActionValue: function(value, folder, type) { return null;},
      allowDuplicates: true,
      needsBody: true
    },

    self.moveLater =
    {
      id: "filtaquilla@mesquilla.com#moveLater",
      name: util.getBundleString("fq.moveLater"),
      applyAction: function(aMsgHdrs, aActionValue, copyListener, filterType, msgWindow) {
        let srcFolder = aMsgHdrs[0].folder;
        let dstFolder = MailUtils.getExistingFolder(aActionValue, false);
        // store the messages uris to use later
        let timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
        let currentIndex = moveLaterIndex++;
        moveLaterTimers[currentIndex] = timer;
        // the message headers array gets cleared by Thunderbird 78! we need to save it elswhere
        
        
        let callback = new MoveLaterNotify(aMsgHdrs, srcFolder, dstFolder, currentIndex);
        timer.initWithCallback(callback, MOVE_LATER_DELAY, Ci.nsITimer.TYPE_ONE_SHOT);
      },
      apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
      {
        let msgHdrs = [];
        for (var i = 0; i < aMsgHdrs.length; i++) {
          msgHdrs.push (aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }
        this.applyAction(msgHdrs, aActionValue, aListener, aType, aMsgWindow);
      },
      isValidForType: function(type, scope) {return moveLaterEnabled;},
      validateActionValue: function(value, folder, type) { return null;},
      allowDuplicates: false,
      needsBody: true
    },
    /*
     * Custom searches
     */

    // search of folder name
    self.folderName =
    {
      id: "filtaquilla@mesquilla.com#folderName",
      name: util.getBundleString("fq.folderName"),
      getEnabled: function folderName_getEnabled(scope, op) {
        return _isLocalSearch(scope);
      },
      needsBody: false,
      getAvailable: function folderName_getAvailable(scope, op) {
        return _isLocalSearch(scope) && FolderNameEnabled;
      },
      getAvailableOperators: function folderName_getAvailableOperators(scope) {
        if (!_isLocalSearch(scope))
        {
          return [];
        }
        return [Contains, DoesntContain, Is, Isnt, BeginsWith, EndsWith];
      },
      match: function folderName_match(aMsgHdr, aSearchValue, aSearchOp) {
        let folderName = aMsgHdr.folder.name,
            matches = false;

        switch (aSearchOp) {
          case Contains:
          case DoesntContain:
            if (folderName.indexOf(aSearchValue) != -1)
              matches = true;
            break;

          case Is:
          case Isnt:
            if (folderName == aSearchValue)
              matches = true;
            break;

          case BeginsWith:
            if (folderName.indexOf(aSearchValue) == 0)
              matches = true;
            break;

          case EndsWith:
            let index = folderName.lastIndexOf(aSearchValue);
            if (index != -1 && index == (folderName.length - aSearchValue.length))
              matches = true;
            break;

            default:
              Cu.reportError("invalid search operator in folder name custom search term");
        }
        if (aSearchOp == DoesntContain || aSearchOp == Isnt)
          return !matches;
        return matches;
      },
    },

    // search of BCC field
    self.searchBcc =
    {
      id: "filtaquilla@mesquilla.com#searchBcc",
      name: util.getBundleString("fq.Bcc"),
      getEnabled: function searchBcc_getEnabled(scope, op) {
        return _isLocalSearch(scope);
      },
      needsBody: false,
      getAvailable: function searchBcc_getAvailable(scope, op) {
        return _isLocalSearch(scope) && SearchBccEnabled;
      },
      getAvailableOperators: function searchBcc_getAvailableOperators(scope) {
        if (!_isLocalSearch(scope))
        {
          return [];
        }
        return [Contains, DoesntContain, Is, Isnt, IsEmpty, IsntEmpty,
                BeginsWith, EndsWith];
      },
      match: function searchBcc_match(aMsgHdr, aSearchValue, aSearchOp) {
        let bccList = aMsgHdr.bccList;
        if (aSearchOp == IsEmpty)
          return (bccList.length == 0);
        if (aSearchOp == IsntEmpty)
          return (bccList.length != 0);

        let addresses = {}, names = {}, fullAddresses = {};
        headerParser.parseHeadersWithArray(bccList, addresses,
                                           names, fullAddresses);
        names = names.value;
        addresses = addresses.value;
        let matches = false;
        for (let i = 0; i < names.length; i++) {
          if (matches) {
            switch (aSearchOp) {
              case Contains:
              case Is:
              case BeginsWith:
              case EndsWith:
                return true;
              case DoesntContain:
              case Isnt:
                return false;
              default:
                Cu.reportError("invalid search operator in bcc custom search term");
            }
          }

          switch (aSearchOp) {
            case Contains:
            case DoesntContain:
              if (names[i].indexOf(aSearchValue) != -1) {
                matches = true;
                break;
              }
              if (addresses[i].indexOf(aSearchValue) != -1)
                matches = true;
              break;

            case Is:
            case Isnt:
              if (names[i] == aSearchValue) {
                matches = true;
                break;
              }
              if (addresses[i] == aSearchValue)
                matches = true;
              break;

            case BeginsWith:
              if (names[i].indexOf(aSearchValue) == 0) {
                matches = true;
                break;
              }
              if (addresses[i].indexOf(aSearchValue) == 0)
                matches = true;
              break;

            case EndsWith:
              let index = names[i].lastIndexOf(aSearchValue);
              if (index != -1 && index == (names[i].length - aSearchValue.length)) {
                matches = true;
                break;
              }
              index = addresses[i].lastIndexOf(aSearchValue);
              if (index != -1 && index == (addresses[i].length - aSearchValue.length))
                matches = true;
              break;

              default:
                Cu.reportError("invalid search operator in bcc custom search term");
          }
        }
        if (aSearchOp == DoesntContain || aSearchOp == Isnt)
          return !matches;
        return matches;
      },
    },

    // search subject with regular expression
    self.subjectRegex =
    {
      id: "filtaquilla@mesquilla.com#subjectRegex",
      name: util.getBundleString("fq.subjectRegex"),
      getEnabled: function subjectRegEx_getEnabled(scope, op) {
        return _isLocalSearch(scope);
      },
      needsBody: false,
      getAvailable: function subjectRegEx_getAvailable(scope, op) {
        return _isLocalSearch(scope) && SubjectRegexEnabled;
      },
      getAvailableOperators: function subjectRegEx_getAvailableOperators(scope) {
        try {
          if (!_isLocalSearch(scope))
          {
            return [];
          }
        }
        catch(ex) {
          console.logException(ex);
        }
        finally {
          return [Matches, DoesntMatch];
        }
      },
      match: function subjectRegEx_match(aMsgHdr, aSearchValue, aSearchOp) {
        let searchValue, searchFlags;
        [searchValue, searchFlags] = _getRegEx(aSearchValue);
        let subjectRegexCallback = new regexUtil.RegexCallback(RegExp(searchValue, searchFlags));
        subjectRegexCallback.handleSubject(aMsgHdr);

        util.logDebug(_getRegEx(aSearchValue));
        util.logDebug(RegExp(_getRegEx(aSearchValue)));
        switch (aSearchOp){
          case Matches:
            return subjectRegexCallback.foundSubject;
          case DoesntMatch:
            return !subjectRegexCallback.foundSubject;
        }
      },
    };

   // local object used for callback
    function ReadAttachmentCallback(matchRegex) {
      this.regex = matchRegex;
      this.found = false;
			this.processed = false;
      this.msgURI = null;
      this.attachments = null;
    }

    ReadAttachmentCallback.prototype = {
      callback: function readAttachmentCallback_callback(aMsgHdr, aMimeMessage) {
				debugger;
				if (aMimeMessage==null) { // failure parsing during MsgHdrToMimeMessage
					this.processed = true;
					return;
				}
				try {
					this.msgURI = aMsgHdr.folder.generateMessageURI(aMsgHdr.messageKey);
					this.attachments = aMimeMessage.allAttachments;
					let messenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
					{
						if (this.attachments.length > 0) {
							let msgURIs = [],
							    contentTypes = [],
							    urls = [],
							    displayNames = [];
                  
							for (let j = 0; j < this.attachments.length; j++) {
								let attachment = this.attachments[j];
								msgURIs.push(this.msgURI);
								contentTypes.push(attachment.contentType);
								urls.push(attachment.url);
								displayNames.push(attachment.name);
								if (this.regex.test(attachment.name)) {
									this.found = true;
									break;
								}
							}
							// messenger.detachAttachmentsWOPrompts(this.directory, this.attachments.length, contentTypes, urls, displayNames, msgURIs, null);
						}
						else
							this.found = false;
						this.processed = true;
					}
				} catch(ex) {
					Services.console.logStringMessage("readAttachmentCallback_callback failed: " + ex.toString());
					this.processed = true;
				}
      }
    },
    // end read Attachment

		// search attachment names with regular expression
		self.attachmentRegex =
		{
      id: "filtaquilla@mesquilla.com#attachmentRegex",
      name: util.getBundleString("fq.attachmentRegex"),
      getEnabled: function attachRegEx_getEnabled(scope, op) {
        return _isLocalSearch(scope);
      },
      getAvailable: function attachRegEx_getAvailable(scope, op) {
        return _isLocalSearch(scope) && AttachmentRegexEnabled;
      },
      getAvailableOperators: function attachRegEx_getAvailableOperators(scope) {
        if (!_isLocalSearch(scope))
        {
          return [];
        }
        return [Matches, DoesntMatch];
      },
      match: function attachRegEx_match(aMsgHdr, aSearchValue, aSearchOp) {
				// attach Regexp
        // var subject = aMsgHdr.mime2DecodedSubject;
        let searchValue, searchFlags,
				    isMatched = false;
				//
        [searchValue, searchFlags] = _getRegEx(aSearchValue);

				if (!aMsgHdr.folder.msgDatabase.HasAttachments(aMsgHdr.messageKey))  {
					switch (aSearchOp) {
						case Matches: return false;
						case DoesntMatch: return true; // or false? no attachment means we cannot really say...
					}
				}
				debugger;

				let hdr = aMsgHdr.QueryInterface(Ci.nsIMsgDBHdr),
				    callbackObject = new ReadAttachmentCallback(new RegExp(searchValue));
				// message must be available offline!
				try {
					self._mimeMsg.MsgHdrToMimeMessage(hdr, callbackObject, callbackObject.callback, false /* allowDownload */);

					// we need a listener for "processed" flag. is match called synchronously though?
					/*
					while (!callbackObject.processed) {
						// we need to yield ...
					}
					*/
					if (!callbackObject.processed)
						alert("sorry, we cannot read attachments without streaming the message asynchronously - the filter mechanims in Tb is still synchronous, so it won't allow me to do this.");
					isMatched = callbackObject.found;
					switch (aSearchOp) {
						case Matches: return isMatched;
						case DoesntMatch: return !isMatched;
					}
				}
				catch (ex) {
					Services.console.logStringMessage("could not attachRegEx_match" + ex.toString());
				}
      },
      needsBody: true,
		};

    self.headerRegex =
    {
      id: "filtaquilla@mesquilla.com#headerRegex",
      name: util.getBundleString("fq.hdrRegex"),
      getEnabled: function headerRegEx_getEnabled(scope, op) {
        return _isLocalSearch(scope);
      },
      needsBody: false,
      getAvailable: function headerRegEx_getAvailable(scope, op) {
        return _isLocalSearch(scope) && HeaderRegexEnabled;
      },
      getAvailableOperators: function headerRegEx_getAvailableOperators(scope) {
        if (!_isLocalSearch(scope))
        {
          return [];
        }
        return [Matches, DoesntMatch];
      },
      match: function headerRegEx_match(aMsgHdr, aSearchValue, aSearchOp) {
        // the header and its regex are separated by a ':' in aSearchValue
        let colonIndex = aSearchValue.indexOf(':');
        if (colonIndex == -1) // not found, default to does not match
          return aSearchOp != Matches;
        let headerName = aSearchValue.slice(0, colonIndex),
            regex = aSearchValue.slice(colonIndex + 1);
        let searchValue, searchFlags;
        [searchValue, searchFlags] = _getRegEx(regex);

        var headerValue = aMsgHdr.getStringProperty(headerName);
        switch (aSearchOp) {
          case Matches:
            return RegExp(searchValue, searchFlags).test(headerValue);
          case DoesntMatch:
            return !RegExp(searchValue, searchFlags).test(headerValue);
        }
      }
    };
    

    function ReadBodyCallback(matchRegex) {
      regexUtil.RegexCallback.apply(this, arguments);
      this.callback = regexUtil.RegexCallback.prototype.parseBody;
      this.found = function found(){
        return this.foundBody;
      }
    }

    ReadBodyCallback.prototype = regexUtil.RegexCallback.prototype;
    ReadBodyCallback.prototype.constructor = ReadBodyCallback;

    self.bodyRegex =
    {
      id: "filtaquilla@mesquilla.com#bodyRegex",
      name: util.getBundleString("fq.bodyRegex"),
      getEnabled: function bodyRegEx_getEnabled(scope, op) {
        return _isLocalSearch(scope);
      },
      needsBody: true,
      getAvailable: function bodyRegEx_getAvailable(scope, op) {
        return _isLocalSearch(scope) && BodyRegexEnabled;
      },
      getAvailableOperators: function bodyRegEx_getAvailableOperators(scope) {
        if (!_isLocalSearch(scope))
        {
          return [];
        }
        return [Matches, DoesntMatch];
      },
      match: function bodyRegEx_match(aMsgHdr, aSearchValue, aSearchOp) {
        
        var mimeConvert = Cc["@mozilla.org/messenger/mimeconverter;1"].getService(Ci.nsIMimeConverter),
        decodedMessageId =  mimeConvert.decodeMimeHeader(aMsgHdr.messageId, null, false, true);
       
        debugger;

        let [searchValue, searchFlags] = _getRegEx(aSearchValue);
            
        util.logDebug("aSearchOp: "+ (aSearchOp == Matches)+ "; searchValue: "+searchValue+"; searchFlags: "+searchFlags+(regexShowAlertSuccessValueEnabled ? "a" : ""));
				
				let callbackObject = new ReadBodyCallback(new RegExp(searchValue, searchFlags));
				    callbackObject.alert = regexShowAlertSuccessValueEnabled;
				    
				// message must be available offline!
				let isMatched = false;
        callbackObject.parseBody_new(aMsgHdr);
        isMatched = callbackObject.found();
        //first try a new solution -> undecodeable garbage

        if(IsMatched(aSearchOp, isMatched)){
				 	//console.log("found_new: ", callbackObject);
           if(callbackObject.alert){
             triggerAlertControl(callbackObject.body, decodedMessageId);
           }
           return true;
         }
				
         util.logDebug("!found: "+ callbackObject);
        
        return false;//not matched or failed
      }
    };

    /**
     * Normalize match status. 
     * 
     * @param {*} aSearchOp 
     * @param {*} isMatched 
     * @returns 
     */
    function IsMatched(aSearchOp, isMatched){
      if(((aSearchOp == Matches) && isMatched) || ((aSearchOp == DoesntMatch) && !isMatched)){
        return true;
      }
      return false;
    }

    self.subjectBodyRegex =
        {
      id: "filtaquilla@mesquilla.com#subjectBodyRegex",
      name: util.getBundleString("fq.subjectBodyRegex"),
      getEnabled: function subjectBodyRegex_getEnabled(scope, op) {
        return _isLocalSearch(scope);
      },
      needsBody: true,
      getAvailable: function subjectBodyRegex_getAvailable(scope, op) {
        return _isLocalSearch(scope) && SubjectBodyRegexEnabled;
      },
      getAvailableOperators: function subjectBodyRegex_getAvailableOperators(scope) {
        if (!_isLocalSearch(scope)){  return [];  }
        return [Matches, DoesntMatch];
      },
      match: function subjectBodyRegex_match(aMsgHdr, aSearchValue, aSearchOp) {
        debugger;
        let isMatched = false;

        var mimeConvert = Cc["@mozilla.org/messenger/mimeconverter;1"].getService(Ci.nsIMimeConverter),
          decodedMessageId =  mimeConvert.decodeMimeHeader(aMsgHdr.messageId, null, false, true);
        var subject = aMsgHdr.mime2DecodedSubject;

        let searchValue, searchFlags;
        [searchValue, searchFlags] = _getRegEx(aSearchValue);
              
        let subjectRegexCallback = new regexUtil.RegexCallback(RegExp(searchValue, searchFlags));
          subjectRegexCallback.alert = regexShowAlertSuccessValueEnabled;
          subjectRegexCallback.handleSubject(aMsgHdr);

        isMatched = subjectRegexCallback.foundSubject;

        if(IsMatched(aSearchOp, isMatched)){
          if(subjectRegexCallback.alert){
            triggerAlertControl(subject, decodedMessageId);
          }
          return true;
        }
        
				let  callbackObject = new ReadBodyCallback("");
          callbackObject.regex = subjectRegexCallback.regex;
          callbackObject.alert = subjectRegexCallback.alert;

        callbackObject.parseBody_new(aMsgHdr);
        isMatched = callbackObject.found();

        if(IsMatched(aSearchOp, isMatched)){
           if(callbackObject.alert){
             triggerAlertControl(callbackObject.body, decodedMessageId);
           }
           return true;
         }
				
         util.logDebug("!found: "+ callbackObject);
        
        return false;//not matched or failed
      }
    };
    
    function triggerAlertControl(msgBody, messageId) {
       let msg = msgBody+"\n"+messageId;
       var retVal = confirm(msg);
       //var notification = new Notification("", {body: msg});
					  //setTimeout(function() {notification.close()}, 1000);
					  
       regexShowAlertSuccessValueEnabled = false;
       /*if( retVal == true ) {
          //do nothing
       } else {
          //#todo delete message
       }*/
    }

    // search using arbitrary javascript
    self.javascript =
    {
      id: "filtaquilla@mesquilla.com#javascript",
      name: util.getBundleString("fq.javascript"),
      getEnabled: function javascript_getEnabled(scope, op) {
        return true;
      },
      needsBody: false,
      getAvailable: function javascript_getAvailable(scope, op) {
        return JavascriptEnabled;
      },
      getAvailableOperators: function javascript_getAvailableOperators(scope) {
        return [Matches, DoesntMatch];
      },
      match: function javascript_match(message, aSearchValue, aSearchOp) {
        // the javascript stored in aSearchValue should use "message" to
        // reference the nsIMsgDBHdr objst for the message
        switch (aSearchOp)
        {
          case Matches:
            return eval(aSearchValue);
          case DoesntMatch:
            return !eval(aSearchValue);
        }
      }
    };

    self.threadHeadTag =
    {
      id: "filtaquilla@mesquilla.com#threadheadtag",
      name: util.getBundleString("fq.threadHeadTag"),
      getEnabled: function threadHeadTag_getEnabled(scope, op) {
        return true;
      },
      needsBody: false,
      getAvailable: function threadHeadTag_getAvailable(scope, op) {
        return ThreadHeadTagEnabled;
      },
      getAvailableOperators: function threadHeadTag_getAvailableOperators(scope) {
        return [Is, Isnt, Contains, DoesntContain, IsEmpty, IsntEmpty];
      },
      match: function threadHeadTag_matches(message, aSearchValue, aSearchOp) {
        let thread = null;
        let rootHdr = null;
        try {
          thread = message.folder.msgDatabase.GetThreadContainingMsgHdr(message);
          rootHdr = thread.getChildHdrAt(0);
        } catch (e) {
          rootHdr = message;
        }

        let msgKeyArray = _getTagArray(rootHdr);

        // -- Now try to match the search term

        // special-case empty for performance reasons
        if (msgKeyArray.length == 0)
          return aSearchOp == DoesntContain ||
                 aSearchOp == Isnt || aSearchOp == IsEmpty;
        else if (aSearchOp == IsEmpty)
          return false;
        else if (aSearchOp == IsntEmpty)
          return true;

        // loop through all message keywords
        let matches = false;
        for (let i = 0; i < msgKeyArray.length; i++) {
          let isValue = (aSearchValue == msgKeyArray[i]);
          switch (aSearchOp) {
            case Is:
              return isValue && msgKeyArray.length == 1;
            case Isnt:
              return !(isValue && msgKeyArray.length == 1);
            case Contains:
              if (isValue)
                return true;
              break;
            case DoesntContain:
              if (isValue)
                return false;
              break;
          }
        }
        // We got through a non-empty list with no match. Only Contains and
        // DoesntContain can do this.
        return (aSearchOp == DoesntContain);
      },
    };

    self.threadAnyTag =
    {
      id: "filtaquilla@mesquilla.com#threadanytag",
      name: util.getBundleString("fq.threadAnyTag"),
      getEnabled: function threadAnyTag_getEnabled(scope, op) {
        return true;
      },
      needsBody: false,
      getAvailable: function threadAnyTag_getAvailable(scope, op) {
        return ThreadAnyTagEnabled;
      },
      getAvailableOperators: function threadAnyTag_getAvailableOperators(scope) {
        return [Contains, DoesntContain, IsntEmpty];
      },
      match: function threadAnyTag_matches(message, aSearchValue, aSearchOp) {
        let tagArray = tagService.getAllTags({}),
            tagKeys = {};
        for (let tagInfo of tagArray) {
          if (tagInfo.tag)
            tagKeys[tagInfo.key] = true;
				}

        let thread = message.folder.msgDatabase.GetThreadContainingMsgHdr(message),
            // we limit the number of thread items that we look at, but we always look at the thread root
            threadCount = Math.min(thread.numChildren, maxThreadScan),
            myKey = message.messageKey,
            threadStart = 0;
            
        if (threadCount < thread.numChildren) {
          // find this message in the thread, and use that as the center of the search
          let threadIndex = 0;
          for (; threadIndex < thread.numChildren; threadIndex++) {
            if (myKey == thread.getChildKeyAt(threadIndex))
              break;
          }
          threadStart = threadIndex - maxThreadScan / 2;
          if (threadStart + threadCount > thread.numChildren)
            threadStart = thread.numChildren - threadCount;
          if (threadStart < 0)
            threadStart = 0;
        }

        for (let index = 0; index < threadCount; index++) {
          // always examine the thread head
          let useIndex = (index == 0) ? 0 : threadStart + index,
              hdr = thread.getChildHdrAt(useIndex); // was getChildAt
          //  -- Get and cleanup the list of message headers following code from
          //  -- msgHdrViewOverlay.js SetTagHeader()

          // extract the tag keys from the msgHdr
          let msgKeyArray = hdr.getStringProperty("keywords").split(" "),
              // attach legacy label to the front if not already there
              label = hdr.label;
          if (label) {
            let labelKey = "$label" + label;
            if (msgKeyArray.indexOf(labelKey) < 0)
              msgKeyArray.unshift(labelKey);
          }

          // Rebuild the keywords string with just the keys that are actual tags or
          // legacy labels and not other keywords like Junk and NonJunk.
          // Retain their order, though, with the label as oldest element.
          for (let i = msgKeyArray.length - 1; i >= 0; --i) {
            if (!(msgKeyArray[i] in tagKeys))
              msgKeyArray.splice(i, 1); // remove non-tag key
          }

          // -- Now try to match the search term

          // special-case empty for performance reasons
          if (msgKeyArray.length == 0)
            continue;

          // there is at least one tag
          if (aSearchOp == IsntEmpty)
            return true;

          // loop through all message keywords
          for (let i = 0; i < msgKeyArray.length; i++) {
            if (aSearchValue == msgKeyArray[i]) {
              if (aSearchOp == Contains)
                return true;
              if (aSearchOp == DoesntContain)
                return false;
            }
          }
        }
        // We got through all messages with no match.
        return (aSearchOp == DoesntContain);
      },
    };

    
    Components.utils.import("resource://filtaquilla/ToneQuillaPlay.jsm");
    ToneQuillaPlay.init();
    ToneQuillaPlay.window = window;
    let tonequilla_name = util.getBundleString("filtaquilla.playSound");
    self.playSound = 
    {
        id: "tonequilla@mesquilla.com#playSound",
        name: tonequilla_name, 
        applyAction: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
        {
          util.logDebug("ToneQuillaPlay.queueToPlay", aActionValue);
          ToneQuillaPlay.queueToPlay(aActionValue);
        },
        apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
        {
          this.applyAction(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow);
        },

        isValidForType: function(type, scope) {return tonequillaEnabled;},

        validateActionValue: function(value, folder, type) { return null;},

        allowDuplicates: true
    }
    

 };
 
 
  self.setOptions = function () {
    // enable features from acbout:config    
    const prefserv = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService),
          prefs = prefserv.getBranch("extensions.filtaquilla.");

    // 1. Enable Actions      
    try {
      maxThreadScan = prefs.getIntPref("maxthreadscan");
    } catch (e) { maxThreadScan = 20;}

    try {
      subjectAppendEnabled = prefs.getBoolPref("subjectAppend.enabled");
    } catch (e) {}

    try {
      subjectSuffixEnabled = prefs.getBoolPref("subjectSuffix.enabled");
    } catch (e) {}

    try {
      removeKeywordEnabled = prefs.getBoolPref("removeKeyword.enabled");
    } catch (e) {}

    try {
      removeFlaggedEnabled = prefs.getBoolPref("removeFlagged.enabled");
    } catch (e) {}

    try {
      markUnreadEnabled = prefs.getBoolPref("markUnread.enabled");
    } catch (e) {}

    try {
      markRepliedEnabled = prefs.getBoolPref("markReplied.enabled");
    } catch (e) {}

    try {
      noBiffEnabled = prefs.getBoolPref("noBiff.enabled");
    } catch (e) {}

    try {
      copyAsReadEnabled = prefs.getBoolPref("copyAsRead.enabled");
    } catch (e) {}

    try {
      launchFileEnabled = prefs.getBoolPref("launchFile.enabled");
    } catch (e) {}

    try {
      runFileEnabled = prefs.getBoolPref("runFile.enabled");
    } catch (e) {}

    try {
      trainAsJunkEnabled = prefs.getBoolPref("trainAsJunk.enabled");
    } catch (e) {}

    try {
      trainAsGoodEnabled = prefs.getBoolPref("trainAsGood.enabled");
    } catch (e) {}

    try {
      printEnabled = prefs.getBoolPref("print.enabled");
    } catch (e) {}

    try {
      addSenderEnabled = prefs.getBoolPref("addSender.enabled");
    } catch (e) {}

    try {
      saveAttachmentEnabled = prefs.getBoolPref("saveAttachment.enabled");
    } catch (e) {}

    try {
      detachAttachmentsEnabled = prefs.getBoolPref("detachAttachments.enabled");
    } catch (e) {}

    try {
      javascriptActionEnabled = prefs.getBoolPref("javascriptAction.enabled");
    } catch (e) {}

    try {
      javascriptActionBodyEnabled = prefs.getBoolPref("javascriptActionBody.enabled");
    } catch (e) {}
    
    try {
      regexpCaseInsensitiveEnabled = prefs.getBoolPref("regexpCaseInsensitive.enabled");
    } catch (e) {}
       
    try {
      tonequillaEnabled = prefs.getBoolPref("tonequilla.enabled");
    } catch (e) {}

    try {
      saveMessageAsFileEnabled = prefs.getBoolPref("saveMessageAsFile.enabled");
    } catch (e) {}

    try {
      moveLaterEnabled = prefs.getBoolPref("moveLater.enabled");
    } catch(e) {}
    
    // 2. Enable conditions
    try {
      SubjectRegexEnabled = prefs.getBoolPref("SubjectRegexEnabled");
    } catch(e) {}

    try {
      HeaderRegexEnabled = prefs.getBoolPref("HeaderRegexEnabled");
    } catch(e) {}
    
    try {
      JavascriptEnabled = prefs.getBoolPref("JavascriptEnabled");
    } catch(e) {}
    
    try {
      SearchBccEnabled = prefs.getBoolPref("SearchBccEnabled");
    } catch(e) {}
    try {
      ThreadHeadTagEnabled = prefs.getBoolPref("ThreadHeadTagEnabled");
    } catch(e) {}
    try {
      ThreadAnyTagEnabled = prefs.getBoolPref("ThreadAnyTagEnabled");
    } catch(e) {}

    try {
      FolderNameEnabled = prefs.getBoolPref("FolderNameEnabled");
    } catch(e) {}
    
		try {
			AttachmentRegexEnabled = prefs.getBoolPref("AttachmentRegexEnabled");
		} catch(e) {}
 
		try {
			BodyRegexEnabled = prefs.getBoolPref("BodyRegexEnabled");
		} catch(e) {}

    try {
			SubjectBodyRegexEnabled = prefs.getBoolPref("SubjectBodyRegexEnabled");
		} catch(e) {}
  }

  // extension initialization
  self.onLoad = function() {
    if (self.initialized)
      return;
      
    try {
      let isCorrectWindow =
        (document && document.getElementById('messengerWindow') &&
         document.getElementById('messengerWindow').getAttribute('windowtype') === "mail:3pane");
      if (isCorrectWindow) {
        util.VersionProxy(window); 
      }
    }
    catch (ex) { 
      util.logDebug("calling VersionProxy failed\n" + ex.message); 
    }
      
    self._init();
    
    self.setOptions();


    var filterService = Cc["@mozilla.org/messenger/services/filters;1"]
                        .getService(Ci.nsIMsgFilterService);
    filterService.addCustomAction(self.subjectAppend);
    filterService.addCustomAction(self.subjectSuffix);
    filterService.addCustomAction(self.removeKeyword);
    filterService.addCustomAction(self.removeFlagged);
    filterService.addCustomAction(self.noBiff);
    filterService.addCustomAction(self.markUnread);
    filterService.addCustomAction(self.markReplied);
    filterService.addCustomAction(self.copyAsRead);
    filterService.addCustomAction(self.launchFile);
    filterService.addCustomAction(self.runFile);
    filterService.addCustomAction(self.trainAsJunk);
    filterService.addCustomAction(self.trainAsGood);
    filterService.addCustomAction(self.print);
    filterService.addCustomAction(self.addSender);
    filterService.addCustomAction(self.saveAttachment);
    filterService.addCustomAction(self.detachAttachments);
    filterService.addCustomAction(self.javascriptAction);
    filterService.addCustomAction(self.javascriptActionBody);
    filterService.addCustomAction(self.saveMessageAsFile);
    filterService.addCustomAction(self.moveLater);
    filterService.addCustomAction(self.playSound);

    // search terms 
    filterService.addCustomTerm(self.subjectRegex);
    filterService.addCustomTerm(self.headerRegex);
    filterService.addCustomTerm(self.bodyRegex);
    filterService.addCustomTerm(self.subjectBodyRegex);
    
    filterService.addCustomTerm(self.javascript);
    filterService.addCustomTerm(self.searchBcc);
    filterService.addCustomTerm(self.threadHeadTag);
    filterService.addCustomTerm(self.threadAnyTag);
    filterService.addCustomTerm(self.folderName);

		if (AttachmentRegexEnabled) {
			debugger;
			filterService.addCustomTerm(self.attachmentRegex);
		}


    // Inherited properties setup
    // standard format for inherited property rows
    //   defaultValue:  value if inherited property missing (boolean true or false)
    //   name:          localized display name
    //   property:      inherited property name
    InheritedPropertiesGrid.addPropertyObject(applyIncomingFilters);

    self.initialized = true;
  };

  // local private functions
  // constructor for the MoveLaterNotify object
  function MoveLaterNotify(aMessages, aSource, aDestination, aTimerIndex)  {
    // thunderbird 78 tidies up the aMessages array during apply, so we need to make a copy:
    this.messages = [];
    // clone the messages array
    for (let i=0; i<aMessages.length; i++) {
      this.messages.push(aMessages[i]);
    }
    this.source = aSource;
    this.destination = aDestination;
    this.timerIndex = aTimerIndex;
    this.recallCount = MOVE_LATER_LIMIT;
  }

  MoveLaterNotify.prototype.notify = function notify(aTimer) {
    // Check the moveLater values for the headers. If this is set by a routine
    //  with a reliable finish listener, then we will wait until that is done to
    //  move. For others, we move on the first callback after the delay.
    const isMove = true, allowUndo = false;
    let moveLaterCount = -1;
    this.recallCount--;
    for (let i = 0; i < this.messages.length; i++) {
      let msgHdr = this.messages[i];
      try {
        let localCount = msgHdr.getUint32Property("moveLaterCount");
        if (localCount > moveLaterCount)
          moveLaterCount = localCount;
      } catch(e) {}
    }
    if ( (moveLaterCount <= 0) || (this.recallCount <= 0)) { // execute move    
      const copyService = MailServices.copy  // Tb91
            || Cc["@mozilla.org/messenger/messagecopyservice;1"].getService(Ci.nsIMsgCopyService);
      copyService.CopyMessages(this.source, 
                               this.messages,
                               this.destination, 
                               isMove,
                               null, 
                               null, 
                               allowUndo);
      moveLaterTimers[this.timerIndex] = null;
      this.messages.clear(); // release all objects, just in case.
    }
    else // reschedule another check
      moveLaterTimers[this.timerIndex].initWithCallback(this, MOVE_LATER_DELAY, Ci.nsITimer.TYPE_ONE_SHOT);
  }

  // is this search scope local, and therefore valid for db-based terms?
  function _isLocalSearch(aSearchScope) {
    switch (aSearchScope) {
      case Ci.nsMsgSearchScope.offlineMail:
      case Ci.nsMsgSearchScope.offlineMailFilter:
      case Ci.nsMsgSearchScope.onlineMailFilter:
      case Ci.nsMsgSearchScope.localNews:
        return true;
      default:
        return false;
    }
  }

  //  take the text utf8Append and either prepend (direction == true)
  //    or suffix (direction == false) to the subject
  function _mimeAppend(utf8Append, subject, direction) {
    // append a UTF8 string to a mime-encoded subject
    var mimeConvert = Cc["@mozilla.org/messenger/mimeconverter;1"].getService(Ci.nsIMimeConverter),
        decodedSubject =  mimeConvert.decodeMimeHeader(subject, null, false, true);

    appendedSubject = direction ? 
                      utf8Append + decodedSubject :
                      decodedSubject + utf8Append;
    recodedSubject = mimeConvert.encodeMimePartIIStr_UTF8(appendedSubject, false, "UTF-8", 0, 72);
    return recodedSubject;
  }

  function _replaceParameters(hdr, parameter) {
    // replace ambersand-delimited fields in a parameter
    if (/@SUBJECT@/.test(parameter))
      return parameter.replace(/@SUBJECT@/, hdr.mime2DecodedSubject);
    if (/@AUTHOR@/.test(parameter))
      return parameter.replace(/@AUTHOR@/, hdr.mime2DecodedAuthor);
    if (/@MESSAGEID@/.test(parameter))
      return parameter.replace(/@MESSAGEID@/, hdr.messageId);
    if (/@DATE@/.test(parameter))
      return parameter.replace(/@DATE@/, Date(hdr.date/1000));
    if (/@RECIPIENTS@/.test(parameter))
      return parameter.replace(/@RECIPIENTS@/, hdr.mime2DecodedRecipients);
    if (/@CCLIST@/.test(parameter))
      return parameter.replace(/@CCLIST@/, hdr.ccList);
    if (/@DATEINSECONDS@/.test(parameter))
      return parameter.replace(/@DATEINSECONDS@/, hdr.dateInSeconds);
    if (/@MESSAGEURI@/.test(parameter))
      return parameter.replace(/@MESSAGEURI@/, hdr.folder.generateMessageURI(hdr.messageKey));
    if (/@PROPERTY@.+@/.test(parameter))
    {
      // This is a little different, the actual property (which is typically a
      // custom db header) is stored like @PROPERTY@X-SPAM@
      // You'll need to add the custom db header manually though.
      var matches = /(.*)@PROPERTY@(.+)@(.*)/.exec(parameter);
      if (matches && matches.length == 4) {
        let property = matches[2];
        try {
          var value = hdr.getStringProperty(property.toLowerCase());
          return matches[1] + value + matches[3];
        }
        catch (e) {}
      }
    }
    return parameter;
  }

  // Given an nsIMsgDBHdr object, return an array containing its tag keys
  function _getTagArray(aMsgHdr) {
    //  -- Get and cleanup the list of message headers following code from
    //  -- msgHdrViewOverlay.js SetTagHeader()
    let tagArray = tagService.getAllTags({});
    let tagKeys = {};
    for (let tagInfo of tagArray) {
      if (tagInfo.tag)
        tagKeys[tagInfo.key] = true;
		}

    // extract the tag keys from the msgHdr
    let msgKeyArray = aMsgHdr.getStringProperty("keywords").split(" ");

    // attach legacy label to the front if not already there
    let label = aMsgHdr.label;
    if (label) {
      let labelKey = "$label" + label;
      if (msgKeyArray.indexOf(labelKey) < 0)
        msgKeyArray.unshift(labelKey);
    }

    // Rebuild the keywords string with just the keys that are actual tags or
    // legacy labels and not other keywords like Junk and NonJunk.
    // Retain their order, though, with the label as oldest element.
    for (let i = msgKeyArray.length - 1; i >= 0; --i) {
      if (!(msgKeyArray[i] in tagKeys))
        msgKeyArray.splice(i, 1); // remove non-tag key
    }
    return msgKeyArray;
  }

  var gJunkService;
  function _trainJunkFilter(aIsJunk, aMsgHdrs, aMsgWindow) {
    if (!gJunkService)
      gJunkService = Cc["@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter"]
                      .getService(Ci.nsIJunkMailPlugin);
    for (var i = 0; i < aMsgHdrs.length; i++) {
      hdr = aMsgHdrs[i];
      // get the old classification
      let junkscore = hdr.getStringProperty("junkscore"),
          junkscoreorigin = hdr.getStringProperty("junkscoreorigin"),
          oldClassification = Ci.nsIJunkMailPlugin.UNCLASSIFIED;
      if (junkscoreorigin == "user") {  // which is a proxy for "trained in bayes"
        if (junkscore == "100")
          oldClassification = Ci.nsIJunkMailPlugin.JUNK;
        else if (junkscore == "0")
          oldClassification = Ci.nsIJunkMailPlugin.GOOD;
      }
      let msgURI = hdr.folder.generateMessageURI(hdr.messageKey) + "?fetchCompleteMessage=true",
          newClassification = aIsJunk ? Ci.nsIJunkMailPlugin.JUNK : Ci.nsIJunkMailPlugin.GOOD,
          db = hdr.folder.msgDatabase;
      // Set the message classification and origin
      db.setStringPropertyByHdr(hdr, "junkscore", aIsJunk ? "100" : "0");
      db.setStringPropertyByHdr(hdr, "junkscoreorigin", "user");
      // We had to set origin to "user" so bayes will know to untrain if changed later. This
      // unfortunately will look strange in JunQuilla, so let's add another field that it
      // can use to tell the difference
      db.setStringPropertyByHdr(hdr, "junktrainorigin", "filter");
      if (oldClassification != newClassification)
        gJunkService.setMessageClassification(msgURI, oldClassification,
            newClassification, aMsgWindow, null);
    }

    // For IMAP, we need to set the junk flag
    // We'll assume this is a single folder
    hdr = aMsgHdrs[0];
    var folder = hdr.folder;
    if (folder instanceof Ci.nsIMsgImapMailFolder) {  // need to update IMAP custom flags
      if (aMsgHdrs.length) {
        let msgKeys = new Array();
        for (let i = 0; i < aMsgHdrs.length; i++)
          msgKeys[i] = aMsgHdrs[i].messageKey;
        folder.storeCustomKeywords(null,
          aIsJunk ? "Junk" : "NonJunk",
          aIsJunk ? "NonJunk" : "Junk",
          msgKeys, msgKeys.length);
      }
    }
  }

  function _getRegEx(aSearchValue) {
    /*
     * If there are no flags added, you can add a regex expression without
     * / delimiters. If we detect a / though, we will look for flags and
     * add them to the regex search. See bug m165.
     */
    let searchValue = aSearchValue, searchFlags = "";
    if (aSearchValue.charAt(0) == "/") {
      let lastSlashIndex = aSearchValue.lastIndexOf("/");
      searchValue = aSearchValue.substring(1, lastSlashIndex);
      searchFlags = aSearchValue.substring(lastSlashIndex + 1);
    }

    if(regexpCaseInsensitiveEnabled && !searchFlags.includes("i") && !searchFlags.includes(REGEX_CASE_SENSITIVE_FLAG)){
      searchFlags += "i";
    }

    if(searchFlags.includes(REGEX_SHOW_ALERT_SUCCESS_VALUE)){
      searchFlags = searchFlags.replace(REGEX_SHOW_ALERT_SUCCESS_VALUE,"");
      regexShowAlertSuccessValueEnabled = true;
    }else{
      regexShowAlertSuccessValueEnabled = false;
    }
    
    return [searchValue, searchFlags];
  }

  function _saveAs(aMsgHdr, aDirectory, aType) {
    let msgSpec = aMsgHdr.folder.getUriForMsg(aMsgHdr),
        fileName = _sanitizeName(aMsgHdr.subject),
        file = aDirectory.clone();
    file.append(fileName + "." + aType);
    file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0o600);
    let service = messenger.messageServiceFromURI(msgSpec);
    /*
    void SaveMessageToDisk(in string aMessageURI, in nsIFile aFile,
                           in boolean aGenerateDummyEnvelope,
                           in nsIUrlListener aUrlListener, out nsIURI aURL,
                           in boolean canonicalLineEnding, in nsIMsgWindow aMsgWindow);
    */
    let aURL = {};
    service.SaveMessageToDisk(msgSpec, file, false, _urlListener, aURL, true, null);

  }

  // from http://mxr.mozilla.org/comm-1.9.2/source/mozilla/toolkit/components/search/nsSearchService.js#677
  /**
   * Removes all characters not in the "chars" string from aName.
   *
   * @returns a sanitized name to be used as a filename, or a random name
   *          if a sanitized name cannot be obtained (if aName contains
   *          no valid characters).
   */
  function _sanitizeName(aName) {
    const chars = "-abcdefghijklmnopqrstuvwxyz0123456789",
          maxLength = 60;

    let name = aName.toLowerCase();
    name = name.replace(/ /g, "-");
    name = name.split("").filter(function (el) {
                                   return chars.indexOf(el) != -1;
                                 }).join("");

    if (!name) {
      // Our input had no valid characters - use a random name
      let cl = chars.length - 1;
      for (let i = 0; i < 8; ++i)
        name += chars.charAt(Math.round(Math.random() * cl));
    }

    if (name.length > maxLength)
      name = name.substring(0, maxLength);

    return name;
  }

  var _urlListener = {
    OnStartRunningUrl: function _onStartRunningUrl(aUrl) {},
    OnStopRunningUrl: function _onStopRunningUrl(aUrl, aStatus) {
      let messageUri;
      if (aUrl instanceof Ci.nsIMsgMessageUrl)
        messageUri = aUrl.uri;
      let msgHdr = messenger.msgHdrFromURI(messageUri),
          moveLaterCount = msgHdr.getUint32Property("moveLaterCount");
      if (moveLaterCount)
        msgHdr.setUint32Property("moveLaterCount", moveLaterCount - 1);
    }
  };

  function dl(text) {dump(text + '\n');}

  // actions that need the body can conflict with a move. These should
  //  set the MoveLaterCount to prevent problems, and then use a MoveLater
  //  function instead of a normal move.
  function _incrementMoveLaterCount(msgHdr) {
    let moveLaterCount = 0;
    try {
      moveLaterCount = msgHdr.getUint32Property("moveLaterCount");
    } catch(e) {}
    moveLaterCount++;
    msgHdr.setUint32Property("moveLaterCount", moveLaterCount);
  }

  // use this for instant feedback after configuring through the options window
  let observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
  observerService.addObserver({
    observe: function() {
      self.setOptions();
    }
  },"filtaquilla-options-changed", false);

})();

// moved to filtaquilla-messenger.js
// window.addEventListener("load", function(e) { filtaquilla.onLoad(e); }, false);

// vim: set expandtab tabstop=2 shiftwidth=2:
