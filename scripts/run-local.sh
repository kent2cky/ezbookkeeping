#!/usr/bin/env bash
# Build and run the app on your own machine.
#
#   scripts/run-local.sh start     run in this terminal; stop with Ctrl+C                (default)
#   scripts/run-local.sh bg        run in the background; the log is data/server.log
#   scripts/run-local.sh stop      stop the background copy
#   scripts/run-local.sh status    is it running, and does it answer?
#   scripts/run-local.sh logs      follow the background log
#   scripts/run-local.sh build     rebuild the server program and the web pages (after changing code)
#   scripts/run-local.sh rebuild   build, then restart in the background
#
# Then open http://localhost:8080 . Your data is in data/ezbookkeeping.db (SQLite) and uploads in storage/.
# Settings come from conf/ezbookkeeping.ini; anything in .env (one NAME=value per line, no quotes) overrides it,
# for example EBK_MAIL_SMTP_USER. .env is never committed.

set -u
cd "$(dirname "$0")/.."

PORT="${PORT:-8080}"
PID_FILE="data/server.pid"
LOG_FILE="data/server.log"

# the Go version this project needs may be installed in ~/sdk/go
[ -x "$HOME/sdk/go/bin/go" ] && export PATH="$HOME/sdk/go/bin:$PATH" GOTOOLCHAIN=local

load_env() {
    # read .env literally: passwords may contain characters (such as $ or ") that a shell would change
    [ -f .env ] || return 0
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in ''|\#*) continue ;; esac
        export "${line%%=*}=${line#*=}"
    done < .env
}

build() {
    echo "== building the server program"
    ./build.sh backend --no-lint --no-test 2>&1 | grep -E '^# |\.go:[0-9]+|cannot |undefined:|^error:' | head -8
    [ -x ./ezbookkeeping ] || { echo "the server program was not built (is Go installed?)"; return 1; }
    echo "== building the web pages (takes a few minutes)"
    npm run build 2>&1 | grep -E "built in|rror" | head -4
    [ -f dist/index.html ] || { echo "the web pages were not built (run npm install first?)"; return 1; }
}

running() {
    [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

prepare() {
    if [ ! -x ./ezbookkeeping ] || [ ! -f dist/index.html ]; then
        echo "nothing built yet, building first"
        build || exit 1
    fi
    mkdir -p data log storage
    load_env
    export EBK_SERVER_STATIC_ROOT_PATH=dist
}

stop() {
    if running; then
        kill "$(cat "$PID_FILE")" && rm -f "$PID_FILE" && echo "stopped"
    else
        rm -f "$PID_FILE"; echo "not running"
    fi
}

status() {
    if running; then echo "running, process $(cat "$PID_FILE")"; else echo "not running (from this script)"; fi
    printf 'http://localhost:%s answers: ' "$PORT"
    curl -s -o /dev/null -m 3 -w '%{http_code}\n' "http://localhost:$PORT/" || echo "no"
}

start_background() {
    if running; then echo "already running (process $(cat "$PID_FILE"))"; return 0; fi
    prepare
    nohup ./ezbookkeeping server run >"$LOG_FILE" 2>&1 &
    echo $! >"$PID_FILE"
    for _ in $(seq 1 40); do curl -s -o /dev/null -m 2 "http://localhost:$PORT/" && break; sleep 1; done
    status
    echo "log: $LOG_FILE   stop: scripts/run-local.sh stop"
}

case "${1:-start}" in
    start)   running && { echo "already running in the background; stop it first (scripts/run-local.sh stop)"; exit 1; }
             prepare; echo "http://localhost:$PORT  (Ctrl+C to stop)"; exec ./ezbookkeeping server run ;;
    bg)      start_background ;;
    stop)    stop ;;
    status)  status ;;
    logs)    tail -f "$LOG_FILE" ;;
    build)   build ;;
    rebuild) stop; build && start_background ;;
    *)       sed -n '2,13p' "$0"; exit 2 ;;
esac
