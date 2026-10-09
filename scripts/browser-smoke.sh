#!/usr/bin/env bash
# Opens the login screens of the running app in a real (headless) browser with a clean profile, and fails if the page crashes
# on start or does not show the login screen. A broken build can pass every API test and still show visitors a blank page
# (that is how the 9 Oct 2026 outage happened), so run this after building and again after every deploy.
#
#   scripts/browser-smoke.sh                          the local app (http://localhost:8080)
#   scripts/browser-smoke.sh https://book.vmerlabs.com    the live site (allow it a minute to wake up)
#
# Needs a Chromium. It looks in $CHROME_BIN, then Playwright's download (~/.cache/ms-playwright), then chromium / google-chrome on PATH.

BASE="${1:-http://localhost:8080}"
BASE="${BASE%/}"

find_browser() {
    [ -n "${CHROME_BIN:-}" ] && [ -x "$CHROME_BIN" ] && { echo "$CHROME_BIN"; return; }
    for pattern in "$HOME"/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell "$HOME"/.cache/ms-playwright/chromium-*/*/chrome; do
        [ -x "$pattern" ] && { echo "$pattern"; return; }
    done
    for name in chromium chromium-browser google-chrome google-chrome-stable; do
        command -v "$name" >/dev/null && { command -v "$name"; return; }
    done
}

BROWSER="$(find_browser)"
[ -n "$BROWSER" ] || { echo "no Chromium found (set CHROME_BIN)"; exit 2; }

# wake a sleeping host first: the first request to a free Render service can take a minute
for _ in $(seq 1 12); do
    curl -s -o /dev/null -m 20 "$BASE/" && break
    sleep 5
done

fails=0

check_page() {
    local label="$1" path="$2" size="$3" expect="$4"
    local profile; profile="$(mktemp -d)"
    timeout 120 "$BROWSER" --no-sandbox --disable-gpu --user-data-dir="$profile" --window-size="$size" \
        --enable-logging=stderr --v=0 --virtual-time-budget=25000 --dump-dom "$BASE/$path" >"$profile/dom.html" 2>"$profile/log.txt"

    local errors; errors="$(grep -E 'CONSOLE' "$profile/log.txt" | grep -E 'Uncaught|TypeError|ReferenceError|SyntaxError|\[ezBookkeeping Error\]|Failed to load module' | cut -c1-240)"
    local text; text="$(python3 -I - "$profile/dom.html" <<'PY'
import re, sys
html = open(sys.argv[1], errors="replace").read()
body = re.sub(r"<script.*?</script>|<style.*?</style>|<noscript.*?</noscript>", "", html, flags=re.S)
print(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", body)).strip())
PY
)"
    rm -rf "$profile"

    if [ -n "$errors" ]; then
        echo "FAIL  $label: the page raised errors on start"; echo "$errors" | sed 's/^/        /'; fails=$((fails + 1))
    elif ! grep -q "$expect" <<<"$text"; then
        echo "FAIL  $label: the login screen did not appear (page shows: ${text:0:120})"; fails=$((fails + 1))
    else
        echo "PASS  $label: loads with no errors and shows the login screen"
    fi
}

# the app serves the two screens at /desktop and /mobile (override for a plain file server, which needs desktop.html and mobile.html)
check_page "desktop screen" "${DESKTOP_PATH:-desktop}" "1280,900" "By continuing you accept our"
check_page "mobile screen"  "${MOBILE_PATH:-mobile}"   "390,800"  "By continuing you accept our"

echo
[ "$fails" -eq 0 ] && echo "BROWSER CHECK PASSED" || echo "BROWSER CHECK FAILED ($fails)"
exit "$fails"
