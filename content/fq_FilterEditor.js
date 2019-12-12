"use strict";
/*
 ***** BEGIN LICENSE BLOCK *****
 * This file is part of FiltaQuilla, Custom Filter Actions
 * rereleased by Axel Grude (original project by R Kent James
 * under the Mesquilla Project)
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
 */

{
  var {FiltaQuilla} = Components.utils.import("chrome://filtaquilla/content/filtaquilla-util.js"); // FiltaQuilla object
  const util = FiltaQuilla.Util,
        Ci = Components.interfaces,
        Cc = Components.classes;

  util.logDebug("fq_FilterEditor.js - start...");


  function getChildNode(type) {
      const elementMapping = {
           // mappings to thunderbird's ruleactiontarget-* elements
          "filtaquilla@mesquilla.com#subjectAppend": "ruleactiontarget-forwardto",
          "filtaquilla@mesquilla.com#subjectSuffix": "ruleactiontarget-forwardto",
          "filtaquilla@mesquilla.com#removeTag": "ruleactiontarget-tag",
          "filtaquilla@mesquilla.com#copyAsRead": "ruleactiontarget-folder",
          "filtaquilla@mesquilla.com#moveLater": "ruleactiontarget-folder",
           // mappings to our ruleactiontarget-* custom elements
          "filtaquilla@mesquilla.com#launchFile": "filtaquilla-ruleactiontarget-launchpicker",
          "filtaquilla@mesquilla.com#runFile": "filtaquilla-ruleactiontarget-runpicker",
          "filtaquilla@mesquilla.com#addSender": "filtaquilla-ruleactiontarget-abpicker",
          "filtaquilla@mesquilla.com#saveAttachment": "filtaquilla-ruleactiontarget-directorypicker",
          "filtaquilla@mesquilla.com#detachAttachments": "filtaquilla-ruleactiontarget-directorypicker",
          "filtaquilla@mesquilla.com#javascriptAction": "filtaquilla-ruleactiontarget-javascriptaction",
          "filtaquilla@mesquilla.com#javascriptActionBody": "filtaquilla-ruleactiontarget-javascriptaction",
          "filtaquilla@mesquilla.com#saveMessageAsFile": "filtaquilla-ruleactiontarget-directorypicker",
      };
      const elementName = elementMapping[type];
      return elementName ? document.createXULElement(elementName) : null;
  }

  function patchRuleactiontargetWrapper() {
    let wrapper = customElements.get("ruleactiontarget-wrapper");
    if (wrapper) {
      let alreadyPatched = wrapper.prototype.hasOwnProperty("_patchedByFiltaQuillaExtension") ?
                           wrapper.prototype._patchedByFiltaQuillaExtension :
                           false;
      if (alreadyPatched) {
        // already patched
        return;
      }
      let prevMethod = wrapper.prototype._getChildNode;
      if (prevMethod) {
        wrapper.prototype._getChildNode = function(type) {
          let element = getChildNode(type);
          return element ? element : prevMethod(type);
        };
        wrapper.prototype._patchedByFiltaQuillaExtension = true;
      }
    }
  }

  patchRuleactiontargetWrapper();

  const updateParentNode = (parentNode) => {
    if (parentNode.hasAttribute("initialActionIndex")) {
      let actionIndex = parentNode.getAttribute("initialActionIndex");
      let filterAction = gFilter.getActionAt(actionIndex);
      parentNode.initWithAction(filterAction);
    }
    parentNode.updateRemoveButton();
  };

  class FiltaQuillaRuleactiontargetBase extends MozXULElement { }


  /* CODE CONVERTED USING https://bgrins.github.io/xbl-analysis/converter/ */

  /* This Source Code Form is subject to the terms of the Mozilla Public
   * License, v. 2.0. If a copy of the MPL was not distributed with this
   * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


  class FiltaQuillaRuleactiontargetLaunchPicker extends FiltaQuillaRuleactiontargetBase {
    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      this.appendChild(MozXULElement.parseXULToFragment(`
        <hbox>
          <textbox class="ruleactionitem" onchange="this.parentNode.value = this.value;"></textbox>
          <toolbarbutton image="chrome://filtaquilla/skin/folder.png"
                         class="focusbutton"
                         tooltiptext="dummy"
                         oncommand="this.parentNode.parentNode.getURL()">
          </toolbarbutton>
          <toolbarbutton image="chrome://filtaquilla/skin/folder_go.png"
                         class="focusbutton"
                         tooltiptext="dummy"
                         oncommand="this.parentNode.parentNode.launch()"></toolbarbutton>
        </hbox>
      `));

      this.hbox = this.getElementsByTagName("hbox")[0]; // document.getAnonymousNodes(this)[0];
      this.textbox = this.hbox.firstChild;              // document.getAnonymousNodes(this)[0].firstChild;
      const txtLaunchSelector = util.getBundleString('filtaquilla.launcher.select', "Select a File…");
      this.launchtitle = txtLaunchSelector;

      let btns = this.getElementsByTagName("toolbarbutton");
      btns[0].setAttribute('tooltiptext', txtLaunchSelector);
      btns[1].setAttribute('tooltiptext',
        util.getBundleString('filtaquilla.launcher.launch', "Launch the File!"));


      updateParentNode(this.closest(".ruleaction"));

      if (typeof(this.hbox.value) != 'undefined')
        this.textbox.setAttribute('value', this.hbox.value);

    }

    getURL() {
      const nsIFilePicker = Ci.nsIFilePicker;
      var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
      fp.init(window, this.launchtitle, nsIFilePicker.modeOpen);
      fp.appendFilters(nsIFilePicker.filterAll);
      try {
        var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile || Ci.nsIFile);
        file.initWithPath(this.textbox.value);
        fp.displayDirectory = file.parent;
        fp.defaultString = file.leafName;
      } catch (e) {}

      //closured stuff:
      let pathBox = this.textbox,
        hBox = this.hbox;

      let fpCallback = function fpCallback_done(aResult) {
        if (aResult == nsIFilePicker.returnOK) {
          pathBox.value = fp.file.path;
          hBox.value = fp.file.path;
        }
      }

      if (fp.open)
        fp.open(fpCallback);
      else { // old code
        fpCallback(fp.show());
      }

    }

    launch() {
      var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile || Ci.nsIFile);
      file.initWithPath(this.textbox.value);
      file.launch();
    }
  } // launch picker

  customElements.define("filtaquilla-ruleactiontarget-launchpicker", FiltaQuillaRuleactiontargetLaunchPicker);


  class FiltaQuillaRuleactiontargetRunPicker extends FiltaQuillaRuleactiontargetBase {
    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      this.appendChild(MozXULElement.parseXULToFragment(`
        <hbox>
          <textbox class="ruleactionitem" onchange="this.parentNode.value = this.value;"></textbox>
          <toolbarbutton image="chrome://filtaquilla/skin/folder.png" class="focusbutton" tooltiptext="dummy" oncommand="this.parentNode.parentNode.getURL()"></toolbarbutton>
        </hbox>
      `));

      this.hbox = this.getElementsByTagName("hbox")[0]; // document.getAnonymousNodes(this)[0];
      this.textbox =  this.hbox.firstChild;             // document.getAnonymousNodes(this)[0].firstChild;

      let btn = this.getElementsByTagName("toolbarbutton")[0];
      btn.setAttribute('tooltiptext',
        util.getBundleString('filtaquilla.runProgram.select', "Select a Program…"));

      this.launchtitle = util.getBundleString('filtaquilla.runProgram.title', "Select a Program to run");

      updateParentNode(this.closest(".ruleaction"));
      this.textbox.setAttribute('value', this.hbox.value);

    }

    getURL() {
      const nsIFilePicker = Ci.nsIFilePicker;
      var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
      fp.init(window, this.launchtitle, nsIFilePicker.modeOpen);
      fp.appendFilters(nsIFilePicker.filterAll);
      try {
        var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile || Ci.nsIFile);
        // the file url is the first comma-separated parameter
        var filePath = this.textbox.value.split(',')[0];
        file.initWithPath(filePath);
        fp.displayDirectory = file.parent;
        fp.defaultString = file.leafName;
      } catch (e) {}

      //closured stuff:
      let pathBox = this.textbox,
        hBox = this.hbox;

      let fpCallback = function fpCallback_done(aResult) {
        if (aResult == nsIFilePicker.returnOK) {
          // We will setup a default using the subject
          pathBox.value = fp.file.path + ",@SUBJECT@,@MESSAGEID@";
          hBox.value = pathBox.value;
        }
      }

      if (fp.open)
        fp.open(fpCallback);
      else { // old code
        fpCallback(fp.show());
      }

    }
  } // run picker

  customElements.define("filtaquilla-ruleactiontarget-runpicker", FiltaQuillaRuleactiontargetRunPicker);


  class FiltaQuillaRuleactiontargetAbPicker extends FiltaQuillaRuleactiontargetBase {
    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      this.appendChild(MozXULElement.parseXULToFragment(`
        <menulist flex="1" class="ruleactionitem" inherits="disabled" onchange="this.parentNode.setAttribute('value', this.value);this.parentNode.value=this.value">
          <menupopup></menupopup>
        </menulist>
      `));
      // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!

      let menulist = this.getElementsByTagName("menulist")[0]; // document.getAnonymousNodes(this)[0],
        value = menulist.value,
        menupopup = menulist.menupopup;

      // set the default to the personal address book
      if (!value || !value.length)
        value = "moz-abmdbdirectory://abook.mab";

      // recursively add all address books and email lists
      let abManager = Cc["@mozilla.org/abmanager;1"].getService(Ci.nsIAbManager);
      this.addDirectories(abManager.directories, menupopup);

      updateParentNode(this.closest(".ruleaction"));
      // scan all menupopup items to find the uri for the selection
      let valueElements = menupopup.getElementsByAttribute('value', value);
      if (valueElements && valueElements.length)
        menulist.selectedItem = valueElements[0];
      else
        menulist.selectedIndex = 0;
      this.value = menulist.selectedItem.getAttribute("value");;

    }

    addDirectories(aDirEnum, aMenupopup) {
      while (aDirEnum.hasMoreElements()) {
        let dir = aDirEnum.getNext();
        if (dir instanceof Ci.nsIAbDirectory) {
          // get children
          let newMenuItem = document.createElement('menuitem');
          let displayLabel = dir.dirName;
          if (dir.isMailList)
            displayLabel = "  " + displayLabel;
          newMenuItem.setAttribute('label', displayLabel);
          newMenuItem.setAttribute('value', dir.URI);
          aMenupopup.appendChild(newMenuItem);
          // recursive add of child mailing lists
          let childNodes = dir.childNodes;
          if (childNodes && childNodes.hasMoreElements())
            this.addDirectories(childNodes, aMenupopup);
        }
      }
    }
  }

  customElements.define("filtaquilla-ruleactiontarget-abpicker", FiltaQuillaRuleactiontargetAbPicker);


  class FiltaQuillaRuleactiontargetDirectoryPicker extends FiltaQuillaRuleactiontargetBase {
    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      this.appendChild(MozXULElement.parseXULToFragment(`
        <hbox>
          <textbox class="ruleactionitem" onchange="this.parentNode.value = this.value;"></textbox>
          <toolbarbutton image="chrome://filtaquilla/skin/folder.png" class="focusbutton" tooltiptext="dummy" oncommand="this.parentNode.parentNode.getURL()"></toolbarbutton>
        </hbox>
      `));

      this.hbox = this.getElementsByTagName("hbox")[0]; // document.getAnonymousNodes(this)[0];

      this.textbox = this.hbox.firstChild; //  document.getAnonymousNodes(this)[0].firstChild;
      this.dialogTitle = util.getBundleString('filtaquilla.selectFolder.title',"Select a Folder");
      let btn = this.getElementsByTagName("toolbarbutton")[0];
      btn.setAttribute("tooltiptext",
                       util.getBundleString('filtaquilla.selectFolder.btn',"Pick Folder…"));

      updateParentNode(this.closest(".ruleaction"));
      if (typeof(this.hbox.value) != 'undefined')
        this.textbox.setAttribute('value', this.hbox.value);
      else
        this.textbox.setAttribute('value', '');

    }

    getURL() {
      const nsIFilePicker = Ci.nsIFilePicker;
      var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
      fp.init(window, this.dialogTitle, nsIFilePicker.modeGetFolder);
      fp.appendFilters(nsIFilePicker.filterAll);
      try {
        var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile || Ci.nsIFile);
        // the file url is the first comma-separated parameter
        var filePath = this.textbox.value;
        file.initWithPath(filePath);
        fp.displayDirectory = file.parent;
        fp.defaultString = file.leafName;
      } catch (e) {}

      //closured stuff:
      let pathBox = this.textbox,
        hBox = this.hbox;

      let fpCallback = function fpCallback_done(aResult) {
        if (aResult == nsIFilePicker.returnOK) {
          // We will setup a default using the subject
          pathBox.value = fp.file.path;
          hBox.value = pathBox.value;
        }
      }

      if (fp.open)
        fp.open(fpCallback);
      else { // old code
        fpCallback(fp.show());
      }

    }
  } // directory picker

  customElements.define("filtaquilla-ruleactiontarget-directorypicker", FiltaQuillaRuleactiontargetDirectoryPicker);


  class FiltaQuillaRuleactiontargetJavascriptAction extends FiltaQuillaRuleactiontargetBase {
    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      this.appendChild(MozXULElement.parseXULToFragment(`
        <hbox>
          <textbox class="ruleactionitem" newlines="pasteintact" anonid="thetextbox" onchange="this.parentNode.value = this.value;"></textbox>
          <toolbarbutton image="chrome://filtaquilla/skin/script_edit.png" class="focusbutton" tooltiptext="dummy"></toolbarbutton>
        </hbox>
      `));

      this.hbox = this.getElementsByTagName("hbox")[0]; // document.getAnonymousNodes(this)[0];
      this.textbox = this.hbox.firstChild;              // document.getAnonymousNodes(this)[0].childNodes[0];
      this.toolbarbutton = this.getElementsByTagName("toolbarbutton")[0]; // document.getAnonymousNodes(this)[0].childNodes[1];
      this.toolbarbutton.addEventListener("command", this.onCommand, false);
      this.toolbarbutton.setAttribute('tooltiptext',
        util.getBundleString('filtaquilla.editJavascript', "Edit JavaScript…"));

      updateParentNode(this.closest(".ruleaction"));
      this.textbox.value = this.hbox.value;

    }

    onCommand() {
      let textbox = this.parentNode.firstChild;
      window.openDialog("chrome://filtaquilla/content/jsEditor.xul", "",
        "chrome, dialog, modal, resizable=yes", textbox);
    }
  }

  customElements.define("filtaquilla-ruleactiontarget-javascriptaction", FiltaQuillaRuleactiontargetJavascriptAction);

// ***********  CONDITIONS  ***********

  class FiltaQuillaSearchValueTag extends MozXULElement {
    updateSearchValue(menulist) {
      let target = this.closest(".search-value-custom");
      target.setAttribute("value", menulist.value);
      // The AssignMeaningfulName functions uses the item's js value, so set
      // this to allow this to be shown correctly.
      target.value = menulist.getAttribute('label');
    }

    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      this.appendChild(MozXULElement.parseXULToFragment(`
        <menulist flex="1" class="search-value-menulist" inherits="disabled"
                           oncommand="this.parentNode.updateSearchValue(this);">
          <menupopup class="search-value-popup"></menupopup>
        </menulist>
      `));
      // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!

      let target = this.closest(".search-value-custom"),
          wrapper = target.closest("search-value");
      let value = target.getAttribute("value"),
          menulist = this.getElementsByTagName("menulist")[0];

      let menuPopup = menulist.getElementsByTagName("menupopup")[0],
          tagService = Cc["@mozilla.org/messenger/tagservice;1"].getService(Ci.nsIMsgTagService),
          tagArray = tagService.getAllTags({}),
          selectedIndex = 0;

      for (let i = 0; i < tagArray.length; ++i) {
        let taginfo = tagArray[i],
            newMenuItem = document.createXULElement('menuitem');
        newMenuItem.setAttribute('label', taginfo.tag);
        newMenuItem.setAttribute('value', taginfo.key);
        menuPopup.appendChild(newMenuItem);
        if (taginfo.key == value)
          selectedIndex = i;
      }

      menulist.selectedIndex = selectedIndex;
      this.updateSearchValue(menulist);

      // override the opParentValue setter to detect ops needing no value
      wrapper.oldOpParentValueSetter = wrapper.__lookupSetter__('opParentValue');
      wrapper.__defineSetter__('opParentValue', function(aValue) {
        let elements = this.getElementsByClassName('search-value-custom');
        if (elements.length > 0) {
          let element = elements[0];
          // hide the value if not relevant
          if (aValue == Components.interfaces.nsMsgSearchOp.IsEmpty ||
            aValue == Components.interfaces.nsMsgSearchOp.IsntEmpty)
            element.setAttribute('hidden', 'true');
          else
            element.removeAttribute('hidden');
        }
        return this.oldOpParentValueSetter(aValue);
      });

      let searchrow = wrapper.parentNode.parentNode;
      let searchop = searchrow.getElementsByTagName('search-operator')[0].value;
      wrapper.opParentValue = searchop;

    }
  }

  customElements.define("filtaquilla-search-value-tag", FiltaQuillaSearchValueTag);


  util.logDebug("fq_FilterEditor.js - Finished.");


} // javascript action

// // XXX: As long as CSS "-moz-binding" works, the following code doesn't have
// //      to be used, but once mozilla disables bindings at all, the following
// //      custom elements have to be introduced somehow to filter editor (at
// //      the moment, I have no idea of how to do it).
//
///* This Source Code Form is subject to the terms of the Mozilla Public
//  * License, v. 2.0. If a copy of the MPL was not distributed with this
//  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
//
//"use strict";
//
//// This is loaded into all XUL windows. Wrap in a block to prevent
//// leaking to window scope.
//{
//
//    class FiltaQuillaSearchValueTextbox extends MozXULElement {
//      connectedCallback() {
//        if (this.delayConnectedCallback()) {
//          return;
//        }
//        this.textContent = "";
//        this.appendChild(MozXULElement.parseXULToFragment(`
//          <textbox flex="1" class="search-value-textbox" inherits="disabled" onchange="this.parentNode.setAttribute('value', this.value);this.parentNode.value=this.value"></textbox>
//        `));
//        // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!
//
//        let value = this.getAttribute("value");
//        let textbox = document.getAnonymousNodes(this)[0];
//        textbox.value = value;
//        this.value = value;
//        // override the opParentValue setter to detect ops needing no value
//        let parent = this.parentNode;
//        parent.oldOpParentValueSetter = parent.__lookupSetter__('opParentValue');
//        parent.__defineSetter__('opParentValue', function(aValue) {
//          let element = document.getAnonymousElementByAttribute(this, 'class', 'search-value-custom');
//          if (element) {
//            // hide the value if not relevant
//            if (aValue == Components.interfaces.nsMsgSearchOp.IsEmpty ||
//              aValue == Components.interfaces.nsMsgSearchOp.IsntEmpty)
//              element.setAttribute('hidden', 'true');
//            else
//              element.removeAttribute('hidden');
//          }
//          this.oldOpParentValueSetter(aValue);
//        });
//
//      }
//    }
//
//    customElements.define("filtaquilla-search-value-textbox", FiltaQuillaSearchValueTextbox);
//
//    class FiltaQuillaSearchValueJavascript extends MozXULElement {
//      connectedCallback() {
//        if (this.delayConnectedCallback()) {
//          return;
//        }
//        this.textContent = "";
//        this.appendChild(MozXULElement.parseXULToFragment(`
//          <toolbarbutton image="chrome://filtaquilla/skin/script_edit.png" class="focusbutton" tooltiptext="FROM-DTD-editJavascript"></toolbarbutton>
//          <textbox flex="1" class="search-value-textbox" inherits="disabled" newlines="pasteintact" onchange="this.parentNode.setAttribute('value', this.value);"></textbox>
//        `));
//        // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!
//
//        let textbox = document.getAnonymousNodes(this)[1];
//        let toolbarbutton = document.getAnonymousNodes(this)[0];
//        textbox.value = this.getAttribute("value");
//        toolbarbutton.addEventListener("command", this.onCommand, false);
//
//      }
//
//      onCommand() {
//        let textbox = document.getAnonymousNodes(document.getBindingParent(this))[1];
//        window.openDialog("chrome://filtaquilla/content/jsEditor.xul", "",
//          "chrome, dialog, modal, resizable=yes", textbox);
//      }
//    }
//
//    customElements.define("filtaquilla-search-value-javascript", FiltaQuillaSearchValueJavascript);
//
//}
//

// vim: set expandtab tabstop=2 shiftwidth=2:
