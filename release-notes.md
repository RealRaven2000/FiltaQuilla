**Version 5.0** In order to move forward with the current release cycle (monthly releases) I decided to raise minimum version to Thunderbird 128, I am doing regular testing with the current beta versions but they may only be a single version number ahead! To help test new versions and be ahead of the curve, you can subscribe to issue #262. If you would like to support FiltaQuilla with donation you can now [do so here](https://quickfilters.quickfolders.org/filtaquilla.html#donate) **Improvements**

*   Made compatible with Thunderbird 137.\*. Minimum version going forward will now be **Thunderbird 128**.
*   The helper function saveAllAttachments() was removed and had to be reimplemented going through web extension layer. The save attachments action is now set to beind asynchronous. This might potentially improve overall performance in Thunderbird. \[issue #319\].
*   Save Messages: Made file operations asynchronous. This should avoid significant slowdowns when Thunderbird starts and tries to execute filters that potentially save many files or attachments. \[issue #335\]
*   Header Regex match: Support using anchor tokens ^ and $ for address lists \[issue #329\].
*   Allow automatic running of filters ouside of Inbox (IMAP only) \[issue #318\].
*   Thunderbird 136 retires ChromeUtils.import - replace with importESModule. Also converted all jsm modules to ESM modules. \[issue #331\].

**Miscellaneus**

*   Replace deprecated nsILocalFile with nsIFile

**Support My Work** As I am often asked about added features for filter conditions and actions for my Add-on [quickFilters](https://addons.thunderbird.net/addon/quickfilters/) - FiltaQuilla is a better location for extending Filter behavior - specifically adding new types of Actions and Conditions. If you want to **support the FiltaQuilla project**, please install quickFilters and **purchase a [quickFilters Pro](https://quickfilters.quickfolders.org/premium.html) license.** You can now also [donate directly here](https://quickfilters.quickfolders.org/filtaquilla.html#donate).