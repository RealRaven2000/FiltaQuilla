**Version 5.1** 

In order to move forward with the current release cycle (monthly releases) I decided to raise minimum version to Thunderbird 128, I am doing regular testing with the current beta versions but they may only be a single version number ahead! To help test new versions and be ahead of the curve, you can subscribe to issue #262. If you would like to support FiltaQuilla with donation you can now [do so here](https://quickfilters.quickfolders.org/filtaquilla.html#donate) 


**Improvements**

*   Made compatible with Thunderbird 137.\*. Minimum version going forward will now be **Thunderbird 128**.
*   The helper function saveAllAttachments() was removed and had to be reimplemented going through web extension layer. The save attachments action is now set to beind asynchronous. This might potentially improve overall performance in Thunderbird. \[issue #319\].
*   Save Messages: Made file operations asynchronous. This should avoid significant slowdowns when Thunderbird starts and tries to execute filters that potentially save many files or attachments. \[issue #335\]
*   Header Regex match: Support using anchor tokens ^ and $ for address lists \[issue #329\].
*   Thunderbird 136 retires ChromeUtils.import - replace with importESModule. Also converted all jsm modules to ESM modules. \[issue #331\].

**Miscellaneus**

*   Replace deprecated nsILocalFile with nsIFile
*   Remove declaration of Services \[issue #337\]

**Bug Fixes**

*   Error when using Javascript for a Saved Search criteria (Tb 137) [issue #338]. The existing xhtml window for editing javascript stopped working in Thunderbird 136, therefore I rewrote the feature using a standard HTML window and more modern back-end code.

  Also, in later versions of Thunderbird 128, the use of eval() triggers a CSP exception and thus does not work at all anymore. I reimplemented the scripting using the more restricted (and safer) evalInSandbox, which only gives a limited, controlled scope to the environment that is accessible from the script.

  I regard Thunderbird as a database fat client, with limited tools. Add-ons make the data access much more accessible. The mail store, address books and the Global Database are data the users own. I want to empower my users to access this data in the way they choose, therefore local scripts running in a sandbox environment should be allowed. However we will not support remote script to be executed as it opens up big security problems.
  
  There may be corporate users of Thunderbird who have a different view on data access, but they can (and usually do) enforce company policies by controlling which apps or Add-ons are allowed to be installed.
*  Fixed: Save Attachments To no longer working in Thunderbird 128 [issue #339]. This was a regression caused by modernizing the code which worked well with the current API of the release version Thunderbird 137. I had to add some missing data to the attachments array in order to be able to filter the correct attachments (excluding inline images and other such data).


**TO DO**
*    Work in progress: Allow automatic running of filters ouside of Inbox (IMAP only) \[issue #318\].
     As adding the checkbox in folder properties didn't meet policy restrictions, we plan to add a web extension compatible interface for this at a later stage, possible through the folder tree context menu.

     


**Support My Work** As I am often asked about added features for filter conditions and actions for my Add-on [quickFilters](https://addons.thunderbird.net/addon/quickfilters/) - FiltaQuilla is a better location for extending Filter behavior - specifically adding new types of Actions and Conditions. If you want to **support the FiltaQuilla project**, please install quickFilters and **purchase a [quickFilters Pro](https://quickfilters.quickfolders.org/premium.html) license.** You can now also [donate directly here](https://quickfilters.quickfolders.org/filtaquilla.html#donate).