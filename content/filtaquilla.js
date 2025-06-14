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
  const { ExtensionParent } = ChromeUtils.importESModule(
    "resource://gre/modules/ExtensionParent.sys.mjs"
  );
  const extension = ExtensionParent.GlobalManager.getExtension("filtaquilla@mesquilla.com");

  var { MailUtils } = ChromeUtils.importESModule("resource:///modules/MailUtils.sys.mjs");
  var { MessageArchiver } = ChromeUtils.importESModule(
    "resource:///modules/MessageArchiver.sys.mjs"
  );

  /*
  // [issue 318] REMOVED

  try {
    var { InheritedPropertiesGrid } = ChromeUtils.importESModule(
      "resource://filtaquilla/inheritedPropertiesGrid.sys.mjs"
    );
  } catch (ex) {
    FiltaQuilla.Util.logException("Importing inheritedPropertiesGrid.sys.mjs failed.", ex);
  }
  */

  Services.scriptloader.loadSubScript("chrome://filtaquilla/content/filtaquilla-util.js"); // FiltaQuilla object

  const Cc = Components.classes,
    Ci = Components.interfaces,
    Cu = Components.utils,
    Cr = Components.results,
    util = FiltaQuilla.Util;

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

  var { MailServices } = ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");

  // javascript mime emitter functions
  // self._mimeMsg = ChromeUtils.importESModule("resource:///modules/gloda/MimeMessage.sys.mjs");
  var { MsgHdrToMimeMessage } = ChromeUtils.importESModule(
    "resource:///modules/gloda/MimeMessage.sys.mjs"
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

  const REGEX_CASE_SENSITIVE_FLAG = "c"; //use this to override global case insensitive flag
  //(js doesnt have that, but tcl does)
  // REGEX_SHOW_ALERT_SUCCESS_VALUE = "a" //use this to trigger dialog box with matched value

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
    runFileUnicode = false,
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
    regexpCaseInsensitiveEnabled = false,
    archiveMessageEnabled = false,
    fwdSmartTemplatesEnabled = false,
    rspSmartTemplatesEnabled = false,
    fileNamesSpaceCharacter = " ";

  // Enabling of search terms.
  let SubjectRegexEnabled = false,
    HeaderRegexEnabled = false,
    JavascriptEnabled = false,
    SearchBccEnabled = false,
    ThreadHeadTagEnabled = false,
    ThreadAnyTagEnabled = false,
    FolderNameEnabled = false,
    BodyRegexEnabled = false,
    SubjectBodyRegexEnabled = false;

  // [#5] AG new condition - attachment name regex
  let AttachmentRegexEnabled = false,
    moveLaterTimers = {}, // references to timers used in moveLater action
    moveLaterIndex = 0; // next index to use to store timers

  let printQueue = [],
    printingMessage = false;

  // inherited property object
  // [issue 318]
  // REMOVED. this was stored in a json object in
  /*
  let applyIncomingFilters = {
    defaultValue: function defaultValue(aFolder) {
      return false;
    },
    name: util.getBundleString("filtaquilla.applyIncomingFilters"),
    accesskey: util.getBundleString("filtaquilla.applyIncomingFilters.accesskey"),
    property: "applyIncomingFilters",
    hidefor: "nntp,none,pop3,rss" // That is, this is only valid for imap.
  };
  */

  self._init = async function () {
    // self.strings = filtaquillaStrings;

    /*
     * custom action implementations
     */

    // prepend to subject. This was called "append" due to an earlier bug
    self.subjectAppend = {
      id: "filtaquilla@mesquilla.com#subjectAppend",
      name: util.getBundleString("fq.subjectprepend"),

      applyAction: function (aMsgHdrs, aActionValue, _aListener, _aType, _aMsgWindow) {
        for (let msgHdr of aMsgHdrs) {
          var appSubject = _mimeAppend(aActionValue, msgHdr.subject, true);
          msgHdr.subject = appSubject;
        }
      },

      isValidForType: function (_type, _scope) {
        return subjectAppendEnabled;
      },

      validateActionValue: function (_value, _folder, _type) {
        return null;
      },

      allowDuplicates: false,
      needsBody: false,
      isAsync: false,
    };

    // Suffix to subject
    self.subjectSuffix = {
      id: "filtaquilla@mesquilla.com#subjectSuffix",
      name: util.getBundleString("fq.subjectappend"),

      applyAction: function (aMsgHdrs, aActionValue, _aListener, _aType, _aMsgWindow) {
        for (let msgHdr of aMsgHdrs) {
          var appSubject = _mimeAppend(aActionValue, msgHdr.subject, false);
          msgHdr.subject = appSubject;
        }
      },

      isValidForType: function (_type, _scope) {
        return subjectSuffixEnabled;
      },

      validateActionValue: function (_value, _folder, _type) {
        return null;
      },

      allowDuplicates: false,
      needsBody: false,
      isAsync: false,
    };

    // remove keyword
    self.removeKeyword = {
      id: "filtaquilla@mesquilla.com#removeTag",
      name: util.getBundleString("fq.removekeyword"),
      applyAction: function (aMsgHdrs, aActionValue, _aListener, _aType, _aMsgWindow) {
        aMsgHdrs[0].folder.removeKeywordsFromMessages(aMsgHdrs, aActionValue);
      },

      isValidForType: function (_type, _scope) {
        return removeKeywordEnabled;
      },
      validateActionValue: function (_value, _folder, _type) {
        return null;
      },
      allowDuplicates: true,
      needsBody: false,
    };

    // remove star
    self.removeFlagged = {
      id: "filtaquilla@mesquilla.com#removeStar",
      name: util.getBundleString("fq.removeflagged"),
      applyAction: function (aMsgHdrs, _aActionValue, _aListener, _aType, _aMsgWindow) {
        aMsgHdrs[0].folder.markMessagesFlagged(aMsgHdrs, false);
      },
      isValidForType: function (_type, _scope) {
        return removeFlaggedEnabled;
      },
      validateActionValue: function (_value, _folder, _type) {
        return null;
      },
    }; // end removeFlagged

    // mark as unread
    self.markUnread = {
      id: "filtaquilla@mesquilla.com#markUnread",
      name: util.getBundleString("fq.markUnread"),
      applyAction: function (aMsgHdrs, _aActionValue, _aListener, _aType, _aMsgWindow) {
        aMsgHdrs[0].folder.markMessagesRead(aMsgHdrs, false);
      },
      isValidForType: function (_type, _scope) {
        return markUnreadEnabled;
      },
      validateActionValue: function (_value, _folder, _type) {
        return null;
      },
    }; // end markUnread

    // mark as replied
    self.markReplied = {
      id: "filtaquilla@mesquilla.com#markReplied",
      name: util.getBundleString("fq.markReplied"),
      applyAction: function (aMsgHdrs, _aActionValue, _aListener, _aType, _aMsgWindow) {
        // what a pain, the folder function does not take an array like all others!
        for (let msgHdr of aMsgHdrs) {
          msgHdr.folder.addMessageDispositionState(
            msgHdr,
            Ci.nsIMsgFolder.nsMsgDispositionState_Replied
          );
        }
      },
      isValidForType: function (_type, _scope) {
        return markRepliedEnabled;
      },
      validateActionValue: function (_value, _folder, _type) {
        return null;
      },
    }; // end markUnread

    // noBiff action
    self.noBiff = {
      id: "filtaquilla@mesquilla.com#noBiff",
      name: util.getBundleString("fq.nobiff"),
      applyAction: function (aMsgHdrs, _aActionValue, _aListener, _aType, _aMsgWindow) {
        let folder = aMsgHdrs[0].folder,
          numNewMessages = folder.getNumNewMessages(false);
        const hdrCount = aMsgHdrs.length;
        numNewMessages = numNewMessages - hdrCount;
        folder.setNumNewMessages(numNewMessages);
      },
      isValidForType: function (_type, _scope) {
        return noBiffEnabled;
      },
      validateActionValue: function (_value, _folder, _type) {
        return null;
      },
    }; // end noBiff

    // copyAsRead action
    (function () {
      self.copyAsRead = {
        id: "filtaquilla@mesquilla.com#copyAsRead",
        name: util.getBundleString("fq.copyAsRead"),
        applyAction: function (aMsgHdrs, aActionValue, aListener, aType, aMsgWindow) {
          _aListener = aListener;
          var srcFolder = aMsgHdrs[0].folder;
          _dstFolder = MailUtils.getExistingFolder(aActionValue, false);
          // store the messages Ids to use post-copy
          _messageIds = [];
          for (let msgHdr of aMsgHdrs) {
            _messageIds.push(msgHdr.messageId); // are these used later?
          }

          MailServices.copy.copyMessages(
            srcFolder,
            aMsgHdrs,
            _dstFolder,
            false /*isMove*/,
            _localListener,
            aMsgWindow,
            false /*allowUndo*/
          );
        },

        isValidForType: function (type, _scope) {
          return type == Ci.nsMsgFilterType.Manual && copyAsReadEnabled;
        },
        validateActionValue: function (aActionValue, _aFilterFolder, _type) {
          const msgFolder = MailUtils.getExistingFolder(aActionValue, false);
          if (!msgFolder || !msgFolder.canFileMessages) {
            return util.getBundleString("fq.filtaquilla.mustSelectFolder");
          }
          return null;
        },
        allowDuplicates: true,
        needsBody: false,
        isAsync: true,
      };

      // local variables and methods
      var _messageIds = null,
        _dstFolder = null,
        _aListener = null;

      var _localListener = {
        OnStartCopy: function () {
          if (_aListener) {_aListener.OnStartCopy();}
        },
        OnProgress: function (aProgress, aProgressMax) {
          if (_aListener) {_aListener.OnProgress(aProgress, aProgressMax);}
        },
        SetMessageKey: function (aKey) {
          if (_aListener) {_aListener.SetMessageKey(aKey);}
        },
        SetMessageId: function (aMessageId) {
          if (_aListener) {_aListener.SetMessageId(aMessageId);}
        },
        OnStopCopy: function (aStatus) {
          // local folders can be set unread now. Imap folders must be loaded
          if (_dstFolder.URI.substr(0, 4) == "imap") {
            var mailSession = Cc["@mozilla.org/messenger/services/session;1"].getService(
              Ci.nsIMsgMailSession
            );
            mailSession.AddFolderListener(_folderListener, Ci.nsIFolderListener.event);
            _dstFolder.updateFolder(null);
          } else {
            _setRead(aStatus);
          }
        },
      };

      var _setRead = function (aStatus) {
        var dstMessages = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
        var dstDb = _dstFolder.msgDatabase;
        for (var i = 0; i < _messageIds.length; i++) {
          var hdr = dstDb.getMsgHdrForMessageID(_messageIds[i]);
          if (hdr) {dstMessages.appendElement(dstDb.getMsgHdrForMessageID(_messageIds[i]), false);}
          else {
            throw (
              "Couldn't find messageId <" + _messageIds[i] + "> in Copy as Unread custom action"
            );
          }
        }

        _dstFolder.markMessagesRead(dstMessages, true);
        _dstFolder = null;
        _messageIds = null;
        if (_aListener) {_aListener.OnStopCopy(aStatus);}
      };

      var _folderListener = {
        OnItemAdded: function (_parentItem, _item) {},
        OnItemRemoved: function (_parentItem, _item) {},
        OnItemPropertyChanged: function (_item, _property, _oldValue, _newValue) {},
        OnItemIntPropertyChanged: function (_item, _property, _oldValue, _newValue) {},
        OnItemBoolPropertyChanged: function (_item, _property, _oldValue, _newValue) {},
        OnItemUnicharPropertyChanged: function (_item, _property, _oldValue, _newValue) {},
        OnItemPropertyFlagChanged: function (_item, _property, _oldFlag, _newFlag) {},
        OnItemEvent: function (folder, event) {
          var eventType = event.toString();

          if (eventType == "FolderLoaded") {
            if (_dstFolder && folder && folder.URI == _dstFolder.URI) {
              var mailSession = Cc["@mozilla.org/messenger/services/session;1"].getService(
                Ci.nsIMsgMailSession
              );
              mailSession.RemoveFolderListener(_folderListener);
              _setRead(null);
            }
          }
        },
      };
    })(); // end copyAsRead

    // launch file
    self.launchFile = {
      id: "filtaquilla@mesquilla.com#launchFile",
      name: util.getBundleString("fq.launchFile"),
      applyAction: function (aMsgHdrs, aActionValue, _aListener, _aType, _aMsgWindow) {
        var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
        file.initWithPath(aActionValue);
        file.launch();
      },

      isValidForType: function (_type, _scope) {
        return launchFileEnabled;
      },
      validateActionValue: function (_value, _folder, _type) {
        return null;
      },
      allowDuplicates: true,
      needsBody: false,
    }; // end launchFile

    // run file
    self.runFile = {
      id: "filtaquilla@mesquilla.com#runFile",
      name: util.getBundleString("fq.runFile"),
      applyAction: function (aMsgHdrs, aActionValue, _aListener, _aType, _aMsgWindow) {
        var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
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

        // TO DO: add @BODY@ support [issue 41]

        /**
         * Convert a UTF8 string to UTF16.
         * @param {String} input
         * @returns {String}
         */
        function utf8To16(input) {
          var _escape = function (s) {
            function q(c) {
              const code = c.charCodeAt();
              // return "%" + (c < 16 ? "0" : "") + code.toString(16).toUpperCase();
              return "%" + (code < 16 ? "0" : "") + code.toString(16).toUpperCase();
            }
            // Escape control and non-ASCII characters
            // eslint-disable-next-line no-control-regex
            return s.replace(/[\u0000-\u001F\u007F-\u00FF]/g, q);
            /* return s.replace(/[\x00-),:-?[-^`{-\xFF]/g, q); */
          };
          try {
            return decodeURIComponent(_escape(input));
          // eslint-disable-next-line no-unused-vars
          } catch (URIError) {
            //include invalid character, cannot convert
            return input;
          }
        }

        let args = aActionValue.split(","),
          fileURL = args[0],
          isUnicode = runFileUnicode;

        if (args.includes("@UTF16@")) {
          isUnicode = true;
          args = args.filter((f) => f != "@UTF16@");
        } else if (args.includes("@UTF8@")) {
          isUnicode = false;
          args = args.filter((f) => f != "@UTF8@");
        }
        let parmCount = args.length - 1;

        try {
          file.initWithPath(fileURL);
        } catch(ex) {
          console.error(`runFile() - invalid file url: ${fileURL}`, ex);
          return;
        }        
        for (var messageIndex = 0; messageIndex < aMsgHdrs.length; messageIndex++) {
          let theProcess = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
          theProcess.init(file);

          // convert parameters
          let parameters = new Array(parmCount);
          if (isUnicode) {
            for (let i = 0; i < parmCount; i++) {
              let pRaw = _replaceParameters(aMsgHdrs[messageIndex], args[i + 1]);
              parameters[i] = utf8To16(pRaw);
            }
            theProcess.runw(false, parameters, parmCount); // [issue 102] decoding problems -  UTF-16
          } else {
            for (let i = 0; i < parmCount; i++) {
              parameters[i] = _replaceParameters(aMsgHdrs[messageIndex], args[i + 1]);
            }
            theProcess.run(false, parameters, parmCount);
          }
        }
      },

      isValidForType: function (_type, _scope) {
        return runFileEnabled;
      },
      validateActionValue: function (_value, _folder, _type) {
        return null;
      },
      allowDuplicates: true,
      needsBody: false,
    }; // end runFile

    self.fwdSmartTemplates = {
      id: "filtaquilla@mesquilla.com#fwdSmart",
      name: util.getBundleString("fq.smartTemplate.fwd"),
      applyAction: function (aMsgHdrs, aActionValue, _aListener, _aType, _aMsgWindow) {
        var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
        var args = aActionValue.split(","),
          fileURL = args[0];

        try {
          file.initWithPath(fileURL); // check whether template exists!
        } catch(ex) {
          console.error(`FiltaQuilla\nfwdSmartTemplates() - invalid file url: ${fileURL}`);
          void ex;
          return;
        }
        if (!file.exists()) {
          console.warn("FiltaQuilla cannot find SmartTemplates file: " + fileURL);
        }
        const prefs = Services.prefs.getBranch("extensions.filtaquilla."),
          isDebug = prefs.getBoolPref("debug.SmartTemplates");

        // then send a message to SmartTemplates
        for (var messageIndex = 0; messageIndex < aMsgHdrs.length; messageIndex++) {
          // pass on the message header - similar to printingTools NG
          let MessageHeader = FiltaQuilla.Util.extension.messageManager.convert(
              aMsgHdrs[messageIndex]
            ),
            count = messageIndex + 1,
            length = aMsgHdrs.length;
          FiltaQuilla.Util.notifyTools.notifyBackground({
            func: "forwardMessageST",
            msgKey: MessageHeader,
            fileURL,
          });
          if (isDebug) {
            console.log(`FQ: after notifyBackground(forwardMessageST) - ${count} of ${length} `);
          }
        }
        if (isDebug) {
          console.log(
            `FQ: processed array of ${aMsgHdrs.length} messages for forwarding to SmartTemplates!`
          );
        }
      },

      isValidForType: function (_type, _scope) {
        return fwdSmartTemplatesEnabled;
      },
      validateActionValue: function (_value, _folder, _type) {
        return null;
      },
      allowDuplicates: true,
      needsBody: true,
    }; // end fwdSmartTemplates

    self.replySmartTemplates = {
      id: "filtaquilla@mesquilla.com#rspSmart",
      name: util.getBundleString("fq.smartTemplate.rsp"),
      applyAction: function (aMsgHdrs, aActionValue, _aListener, _aType, _aMsgWindow) {
        var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
        var args = aActionValue.split(","),
          fileURL = args[0];

        try {
          file.initWithPath(fileURL); // check whether template exists!
        } catch(ex) {
          console.error(`FiltaQuilla\nreplySmartTemplates() - invalid file url: ${fileURL}`, ex);
          return;
        }
        
        if (!file.exists()) {
          console.warn("FiltaQuilla cannot find SmartTemplates file: " + fileURL);
        }
        // then send a message to SmartTemplates
        for (var messageIndex = 0; messageIndex < aMsgHdrs.length; messageIndex++) {
          // pass on the message header - similar to printingTools NG
          let MessageHeader = FiltaQuilla.Util.extension.messageManager.convert(
            aMsgHdrs[messageIndex]
          );
          FiltaQuilla.Util.notifyTools.notifyBackground({
            func: "replyMessageST",
            msgKey: MessageHeader,
            fileURL,
          });
          //
        }
      },

      isValidForType: function (_type, _scope) {
        return rspSmartTemplatesEnabled;
      },
      validateActionValue: function (_value, _folder, _type) {
        return null;
      },
      allowDuplicates: true,
      needsBody: true,
    }; // end fwdSmartTemplates

    // train as junk
    self.trainAsJunk = {
      id: "filtaquilla@mesquilla.com#trainAsJunk",
      name: util.getBundleString("fq.trainJunk"),
      applyAction: function (aMsgHdrs, aActionValue, aListener, aType, aMsgWindow) {
        _trainJunkFilter(true, aMsgHdrs, aMsgWindow);
      },
      apply: function (aMsgHdrs, aActionValue, aListener, aType, aMsgWindow) {
        let msgHdrs = [];
        for (var i = 0; i < aMsgHdrs.length; i++) {
          msgHdrs.push(aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }
        this.applyAction(msgHdrs, aActionValue, aListener, aType, aMsgWindow);
      },
      isValidForType: function (_type, _scope) {
        return trainAsJunkEnabled;
      },
      validateActionValue: function (_value, _folder, _type) {
        return null;
      },
      allowDuplicates: false,
      needsBody: true,
    }; // end trainAsJunk

    // train as good
    self.trainAsGood = {
      id: "filtaquilla@mesquilla.com#trainAsGood",
      name: util.getBundleString("fq.trainGood"),
      applyAction: function (aMsgHdrs, aActionValue, aListener, aType, aMsgWindow) {
        _trainJunkFilter(false, aMsgHdrs, aMsgWindow);
      },
      apply: function (aMsgHdrs, aActionValue, aListener, aType, aMsgWindow) {
        let msgHdrs = [];
        for (var i = 0; i < aMsgHdrs.length; i++) {
          msgHdrs.push(aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }
        this.applyAction(msgHdrs, aActionValue, aListener, aType, aMsgWindow);
      },
      isValidForType: function (_type, _scope) {
        return trainAsGoodEnabled;
      },
      validateActionValue: function (_value, _folder, _type) {
        return null;
      },
      allowDuplicates: false,
      needsBody: true,
    }; // end trainAsJunk

    // print messages
    self.print = {
      id: "filtaquilla@mesquilla.com#print",
      name: util.getBundleString("fq.print"),
      applyAction: function (aMsgHdrs, _aActionValue, _aListener, _aType, _aMsgWindow) {
        // print me
        const prefs = Services.prefs.getBranch("extensions.filtaquilla.");
        let count = aMsgHdrs.length;
        let isPrintingToolsNG = prefs.getBoolPref("print.enablePrintToolsNG"); // [issue 152] - PrintingTools NG
        let isAllowDuplicates = prefs.getBoolPref("print.allowDuplicates");
        let printDelay = prefs.getIntPref("print.delay");

        for (let i = 0; i < count; i++) {
          let hdr = aMsgHdrs[i];
          FiltaQuilla.Util.logDebug("print", hdr, isAllowDuplicates);
          // no duplicates!
          if (isAllowDuplicates || !printQueue.includes(hdr)) {
            printQueue.push(hdr);
          }
        }
        util.logDebug("print.applyAction queue length: " + printQueue.length, printQueue);
        /*
         * Message printing always assumes that we want to put up a print selection
         *  dialog, which we really don't want to do for filters. We can override
         *  that, but it is a global setting. I'll do it here, but hopefully I can
         *  add a future backend hook to allow me to specify that. I'll override that
         *  in setup.
         *
         */
        let rootprefs = Services.prefs.getBranch("");

        async function printNextMessage() {
          if (printingMessage || !printQueue.length) {
            return;
          } else {
            util.logDebug("printNextMessage queue length: " + printQueue.length, printQueue);
          }
          if (!PrintUtils && !isPrintingToolsNG) {
            printingMessage = true; // old code branch
          }

          let timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
          timer.initWithCallback(
            async function _printNextMessage() {
              let hdr = printQueue.shift();
              if (!hdr) {return;} // triggered too often?
              util.logDebug(
                "_printNextMessage(). Remaining queue length=" + printQueue.length,
                hdr
              );
              if (isPrintingToolsNG) {
                let MessageHeader = FiltaQuilla.Util.extension.messageManager.convert(hdr);
                if (MessageHeader) {
                  FiltaQuilla.Util.notifyTools.notifyBackground({
                    func: "printMessage",
                    msgKey: MessageHeader,
                  });
                } else {
                  util.logDebug("_printNextMessage() - couldn't convert message header: ", hdr);
                }
                await printNextMessage();
              } else {
                let uri = hdr.folder.generateMessageURI(hdr.messageKey);
                Services.console.logStringMessage(
                  "Queue filter request to print message: " + hdr.subject
                );
                let printSilentBackup = rootprefs.getBoolPref("print.always_print_silent");
                rootprefs.setBoolPref("print.always_print_silent", true);
                if (!PrintUtils) {
                  var { PrintUtils } = window.ownerGlobal;
                  // window.docShell.chromeEventHandler.ownerGlobal; // not in 91.5 - chromeEventHandler = null
                }

                // Tb 91
                // let uri = gFolderDisplay.selectedMessageUris[0];
                if (PrintUtils && PrintUtils.startPrintWindow) {
                  // && PrintUtils.loadPrintBrowser MISSING IN TB 91.3.2 ???
                  let messageService = MailServices.messageServiceFromURI(uri),
                    messageURL = messageService.getUrlForUri(uri).spec;
                  if (PrintUtils.loadPrintBrowser) {
                    await PrintUtils.loadPrintBrowser(messageURL);
                    PrintUtils.startPrintWindow(PrintUtils.printBrowser.browsingContext, {});
                  } else {
                    if (
                      gMessageDisplay.visible &&
                      hdr == gFolderDisplay.selectedMessage &&
                      gFolderDisplay.selectedMessage == gMessageDisplay.displayedMessage
                    ) {
                      let messagePaneBrowser = document.getElementById("messagepane");
                      PrintUtils.startPrintWindow(messagePaneBrowser.browsingContext, {});
                    } else {
                      console.log(
                        "CANNOT PRINT, PrintUtils IS MISSING THE METHOD loadPrintBrowser !!"
                      );
                    }
                  }
                  printingMessage = false;
                  rootprefs.setBoolPref("print.always_print_silent", printSilentBackup); // try to restore previous setting
                  await printNextMessage();
                } else {
                  console.warn("No PrintUtils!")
                }
              }
            },
            printDelay,
            Ci.nsITimer.TYPE_ONE_SHOT
          ); // was hard coded to 10ms
        }
        printNextMessage();
      },

      isValidForType: function (_type, _scope) {
        return printEnabled;
      },
      validateActionValue: function (_value, _folder, _type) {
        return null;
      },
      allowDuplicates: false,
      needsBody: true,
    }; // end print messages
    // reset the always_print_silent value at startup
    // XXX to do : add a hook to base so that this is not needed
    /*    
    // [issue 97] do not reset this setting generally!!!
    let rootprefs = Services.prefs.getBranch("");
    try {
      rootprefs.clearUserPref("print.always_print_silent");
    } catch (e) {}
    */

    // add sender to a specific address book
    self.addSender = {
      id: "filtaquilla@mesquilla.com#addSender",
      name: util.getBundleString("fq.addSender"),
      applyAction: function (aMsgHdrs, aActionValue, _aListener, _aType, _aMsgWindow) {
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
          let addresses = {},
            names = {};
          parseHeadersWithArray(hdr.mime2DecodedAuthor, addresses, names, {});
          names = names.value;
          addresses = addresses.value;
          if (addresses.length) {
            // don't add the address if it already exists. Mailing lists seem to
            // detect this themselves.
            if (!dir.isMailList && dir.cardForEmailAddress(addresses[0])) {
              continue;
            }

            let card = Cc["@mozilla.org/addressbook/cardproperty;1"].createInstance(Ci.nsIAbCard);
            card.primaryEmail = addresses[0];
            card.displayName = names[0];
            dir.addCard(card);
          }
        }
      },

      isValidForType: function (_type, _scope) {
        return addSenderEnabled;
      },
      validateActionValue: function (_value, _folder, _type) {
        return null;
      },
      allowDuplicates: true,
      needsBody: false,
    }; // end add Sender

    function _extractAttachmentDetail(mimeMsg, msgHdr, directory, msgURI) {
      const attachments = mimeMsg.allAttachments;
      const msgURIs = [],
        contentTypes = [],
        urls = [],
        displayNames = [];

      for (let j = 0; j < attachments.length; j++) {
        const attachment = attachments[j];
        if (attachment.url.startsWith("file:")) {
          util.logToConsole(
            `Attachment for '${msgHdr.subject}'was already removed: check \n { attachment.url}`
          );
          continue;
        }

        msgURIs.push(msgURI);
        contentTypes.push(attachment.contentType);
        urls.push(attachment.url);
        let attachmentName = _sanitizeName(attachment.name, true);
        displayNames.push(attachmentName);
        const txt =
          `Detach attachment [${j}] to ${directory.path} ...\n` +
          ` msgURI=${msgURI}\n` +
          ` att.url=${attachment.url}\n` +
          ` att.contentType=${attachment.contentType}`;
        util.logDebug(txt);
      }
      return { msgURIs, contentTypes, urls, displayNames };
    }

    async function _detachAttachments(aMsgHdrs, directory) {
      const failedUris = [];
      try {
        // Process all message headers asynchronously
        for (let i = 0; i < aMsgHdrs.length; i++) {
          let { msgHdr, mimeMsg } = await new Promise((resolve) =>
            MsgHdrToMimeMessage(
              aMsgHdrs[i],
              null,
              function (msgHdr, mimeMsg) {
                resolve({ msgHdr, mimeMsg });
              },
              false /* allowDownload */,
              { saneBodySize: true, examineEncryptedParts: false }
            )
          );
 
          // do something with mimeMsg
          const msgURI = msgHdr.folder.generateMessageURI(msgHdr.messageKey);
          const attachments = mimeMsg.allAttachments;
          const messenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
          const ds = msgHdr.date / 1000;
          const mDate = new Date(ds);
          let nicedate =
            `${mDate.getFullYear()}-${mDate.getMonth() + 1}-` +
            `${mDate.getDate()} ${mDate.getHours()}:${mDate.getMinutes()}`;

          if (!attachments?.length) {
            // nothing to do
            continue;
          }

          const { msgURIs, contentTypes, urls, displayNames } = _extractAttachmentDetail(
            mimeMsg,
            msgHdr,
            directory,
            msgURI,
            nicedate
          );
          if (!msgURIs.length) {
            // nothing to do
            util.logDebug("No attachments left to process.");
            continue;
          }

          try {
            util.logDebug("calling detachAttachmentsWOPrompts", urls);
            await new Promise((resolve, _reject) => {
              messenger.detachAttachmentsWOPrompts(
                directory,
                contentTypes,
                urls,
                displayNames,
                msgURIs,
                {
                  OnStartRunningUrl(url) {
                    util.logDebug(
                      `Starting to detach attachment: ${url?.spec ?? "unknown URL"}\n` +
                        `from ${nicedate}`
                    );
                  },
                  OnStopRunningUrl(url, status) {
                    const urlSpec = url?.spec ?? "unknown URL";
                    if (status === 0) {
                      util.logDebug(`Attachment detached successfully: ${urlSpec}`, url || "");
                      resolve(); // No failures
                    } else {
                      failedUris.push(urlSpec);
                      util.logDebug(
                        `---------------\nFailed to detach attachment: ${urlSpec}`,
                        url || ""
                      );
                      // reject(new Error(`Failed to detach attachment: ${url?.spec}`));
                      resolve();
                    }
                  },
                }
              );
            });

            if (!failedUris.length) {
              util.logDebug("All attachments detached successfully.");
            }
          } catch (ex) {
            failedUris.push("General detachAttachmentsWOPrompts exception");
            util.logException("FiltaQuilla._detachAttachments - detachAttachmentsWOPrompts()", ex);
          }
        }
      } catch (ex) {
        util.logException("FiltaQuilla._detachAttachments()", ex);
        return Cr.NS_ERROR_FAILURE;
      }
      return failedUris.length ? Cr.NS_ERROR_FAILURE : Cr.NS_OK;
    }

    async function _saveAttachments(aMsgHdrs, directory) {
      const resultArray = [];
      try {
        let testErr = false; // set to testErr to cause exception  in debugger
        if (testErr) {
          const context = "_saveAttachments";
          throw new Error(`Exception test in: ${context}`);
        }
        // Process all message headers asynchronously
        for (let i = 0; i < aMsgHdrs.length; i++) {
          let msgHdr = aMsgHdrs[i];
          FiltaQuilla.Util.logDebug(
            `saveAttachements() for Message ${i + 1} of ${aMsgHdrs.length} ... `,
            `messageKey: ${msgHdr?.messageKey}`,
            `subject: ${msgHdr?.subject}`
          );
          if (!msgHdr) {
            continue; // Skip if no data
          }
          // do something with mimeMsg
          const ds = msgHdr.date / 1000;
          const mDate = new Date(ds);
          let nicedate =
            `${mDate.getFullYear()}-${mDate.getMonth() + 1}-` +
            `${mDate.getDate()} ${mDate.getHours()}:${mDate.getMinutes()}`;

          // save attachment code
          const messageHeader = extension.messageManager.convert(msgHdr);
          if (testErr) {
            throw new Error(`Exception test in: saveAttachments background call`);
          }
          const results = await FiltaQuilla.Util.notifyTools.notifyBackground({
            func: "saveAttachments",
            messageHeader: messageHeader,
            path: directory.path,
          });

          // Process each saved item individually
          const successes = [],
            failures = [];
          for (let savedItem of results) {
            if (savedItem.success) {
              successes.push(
                `Attachment ${savedItem.fileName} saved successfully in ${directory.path}`
              );
            } else {
              failures.push(`Failed to save attachment: ${savedItem.fileName}`);
            }
          }
          // Concatenate successes and failures with a separator if both are present
          const separator = successes.length * failures.length ? "----------\n" : "";
          const heading = `_saveAttachments()\n${msgHdr.subject} at ${nicedate}\n`;
          util.logDebug(heading + successes.join("\n") + separator + failures.join("\n"));
          // Push ONE result per message
          resultArray.push({
            messageSubject: msgHdr.subject,
            messageDate: nicedate,
            success: failures.length === 0,
            details: { successes, failures },
          });
        }
        return resultArray;
      } catch (ex) {
        util.logException("FiltaQuilla._saveAttachments()", ex);
        console.error(ex);
        // Append a final failure message to whatever was already processed
        resultArray.push({
          messageSubject: null,
          messageDate: null,
          success: false,
          details: {
            successes: [],
            failures: ["Unhandled exception: " + ex?.message || String(ex)],
            internalError: true,
            code: Cr.NS_ERROR_FAILURE,
          },
        });

        return resultArray;
      }
    }

    function describeMsgHdr(msgHdr) {
      let subject = msgHdr.subject || "[no subject]";
      let author = msgHdr.author || "[unknown sender]";
      let date = msgHdr.date ? new Date(msgHdr.date / 1000).toLocaleString() : "[no date]";
      return `"${subject}" from ${author} on ${date}`;
    }

    // Helper function to deal with missing copyListener object
    // this function is able to synchronously wait for a promis
    // so a function that returns promise.
    // effectively this is a way to syncronize an async function
    function waitForPromise(promise, msgHdr) {
      const startTime = Date.now();
      let result = null;
      // return a status of each promise

      promise.then(
        (value) => {
          result = { value, success: true };
        },
        (error) => {
          const elapsed = Date.now() - startTime;
          console.error(`waitForPromise: promise rejected after ${elapsed} ms:`, error);
          result = { value: null, success: false, message: error.message };
        }
      );

      // const messageSize = Math.floor((msgHdr.messageSize || 0) / 1024); // Convert to KB
      // Heuristic calculation for the timeout
      const prefs = Services.prefs.getBranch("extensions.filtaquilla."),
        MAX_ATTACHMENT_TIME = prefs.getIntPref("attachmentTimeoutMs");

      // Synchronously wait for the promise to resolve/reject
      // we removed code that used nsIThreadManager.processNextEvent();
      const thread = Services.tm.mainThread;
      while (!result) {
        const timeSpent = Date.now() - startTime;
        if (timeSpent > MAX_ATTACHMENT_TIME) {
          console.error(
            `Attachment processing took too long for message ${describeMsgHdr(msgHdr)}. Aborting.`
          );
          console.warn(`waitForPromise: operation timed out after ${timeSpent} ms!`);
          return { value: null, success: false, message: "Operation timed out" }; // Exit early if too much time is spent
        }
        thread.processNextEvent(true);
      }
      return result;
    }


    self.saveAttachment = {
      id: "filtaquilla@mesquilla.com#saveAttachment",
      name: util.getBundleString("fq.saveAttachment"),
      applyAction: function (aMsgHdrs, aActionValue, copyListener, _aType, _aMsgWindow) {
        // async functions pass in a nsIMsgCopyServiceListener
        let directory = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
        try {
          if (!copyListener) {
            util.logDebug("saveAttachment: no copyListener, proceeding without it");
          }

          try {
            directory.initWithPath(aActionValue);
          } catch(ex) {
            console.error(`FiltaQuilla\nsaveAttachment() - invalid directory url: ${aActionValue}`);
            void ex;
            return;
          }

          if (directory.exists()) {
            util.logDebug("saveAttachment() - target directory exists:\n" + aActionValue);
          } else {
            util.logDebug("saveAttachment() - target directory does not exist:\n" + aActionValue);
            if (copyListener) {
              copyListener.onStopCopy(Cr.NS_ERROR_FAILURE);
            }
            return Cr.NS_ERROR_FAILURE;
          }

          if (!copyListener) {
            // Wait for the async operation to complete
            let anyFailures = false;

            for (let msgHdr of aMsgHdrs) {
              const info = `subject="${msgHdr.subject}",\nauthor="${msgHdr.author}"`;
              const result = waitForPromise(_saveAttachments([msgHdr], directory), msgHdr);

              if (!result.success) {
                anyFailures = true;
                util.logError(`Attachment save failed for: ${info} - ${result?.message}`);
              } else {
                util.logDebug("Attachment saved for: " + info);
              }
            }
            return anyFailures ? Cr.NS_ERROR_FAILURE : Cr.NS_OK;
          } // !copyListener

          // pass in message array, returns result status array!
          _saveAttachments(aMsgHdrs, directory)
            .then((rv) => {
              // look at array of results, if there was one failure we consider the filter failed (?)
              const failed = rv.some((r) => !r.success);
              copyListener.onStopCopy(failed ? Cr.NS_ERROR_FAILURE : Cr.NS_OK);
            })
            .catch((ex) => {
              util.logException("FiltaQuilla.saveAttachment", ex);
              copyListener.onStopCopy(Cr.NS_ERROR_FAILURE);
              // Log the error for cases where copyListener is null
              util.logError("Error saving attachment: " + ex.message);
            });
        } catch (ex) {
          util.logException("FiltaQuilla.saveAttachment", ex);
          if (copyListener) {
            copyListener.onStopCopy(Cr.NS_ERROR_FAILURE);
          }
        }
      },

      isValidForType: function (_type, _scope) {
        return saveAttachmentEnabled;
      },
      validateActionValue: function (_value, _folder, _type) {
        return null;
      },
      allowDuplicates: true,
      needsBody: true,
      isAsync: true,
    };
    // end save Attachments

    self.detachAttachments = {
      id: "filtaquilla@mesquilla.com#detachAttachments",
      name: util.getBundleString("fq.detachAttachments"),
      applyAction: async function (aMsgHdrs, aActionValue, copyListener, _aType, _aMsgWindow) {
        // async functions pass in a nsIMsgCopyServiceListener
        let directory = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
        try {
          directory.initWithPath(aActionValue);
          if (directory.exists()) {
            util.logDebug("detachAttachments() - target directory exists:\n" + aActionValue);
          } else {
            util.logDebug(
              "detachAttachments() - target directory does not exist:\n" + aActionValue
            );
            copyListener.onStopCopy(Cr.NS_ERROR_FAILURE);
            return; // Exit early if directory doesn't exist
          }

          // pass in message array
          await _detachAttachments(aMsgHdrs, directory)
            .then(async (rv) => {
              util.logDebug(`detachAttachments() - copyListener.onStopCopy(${rv});`);
              copyListener.onStopCopy(rv);
            })
            .catch((ex) => {
              util.logException("FiltaQuilla.detachAttachments(", ex);
              copyListener.onStopCopy(Cr.NS_ERROR_FAILURE); // this will stop filter flow
            });
        } catch (ex) {
          util.logException("FiltaQuilla.detachAttachments()", ex);
          if (copyListener) {copyListener.onStopCopy(Cr.NS_ERROR_FAILURE);}
        }
      },
      isValidForType: function (_type, _scope) {
        return detachAttachmentsEnabled;
      },
      validateActionValue: function (_value, _folder, _type) {
        return null;
      },
      allowDuplicates: false,
      needsBody: true,
      isAsync: true,
    };
    // end detach Attachments

    self.javascriptAction = {
      id: "filtaquilla@mesquilla.com#javascriptAction",
      name: util.getBundleString("filtaquilla.javascriptAction.name"),
      applyAction: function (msgHdrs, actionValue, copyListener, filterType, msgWindow) {
        try {
          // [issue 338] eval rejected by CSP
          //             we only pass in a controlled set of data using the "context" parameter
          const script = actionValue;
          const context = {
            msgHdrs,
            filterType,
            msgWindow,
            fq_method: "javascriptAction",
          };
          return util.saferEval(script, context);
        } catch (ex) {
          // Galantha: javascript eval action error triggered a bug report
          let msg = "Error: Name: " + ex.name + "\nMessage: " + ex.message + "\nCause: " + ex.cause;
          util.logToConsole(msg);
          util.logException("FiltaQuilla.javascriptAction - applyAction failed.", ex);
          return false;
        }
      },
      isValidForType: function (_type, _scope) {
        return javascriptActionEnabled;
      },
      validateActionValue: function (_value, _folder, _type) {
        return null;
      },
      allowDuplicates: true,
      needsBody: false,
      isAsync: false,
    };

    self.javascriptActionBody = {
      id: "filtaquilla@mesquilla.com#javascriptActionBody",
      name: util.getBundleString("filtaquilla.javascriptActionBody.name"),
      applyAction: function (msgHdrs, actionValue, copyListener, filterType, msgWindow) {
        try {
          // [issue 338] eval rejected by CSP
          //             we only pass in a controlled set of data using the "context" parameter
          const script = actionValue;
          const context = {
            msgHdrs,
            filterType,
            msgWindow,
            fq_method: "javascriptAction",
          };
          return util.saferEval(script, context);
        } catch (ex) {
          // Galantha: javascript eval action error triggered a bug report
          let msg = "Error: Name: " + ex.name + "\nMessage: " + ex.message + "\nCause: " + ex.cause;
          util.logToConsole(msg);
          util.logException("FiltaQuilla.javascriptAction - applyAction failed.", ex);
          return false;
        }
      },
      isValidForType: function (_type, _scope) {
        return javascriptActionBodyEnabled;
      },
      validateActionValue: function (_value, _folder, _type) {
        return null;
      },
      allowDuplicates: true,
      needsBody: true,
    };

    self.saveMessageAsFile = {
      id: "filtaquilla@mesquilla.com#saveMessageAsFile",
      name: util.getBundleString("fq.saveMsgAsFile"),
      applyAction: async function (msgHdrs, actionValue, copyListener, _filterType, _msgWindow) {
        const CONCURRENCY_LIMIT = 10; // maximum # file handles to be handled at the same time.
        // allow specifying directory with suffix of |htm
        let type = "eml"; //default
        let path = actionValue;
        if (/\|/.test(actionValue)) {
          let matches = /(^[^|]*)\|(.*$)/.exec(actionValue);
          path = matches[1];
          type = matches[2];
        }

        const directory = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
        try {
          directory.initWithPath(path);
        } catch(ex) {
          console.error(`FiltaQuilla\nsaveMessageAsFile() - invalid file url: ${path}`, ex);
          return;
        }        

        // queue and save files asynchronously:
        let activePromises = new Set();

        for (const msgHdr of msgHdrs) {
          // Start the save operation and add its promise to the active set
          const savePromise = async () => {
            try {
              _incrementMoveLaterCount(msgHdr);
              await _saveAs(msgHdr, directory, type, copyListener);
            } catch (error) {
              console.error("Error saving message:", error, msgHdr);
            } finally {
              // When a promise completes, remove it from the active set
              activePromises.delete(savePromise);
            }
          };

          // Invoke the promise and handle errors
          activePromises.add(savePromise());

          // If the active set reaches the concurrency limit, wait for one to complete
          if (activePromises.size >= CONCURRENCY_LIMIT) {
            await Promise.race(activePromises); // fastest finish first
          }
        }

        // Wait for any remaining operations to complete
        await Promise.all(activePromises);
      },
      isValidForType: function (_type, _scope) {
        return saveMessageAsFileEnabled;
      },
      validateActionValue: function (_value, _folder, _type) {
        return null;
      },
      allowDuplicates: true,
      needsBody: true,
      isAsync: true,
    };

    self.moveLater = {
      id: "filtaquilla@mesquilla.com#moveLater",
      name: util.getBundleString("fq.moveLater"),
      applyAction: function (aMsgHdrs, aActionValue, _copyListener, _filterType, _msgWindow) {
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
      isValidForType: function (_type, _scope) {
        return moveLaterEnabled;
      },
      validateActionValue: function (_value, _folder, _type) {
        return null;
      },
      allowDuplicates: false,
      needsBody: true,
    };

    // archiveMessage [issue 126]
    self.archiveMessage = {
      id: "filtaquilla@mesquilla.com#archiveMessage",
      name: util.getBundleString("fq.archiveMessage"),
      applyAction: function (aMsgHdrs, _aActionValue, _aListener, _aType, _aMsgWindow) {
        let archiver = new MessageArchiver(); // [issue 241]
        archiver.archiveMessages(aMsgHdrs);
      },
      isValidForType: function (_type, _scope) {
        return archiveMessageEnabled;
      },
      validateActionValue: function (_value, _folder, _type) {
        return null;
      },
    }; // end archiveMessage

    /*
     * Custom searches
     */

    // search of folder name
    self.folderName = {
      id: "filtaquilla@mesquilla.com#folderName",
      name: util.getBundleString("fq.folderName"),
      getEnabled: function folderName_getEnabled(scope, _op) {
        return _isLocalSearch(scope);
      },
      needsBody: false,
      getAvailable: function folderName_getAvailable(scope, _op) {
        return _isLocalSearch(scope) && FolderNameEnabled;
      },
      getAvailableOperators: function folderName_getAvailableOperators(scope) {
        if (!_isLocalSearch(scope)) {
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
            if (folderName.indexOf(aSearchValue) != -1) {matches = true;}
            break;

          case Is:
          case Isnt:
            if (folderName == aSearchValue) {matches = true;}
            break;

          case BeginsWith:
            if (folderName.indexOf(aSearchValue) == 0) {matches = true;}
            break;

          case EndsWith: {
            let index = folderName.lastIndexOf(aSearchValue);
            if (index != -1 && index == folderName.length - aSearchValue.length) {matches = true;}
          } break;

          default:
            Cu.reportError("invalid search operator in folder name custom search term");
        }
        if (aSearchOp == DoesntContain || aSearchOp == Isnt) {return !matches;}
        return matches;
      },
    };

    // search of BCC field
    self.searchBcc = {
      id: "filtaquilla@mesquilla.com#searchBcc",
      name: util.getBundleString("fq.Bcc"),
      getEnabled: function searchBcc_getEnabled(scope, _op) {
        return _isLocalSearch(scope);
      },
      needsBody: false,
      getAvailable: function searchBcc_getAvailable(scope, _op) {
        return _isLocalSearch(scope) && SearchBccEnabled;
      },
      getAvailableOperators: function searchBcc_getAvailableOperators(scope) {
        if (!_isLocalSearch(scope)) {
          return [];
        }
        return [Contains, DoesntContain, Is, Isnt, IsEmpty, IsntEmpty, BeginsWith, EndsWith];
      },
      match: function searchBcc_match(aMsgHdr, aSearchValue, aSearchOp) {
        let bccList = aMsgHdr.bccList;
        if (aSearchOp == IsEmpty) {return bccList.length == 0;}
        if (aSearchOp == IsntEmpty) {return bccList.length != 0;}

        let addresses = {},
          names = {},
          fullAddresses = {};
        headerParser.parseHeadersWithArray(bccList, addresses, names, fullAddresses);
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
              if (addresses[i].indexOf(aSearchValue) != -1) {matches = true;}
              break;

            case Is:
            case Isnt:
              if (names[i] == aSearchValue) {
                matches = true;
                break;
              }
              if (addresses[i] == aSearchValue) {matches = true;}
              break;

            case BeginsWith:
              if (names[i].indexOf(aSearchValue) == 0) {
                matches = true;
                break;
              }
              if (addresses[i].indexOf(aSearchValue) == 0) {matches = true;}
              break;

            case EndsWith: {
              let index = names[i].lastIndexOf(aSearchValue);
              if (index != -1 && index == names[i].length - aSearchValue.length) {
                matches = true;
                break;
              }
              index = addresses[i].lastIndexOf(aSearchValue);
              if (index != -1 && index == addresses[i].length - aSearchValue.length) {matches = true;}
            } break;

            default:
              Cu.reportError("invalid search operator in bcc custom search term");
          }
        }
        if (aSearchOp == DoesntContain || aSearchOp == Isnt) {return !matches;}
        return matches;
      },
    };

    // search subject with regular expression
    self.subjectRegex = {
      id: "filtaquilla@mesquilla.com#subjectRegex",
      name: util.getBundleString("fq.subjectRegex"),
      getEnabled: function subjectRegEx_getEnabled(scope, _op) {
        return _isLocalSearch(scope);
      },
      needsBody: false,
      getAvailable: function subjectRegEx_getAvailable(scope, _op) {
        return _isLocalSearch(scope) && SubjectRegexEnabled;
      },
      getAvailableOperators: function subjectRegEx_getAvailableOperators(scope) {
        try {
          if (!_isLocalSearch(scope)) {
            return [];
          }
        } catch (ex) {
          console.logException(ex);
        } finally {
          // eslint-disable-next-line no-unsafe-finally
          return [Matches, DoesntMatch];
        }
      },
      match: function subjectRegEx_match(aMsgHdr, aSearchValue, aSearchOp) {
        var subject = aMsgHdr.mime2DecodedSubject;
        let searchValue, searchFlags;
        [searchValue, searchFlags] = _getRegEx(aSearchValue);
        FiltaQuilla.Util.logDebugOptional(
          "regexSubject",
          `decoded subject: ${subject}\nRegex String:${searchValue}`
        );

        let retVal, operand;
        switch (aSearchOp) {
          case Matches:
            retVal = RegExp(searchValue, searchFlags).test(subject);
            operand = "matches";
            break;
          case DoesntMatch:
            retVal = !RegExp(searchValue, searchFlags).test(subject);
            operand = "doesn't match";
            break;
          default:
            retVal = null;
        }

        FiltaQuilla.Util.logHighlightDebug(
          `subjectRegex RESULT: ${retVal}`,
          "white",
          "rgb(0,100,0)",
          `\n search term: Subject ${operand} '${searchValue}'`
        );
        return retVal;
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
        if (aMimeMessage == null) {
          // failure parsing during MsgHdrToMimeMessage
          this.processed = true;
          return;
        }
        try {
          this.msgURI = aMsgHdr.folder.generateMessageURI(aMsgHdr.messageKey);
          this.attachments = aMimeMessage.allAttachments;

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
          } else {this.found = false;}
          this.processed = true;
        } catch (ex) {
          Services.console.logStringMessage(
            "readAttachmentCallback_callback failed: " + ex.toString()
          );
          this.processed = true;
        }
      },
    };
    // end read Attachment

    // search attachment names with regular expression
    self.attachmentRegex = {
      id: "filtaquilla@mesquilla.com#attachmentRegex",
      name: util.getBundleString("fq.attachmentRegex"),
      getEnabled: function attachRegEx_getEnabled(scope, _op) {
        return _isLocalSearch(scope);
      },
      getAvailable: function attachRegEx_getAvailable(scope, _op) {
        return _isLocalSearch(scope) && AttachmentRegexEnabled;
      },
      getAvailableOperators: function attachRegEx_getAvailableOperators(scope) {
        if (!_isLocalSearch(scope)) {
          return [];
        }
        return [Matches, DoesntMatch];
      },
      match: function attachRegEx_match(aMsgHdr, aSearchValue, aSearchOp) {
        // attach Regexp
        // var subject = aMsgHdr.mime2DecodedSubject;
        let searchValue,
          searchFlags,
          isMatched = false;
        // eslint-disable-next-line no-unused-vars
        [searchValue, searchFlags] = _getRegEx(aSearchValue);

        if (!aMsgHdr.folder.msgDatabase.HasAttachments(aMsgHdr.messageKey)) {
          switch (aSearchOp) {
            case Matches:
              return false;
            case DoesntMatch:
              return true; // or false? no attachment means we cannot really say...
          }
        }

        let hdr = aMsgHdr.QueryInterface(Ci.nsIMsgDBHdr),
          callbackObject = new ReadAttachmentCallback(new RegExp(searchValue));
        // message must be available offline!
        try {
          MsgHdrToMimeMessage(
            hdr,
            callbackObject,
            callbackObject.callback,
            false /* allowDownload */
          );

          // we need a listener for "processed" flag. is match called synchronously though?
          /*
					while (!callbackObject.processed) {
						// we need to yield ...
					}
					*/
          if (!callbackObject.processed) {
              alert(
              "sorry, we cannot read attachments without streaming the message asynchronously - the filter mechanims in Tb is still synchronous, so it won't allow me to do this."
            );
          }
          isMatched = callbackObject.found;
          switch (aSearchOp) {
            case Matches:
              return isMatched;
            case DoesntMatch:
              return !isMatched;
          }
        } catch (ex) {
          Services.console.logStringMessage("could not attachRegEx_match" + ex.toString());
        }
      },
      needsBody: true,
    };

    self.headerRegex = {
      id: "filtaquilla@mesquilla.com#headerRegex",
      name: util.getBundleString("fq.hdrRegex"),
      getEnabled: function headerRegEx_getEnabled(scope, _op) {
        return _isLocalSearch(scope);
      },
      needsBody: false,
      getAvailable: function headerRegEx_getAvailable(scope, _op) {
        return _isLocalSearch(scope) && HeaderRegexEnabled;
      },
      getAvailableOperators: function headerRegEx_getAvailableOperators(scope) {
        if (!_isLocalSearch(scope)) {
          return [];
        }
        return [Matches, DoesntMatch];
      },
      match: function headerRegEx_match(aMsgHdr, aSearchValue, aSearchOp) {
        // the header and its regex are separated by a ':' in aSearchValue
        const prefs = Services.prefs.getBranch("extensions.filtaquilla."),
          isDebug = prefs.getBoolPref("debug.regexHeader");
        let colonIndex = aSearchValue.indexOf(":");
        if (colonIndex == -1) {
          // not found, default to does not match
          return aSearchOp != Matches;
        }
        let headerName = aSearchValue.slice(0, colonIndex),
          regex = aSearchValue.slice(colonIndex + 1);
        let searchValue, searchFlags, options;
        // eslint-disable-next-line no-unused-vars
        [searchValue, searchFlags, options] = _getRegEx(regex);

        // find the property with the correct case (in case it was misspelled):
        let propertyRealName = aMsgHdr.properties.find(
          (e) => e.toLowerCase() == headerName.toLowerCase()
        );

        if (!propertyRealName) {
          if (isDebug) {
            util.logDebugOptional(
              "regexHeader",
              `Header ${headerName} not found. The following properties are available in\n"${aMsgHdr.subject}":\n` +
                `${aMsgHdr.properties.join(", ")}\n`
            );
          }
          // property not found!
          switch (aSearchOp) {
            case Matches:
              return false;
            case DoesntMatch:
              return true;
          }
        }

        var headerValue = aMsgHdr.getStringProperty(propertyRealName);
        if (headerValue) {
          // [issue 308]
          const mimeConvert = Cc["@mozilla.org/messenger/mimeconverter;1"].getService(
            Ci.nsIMimeConverter
          );
          headerValue = mimeConvert.decodeMimeHeader(headerValue, null, false, true);
        }
        let result, operand;

        const isMultiLine = prefs.getBoolPref("regexpHeader.addressMultiLine");

        if (isMultiLine && ["ccList", "bccList", "recipients"].includes(propertyRealName)) {
          // make sure we can use anchor tokens ^ and $
          headerValue = headerValue.split(", ").join("\n");
        }

        switch (aSearchOp) {
          case Matches:
            result = RegExp(searchValue, searchFlags).test(headerValue);
            operand = "matches";
            break;
          case DoesntMatch:
            result = !RegExp(searchValue, searchFlags).test(headerValue);
            operand = "doesn't match";
            break;
          default:
            result = null;
        }
        FiltaQuilla.Util.logHighlightDebug(
          `headerRegEx[${headerName}] RESULT: ${result}`,
          "white",
          "rgb(0,100,0)",
          `\n search term: Header ${operand} '${searchValue}'`
        );
        return result;
      },
    };

    self.bodyRegex = {
      id: "filtaquilla@mesquilla.com#bodyRegex",
      name: util.getBundleString("fq.bodyRegex"),
      getEnabled: function bodyRegEx_getEnabled(scope, _op) {
        return _isLocalSearch(scope);
      },
      needsBody: true,
      getAvailable: function bodyRegEx_getAvailable(scope, _op) {
        if (scope == Ci.nsMsgSearchScope.newsFilter) {return false;}
        return _isLocalSearch(scope) && BodyRegexEnabled;
      },
      getAvailableOperators: function bodyRegEx_getAvailableOperators(scope) {
        if (!_isLocalSearch(scope)) {
          return [];
        }
        return [Matches, DoesntMatch];
      },
      match: function (aMsgHdr, aSearchValue, aSearchOp) {
        /*** SEARCH INIT  **/
        let searchValue, searchFlags, options;
        [searchValue, searchFlags, options] = _getRegEx(aSearchValue);

        let result = FiltaQuilla.Util.bodyMimeMatch(aMsgHdr, searchValue, searchFlags, options);
        let operand;

        switch (aSearchOp) {
          case Matches:
            operand = "matches";
            break;
          case DoesntMatch:
            operand = "doesn't match";
            result = !result;
            break;
          default:
            result = null;
        }
        FiltaQuilla.Util.logHighlightDebug(
          `bodyRegex RESULT: ${result}`,
          "white",
          "rgb(0,100,0)",
          `\n search term: Body ${operand} '${searchValue}'`
        );

        return result;
      },
    };

    self.subjectBodyRegex = {
      id: "filtaquilla@mesquilla.com#subjectBodyRegex",
      name: util.getBundleString("fq.subjectBodyRegex"),
      getEnabled: function subjectBodyRegex_getEnabled(scope, _op) {
        return _isLocalSearch(scope);
      },
      needsBody: true,
      getAvailable: function subjectBodyRegex_getAvailable(scope, _op) {
        return _isLocalSearch(scope) && SubjectBodyRegexEnabled;
      },
      getAvailableOperators: function subjectBodyRegex_getAvailableOperators(scope) {
        if (!_isLocalSearch(scope)) {
          return [];
        }
        return [Matches, DoesntMatch];
      },
      match: function subjectBodyRegex_match(aMsgHdr, aSearchValue, aSearchOp) {
        var subject = aMsgHdr.mime2DecodedSubject,
          subResult = false;

        /*** SEARCH INIT  **/
        let searchValue, searchFlags, options;
        [searchValue, searchFlags, options] = _getRegEx(aSearchValue);

        subResult = RegExp(searchValue, searchFlags).test(subject); // find in subject

        const mimeConvert = Cc["@mozilla.org/messenger/mimeconverter;1"].getService(
            Ci.nsIMimeConverter
          );
        // eslint-disable-next-line no-unused-vars
        const _decodedMessageId = mimeConvert.decodeMimeHeader(aMsgHdr.messageId, null, false, true);

        // early exit (only when found, not when not found!)
        if (aSearchOp == Matches && subResult) {
          return true;
        }

        let bodyResult = FiltaQuilla.Util.bodyMimeMatch(aMsgHdr, searchValue, searchFlags, options);

        switch (aSearchOp) {
          case Matches:
            return bodyResult || subResult;
          case DoesntMatch:
            return !(bodyResult || subResult);
        }

        return false; //not matched or failed
      },
    };

    // search using arbitrary javascript
    self.javascript = {
      id: "filtaquilla@mesquilla.com#javascript",
      name: util.getBundleString("fq.javascript"),
      getEnabled: function javascript_getEnabled(_scope, _op) {
        return true;
      },
      needsBody: false,
      getAvailable: function javascript_getAvailable(_scope, _op) {
        return JavascriptEnabled;
      },
      getAvailableOperators: function javascript_getAvailableOperators(_scope) {
        return [Matches, DoesntMatch];
      },
      match: function javascript_match(message, aSearchValue, aSearchOp) {
        const script = aSearchValue;
        // the javascript stored in aSearchValue should use "message" to
        // reference the nsIMsgDBHdr objst for the message
        // we only pass in a controlled set of data using the "context" parameter
        const context = {
          message,
          fq_operator: aSearchOp,
          fq_method: "javascript",
        };

        switch (aSearchOp) {
          case Matches:
            // [issue 338] eval rejected by CSP
            return util.saferEval(script, context);
          case DoesntMatch:
            // [issue 338] eval rejected by CSP
            return !util.saferEval(script, context);
        }
      },
    };

    self.threadHeadTag = {
      id: "filtaquilla@mesquilla.com#threadheadtag",
      name: util.getBundleString("fq.threadHeadTag"),
      getEnabled: function threadHeadTag_getEnabled(_scope, _op) {
        return true;
      },
      needsBody: false,
      getAvailable: function threadHeadTag_getAvailable(_scope, _op) {
        return ThreadHeadTagEnabled;
      },
      getAvailableOperators: function threadHeadTag_getAvailableOperators(_scope) {
        return [Is, Isnt, Contains, DoesntContain, IsEmpty, IsntEmpty];
      },
      match: function threadHeadTag_matches(message, aSearchValue, aSearchOp) {
        let thread = null;
        let rootHdr = null;
        try {
          thread = message.folder.msgDatabase.getThreadContainingMsgHdr(message);
          rootHdr = thread.getChildHdrAt(0);
        } catch (e) {
          void e;
          rootHdr = message;
        }


        let msgKeyArray = _getTagArray(rootHdr);

        // -- Now try to match the search term

        // special-case empty for performance reasons
        if (msgKeyArray.length == 0) {
          return aSearchOp == DoesntContain || aSearchOp == Isnt || aSearchOp == IsEmpty;
        } else if (aSearchOp == IsEmpty) {return false;}
        else if (aSearchOp == IsntEmpty) {return true;}

        // loop through all message keywords
        for (let i = 0; i < msgKeyArray.length; i++) {
          let isValue = aSearchValue == msgKeyArray[i];
          switch (aSearchOp) {
            case Is:
              return isValue && msgKeyArray.length == 1;
            case Isnt:
              return !(isValue && msgKeyArray.length == 1);
            case Contains:
              if (isValue) {return true;}
              break;
            case DoesntContain:
              if (isValue) {return false;}
              break;
          }
        }
        // We got through a non-empty list with no match. Only Contains and
        // DoesntContain can do this.
        return aSearchOp == DoesntContain;
      },
    };

    self.threadAnyTag = {
      id: "filtaquilla@mesquilla.com#threadanytag",
      name: util.getBundleString("fq.threadAnyTag"),
      getEnabled: function threadAnyTag_getEnabled(_scope, _op) {
        return true;
      },
      needsBody: false,
      getAvailable: function threadAnyTag_getAvailable(_scope, _op) {
        return ThreadAnyTagEnabled;
      },
      getAvailableOperators: function threadAnyTag_getAvailableOperators(_scope) {
        return [Contains, DoesntContain, IsntEmpty];
      },
      match: function threadAnyTag_matches(message, aSearchValue, aSearchOp) {
        let tagArray = tagService.getAllTags({}),
          tagKeys = {};
        for (let tagInfo of tagArray) {
          if (tagInfo.tag) {tagKeys[tagInfo.key] = true;}
        }

        let thread = message.folder.msgDatabase.getThreadContainingMsgHdr(message),
          // we limit the number of thread items that we look at, but we always look at the thread root
          threadCount = Math.min(thread.numChildren, maxThreadScan),
          myKey = message.messageKey,
          threadStart = 0;

        if (threadCount < thread.numChildren) {
          // find this message in the thread, and use that as the center of the search
          let threadIndex = 0;
          for (; threadIndex < thread.numChildren; threadIndex++) {
            if (myKey == thread.getChildKeyAt(threadIndex)) {break;}
          }
          threadStart = threadIndex - maxThreadScan / 2;
          if (threadStart + threadCount > thread.numChildren) {
            threadStart = thread.numChildren - threadCount;
          }
            
          if (threadStart < 0) {threadStart = 0;}
        }

        for (let index = 0; index < threadCount; index++) {
          // always examine the thread head
          let useIndex = index == 0 ? 0 : threadStart + index,
            hdr = thread.getChildHdrAt(useIndex); // was getChildAt
          //  -- Get and cleanup the list of message headers following code from
          //  -- msgHdrViewOverlay.js SetTagHeader()

          // extract the tag keys from the msgHdr
          let msgKeyArray = hdr.getStringProperty("keywords").split(" "),
            // attach legacy label to the front if not already there
            label = hdr.label;
          if (label) {
            let labelKey = "$label" + label;
            if (msgKeyArray.indexOf(labelKey) < 0) {msgKeyArray.unshift(labelKey);}
          }

          // Rebuild the keywords string with just the keys that are actual tags or
          // legacy labels and not other keywords like Junk and NonJunk.
          // Retain their order, though, with the label as oldest element.
          for (let i = msgKeyArray.length - 1; i >= 0; --i) {
            if (!(msgKeyArray[i] in tagKeys)) {msgKeyArray.splice(i, 1);} // remove non-tag key
          }

          // -- Now try to match the search term

          // special-case empty for performance reasons
          if (msgKeyArray.length == 0) {continue;}

          // there is at least one tag
          if (aSearchOp == IsntEmpty) {return true;}

          // loop through all message keywords
          for (let i = 0; i < msgKeyArray.length; i++) {
            if (aSearchValue == msgKeyArray[i]) {
              if (aSearchOp == Contains) {return true;}
              if (aSearchOp == DoesntContain) {return false;}
            }
          }
        }
        // We got through all messages with no match.
        return aSearchOp == DoesntContain;
      },
    };

    var { ToneQuillaPlay } = ChromeUtils.importESModule(
      "resource://filtaquilla/ToneQuillaPlay.sys.mjs"
    );

    try {
      await ToneQuillaPlay.init();
      ToneQuillaPlay.window = window;
    } catch (ex) {
      FiltaQuilla.Util.logException("ToneQuillaPlay.init failed.", ex);
    }
    let tonequilla_name = util.getBundleString("filtaquilla.playSound");
    self.playSound = {
      id: "tonequilla@mesquilla.com#playSound",
      name: tonequilla_name,
      applyAction: function (aMsgHdrs, aActionValue, _aListener, _aType, _aMsgWindow) {
        util.logDebug("ToneQuillaPlay.queueToPlay", aActionValue);
        ToneQuillaPlay.queueToPlay(aActionValue);
      },
      isValidForType: function (_type, _scope) {
        return tonequillaEnabled;
      },

      validateActionValue: function (_value, _folder, _type) {
        return null;
      },

      allowDuplicates: true,
    };
  };

  self.setOptions = function () {
    // enable features from acbout:config
    const prefs = Services.prefs.getBranch("extensions.filtaquilla.");

    // 1. Enable Actions
    try {
      maxThreadScan = prefs.getIntPref("maxthreadscan");
    } catch (e) {
      maxThreadScan = 20;
      void e;
    }

    try {
      subjectAppendEnabled = prefs.getBoolPref("subjectAppend.enabled");
    } catch (e) {void e;}

    try {
      subjectSuffixEnabled = prefs.getBoolPref("subjectSuffix.enabled");
    } catch (e) {void e;}

    try {
      removeKeywordEnabled = prefs.getBoolPref("removeKeyword.enabled");
    } catch (e) {
      void e;
    }

    try {
      removeFlaggedEnabled = prefs.getBoolPref("removeFlagged.enabled");
    } catch (e) {
      void e;
    }

    try {
      markUnreadEnabled = prefs.getBoolPref("markUnread.enabled");
    } catch (e) {
      void e;
    }

    try {
      markRepliedEnabled = prefs.getBoolPref("markReplied.enabled");
    } catch (e) {
      void e;
    }

    try {
      noBiffEnabled = prefs.getBoolPref("noBiff.enabled");
    } catch (e) {
      void e;
    }

    try {
      copyAsReadEnabled = prefs.getBoolPref("copyAsRead.enabled");
    } catch (e) {
      void e;
    }

    try {
      launchFileEnabled = prefs.getBoolPref("launchFile.enabled");
    } catch (e) {
      void e;
    }

    try {
      runFileEnabled = prefs.getBoolPref("runFile.enabled");
    } catch (e) {
      void e;
    }

    try {
      runFileUnicode = prefs.getBoolPref("runFile.unicode");
    } catch (e) {
      void e;
    }

    try {
      trainAsJunkEnabled = prefs.getBoolPref("trainAsJunk.enabled");
    } catch (e) {
      void e;
    }

    try {
      trainAsGoodEnabled = prefs.getBoolPref("trainAsGood.enabled");
    } catch (e) {
      void e;
    }

    try {
      printEnabled = prefs.getBoolPref("print.enabled");
    } catch (e) {
      void e;
    }

    try {
      addSenderEnabled = prefs.getBoolPref("addSender.enabled");
    } catch (e) {
      void e;
    }

    try {
      saveAttachmentEnabled = prefs.getBoolPref("saveAttachment.enabled");
    } catch (e) {
      void e;
    }

    try {
      detachAttachmentsEnabled = prefs.getBoolPref("detachAttachments.enabled");
    } catch (e) {
      void e;
    }

    try {
      javascriptActionEnabled = prefs.getBoolPref("javascriptAction.enabled");
    } catch (e) {
      void e;
    }

    try {
      javascriptActionBodyEnabled = prefs.getBoolPref("javascriptActionBody.enabled");
    } catch (e) {
      void e;
    }

    try {
      regexpCaseInsensitiveEnabled = prefs.getBoolPref("regexpCaseInsensitive.enabled");
    } catch (e) {
      void e;
    }

    try {
      tonequillaEnabled = prefs.getBoolPref("tonequilla.enabled");
    } catch (e) {
      void e;
    }

    try {
      saveMessageAsFileEnabled = prefs.getBoolPref("saveMessageAsFile.enabled");
    } catch (e) {
      void e;
    }

    try {
      moveLaterEnabled = prefs.getBoolPref("moveLater.enabled");
    } catch (e) {
      void e;
    }

    try {
      archiveMessageEnabled = prefs.getBoolPref("archiveMessage.enabled");
    } catch (e) {
      void e;
    }

    try {
      fwdSmartTemplatesEnabled = prefs.getBoolPref("smarttemplates.fwd.enabled");
    } catch (e) {
      void e;
    }

    try {
      rspSmartTemplatesEnabled = prefs.getBoolPref("smarttemplates.rsp.enabled");
    } catch (e) {
      void e;
    }

    // 2. Enable conditions
    try {
      SubjectRegexEnabled = prefs.getBoolPref("SubjectRegexEnabled");
    } catch (e) {
      void e;
    }

    try {
      HeaderRegexEnabled = prefs.getBoolPref("HeaderRegexEnabled");
    } catch (e) {
      void e;
    }

    try {
      JavascriptEnabled = prefs.getBoolPref("JavascriptEnabled");
    } catch (e) {void e;}

    try {
      SearchBccEnabled = prefs.getBoolPref("SearchBccEnabled");
    } catch (e) {
      void e;
    }
    try {
      ThreadHeadTagEnabled = prefs.getBoolPref("ThreadHeadTagEnabled");
    } catch (e) {
      void e;
    }
    try {
      ThreadAnyTagEnabled = prefs.getBoolPref("ThreadAnyTagEnabled");
    } catch (e) {
      void e;
    }

    try {
      FolderNameEnabled = prefs.getBoolPref("FolderNameEnabled");
    } catch (e) {
      void e;
    }

    try {
      AttachmentRegexEnabled = prefs.getBoolPref("AttachmentRegexEnabled");
    } catch (e) {
      void e;
    }

    try {
      BodyRegexEnabled = prefs.getBoolPref("BodyRegexEnabled");
    } catch (e) {
      void e;
    }

    try {
      SubjectBodyRegexEnabled = prefs.getBoolPref("SubjectBodyRegexEnabled");
    } catch (e) {
      void e;
    }

    fileNamesSpaceCharacter = prefs.getStringPref("fileNames.spaceCharacter");
  };

  // extension initialization
  self.onLoad = async function () {
    if (self.initialized) {return;}

    await self._init();

    self.setOptions();

    var filterService = Cc["@mozilla.org/messenger/services/filters;1"].getService(
      Ci.nsIMsgFilterService
    );
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
    // [issue 153]
    // test: filterService.getCustomAction("filtaquilla@mesquilla.com#fwdSmart")
    filterService.addCustomAction(self.fwdSmartTemplates);
    filterService.addCustomAction(self.replySmartTemplates);
    filterService.addCustomAction(self.addSender);
    filterService.addCustomAction(self.saveAttachment);
    filterService.addCustomAction(self.detachAttachments);
    filterService.addCustomAction(self.javascriptAction);
    filterService.addCustomAction(self.javascriptActionBody);
    filterService.addCustomAction(self.saveMessageAsFile);
    filterService.addCustomAction(self.moveLater);
    filterService.addCustomAction(self.playSound);
    filterService.addCustomAction(self.archiveMessage);
    filterService.addCustomAction(self.trainAsJunk);

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
      filterService.addCustomTerm(self.attachmentRegex);
    }

    // Inherited properties setup
    // standard format for inherited property rows
    //   defaultValue:  value if inherited property missing (boolean true or false)
    //   name:          localized display name
    //   property:      inherited property name
    /*    
    // [issue 318] REMOVED
    if (typeof InheritedPropertiesGrid !== "undefined") {
      InheritedPropertiesGrid.addPropertyObject(applyIncomingFilters);
    }
*/

    self.initialized = true;
  };

  // local private functions
  // constructor for the MoveLaterNotify object
  function MoveLaterNotify(aMessages, aSource, aDestination, aTimerIndex) {
    // thunderbird 78 tidies up the aMessages array during apply, so we need to make a copy:
    this.messages = [];
    // clone the messages array
    for (let i = 0; i < aMessages.length; i++) {
      this.messages.push(aMessages[i]);
    }
    util.logDebug("MoveLaterNotify ()", aMessages, aSource, aDestination, aTimerIndex);
    this.source = aSource;
    this.destination = aDestination;
    this.timerIndex = aTimerIndex;
    this.recallCount = MOVE_LATER_LIMIT;
  }

  MoveLaterNotify.prototype.notify = function notify(_aTimer) {
    // Check the moveLater values for the headers. If this is set by a routine
    //  with a reliable finish listener, then we will wait until that is done to
    //  move. For others, we move on the first callback after the delay.
    const isMove = true,
      allowUndo = false;
    let moveLaterCount = -1;
    this.recallCount--;
    for (let i = 0; i < this.messages.length; i++) {
      let msgHdr = this.messages[i];
      try {
        let localCount = msgHdr.getUint32Property("moveLaterCount");
        if (localCount > moveLaterCount) {moveLaterCount = localCount;}
      } catch (e) {void e;}
    }
    if (moveLaterCount <= 0 || this.recallCount <= 0) {
      // execute move
      MailServices.copy.copyMessages(
        this.source,
        this.messages,
        this.destination,
        isMove,
        null,
        null,
        allowUndo
      );
      moveLaterTimers[this.timerIndex] = null;
      if (this.messages.clear) {this.messages.clear();} // release all objects, just in case.
    } else {
      // reschedule another check
      moveLaterTimers[this.timerIndex].initWithCallback(
        this,
        MOVE_LATER_DELAY,
        Ci.nsITimer.TYPE_ONE_SHOT
      );
    }
  };

  // is this search scope local, and therefore valid for db-based terms?
  function _isLocalSearch(aSearchScope) {
    switch (aSearchScope) {
      case Ci.nsMsgSearchScope.offlineMail:
      case Ci.nsMsgSearchScope.offlineMailFilter:
      case Ci.nsMsgSearchScope.onlineMailFilter:
      case Ci.nsMsgSearchScope.localNews:
      case Ci.nsMsgSearchScope.newsFilter:
        return true;
      default:
        FiltaQuilla.Util.logDebugOptional("isLocal", "isLocalSearch = FALSE!", aSearchScope); // test!!!
        return false;
    }
  }

  //  take the text utf8Append and either prepend (direction == true)
  //    or suffix (direction == false) to the subject
  function _mimeAppend(utf8Append, subject, direction) {
    // append a UTF8 string to a mime-encoded subject
    var mimeConvert = Cc["@mozilla.org/messenger/mimeconverter;1"].getService(Ci.nsIMimeConverter),
      decodedSubject = mimeConvert.decodeMimeHeader(subject, null, false, true);

    const appendedSubject = direction ? utf8Append + decodedSubject : decodedSubject + utf8Append;
    const recodedSubject = mimeConvert.encodeMimePartIIStr_UTF8(appendedSubject, false, "UTF-8", 0, 72);
    return recodedSubject;
  }

  function _replaceParameters(hdr, parameter) {
    // replace ambersand-delimited fields in a parameter
    // eslint-disable-next-line no-unused-vars
    function convertFromUnicode(aSrc) {
      // [issue 102] Variables @SUBJECT@ and others - decoding problems - WIP!!
      let unicodeConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(
        Ci.nsIScriptableUnicodeConverter
      );
      unicodeConverter.charset = "UTF-8";
      return unicodeConverter.ConvertFromUnicode(aSrc);
    }

    if (/@SUBJECT@/.test(parameter)) {
      // let str = convertFromUnicode(hdr.mime2DecodedSubject);
      return parameter.replace(/@SUBJECT@/, hdr.mime2DecodedSubject);
    }
    if (/@AUTHOR@/.test(parameter)) {return parameter.replace(/@AUTHOR@/, hdr.mime2DecodedAuthor);}
    if (/@MESSAGEID@/.test(parameter)) {return parameter.replace(/@MESSAGEID@/, hdr.messageId);}
    if (/@DATE@/.test(parameter)) {return parameter.replace(/@DATE@/, Date(hdr.date / 1000));}
    if (/@RECIPIENTS@/.test(parameter))
      {return parameter.replace(/@RECIPIENTS@/, hdr.mime2DecodedRecipients);}
    if (/@CCLIST@/.test(parameter)) {return parameter.replace(/@CCLIST@/, hdr.ccList);}
    if (/@DATEINSECONDS@/.test(parameter))
      {return parameter.replace(/@DATEINSECONDS@/, hdr.dateInSeconds);}
    if (/@MESSAGEURI@/.test(parameter))
      {return parameter.replace(/@MESSAGEURI@/, hdr.folder.generateMessageURI(hdr.messageKey));}
    if (/@FOLDERNAME@/.test(parameter))
      {return parameter.replace(/@FOLDERNAME@/, hdr.folder.prettyName);}
    if (/@PROPERTY@.+@/.test(parameter)) {
      // This is a little different, the actual property (which is typically a
      // custom db header) is stored like @PROPERTY@X-SPAM@
      // You'll need to add the custom db header manually though.
      var matches = /(.*)@PROPERTY@(.+)@(.*)/.exec(parameter);
      if (matches && matches.length == 4) {
        let property = matches[2];
        try {
          var value = hdr.getStringProperty(property.toLowerCase());
          return matches[1] + value + matches[3];
        } catch (e) {
          void e;
        }
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
      if (tagInfo.tag) {tagKeys[tagInfo.key] = true;}
    }

    // extract the tag keys from the msgHdr
    let msgKeyArray = aMsgHdr.getStringProperty("keywords").split(" ");

    // attach legacy label to the front if not already there
    let label = aMsgHdr.label;
    if (label) {
      let labelKey = "$label" + label;
      if (msgKeyArray.indexOf(labelKey) < 0) {msgKeyArray.unshift(labelKey);}
    }

    // Rebuild the keywords string with just the keys that are actual tags or
    // legacy labels and not other keywords like Junk and NonJunk.
    // Retain their order, though, with the label as oldest element.
    for (let i = msgKeyArray.length - 1; i >= 0; --i) {
      if (!(msgKeyArray[i] in tagKeys)) {msgKeyArray.splice(i, 1);} // remove non-tag key
    }
    return msgKeyArray;
  }

  var gJunkService;
  function _trainJunkFilter(aIsJunk, aMsgHdrs, aMsgWindow) {
    if (!gJunkService)
      {gJunkService = Cc["@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter"].getService(
        Ci.nsIJunkMailPlugin
      );}
    for (var i = 0; i < aMsgHdrs.length; i++) {
      const hdr = aMsgHdrs[i];
      // get the old classification
      let junkscore = hdr.getStringProperty("junkscore"),
        junkscoreorigin = hdr.getStringProperty("junkscoreorigin"),
        oldClassification = Ci.nsIJunkMailPlugin.UNCLASSIFIED;
      if (junkscoreorigin == "user") {
        // which is a proxy for "trained in bayes"
        if (junkscore == "100") {oldClassification = Ci.nsIJunkMailPlugin.JUNK;}
        else if (junkscore == "0") {oldClassification = Ci.nsIJunkMailPlugin.GOOD;}
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
      if (oldClassification != newClassification) {
        gJunkService.setMessageClassification(
          msgURI,
          oldClassification,
          newClassification,
          aMsgWindow,
          null
        );
      }
    }

    // For IMAP, we need to set the junk flag
    // We'll assume this is a single folder
    const hdr = aMsgHdrs[0];
    var folder = hdr.folder;
    if (folder instanceof Ci.nsIMsgImapMailFolder) {
      // need to update IMAP custom flags
      if (aMsgHdrs.length) {
        let msgKeys = new Array();
        for (let i = 0; i < aMsgHdrs.length; i++) {msgKeys[i] = aMsgHdrs[i].messageKey;}
        folder.storeCustomKeywords(
          null,
          aIsJunk ? "Junk" : "NonJunk",
          aIsJunk ? "NonJunk" : "Junk",
          msgKeys,
          msgKeys.length
        );
      }
    }
  }

  function _getRegEx(aSearchValue) {
    /*
     * If there are no flags added, you can add a regex expression without
     * / delimiters. If we detect a / though, we will look for flags and
     * add them to the regex search. See bug m165.
     */
    let searchValue = aSearchValue,
      searchFlags = "",
      searchOptions = [];
    if (aSearchValue.charAt(0) == "/") {
      let lastSlashIndex = aSearchValue.lastIndexOf("/");
      searchValue = aSearchValue.substring(1, lastSlashIndex);
      searchFlags = aSearchValue.substring(lastSlashIndex + 1);
      let sw = searchFlags.match(/{.*}/) || [];
      if (sw && sw.length) {
        const startOptions = searchFlags.indexOf(sw[0]),
          optionString = searchFlags.substring(startOptions + 1, startOptions + sw[0].length - 1);
        searchOptions = optionString.split(",");

        searchFlags = searchFlags.substring(0, startOptions);
      }
    }
    if (
      regexpCaseInsensitiveEnabled &&
      !searchFlags.includes("i") &&
      !searchFlags.includes(REGEX_CASE_SENSITIVE_FLAG)
    ) {
      searchFlags += "i";
    }

    return [searchValue, searchFlags, searchOptions];
  }

  async function _saveAs(aMsgHdr, aDirectory, aType, copyListener) {
    const msgSpec = aMsgHdr.folder.getUriForMsg(aMsgHdr),
      subject = MailServices.mimeConverter.decodeMimeHeader(aMsgHdr.subject, null, false, true), // [issue 53]
      fileName = _sanitizeName(subject),
      fullFileName = fileName + "." + aType,
      file = aDirectory.clone();

    file.append(fullFileName);
    try {
      file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0o600);
      const service = MailServices.messageServiceFromURI(msgSpec);

      return new Promise((resolve, reject) => {
        let urlListener = createUrlListener(resolve, copyListener);

        try {
          // in Tb115 this used to be called SaveMessageToDisk
          if (service.saveMessageToDisk) {
            service.saveMessageToDisk(msgSpec, file, false, urlListener, true, null);
          } else {
            reject(new Error("No valid saveMessageToDisk method found."));
          }
        } catch (ex) {
          console.error("Error saving message:", ex);
          reject(ex);
        }
      });
    } catch (ex) {
      console.log("Could not create file with name:" + fullFileName);
      throw ex;
    }
  }

  // OBSOLETE from http://mxr.mozilla.org/comm-1.9.2/source/mozilla/toolkit/components/search/nsSearchService.js#677
  /**
   * Removes invalid file name characters
   *
   * @returns a sanitized name to be used as a filename, or a random name
   *          if a sanitized name cannot be obtained (if aName contains
   *          no valid characters).
   */
  function _sanitizeName(aName, includesExtension = false) {
    const prefs = Services.prefs.getBranch("extensions.filtaquilla.");
    let chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789()_-+'!%" +
        (includesExtension ? "." : ""),
      maxLength = prefs.getIntPref("fileNames.maxLength") || 60,
      whiteList = prefs.getStringPref("fileNames.whiteList") || "";

    let replaceMap = new Map();
    function addItems(keys, val) {
      let list = keys.split("|");
      for (let x of list) {
        replaceMap.set(x, val);
      }
    }

    let spaceChar = fileNamesSpaceCharacter.substring(0, 1);
    if (!chars.includes(spaceChar)) {
      chars += spaceChar;
    }

    let str = aName; // .toLowerCase();
    // diacritics
    // eslint-disable-next-line no-constant-condition
    if (true) {
      // 1. create list of blacklisted (replaced) characters
      addItems("Ä", "Ae");
      addItems("æ|ǽ|ä", "ae");
      addItems("À|Á|Â|Ã|Å|Ǻ|Ā|Ă|Ą|Ǎ|А", "A");
      addItems("à|á|â|ã|å|ǻ|ā|ă|ą|ǎ|ª|а", "a");
      addItems("Б", "B");
      addItems("б", "b");
      addItems("Ç|Ć|Ĉ|Ċ|Č|Ц", "C");
      addItems("ç|ć|ĉ|ċ|č|ц", "c");
      addItems("Ð|Ď|Đ", "Dj");
      addItems("ð|ď|đ", "dj");
      addItems("Д", "D");
      addItems("д", "d");
      addItems("È|É|Ê|Ë|Ē|Ĕ|Ė|Ę|Ě|Е|Ё|Э", "E");
      addItems("è|é|ê|ë|ē|ĕ|ė|ę|ě|е|ё|э", "e");
      addItems("Ф", "F");
      addItems("ƒ|ф", "f");
      addItems("Ĝ|Ğ|Ġ|Ģ|Г", "G");
      addItems("ĝ|ğ|ġ|ģ|г", "g");
      addItems("Ĥ|Ħ|Х", "H");
      addItems("ĥ|ħ|х", "h");
      addItems("Ì|Í|Î|Ï|Ĩ|Ī|Ĭ|Ǐ|Į|İ|И", "I");
      addItems("ì|í|î|ï|ĩ|ī|ĭ|ǐ|į|ı|и", "i");
      addItems("Ĵ|Й", "J");
      addItems("ĵ|й", "j");
      addItems("Ķ|К", "K");
      addItems("ķ|к", "k");
      addItems("Ĺ|Ļ|Ľ|Ŀ|Ł|Л", "L");
      addItems("ĺ|ļ|ľ|ŀ|ł|л", "l");
      addItems("М", "M");
      addItems("м", "m");
      addItems("Ñ|Ń|Ņ|Ň|Н", "N");
      addItems("ñ|ń|ņ|ň|ŉ|н", "n");
      addItems("Ö", "Oe");
      addItems("œ|ö", "oe");
      addItems("Ò|Ó|Ô|Õ|Ō|Ŏ|Ǒ|Ő|Ơ|Ø|Ǿ|О", "O");
      addItems("ò|ó|ô|õ|ō|ŏ|ǒ|ő|ơ|ø|ǿ|º|о", "o");
      addItems("П", "P");
      addItems("п", "p");
      addItems("Ŕ|Ŗ|Ř|Р", "R");
      addItems("ŕ|ŗ|ř|р", "r");
      addItems("Ś|Ŝ|Ş|Ș|Š|С", "S");
      addItems("ś|ŝ|ş|ș|š|ſ|с", "s");
      addItems("Ţ|Ț|Ť|Ŧ|Т", "T");
      addItems("ţ|ț|ť|ŧ|т", "t");
      addItems("Ü", "Ue");
      addItems("ü", "ue");
      addItems("Ù|Ú|Û|Ũ|Ū|Ŭ|Ů|Ű|Ų|Ư|Ǔ|Ǖ|Ǘ|Ǚ|Ǜ|У", "U");
      addItems("ù|ú|û|ũ|ū|ŭ|ů|ű|ų|ư|ǔ|ǖ|ǘ|ǚ|ǜ|у", "u");
      addItems("В", "V");
      addItems("в", "v");
      addItems("Ý|Ÿ|Ŷ|Ы", "Y");
      addItems("ý|ÿ|ŷ|ы", "y");
      addItems("Ŵ", "W");
      addItems("ŵ", "w");
      addItems("Ź|Ż|Ž|З", "Z");
      addItems("ź|ż|ž|з", "z");
      addItems("Æ|Ǽ", "AE");
      addItems("ß", "ss");
      addItems("Ĳ", "IJ");
      addItems("ĳ", "ij");
      addItems("Œ", "OE");
      addItems("Ч", "Ch");
      addItems("ч", "ch");
      addItems("Ю", "Ju");
      addItems("ю", "ju");
      addItems("Я", "Ja");
      addItems("я", "ja");
      addItems("Ш", "Sh");
      addItems("ш", "sh");
      addItems("Щ", "Shch");
      addItems("щ", "shch");
      addItems("Ж", "Zh");
      addItems("ж", "zh");
      addItems("&", "+"); // improve readability

      // 2. remove whitelisted characters
      [...whiteList].forEach((l) => replaceMap.delete(l));

      // 3. replace stuff
      replaceMap.forEach((value, key) => {
        str = str.replace(new RegExp(key, "g"), value);
      });
    }

    // special characters
    let name = str.trim().replace(/ /g, spaceChar); // used to be "-"
    // eslint-disable-next-line no-useless-escape
    name = name.replace(/[@:|/\\\*\?]/g, "-");
    name = name.replace(/[$"<>,]/g, "").trim();
    let finalWhiteList = chars + whiteList; // add user white listed characters
    name = name
      .split("")
      .filter(function (el) {
        return finalWhiteList.indexOf(el) != -1;
      })
      .join("");

    if (!name) {
      // Our input had no valid characters - use a random name
      let cl = chars.length - 1;
      for (let i = 0; i < 8; ++i) {
        name += chars.charAt(Math.round(Math.random() * cl));
      }
    }

    if (name.length > maxLength) {
      let ext;
      if (includesExtension) {
        let i = name.lastIndexOf(".");
        if (i > 0) {
          ext = name.substr(i);
        }
      }
      if (ext) {
        name = name.substring(0, maxLength - ext.length) + ext;
      } else {
        name = name.substring(0, maxLength);
      }
    }

    return name;
  }

  function createUrlListener(resolve, copyListener) {
    // returns a nsIUrlListener
    return {
      OnStartRunningUrl: function (_aUrl) {
        copyListener.onStartCopy();
      },
      OnStopRunningUrl: function (aUrl, status) {
        let messageUri;
        if (aUrl instanceof Ci.nsIMsgMessageUrl) {messageUri = aUrl.uri;}
        const msgHdr = messenger.msgHdrFromURI(messageUri);
        const moveLaterCount = msgHdr.getUint32Property("moveLaterCount");
        if (moveLaterCount) {
          msgHdr.setUint32Property("moveLaterCount", moveLaterCount - 1);
        }
        // By passing this status to the resolve function, we effectively allow the Promise
        // to be settled with the operation's outcome, enabling subsequent
        // handling of success or failure states.
        copyListener.onStopCopy(status);
        resolve(status); // Resolve the Promise when saving completes
      },
    };
  }

  // eslint-disable-next-line no-unused-vars
  function _detachAttachments_old(
    messenger,
    directory,
    contentTypes,
    urls,
    displayNames,
    msgURIs,
    copyListener
  ) {
    const failedUris = [];

    return new Promise((resolve, reject) => {
      messenger.detachAttachmentsWOPrompts(directory, contentTypes, urls, displayNames, msgURIs, {
        OnStartRunningUrl(url) {
          copyListener.onStartCopy();
          util.logDebug(`Starting to detach attachment: ${url?.spec ?? "unknown URL"}`);
        },
        OnStopRunningUrl(url, status) {
          const urlSpec = url?.spec ?? "unknown URL";
          if (status === 0) {
            util.logDebug(`Attachment detached successfully: ${urlSpec}`, url);
            resolve(failedUris); // No failures
          } else {
            failedUris.push(urlSpec);
            util.logDebug(`---------------\nFailed to detach attachment: ${urlSpec}`, url);
            reject(new Error(`Failed to detach attachment: ${url?.spec}`));
          }
        },
      });
    })
      .then((failedUris) => {
        //  Pass failedUris through
        const result = failedUris.length ? Cr.NS_ERROR_FAILURE : Cr.NS_OK;
        util.logDebug(`calling copyListener.onStopCopy(${result}) ...`);
        copyListener.onStopCopy(result);
        return failedUris;
      })
      .catch((error) => {
        util.logDebug("exception: calling copyListener.onStopCopy() with failure");
        copyListener.onStopCopy(Cr.NS_ERROR_FAILURE);
        return Promise.reject(error);
      });
  }

  // actions that need the body can conflict with a move. These should
  //  set the MoveLaterCount to prevent problems, and then use a MoveLater
  //  function instead of a normal move.
  function _incrementMoveLaterCount(msgHdr) {
    let moveLaterCount = 0;
    try {
      moveLaterCount = msgHdr.getUint32Property("moveLaterCount");
    } catch (e) {
      void e;
    }
    moveLaterCount++;
    msgHdr.setUint32Property("moveLaterCount", moveLaterCount);
  }

  // use this for instant feedback after configuring through the options window
  let observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
  observerService.addObserver(
    {
      observe: function () {
        self.setOptions();
      },
    },
    "filtaquilla-options-changed",
    false
  );

  /* functions to move to experiment API in the future */
  FiltaQuilla.sanitizeName = _sanitizeName;
})();

// vim: set expandtab tabstop=2 shiftwidth=2:
