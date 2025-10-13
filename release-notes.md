**Version 5.5** 

**Latest News**

The Thunderbird monthly release cycle will deliver new features and interface updates as they’re developed. Please check whether your current add-ons support this release model. To help with this, you can install the [Add-on Compatibility Check](https://addons.thunderbird.net/thunderbird/addon/addon-compatibility-check/).

Some users may have seen a false incompatibility warning after updating from Thunderbird to v142 or higher. This was caused by cached compatibility information in Thunderbird, which sometimes fails to refresh correctly. The previous version of FiltaQuilla was already fully compatible with 143.

To get this fixed I raised a bug with Thunderbird: [Bugzilla 1986027](https://bugzilla.mozilla.org/show_bug.cgi?id=1986027).


**Improvements**
*   Made compatible with Thunderbird 145.*.
*   Converted settings dialog to html \[issue #266\]
*   Added localisations for French, Japanese, Italian and Spanish users.
*   Added a toolbar button for convenient access to settings. If it's not needed, you can remove it via View » Toolbars » Toolbar Layout

**Bug Fixes**
*   In some cases, attachments can be saved under wrong name and wrong format. \[issue #364\] I added some manual correction to fix the problem. As this is a bug in the messages API, that returns an incorrectly encoded file name (it should decode the file name and return it correctly), so I raised [Bug 1992976](https://bugzilla.mozilla.org/show_bug.cgi?id=1992976) in this matter.


**TO DO NEXT**
*    Feature Request: Notification alert \[issue #240\].
*    Work in progress: Allow automatic running of filters outside of Inbox (IMAP only) \[issue #318\].
     As adding the checkbox in folder properties didn't meet policy restrictions, we are planning to add a web extension compatible interface for this at a later stage, possible through the folder tree context menu.
*    Test attachRegEx_match and see if it needs updates for Tb128 / Release


**Support My Work** 
As I am often asked about added features for filter conditions and actions for my Add-on [quickFilters](https://addons.thunderbird.net/addon/quickfilters/) - FiltaQuilla is a better location for extending Filter behavior - specifically adding new types of Actions and Conditions. If you want to **support the FiltaQuilla project**, please install quickFilters and **purchase a [quickFilters Pro](https://quickfilters.quickfolders.org/premium.html) license.** You can now also [donate directly here](https://quickfilters.quickfolders.org/filtaquilla.html#donate).