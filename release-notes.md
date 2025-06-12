**Version 5.3** 

In order to move forward with the current release cycle (monthly releases) I decided to raise minimum version to Thunderbird 128, I am doing regular testing with the current beta versions but they may only be a single version number ahead! To help test new versions and be ahead of the curve, you can subscribe to issue #262. If you would like to support FiltaQuilla with donation you can now [do so here](https://quickfilters.quickfolders.org/filtaquilla.html#donate) 


**Improvements**
*   Made compatible with Thunderbird 140.\*. Minimum version going forward will now be **Thunderbird 128**.
*   Improvement in asynchronous Save Attachments, leading to slow down of Thunderbird when filtering POP3 mail (no copy listener) [issue #349]. We are now allowed to use `nsIThreadManager.processNextEvent()` in order to give cycles back to the system while the attachments are processed. Please restart Thunderbird to force changes to come into effect. 
*   Play sound improvements: Fixed open sound file button, extracting the supplied sounds to the default folder `profile/extensions/filtaquilla` and added a play sound button to filter editor. [issue #350]

**TO DO NEXT**
*    Feature Request: Notification alert \[issue #240\].
*    Work in progress: Allow automatic running of filters outside of Inbox (IMAP only) \[issue #318\].
     As adding the checkbox in folder properties didn't meet policy restrictions, we are planning to add a web extension compatible interface for this at a later stage, possible through the folder tree context menu.
*    Test attachRegEx_match and see if it needs updates for Tb128 / Release


**Support My Work** As I am often asked about added features for filter conditions and actions for my Add-on [quickFilters](https://addons.thunderbird.net/addon/quickfilters/) - FiltaQuilla is a better location for extending Filter behavior - specifically adding new types of Actions and Conditions. If you want to **support the FiltaQuilla project**, please install quickFilters and **purchase a [quickFilters Pro](https://quickfilters.quickfolders.org/premium.html) license.** You can now also [donate directly here](https://quickfilters.quickfolders.org/filtaquilla.html#donate).