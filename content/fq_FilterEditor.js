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
  var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
  Services.scriptloader.loadSubScript("chrome://filtaquilla/content/filtaquilla-util.js") // FiltaQuilla object

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


  /* BINDINGS CODE CONVERTED USING https://bgrins.github.io/xbl-analysis/converter/ */
  /* This Source Code Form is subject to the terms of the Mozilla Public
   * License, v. 2.0. If a copy of the MPL was not distributed with this
   * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

  function defineIfNotPresent(element, elementClass) {
    if (!customElements.get(element))
      customElements.define(element, elementClass);
    else
      console.log ("custom Element is already defined: " + element);
  }

  class FiltaQuillaRuleactiontargetLaunchPicker extends FiltaQuillaRuleactiontargetBase {
    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      this.appendChild(MozXULElement.parseXULToFragment(`
        <hbox flex="1" class="flexelementcontainer">
          <html:input class="ruleactionitem flexinput" onchange="this.parentNode.value = this.value;"></html:input>
          <toolbarbutton image="chrome://messenger/skin/icons/folder.svg"
                         class="focusbutton"
                         tooltiptext="dummy"
                         oncommand="this.parentNode.parentNode.getURL()">
          </toolbarbutton>
          <toolbarbutton image="resource://filtaquilla-skin/folder_go.png"
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
  
  defineIfNotPresent("filtaquilla-ruleactiontarget-launchpicker", FiltaQuillaRuleactiontargetLaunchPicker);

  class FiltaQuillaRuleactiontargetRunPicker extends FiltaQuillaRuleactiontargetBase {
    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      this.appendChild(MozXULElement.parseXULToFragment(`
        <hbox flex="1" class="flexelementcontainer">
          <html:input class="ruleactionitem flexinput" onchange="this.parentNode.value = this.value;"></html:input>
          <toolbarbutton image="chrome://messenger/skin/icons/folder.svg" class="focusbutton" tooltiptext="dummy" oncommand="this.parentNode.parentNode.getURL()"></toolbarbutton>
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

  defineIfNotPresent("filtaquilla-ruleactiontarget-runpicker", FiltaQuillaRuleactiontargetRunPicker);


  class FiltaQuillaRuleactiontargetAbPicker extends FiltaQuillaRuleactiontargetBase {
    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      /*  Removed Code:
          onchange="this.parentNode.setAttribute('value', this.value);this.parentNode.value=this.value" */
      this.appendChild(MozXULElement.parseXULToFragment(`
        <hbox flex="1" class="flexelementcontainer">
          <menulist flex="1" class="ruleactionitem filtaquillaAB flexinput" inherits="disabled">
            <menupopup></menupopup>
          </menulist>
        </hbox>
      `));
      // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!
      this.hbox = this.getElementsByTagName("hbox")[0]; // document.getAnonymousNodes(this)[0];
      
      let menulist = this.getElementsByTagName("menulist")[0], // document.getAnonymousNodes(this)[0],
          menupopup = menulist.menupopup;
          
      //propagate value up to container element
      menulist.addEventListener('command', function (evt) { 
        let me = evt.target, // use me as stand in for 'this' - the menulist item
            p = me.parentElement;
        // stop propagation on container
        while (p && !p.classList.contains('flexelementcontainer')) {
          p = p.parentNode;
        }
        if (p) {
          p.value=me.value; 
          p.setAttribute('value', me.value); 
        }
      });

      // recursively add all address books and email lists
      let abManager = Cc["@mozilla.org/abmanager;1"].getService(Ci.nsIAbManager);
      this.addDirectories(abManager.directories, menupopup);

      updateParentNode(this.closest(".ruleaction"));
      let value = typeof(this.hbox.value) != 'undefined' ? this.hbox.value : ""
      // set the default to the personal address book
      if (!value || !value.length)
        value = "moz-abmdbdirectory://abook.mab";    
      
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
          let newMenuItem = document.createXULElement('menuitem'),
              displayLabel = dir.dirName;
          newMenuItem.setAttribute('label', displayLabel);
          newMenuItem.setAttribute('value', dir.URI);
          newMenuItem.classList.add('menuitem-iconic');
          if (dir.isMailList)
            newMenuItem.classList.add('mailing-list');
          aMenupopup.appendChild(newMenuItem);
          // recursive add of child mailing lists
          let childNodes = dir.childNodes;
          if (childNodes && childNodes.hasMoreElements())
            this.addDirectories(childNodes, aMenupopup);
        }
      }
    }
  }

  defineIfNotPresent("filtaquilla-ruleactiontarget-abpicker", FiltaQuillaRuleactiontargetAbPicker);

  class FiltaQuillaRuleactiontargetDirectoryPicker extends FiltaQuillaRuleactiontargetBase {
    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      this.appendChild(MozXULElement.parseXULToFragment(`
        <hbox flex="1" class="flexelementcontainer">
          <html:input class="ruleactionitem flexinput" onchange="this.parentNode.value = this.value;"></html:input>
          <toolbarbutton image="chrome://messenger/skin/icons/folder.svg" class="focusbutton" tooltiptext="dummy" oncommand="this.parentNode.parentNode.getURL()"></toolbarbutton>
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

  defineIfNotPresent("filtaquilla-ruleactiontarget-directorypicker", FiltaQuillaRuleactiontargetDirectoryPicker);

  class FiltaQuillaRuleactiontargetJavascriptAction extends FiltaQuillaRuleactiontargetBase {
    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      this.appendChild(MozXULElement.parseXULToFragment(`
        <hbox flex="1" class="flexelementcontainer">
          <html:input class="ruleactionitem flexinput" newlines="pasteintact" anonid="thetextbox" onchange="this.parentNode.value = this.value;"></html:input>
          <toolbarbutton image="resource://filtaquilla-skin/script_edit.png" class="focusbutton" tooltiptext="dummy"></toolbarbutton>
        </hbox>
      `));

      this.hbox = this.getElementsByTagName("hbox")[0]; // document.getAnonymousNodes(this)[0];
      this.textbox = this.hbox.firstChild;              // document.getAnonymousNodes(this)[0].childNodes[0];
      this.toolbarbutton = this.getElementsByTagName("toolbarbutton")[0]; // document.getAnonymousNodes(this)[0].childNodes[1];
      this.toolbarbutton.addEventListener("command", this.onCommand, false);
      this.toolbarbutton.setAttribute('tooltiptext', util.getBundleString('filtaquilla.editJavascript', "Edit JavaScript…"));

      updateParentNode(this.closest(".ruleaction"));
      this.textbox.value = this.hbox.value;

    }

    onCommand() {
      let textbox = this.parentNode.firstChild;
      window.openDialog("chrome://filtaquilla/content/jsEditor.xhtml", "",
        "chrome,dependent,centerscreen,dialog,modal,resizable=yes", textbox);
    }
  }

  defineIfNotPresent("filtaquilla-ruleactiontarget-javascriptaction", FiltaQuillaRuleactiontargetJavascriptAction);

// ***********  CONDITIONS  ***********

    
  function patchFiltaQuillaJavaScriptCondition(es) {
    // bindings.xml#javascript: inject a JS editor. Script returns true or false
    // add a class fq-js to the container element!
    if (es.firstChild && es.firstChild.classList.contains("fq-javascript")) return true;
    if (es.firstChild) es.removeChild(es.firstChild);
    
    
    try {
      es.onCommand = function() {
        let textbox = es.children[1]; // document.getAnonymousNodes(es)[1];
        window.openDialog("chrome://filtaquilla/content/jsEditor.xhtml", "", "chrome,dialog,centerscreen,modal,resizable=yes", textbox);
      }
      
      
      es.textContent = "";
      es.appendChild(MozXULElement.parseXULToFragment(`
        <toolbarbutton image="resource://filtaquilla-skin/script_edit.png" class="focusbutton fq-javascript"></toolbarbutton>
        <html:input flex="1" class="search-value-textbox flexinput" inherits="disabled" newlines="pasteintact" 
         onchange="this.parentNode.setAttribute('value', this.value); this.parentNode.value=this.value;"></html:input>
      `)); 

      // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!

      let hbox = es, // es.parentNode.getElementsByTagName("hbox")[0], // document.getAnonymousNodes(this)[0];
          textbox = hbox.children[1], // document.getAnonymousNodes(es)[1];
          toolbarbutton = hbox.children[0]; // document.getAnonymousNodes(es)[0];
      textbox.value = es.getAttribute("value");
      toolbarbutton.addEventListener("command", es.onCommand, false);
      toolbarbutton.setAttribute('tooltiptext', util.getBundleString('filtaquilla.editJavascript', "Edit JavaScript…"));
      hbox.classList.add("flexelementcontainer");
      return true;
    }
    catch(ex) {
      console.log(ex);
      return false;  
    }
  }
   
  function patchFiltaQuillaTextbox(es) {
    if (es.firstChild && es.firstChild.classList.contains("fq-textbox")) return true;
    if (es.firstChild) es.removeChild(es.firstChild);
    // patch!
    try {
      let textbox = window.MozXULElement.parseXULToFragment(
        ` <html:input class="search-value-textbox flexinput fq-textbox" inherits="disabled" 
          onchange="this.parentNode.setAttribute('value', this.value); this.parentNode.value=this.value;"> 
          </html:input>`
      );
      es.appendChild(textbox);
      es.lastChild.value = es.getAttribute("value");
      es.classList.add("flexelementcontainer");
      es.setAttribute('fq-patched', "true");
      return true;
    }
    catch(ex) {
      console.log(ex);
      return false;  
    }
  }
  
  function patchFiltaQuillaTagSelector(es) {
    function updateSearchValue(menulist) {
      let target = this.closest(".search-value-custom");
      if (target) {
        target.setAttribute("value", menulist.value);
        // The AssignMeaningfulName functions uses the item's js value, so set
        // this to allow this to be shown correctly.
        target.value = menulist.getAttribute('label');
      }
      else {
        console.log("cannot update search value for menulist:")
        console.log(menulist);
      }
    }
    
    util.logDebug("patchFiltaQuillaTagSelector()");
    
    if (es.firstChild && es.firstChild.classList.contains("fq-tag")) return true;
    if (es.firstChild) es.removeChild(es.firstChild);
    try {
      let wrapper = es.closest("search-value"),
          menulistFragment = window.MozXULElement.parseXULToFragment(`
        <menulist flex="1" class="search-value-menulist flexinput fq-tag" inherits="disabled"
                  oncommand="this.parentNode.updateSearchValue(this);">
          <menupopup class="search-value-popup"></menupopup>
        </menulist>
      `);
      // dropdown selected, then we haven't got the container <hbox class="search-value-custom" />

      es.appendChild(menulistFragment);
      es.classList.add("flexelementcontainer");
      es.updateSearchValue = updateSearchValue;
      
      let value = es.getAttribute("value"),
          menulist = es.getElementsByTagName("menulist")[0];
      
      
      let menuPopup = es.lastChild.getElementsByTagName("menupopup")[0],
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
      es.updateSearchValue(menulist);
      
      // override the opParentValue setter to detect operators which need no value
      // this => es ??
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

      let searchrow = wrapper.parentNode.parentNode,
          searchop = searchrow.getElementsByTagName('search-operator')[0].value;
      wrapper.opParentValue = searchop;
      es.setAttribute('fq-patched', "true");
      return true;
    }
    catch(ex) {
      console.log(ex);
      return false;  
    }
       
  }
  
  
  function callbackFiltaquillaSearchCondition(mutationList, observer) {
    mutationList.forEach( (mutation) => {
      switch(mutation.type) {
        case 'childList':
          /* One or more children have been added to and/or removed
             from the tree.
             (See mutation.addedNodes and mutation.removedNodes.) */
          // iterate nodelist of added nodes
          let nList = mutation.addedNodes;
          nList.forEach( (el) => {
            if (!el.querySelectorAll) return; // leave the anonymous function, this continues with the next forEach
            let hbox = el.querySelectorAll("hbox.search-value-custom");
            hbox.forEach ( (es) => {
              let attType = es.getAttribute('searchAttribute'),
                  isPatched = false;
              if (!attType.startsWith("filtaquilla@")) return;
              
              util.logDebug("Mutation observer (childList), check for patching: " + es);
              
              switch(attType) {
                case "filtaquilla@mesquilla.com#subjectRegex":     // fall-through
                case "filtaquilla@mesquilla.com#attachmentRegex":  // fall-through
                case "filtaquilla@mesquilla.com#headerRegex" :     // fall-through
                case "filtaquilla@mesquilla.com#searchBcc" :       // fall-through
                case "filtaquilla@mesquilla.com#folderName" :      
                  isPatched = patchFiltaQuillaTextbox(es);
                  break;
                case "filtaquilla@mesquilla.com#threadheadtag":  // fall-through
                case "filtaquilla@mesquilla.com#threadanytag":
                  isPatched = patchFiltaQuillaTagSelector(es)
                  break;
                case "filtaquilla@mesquilla.com#javascript":
                  isPatched = patchFiltaQuillaJavaScriptCondition(es)
                  break;
                default:
                  // irrelevant for FiltaQuilla
              }
              if (isPatched) {
                console.log("mutation observer patched: " + es);
              }
              
            });
          });
          break;
          case "attributes":
          {
            let es = mutation.target;
            if (es.classList.contains("search-value-custom")) {
              let attType = es.getAttribute('searchAttribute'),
                  isPatched = false;
              util.logDebug("attribute changed: " + attType);
              if (!attType.startsWith("filtaquilla@")) return;
              
              
              util.logDebug("Mutation observer (attribute), check for patching: " + es);
              // console.log(es);
              
              switch(attType) {
                case "filtaquilla@mesquilla.com#subjectRegex":     // fall-through
                case "filtaquilla@mesquilla.com#attachmentRegex":  // fall-through
                case "filtaquilla@mesquilla.com#headerRegex" :     // fall-through
                case "filtaquilla@mesquilla.com#searchBcc" :       // fall-through
                case "filtaquilla@mesquilla.com#folderName" :      
                  if (es.firstChild) {
                    if (es.firstChild.classList.contains("fq-textbox")) return;
                    es.removeChild(es.firstChild);
                  }
                  isPatched = patchFiltaQuillaTextbox(es);
                  break;
                case "filtaquilla@mesquilla.com#threadheadtag":  // fall-through
                case "filtaquilla@mesquilla.com#threadanytag":
                  if (es.firstChild) {
                    if (es.firstChild.classList.contains("fq-tag")) return;
                    es.removeChild(es.firstChild);
                  }
                  isPatched = patchFiltaQuillaTagSelector(es)
                  break;
                case "filtaquilla@mesquilla.com#javascript":
                  if (es.firstChild) {
                    if (es.firstChild.classList.contains("fq-javascript")) return;
                    es.removeChild(es.firstChild);
                  }
                  isPatched = patchFiltaQuillaJavaScriptCondition(es)
                  break;
                default:
                  // irrelevant for FiltaQuilla
              }
              if (isPatched) {
                console.log("mutation observer patched: "  + es);
                // console.log(es);
              }               
            }
          }
          break;          
      }
    });
  }
  
  
  // watch out for custom conditions being added to the top list.
  // or the searchAttribute changing to something that matches
  const fq_observer = new MutationObserver(callbackFiltaquillaSearchCondition);
  
  const fq_observerOptions = {
    childList: true,
    attributes: true,
    subtree: true // Omit (or set to false) to observe only changes to the parent node
  }
  
  let termList = window.document.querySelector('#searchTermList')
  fq_observer.observe(termList, fq_observerOptions);
  
  function selectCustomCondition(event) {
    debugger;
    let target = event.target,
        attType = event.originalTarget.getAttribute('value'),
        p = target.parentElement; // find the richlistitem
    while (p && p.tagName!='richlistitem') {
      p = p.parentNode;
    }
    util.logDebug("selectCustomCondition");
    if (p) { 
      // found the richtlistitem, now we need to find the third child element(search value)
      // <search-value> element
      let searchValueItem = p.getElementsByTagName('search-value')[0],
          isPatched = false;
      if (searchValueItem) {
  
        let wrapper = searchValueItem; // es.closest("search-value"); // test code!
        
        let ce = wrapper.querySelectorAll('.search-value-custom'),
            foundEL = null; // does this already exist?
        ce.forEach( (el) => {
          // find out whether type still matches.
          if (["filtaquilla@mesquilla.com#threadheadtag","filtaquilla@mesquilla.com#threadanytag"].includes(attType)) {
            // it is a tag, but is it?
            if (el.firstChild.classList.contains("fq-tag"))
              foundEL = el; // reuse!
          }
          else if (["filtaquilla@mesquilla.com#subjectRegex",
               "filtaquilla@mesquilla.com#attachmentRegex",
               "filtaquilla@mesquilla.com#headerRegex",
               "filtaquilla@mesquilla.com#searchBcc",
               "filtaquilla@mesquilla.com#folderName"].includes(attType)) {
            if (el.firstChild.classList.contains("fq-textbox"))
              foundEL = el; // reuse!
          }
          if (foundEL) {
            //
            util.logDebug("reusing custom element - " + attType);
          }

        });
        if (!foundEL)  { // unpatch
          debugger;                  // we need to create a new search-value-custom item?
          // possible delete an existing one beforehand?
          if (ce.length) {
            // delete existing element
            ce[0].removeChild(ce[0].firstChild);
          }
          wrapper.removeAttribute("fq-patched");
        }
      }        
        
      switch(attType) {
        case "filtaquilla@mesquilla.com#subjectRegex":     // fall-through
        case "filtaquilla@mesquilla.com#attachmentRegex":  // fall-through
        case "filtaquilla@mesquilla.com#headerRegex" :     // fall-through
        case "filtaquilla@mesquilla.com#searchBcc" :       // fall-through
        case "filtaquilla@mesquilla.com#folderName" :      
          isPatched = patchFiltaQuillaTextbox(searchValueItem);
          break;
        case "filtaquilla@mesquilla.com#threadheadtag":  // fall-through
        case "filtaquilla@mesquilla.com#threadanytag":
          isPatched = patchFiltaQuillaTagSelector(searchValueItem);
          break;
        case "filtaquilla@mesquilla.com#javascript":
          isPatched = patchFiltaQuillaJavaScriptCondition(searchValueItem);
          break;
        default:
          // irrelevant for FiltaQuilla
      }
      if(isPatched) {
        util.logDebug(searchValueItem);
      }
    }
    
  }

  util.logDebug("fq_FilterEditor.js - Finished.");

} // javascript action



// vim: set expandtab tabstop=2 shiftwidth=2:
