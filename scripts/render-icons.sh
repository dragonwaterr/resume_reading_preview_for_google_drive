#!/bin/sh
# assets/*.svg → icons/icon{16,32,48,128}.png (투명 배경). 설치된 Chrome headless로 렌더링한다.
set -e
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

render() { # $1=svg $2=size
  printf '<html><body style="margin:0;background:transparent"><img src="%s" width="%s" height="%s"></body></html>' \
    "file://$PWD/$1" "$2" "$2" > "$TMP/page.html"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 \
    --allow-file-access-from-files --window-size="$2,$2" --screenshot="$PWD/icons/icon$2.png" \
    "file://$TMP/page.html" >/dev/null 2>&1
}

mkdir -p icons
render assets/icon-small.svg 16
render assets/icon-small.svg 32
render assets/icon.svg 48
render assets/icon.svg 128
ls -l icons
