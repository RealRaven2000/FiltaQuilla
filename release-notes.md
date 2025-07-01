**Version 5.3.1** 

_Upcoming in the next big release:_ Thunderbird will soon ask you to choose your preferred update path — either the annual ESR track or the faster monthly releases. [Learn more about the new release model](https://blog.thunderbird.net/2025/03/thunderbird-release-channel-update/)

The ESR version will stay on v140, increasing minor version numbers and including only security fixes and bug patches, which is often preferable for corporate environments.

The monthly release cycle will deliver new features and interface updates as they’re developed. Please check whether your current add-ons support this release model. To help with this, you can install the [Add-on Compatibility Check](https://addons.thunderbird.net/thunderbird/addon/addon-compatibility-check/) extension.


**Improvements**
*   Made compatible with Thunderbird 141.\*. 

**Miscellaneus**
*    Thunderbird 141 removed `nsIMsgFolder.prettyName`

**TO DO NEXT**
*    Feature Request: Notification alert \[issue #240\].
*    Work in progress: Allow automatic running of filters outside of Inbox (IMAP only) \[issue #318\].
     As adding the checkbox in folder properties didn't meet policy restrictions, we are planning to add a web extension compatible interface for this at a later stage, possible through the folder tree context menu.
*    Test attachRegEx_match and see if it needs updates for Tb128 / Release


**Support My Work** As I am often asked about added features for filter conditions and actions for my Add-on [quickFilters](https://addons.thunderbird.net/addon/quickfilters/) - FiltaQuilla is a better location for extending Filter behavior - specifically adding new types of Actions and Conditions. If you want to **support the FiltaQuilla project**, please install quickFilters and **purchase a [quickFilters Pro](https://quickfilters.quickfolders.org/premium.html) license.** You can now also [donate directly here](https://quickfilters.quickfolders.org/filtaquilla.html#donate).