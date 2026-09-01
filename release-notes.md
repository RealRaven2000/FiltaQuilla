**FiltaQuilla 6.3**

Important for Release channel users (**154 and later**): With Thunderbird's new 2-week release cycle, there is an elevated risk of unexpected breakages. While I regularly test SmartTemplates against daily builds, timely fixes depend on **early reporting** from Release users. Please follow the <a href='https://github.com/RealRaven2000/FiltaQuilla/issues'>issue tracker</a> and report any regressions promptly to help maintain compatibility.

**Improvements**

- FiltaQuilla is now compatible with Thunderbird 157.*.
- Updated the Swedish translation, many thanks to [Jonatan Nyberg (@NickWick13)](https://github.com/NickWick13) [PR #410](https://github.com/RealRaven2000/FiltaQuilla/pull/410).
- Replaced the legacy ToneQuilla sound-playing code with WebExtension methods [issue #404](https://github.com/RealRaven2000/FiltaQuilla/issues/404).
- Added a desktop notification filter action - clicking the notification opens the original message. This initial version of the feature shows one notification for each mail; collated message lists with individual links are planned for a future version [issue #240](https://github.com/RealRaven2000/FiltaQuilla/issues/240).
- Updated script loading where required for Thunderbird 155 compatibility [issue #411](https://github.com/RealRaven2000/FiltaQuilla/issues/411).

**Bug Fixes**

- Fixed printing with current Thunderbird versions [issue #406](https://github.com/RealRaven2000/FiltaQuilla/issues/406), [issue #340](https://github.com/RealRaven2000/FiltaQuilla/issues/340).

**TO DO NEXT**

- Restore the “Folder Name” search term on newer Thunderbird versions [issue #377](https://github.com/RealRaven2000/FiltaQuilla/issues/377).
- Support custom filenames when saving or detaching attachments [issue #219](https://github.com/RealRaven2000/FiltaQuilla/issues/219).
- Review `attachRegEx_match` for current Thunderbird versions.

**Support My Work**

As I am often asked about added features for filter conditions and actions for my add-on [quickFilters](https://addons.thunderbird.net/addon/quickfilters/), FiltaQuilla is a better location for extending filter behavior—specifically by adding new types of actions and conditions. If you want to **support the FiltaQuilla project**, please install quickFilters and **purchase a [quickFilters Pro](https://quickfilters.quickfolders.org/premium.html) license.** You can also [donate directly here](https://quickfilters.quickfolders.org/filtaquilla.html#donate).
