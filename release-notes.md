**FiltaQuilla 6.3.1**

Important for Release channel users (**154 and later**): With Thunderbird's new 2-week release cycle, there is an elevated risk of unexpected breakages. While I regularly test FiltaQuilla against daily builds, timely fixes depend on **early reporting** from Release users. Please follow the <a href='https://github.com/RealRaven2000/FiltaQuilla/issues'>issue tracker</a> and report any regressions promptly to help maintain compatibility.

**Improvements**

- Made FiltaQuilla compatible with Thunderbird 159.*.
- Improved startup reliability by allowing more time for Thunderbird windows to finish loading.

**Bug Fixes**

- Fixed errors in the Save Message as File filter action caused by a changed Thunderbird API. #417

**TO DO NEXT**

- Restore the “Folder Name” search term on newer Thunderbird versions #377.
- Support custom filenames when saving or detaching attachments #219.
- Review `attachRegEx_match` for current Thunderbird versions.

**Support My Work**

As I am often asked about added features for filter conditions and actions for my add-on [quickFilters](https://addons.thunderbird.net/addon/quickfilters/), FiltaQuilla is a better location for extending filter behavior—specifically by adding new types of actions and conditions. If you want to **support the FiltaQuilla project**, please install quickFilters and **purchase a [quickFilters Pro](https://quickfilters.quickfolders.org/premium.html) license.** You can also [donate directly here](https://quickfilters.quickfolders.org/filtaquilla.html#donate).
