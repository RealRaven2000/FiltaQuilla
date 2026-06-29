
**Maintenance Items - 6.2.2** 
*    Hardened ToneQuilla against path errors, 6.2.2 Hardened ToneQuilla against path errors. Fixes specific issues for MacOS [issue #380]


**Improvements**
*    Increased strict_max_version to 153.*.
*    Made regex options panel theme compatible using --box-text-color, --richlist-button-background, --border-color
*    header regex: headers like "in-reply-to" are not exposed and do not work [issue #395]
*    JavaScript search term now forces needsBody = true for stability [issue #403]
*    Prepend / Append Date to subject [issue #398] 
*              Added %date()% switch for subject prefix / append, for a list of letters you can use in the format string 
*              check https://smarttemplates.quickfolders.org/variables.html#customDates
*              Example: Prefix Subject:  `%date("Y-m-d")% [Important] 
*    Added tool tip to regular expression option for case insensitive matching


**Bug Fixes**
*    Fixed regex pseudo-flag "c" - which forces case sensitive behavior overriding "Regex case-insensitive Match"


**TO DO NEXT**
*    Feature Request: Notification alert \[issue #240\].
*    Support custom file names, including date, when saving / detaching attachments [issue #219]
*    Test attachRegEx_match and see if it needs updates for Tb128 / Release


**Support My Work** 
As I am often asked about added features for filter conditions and actions for my Add-on [quickFilters](https://addons.thunderbird.net/addon/quickfilters/) - FiltaQuilla is a better location for extending Filter behavior - specifically adding new types of Actions and Conditions. If you want to **support the FiltaQuilla project**, please install quickFilters and **purchase a [quickFilters Pro](https://quickfilters.quickfolders.org/premium.html) license.** You can now also [donate directly here](https://quickfilters.quickfolders.org/filtaquilla.html#donate).