/*
 ***** BEGIN LICENSE BLOCK *****
 * This file is part of an application by Mesquilla.
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

/**
 * InheritedPropertiesGrid: User interface for setting inherited folder properties
 */

var EXPORTED_SYMBOLS = ["InheritedPropertiesGrid"];

const Cc = Components.classes,
      Ci = Components.interfaces,
      Cu = Components.utils,
      catMan = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);

Cu.import("resource://gre/modules/Services.jsm");

var InheritedPropertiesGrid = {
	getInheritedProperties: function getInheritedProperties() {
    let inheritedProperties =
		  Services.prefs.getStringPref ?
		  Services.prefs.getStringPref("mesquillaInheritedProperties", "{}") :
			Services.prefs.getComplexValue("mesquillaInheritedProperties", Ci.nsISupportsString).data;

		return JSON.parse(inheritedProperties);
	},

	setInheritedProperties: function setInheritedProperties(props) {
		let sData = JSON.stringify(props);
		if (Services.prefs.setStringPref)
			Services.prefs.setStringPref("mesquillaInheritedProperties", sData);
		else {
			var str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
			str.data = sData;
			Services.prefs.setComplexValue("mesquillaInheritedProperties", Ci.nsISupportsString, str);
		}
	},

  /*
   * Management of property objects. These objects are used to store information
   *  needed to manage a single inherited property. Definition:
   *
   *    property     (string) the inherited property key
   *    name         (string) localized display name for the property
   *    defaultValue (function (nsIMsgFolder or nsIMsgIncomingServer), returns boolean)
   *                          the default value when no inherited property is applied
   *    accesskey    (string) accesskey attribute for entries
   *    hidefor      (string) list of server types for which the property is invalid
   */

  // register a new property object
  addPropertyObject: function addPropertyObject(aPropertyObject) {
    /*
     * New method: we store the object containing inherited properties using
     *             Services.prefs
     *
     *             The new method still uses the category to store the names of
     *             the inherited properties, but the value is not important.
     *             Need to eliminate the ".toSource" which was needed by the old
     *             method.
     */
    catMan.addCategoryEntry("InheritedPropertiesGrid",
                            aPropertyObject.property,
                            aPropertyObject.toSource(),
                            false /* aPersist */,
                            true /* aReplace */);
    // new method, saving in a global context

    let inheritedProperties = this.getInheritedProperties();
    inheritedProperties[aPropertyObject.property] = aPropertyObject;
		this.setInheritedProperties(inheritedProperties);
    return;
  },

  // unregister a property object
  removePropertyObject: function removePropertyObject(aPropertyObject) {
    /*
     * New method: we store the object containing inherited properties using
     *             Services.prefs
     *
     *             The new method still uses the category to store the names of
     *             the inherited properties, but the value is not important.
     *             Need to eliminate the ".toSource" which was needed by the old
     *             method.
     */
    catMan.deleteCategoryEntry("InheritedPropertiesGrid",
                               aPropertyObject.property,
                               false /* aPersist */);
    // new method, saving in a global context
		let inheritedProperties = this.getInheritedProperties();
    inheritedProperties[aPropertyObject.property] = null;
		this.setInheritedProperties(inheritedProperties);
    return;
  },

  // given the property key, return the registered property object
  getPropertyObject: function getPropertyObject(aProperty) {
    // new method: shared global context
    try {
			let inheritedProperties = this.getInheritedProperties();
      let property = inheritedProperties[aProperty];
      if (typeof property != 'undefined')
        return property;
    } catch (e) {} // perhaps something is still using the old method?
    throw "Inherited property " + aProperty + " not registered";
    return null;
   },

  // This function implements most of the onPreInit function for setting
  //  up an account manager extension for inherited properties.
  onPreInit: function onPreInit(account, accountValues, window)  {
		try {
			let server = account.incomingServer;
			window.gInheritTarget = server;
			let rows = this.getInheritRows(window.document);
			// Add rows for defined properties. These are defined through entries
			//  in the category manager.
			let catEnum = catMan.enumerateCategory("InheritedPropertiesGrid");
			while (catEnum.hasMoreElements()) {
				let property = catEnum.getNext()
															.QueryInterface(Components.interfaces.nsISupportsCString)
															.data,
				    row = this.createInheritRow(property, server, window.document, true);
				if (row) // don't add if it already exists, probably a prior extension uses it
					rows.appendChild(row);
			}

		} catch (e) {Cu.reportError(e);}
	},

  _strings: null,

  // Create or get a 3-column grid to describe inherited variables for the
  //  folder properties xul. Account Manager uses an overlay.
  getInheritRows: function getInheritRows(document) {
	  try {
			/* this is what we are creating, and adding to the GeneralPanel
			<vbox id="inheritBox">
				<grid>
					<columns>
						<column/>
						<column/>
						<column/>
					</columns>
						<column flex="1"/>
					<rows id="inheritRows">
						<row>
							<label value=" " />
							<label value="Enabled" />
							<label value="Inherit" />
						</row>
						<label value=" "/>
					</rows>
				</grid>
			</vbox>

			*/

			// Check if it already exists, perhaps added by another extension.
			let rows = document.getElementById("inheritRows");
			if (rows)
				return rows;

			const strings = Cc["@mozilla.org/intl/stringbundle;1"]
												.getService(Ci.nsIStringBundleService)
												.createBundle("chrome://filtaquilla/locale/am-inheritPane.properties");

			// create new vbox
			let inheritBox = document.createElement("vbox");
			inheritBox.setAttribute("id", "inheritBox");

			// now append into the existing xul
			try {
					document.getElementById("GeneralPanel")
									.appendChild(inheritBox);
			} catch (e) {
				// must be SeaMonkey
				let nameBox = document.getElementById('nameBox');
				nameBox.parentNode.appendChild(inheritBox);
			}

			// create the grid and its children
			let grid = document.createElement("grid"),
			    columns = document.createElement("columns");
			grid.appendChild(columns);

			// add three columns
			let nameColumn = document.createElement("column");
			columns.appendChild(nameColumn);

			let enabledColumn = document.createElement("column");
			columns.appendChild(enabledColumn);

			let inheritColumn = document.createElement("column");
			columns.appendChild(inheritColumn);

			let flexColumn = document.createElement("column");
			flexColumn.setAttribute("flex", "1");
			grid.appendChild(flexColumn);

			rows = document.createElement("rows");
			rows.setAttribute("id", "inheritRows");
			grid.appendChild(rows);

			// add column headers as the first row
			let row = document.createElement("row");

			let label1 = document.createElement("label");
			label1.setAttribute("value", " ");
			row.appendChild(label1);

			let label2 = document.createElement("label");
			label2.setAttribute("value", strings.GetStringFromName("enabled"));
			row.appendChild(label2);

			let label3 = document.createElement("label");
			label3.setAttribute("value", strings.GetStringFromName("inherit"));
			row.appendChild(label3);

			rows.appendChild(row);

			// add it all to the panel
			inheritBox.appendChild(grid);
			return rows;
		}
		catch(e) {Cu.reportError(e);}
	},

  /** create a row element for an inherited property on the account manager
   * @param aProperty  inherited property (string)
   *
   * @param aFolder  either an nsIMsgFolder or nsIMsgIncomingServer as the target of
   *                 the inherited property
   *
   * @param document DOM document
   * @param aIsAccountManager  true if row in account manager
   */

  createInheritRow: function createInheritRow(aProperty, aFolder, document, aIsAccountManager) {
		try {
			/* We are creating this:

				 <row hidefor="<hidefor>" id="property-<property>">
					 <label value="<aName>" accesskey="<accesskey>" control=="inherit-"+property />
					 <hbox pack="center">
						 <checkbox id="enable-"+property
											 oncommand="InheritedPropertiesGrid.onCommandEnable(
							'<property>' ,gInheritTarget, document);" />
					 </hbox>
					 <hbox pack="center">
						 <checkbox id="inherit-"+property
											 oncommand="InheritedPropertiesGrid.onCommandInherit(
							'<property>' ,gInheritTarget, document);" />
					 </hbox>
					 <text id="server.<property>"
								 inheritProperty="<property>"
								 wsm_persist="true"
								 prefstring="mail.server.%serverkey%.<property>"
								 preftype="string"
								 genericattr="true"
								 hidden="true" />
				 </row>

				 AccountManager.js gives special handling to a tag of type "text" that we
					take advantage of here. The "value" attribute will contain a string
					"true" or "false" when an inherited boolean is defined.
			*/

			let property = aProperty,
			    propertyObject = this.getPropertyObject(property),
			    row = document.getElementById("property-" + property);
			if (row)
				row.parentNode.removeChild(row);
			row = document.createElement("row");
			row.setAttribute("id", "property-" + property);
			if (aIsAccountManager && propertyObject.hidefor)
				row.setAttribute("hidefor", propertyObject.hidefor);

			let label = document.createElement("label");
			label.setAttribute("value", propertyObject.name);
			label.setAttribute("accesskey", propertyObject.accesskey);
			label.setAttribute("control", "inherit-" + property);
			row.appendChild(label);

			let enableHbox = document.createElement("hbox");
			enableHbox.setAttribute("pack", "center");
			let enableCheckbox = document.createElement("checkbox");
			enableCheckbox.setAttribute("id", "enable-" + property);
			// We only use this in the account manager
			if (aIsAccountManager)
				enableCheckbox.setAttribute("oncommand",
					"InheritedPropertiesGrid.onCommandEnable('" + property +
					"' ,gInheritTarget, document);");
			enableHbox.appendChild(enableCheckbox);
			row.appendChild(enableHbox);

			let inheritHbox = document.createElement("hbox");
			inheritHbox.setAttribute("pack", "center");
			let inheritCheckbox = document.createElement("checkbox");
			inheritCheckbox.setAttribute("id", "inherit-" + property);
			inheritCheckbox.setAttribute("oncommand",
				"InheritedPropertiesGrid.onCommandInherit('" + property +
				"' ,gInheritTarget, document);");
			inheritHbox.appendChild(inheritCheckbox);
			row.appendChild(inheritHbox);

			// The account manager gives special treatment to an element of type
			//  "text", which is the treatment that we want.
			let text = document.createElement("text");
			text.setAttribute("id", "server." + property);
			text.setAttribute("hidden", "true");
			if (aIsAccountManager)
			{
				text.setAttribute("wsm_persist", "true");
				text.setAttribute("prefstring", "mail.server.%serverkey%." + property);
				text.setAttribute("preftype", "string");
				text.setAttribute("genericattr", "true");
			}
			row.appendChild(text);

			// set the values of the checkboxes
			// It's not trivial to figure out if a server property is inherited or not.
			// I need to call the underlying server preference to see :( Easier to
			// check the global preference to see if they are equal.
			let isInherited, server;

			// aFolder can be either an nsIMsgIncomingServer or an nsIMsgFolder
			if (aFolder instanceof Ci.nsIMsgIncomingServer)
				server = aFolder;
			else if (aFolder.isServer)
				server = aFolder.server;

			let inheritedValue = "";
			if (server)
			{
				inheritedValue = server.getCharValue(property);
				let globalProperty = "mail.server.default." + property;
				let globalValue;
				try {
					var rootprefs = Cc["@mozilla.org/preferences-service;1"]
														.getService(Ci.nsIPrefService)
														.getBranch("");
					globalValue = rootprefs.getCharPref(globalProperty);
				}
				catch (e) {}
				isInherited = (inheritedValue == globalValue);
			}
			else
			{
				let folderValue = aFolder.getStringProperty(property);
				if (folderValue && folderValue.length > 0)
					isInherited = false;
				else
					isInherited = true;
				inheritedValue = aFolder.getInheritedStringProperty(property);
			}

			if (isInherited)
				inheritCheckbox.setAttribute("checked", "true");

			let isEnabled = true;
	/* propertyObject.defaultValue(aFolder) ? inheritedValue != "false" : inheritedValue == "true"; */
			enableCheckbox.setAttribute("checked", isEnabled ? "true" : "false");
			if (isInherited)
				enableCheckbox.setAttribute("disabled", "true");

			return row;

		}
		catch (e) {Cu.reportError(e);}
	},

  onCommandInherit: function onCommandInherit(property, aFolder, document) {
		try {

			// find the property object
			let propertyObject = this.getPropertyObject(property),
			// Whether a property is "enabled" depends on its default, since the
			//  inherited folder property is usually an override.
			    defaultValue = true, // propertyObject.defaultValue(aFolder);
			    elementInherit = document.getElementById("inherit-" + property),
			    elementEnable = document.getElementById("enable-" + property),
			    isInherited = elementInherit.checked;
			elementEnable.setAttribute("disabled", isInherited);

			// The account manager uses the the <text> element's value to manage
			//  persisting the preference.
			let elementText = document.getElementById("server." + property);

			if (isInherited)
			{
				let inheritedValue = defaultValue ? "true" : "false";
				// XXX this does not work if there is a server.default value.  I should
				//  really create a function that does this work.
				if (aFolder.parent)
				{
					inheritedValue = aFolder.parent.getInheritedStringProperty(property);
				}
				let isEnabled = defaultValue ? inheritedValue != "false" :
																			 inheritedValue == "true";
				elementEnable.checked = isEnabled;
				elementText.setAttribute("value", "");
			}
			else
			{
				elementText.setAttribute("value", elementEnable.checked ? "true" : "false");
				elementEnable.focus();
			}

		}
		catch (e) {Cu.reportError(e);}
	},

  // this function is only used in the account manager.
  onCommandEnable: function onCommandEnable(property, aFolder, document) {
		try {
			let elementEnable = document.getElementById("enable-" + property),
			    isEnabledString = elementEnable.checked ? "true" : "false",
			// The account manager uses the the <text> element's value to manage
			//  persisting the preference.
			    elementText = document.getElementById("server." + property);
			elementText.setAttribute("value", isEnabledString);
		}
		catch (e) {Cu.reportError(e);}
	},

  // This function does not work with the account manager, which has its
  //  own mechanism for accepting preferences.
  onAcceptInherit: function onAcceptInherit(aProperty, aFolder, document) {
		try {
			let property = aProperty,
			    elementInherit = document.getElementById("inherit-" + property),
			    elementEnable = document.getElementById("enable-" + property);

			if (elementInherit.checked)
			{
				if (aFolder.isServer)
				{
					let value = aFolder.server.getCharValue(property);
					if (value && value.length > 0)
						aFolder.server.setCharValue(property, "");
				}
				else
				{
					let value = aFolder.getStringProperty(property);
					if (value && value.length > 0)
						aFolder.setStringProperty(property, "");
				}
			}
			else
			{
				let value = elementEnable.checked ? "true" : "false";
				if (aFolder.isServer)
					aFolder.server.setCharValue(property, value);
				else
					aFolder.setStringProperty(property, value);
			}
		}
		catch (e) {Cu.reportError(e);}
	}
}
