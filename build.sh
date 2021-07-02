#! /bin/sh

set -e

HERE=`dirname $0`;
CONTENT=`cat "${HERE}/build.manifest"`
MANIFEST="${HERE}/manifest.json"
RE='^\s*"version"\s*:\s*"\([0-9\.]\+\(-\?\w\+\)\?\)"\s*,\s*$'

VERSION=`grep "$RE" "${MANIFEST}" | sed -e "s|$RE|\1|g"`

if [ ! -z "$VERSION" ]; then
  XPI="filtaquilla-${VERSION}.xpi"
else
  XPI="filtaquilla.xpi"
fi

XPI="`pwd`/${XPI}";

( cd $HERE;
  echo -n "build.sh: building ${XPI}... ";
  if zip -r "${XPI}" $CONTENT > /dev/null; then
    echo "done."
  else
    echo "failed."
  fi
)

