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


// web extension support
var EXPORTED_SYMBOLS = ['FiltaQuilla_wx'];


var FiltaQuilla_wx = {
  // example - https://dxr.mozilla.org/comm-beta/source/mailnews/base/search/content/searchWidgets.js#133 
  // convert binding id="directoryPicker"
  class MozRuleactiontargetSaveAttachment extends MozXULElement {
    connectedCallback() {
      // add xml code from bindins.xml here
      this.appendChild(
        MozXULElement.parseXULToFragment(
      `
      <xul:hbox>
        <xul:textbox 
          class="ruleactionitem" 
          onchange="this.parentNode.value = this.value;"/>
        <xul:toolbarbutton 
          image="chrome://filtaquilla/skin/folder.png"
          class="focusbutton" 
          tooltiptext="&filebutton;"
          oncommand="this.parentNode.parentNode.getURL();"/>
      </xul:hbox>
      `,
          ["chrome://filtaquilla/locale/bindings.dtd"]
        )
      );
      
      this.textbox =  this.querySelector("textbox");
      this.hbox = this.querySelector("hbox");
      this.btnPicker = this.querySelector("toolbarbutton");
      this.btnPicker.addEventListener("command",
        event => {
          setPicker(event);
        }
      )
      
      updateParentNode(this.closest(".ruleaction"));
    }
    
    setPicker(event) {
      const Ci = Components.interfaces,
            Cc = Components.classes,
            nsIFilePicker = Ci.nsIFilePicker;
      var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
      fp.init(window, this.filetitle, nsIFilePicker.modeGetFolder);
      fp.appendFilters(nsIFilePicker.filterAll);
      try {
        var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile || Ci.nsIFile);
        // the file url is the first comma-separated parameter
        var filePath = this.textbox.value;
        file.initWithPath(filePath);
        fp.displayDirectory = file.parent;
        fp.defaultString = file.leafName;
      }
      catch (e) {}
      
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
  
  }
  
  
  this.init = function fq_wx_init() {
    customElements.define(
      "filtaquilla@mesquilla.com#saveAttachment",
      MozRuleactiontargetSaveAttachment
    );    
  }
  
}