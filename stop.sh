#!/usr/bin/env bash
#
# Meridian Production Management — stop helper.
#
# Stops the background instance recorded in .run/pms.pid. If the PID file is
# missing or stale, it falls back to the process listening on the configured
# port, but only stops that process when it can verify it belongs to Meridian.
#
#   ./stop.sh                  Stop the default instance (port 8090)
#   ./stop.sh --port 8091      Stop an instance on another port
#   STOP_TIMEOUT=30 ./stop.sh  Wait up to 30 seconds for a graceful exit
#
# Listener fallback checks both IPv4 and IPv6 sockets.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT/.run"
PID_FILE="$RUN_DIR/pms.pid"
PORT="${PORT:-8090}"
TIMEOUT="${STOP_TIMEOUT:-15}"

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
    BOLD="$(printf '\033[1m')"
    DIM="$(printf '\033[2m')"
    GREEN="$(printf '\033[32m')"
    AMBER="$(printf '\033[33m')"
    RED="$(printf '\033[31m')"
    RESET="$(printf '\033[0m')"
else
    BOLD=""; DIM=""; GREEN=""; AMBER=""; RED=""; RESET=""
fi

info()  { printf '%s\n' "${BOLD}▸${RESET} $*"; }
ok()    { printf '%s\n' "${GREEN}✓${RESET} $*"; }
warn()  { printf '%s\n' "${AMBER}!${RESET} $*" >&2; }
fail()  { printf '%s\n' "${RED}✗ $*${RESET}" >&2; exit 1; }

usage() {
    cat <<'EOF'
Meridian Production Management — stop helper.

Usage:
  ./stop.sh                    Stop the instance recorded in .run/pms.pid
  ./stop.sh --port 8091        Stop the instance on a specific port
  STOP_TIMEOUT=30 ./stop.sh    Graceful shutdown timeout in seconds

Options:
  -p, --port <port>       Backend port (default: 8090 or $PORT)
  -t, --timeout <secs>    Seconds to wait before SIGKILL (default: 15)
  -h, --help              Show this help

The script refuses to kill a process unless it can verify the process belongs
to this Meridian application. Stale PID files are removed automatically.
EOF
    exit 0
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        -h|--help)
            usage
            ;;
        -p|--port)
            [ "$#" -ge 2 ] || fail "Missing value for $1"
            PORT="$2"
            shift 2
            ;;
        --port=*)
            PORT="${1#*=}"
            shift
            ;;
        -t|--timeout)
            [ "$#" -ge 2 ] || fail "Missing value for $1"
            TIMEOUT="$2"
            shift 2
            ;;
        --timeout=*)
            TIMEOUT="${1#*=}"
            shift
            ;;
        *)
            fail "Unknown option: $1 (try ./stop.sh --help)"
            ;;
    esac
done

case "$PORT" in
    ''|*[!0-9]*) fail "PORT must be a number (received: $PORT)" ;;
esac
case "$TIMEOUT" in
    ''|*[!0-9]*) fail "STOP_TIMEOUT must be a number (received: $TIMEOUT)" ;;
esac
if [ "$TIMEOUT" -lt 1 ]; then
    fail "Stop timeout must be at least 1 second."
fi

read_pid() {
    [ -f "$PID_FILE" ] || return 1
    local pid
    pid="$(tr -cd '0-9' < "$PID_FILE")"
    [ -n "$pid" ] || return 1
    printf '%s' "$pid"
}

is_alive() {
    [ -n "${1:-}" ] && kill -0 "$1" >/dev/null 2>&1
}

is_meridian_process() {
    local pid="$1" cmd
    [ "$pid" != "1" ] || return 1
    [ "$pid" != "$$" ] || return 1
    cmd="$(ps -p "$pid" -ww -o command= 2>/dev/null || true)"
    [ -n "$cmd" ] || return 1
    case "$cmd" in
        *production-management-system*.jar*|*MeridianApplication*) return 0 ;;
        *) return 1 ;;
    esac
}

kill_tree() {
    local pid="$1" signal="$2" child
    for child in $(pgrep -P "$pid" 2>/dev/null || true); do
        kill_tree "$child" "$signal"
    done
    kill -s "$signal" "$pid" >/dev/null 2>&1 || true
}

listener_pid() {
    # -iTCP covers IPv4 and IPv6 listeners. Prefer the IPv6-aware query and
    # verify with a second pass if the first returns nothing.
    if command -v lsof >/dev/null 2>&1; then
        local pid
        pid="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -n 1)"
        if [ -z "$pid" ]; then
            pid="$(lsof -nP -i6TCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -n 1)"
        fi
        [ -n "$pid" ] && printf '%s' "$pid"
    fi
}

stop_pid() {
    local pid="$1"
    local ticks=$((TIMEOUT * 2))

    info "Stopping Meridian on port ${PORT} (PID ${pid})…"
    kill_tree "$pid" TERM

    while [ "$ticks" -gt 0 ] && is_alive "$pid"; do
        sleep 0.5
        ticks=$((ticks - 1))
    done

    if is_alive "$pid"; then
        warn "Process did not exit after ${TIMEOUT}s; sending SIGKILL."
        kill_tree "$pid" KILL
        sleep 1
    fi

    if is_alive "$pid"; then
        fail "Could not stop process ${pid}. Check its permissions and try again."
    fi

    # Give Tomcat a moment to release the port, then clean up any surviving child.
    local attempts=20
    while [ "$attempts" -gt 0 ]; do
        local remaining
        remaining="$(listener_pid || true)"
        [ -z "$remaining" ] && break
        if [ "$remaining" != "$pid" ] && is_meridian_process "$remaining"; then
            warn "A Meridian child process (PID ${remaining}) still holds port ${PORT}; stopping it."
            kill_tree "$remaining" KILL
        fi
        sleep 0.25
        attempts=$((attempts - 1))
    done

    rm -f "$PID_FILE"

    local still_listening
    still_listening="$(listener_pid || true)"
    if [ -n "$still_listening" ]; then
        if is_meridian_process "$still_listening"; then
            fail "Port ${PORT} is still held by Meridian process ${still_listening}."
        fi
        warn "Meridian stopped, but port ${PORT} is still held by unrelated PID ${still_listening}."
    fi

    ok "Meridian stopped on port ${PORT}."
}

pid="$(read_pid || true)"

if [ -n "$pid" ]; then
    if ! is_alive "$pid"; then
        warn "PID file is stale (process ${pid} is not running); removing it."
        rm -f "$PID_FILE"
    elif ! is_meridian_process "$pid"; then
        fail "PID ${pid} does not appear to be Meridian. Refusing to stop it. Remove ${PID_FILE} if it is stale."
    else
        stop_pid "$pid"
        exit 0
    fi
fi

# No usable PID file: only stop a listener we can positively identify as ours.
listener="$(listener_pid || true)"
if [ -n "$listener" ]; then
    if is_meridian_process "$listener"; then
        info "No PID file found; detected Meridian listening on port ${PORT} (PID ${listener})."
        stop_pid "$listener"
        exit 0
    fi
    warn "Port ${PORT} is held by an unrelated process (PID ${listener}); nothing to stop."
    exit 0
fi

ok "Meridian is not running on port ${PORT}."
