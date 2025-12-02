**Version 6.0** 

**Latest News**

We decided to concentrate on the latest versions from FIltaQuilla 140 onwards because the code base was getting pretty unmanagable due to the substantial changes in Thunderbird Core and additional features added by the extended mail extension APIs. Being able to support this and legacy ways of doing the same thing within the same Add-on proved to be very difficult and produce unmanagable code.

Even just supporting both ESR140 and the current release versions (currently 145), is already a difficult thing leading to substantially branching code paths within the same Add-on. This cut-off point will also be used to prepare for a number of long desired feature additions around saving attachments, which will be delivered next.

Increased strict_min_version to 140.0.


**Improvements**
*   Exclude signatures from saved / detached attachments [issue #372] 


**Bug Fixes**
*  Problems with saving some attachments - others work [issue #376]
*  Tb142 removed `messenger.detachAttachmentsWOPrompts` - reimplement detach attachments [issue #369]
*  Fixed: Double saving via the filter as pdf and additional txt file  [issue #370]



**TO DO NEXT**
*    Feature Request: Notification alert \[issue #240\].
*    Support custom file names, including date, when saving / detaching attachments [issue #219]
*    Test attachRegEx_match and see if it needs updates for Tb128 / Release


**Support My Work** 
As I am often asked about added features for filter conditions and actions for my Add-on [quickFilters](https://addons.thunderbird.net/addon/quickfilters/) - FiltaQuilla is a better location for extending Filter behavior - specifically adding new types of Actions and Conditions. If you want to **support the FiltaQuilla project**, please install quickFilters and **purchase a [quickFilters Pro](https://quickfilters.quickfolders.org/premium.html) license.** You can now also [donate directly here](https://quickfilters.quickfolders.org/filtaquilla.html#donate).