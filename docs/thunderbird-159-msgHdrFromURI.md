# Thunderbird 159 beta: `msgHdrFromURI` removed

Thunderbird 159 beta removed `messenger.msgHdrFromURI`, used in FiltaQuilla's save-completion callback. This can leave the save promise unresolved and delay subsequent move actions.

Replace it with:

```js
MailServices.messageServiceFromURI(messageUri).messageURIToMsgHdr(messageUri)
```

Related: [SmartTemplates #433](https://github.com/RealRaven2000/SmartTemplates/issues/433)
