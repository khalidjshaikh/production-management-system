#!/usr/bin/env bash
#
# Meridian Production Management — build and launch helper.
#
#   ./run.sh              Build the UI + jar, run in the foreground
#   ./run.sh start        Build, then run in the background (PID: .run/pms.pid)
#   ./run.sh stop         Stop a background instance started with `start`
#   ./run.sh restart      Stop, rebuild, start in the background
#   ./run.sh status       Show whether a background instance is running
#   ./run.sh dev          Spring Boot + Vite hot-reload development mode
#   ./run.sh build        Build the UI and executable jar only
#   ./run.sh test         Run backend tests and the frontend production build
#
#   ./stop.sh             Safely stop a background instance (and stale PID cleanup)
#
# Environment:
#   PORT=8090             Backend port
#   SKIP_UI_BUILD=1       Reuse frontend/dist instead of rebuilding the UI
#   JAVA_OPTS="-Xmx1g"    JVM options
#   NO_COLOR=1            Disable ANSI colors
#
# The server binds all interfaces (dual-stack IPv4/IPv6). Health checks probe
# localhost, 127.0.0.1 and [::1] so either loopback family works.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="$ROOT/frontend"
RUN_DIR="$ROOT/.run"
PID_FILE="$RUN_DIR/pms.pid"
LOG_FILE="$RUN_DIR/pms.log"
JAR="$ROOT/target/production-management-system-1.0.0.jar"
PORT="${PORT:-8090}"
APP_URL="http://localhost:${PORT}"
IPV4_URL="http://127.0.0.1:${PORT}"
IPV6_URL="http://[::1]:${PORT}"
HEALTH_URL="${APP_URL}/actuator/health"
IPV4_HEALTH_URL="${IPV4_URL}/actuator/health"
IPV6_HEALTH_URL="${IPV6_URL}/actuator/health"

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
quiet() { "$@" >/dev/null 2>&1; }

usage() {
    cat <<'EOF'
Meridian Production Management — build and launch helper.

Usage:
  ./run.sh              Build the UI + jar, run in the foreground
  ./run.sh start        Build, then run in the background (PID: .run/pms.pid)
  ./run.sh stop         Stop a background instance started with `start`
  ./run.sh restart      Stop, rebuild, start in the background
  ./run.sh status       Show whether a background instance is running
  ./run.sh dev          Spring Boot + Vite hot-reload development mode
  ./run.sh build        Build the UI and executable jar only
  ./run.sh test         Run backend tests and the frontend production build

  ./stop.sh             Safely stop a background instance
  ./stop.sh --port N    Stop an instance on another port

Environment:
  PORT=8090             Backend port
  SKIP_UI_BUILD=1       Reuse frontend/dist instead of rebuilding the UI
  JAVA_OPTS="-Xmx1g"    JVM options
  NO_COLOR=1            Disable ANSI colors

URLs:
  IPv4: http://127.0.0.1:8090       IPv6: http://[::1]:8090
  (set PORT to use a different port)

Examples:
  ./run.sh start
  PORT=8091 ./run.sh
  SKIP_UI_BUILD=1 ./run.sh restart
EOF
    exit 0
}

need() {
    command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

check_toolchain() {
    need java
    need mvn
    if [ "${SKIP_UI_BUILD:-0}" != "1" ] || [ "${1:-}" = "dev" ]; then
        need npm
    fi
    local java_major
    java_major="$(java -version 2>&1 | awk -F'"' '/version/ { split($2, v, "."); print v[1]; exit }')"
    if [ -n "$java_major" ] && [ "$java_major" -lt 27 ] 2>/dev/null; then
        fail "Java 27 or newer is required (found Java ${java_major}). Set JAVA_HOME to a Java 27 JDK."
    fi
}

install_ui_deps() {
    [ -f "$FRONTEND/package.json" ] || fail "frontend/package.json is missing."
    cd "$FRONTEND"
    local marker="$FRONTEND/node_modules/.package-lock.json"
    if [ ! -d "$FRONTEND/node_modules" ]; then
        if [ -f "$FRONTEND/package-lock.json" ]; then
            info "Installing frontend dependencies (npm ci)…"
            npm ci --no-audit --no-fund
        else
            info "Installing frontend dependencies (npm install)…"
            npm install --no-audit --no-fund
        fi
    elif [ -f "$FRONTEND/package-lock.json" ] && [ "$FRONTEND/package-lock.json" -nt "$marker" ]; then
        info "package-lock.json changed — syncing frontend dependencies…"
        npm install --no-audit --no-fund
    fi
    cd "$ROOT"
}

build_ui() {
    if [ "${SKIP_UI_BUILD:-0}" = "1" ]; then
        [ -f "$FRONTEND/dist/index.html" ] || fail "SKIP_UI_BUILD=1 but frontend/dist/index.html does not exist."
        ok "Reusing existing frontend build."
        return
    fi
    install_ui_deps
    info "Building React UI…"
    ( cd "$FRONTEND" && npm run build )
    ok "Frontend built."
}

build_backend() {
    info "Building Spring Boot application…"
    local args=(-q -DskipTests package)
    ( cd "$ROOT" && mvn "${args[@]}" )
    [ -f "$JAR" ] || fail "Maven did not produce $JAR"
    ok "Application jar ready: target/$(basename "$JAR")"
}

build_all() {
    build_ui
    build_backend
}

port_in_use() {
    if command -v lsof >/dev/null 2>&1; then
        lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1
    else
        return 1
    fi
}

running_pid() {
    [ -f "$PID_FILE" ] || return 1
    local pid
    pid="$(tr -dc '0-9' < "$PID_FILE")"
    [ -n "$pid" ] || return 1
    kill -0 "$pid" >/dev/null 2>&1 || return 1
    printf '%s' "$pid"
}

health_ok() {
    local url
    for url in "$HEALTH_URL" "$IPV4_HEALTH_URL" "$IPV6_HEALTH_URL"; do
        # -g stops curl from interpreting the IPv6 brackets as a URL glob.
        if curl -g -fsS --max-time 2 "$url" >/dev/null 2>&1; then
            return 0
        fi
    done
    return 1
}

wait_for_health() {
    local attempts="${1:-60}"
    local i=0
    if ! command -v curl >/dev/null 2>&1; then
        sleep 3
        return 0
    fi
    while [ "$i" -lt "$attempts" ]; do
        if health_ok; then
            return 0
        fi
        i=$((i + 1))
        sleep 1
    done
    return 1
}

kill_tree() {
    local pid="$1"
    local child
    for child in $(pgrep -P "$pid" 2>/dev/null || true); do
        kill_tree "$child"
    done
    kill "$pid" >/dev/null 2>&1 || true
}

cmd_run() {
    check_toolchain
    if pid="$(running_pid)"; then
        fail "Meridian is already running (PID $pid) at $APP_URL. Use ./run.sh stop first."
    fi
    if port_in_use; then
        fail "Port $PORT is already in use. Stop the other process or run with PORT=<other>."
    fi
    mkdir -p "$ROOT/data"
    build_all
    printf '\n'
    ok "Starting Meridian at ${BOLD}${APP_URL}${RESET}"
    printf '%s\n' "${DIM}    IPv4: ${IPV4_URL}   IPv6: ${IPV6_URL}${RESET}"
    printf '%s\n' "${DIM}    H2 console: ${APP_URL}/h2-console${RESET}"
    printf '%s\n\n' "${DIM}    Press Ctrl+C to stop.${RESET}"
    exec java ${JAVA_OPTS:-} -jar "$JAR" --server.port="$PORT"
}

cmd_start() {
    check_toolchain
    if pid="$(running_pid)"; then
        fail "Meridian is already running (PID $pid) at $APP_URL."
    fi
    if port_in_use; then
        fail "Port $PORT is already in use."
    fi
    build_all
    mkdir -p "$RUN_DIR" "$ROOT/data"
    info "Starting Meridian in the background…"
    nohup java ${JAVA_OPTS:-} -jar "$JAR" --server.port="$PORT" >"$LOG_FILE" 2>&1 &
    local pid=$!
    printf '%s\n' "$pid" > "$PID_FILE"
    if wait_for_health 75; then
        ok "Meridian is running (PID $pid) at ${BOLD}${APP_URL}${RESET}"
        printf '%s\n' "${DIM}    IPv4: ${IPV4_URL}   IPv6: ${IPV6_URL}${RESET}"
        printf '%s\n' "${DIM}    Logs:   $LOG_FILE${RESET}"
        printf '%s\n' "${DIM}    Stop:   ./stop.sh (or ./run.sh stop)${RESET}"
    else
        warn "The server did not become healthy in time. Recent log output:"
        tail -n 30 "$LOG_FILE" >&2 || true
        kill "$pid" >/dev/null 2>&1 || true
        rm -f "$PID_FILE"
        exit 1
    fi
}

cmd_stop() {
    "$ROOT/stop.sh" --port "$PORT" --timeout "${STOP_TIMEOUT:-15}"
}

cmd_status() {
    if pid="$(running_pid)"; then
        if health_ok; then
            ok "Meridian is running (PID $pid) at ${BOLD}${APP_URL}${RESET}"
            printf '%s\n' "${DIM}    IPv4: ${IPV4_URL}   IPv6: ${IPV6_URL}${RESET}"
        else
            warn "Process $pid is running but the health endpoint is not responding."
        fi
    else
        printf '%s\n' "Meridian is not running."
    fi
}

cmd_dev() {
    check_toolchain dev
    install_ui_deps
    if port_in_use; then
        fail "Port $PORT is already in use. Stop the other process or run with PORT=<other>."
    fi
    local backend_pid=""
    cleanup() {
        printf '\n'
        info "Shutting down development servers…"
        if [ -n "$backend_pid" ]; then
            kill_tree "$backend_pid"
        fi
    }
    trap cleanup EXIT INT TERM
    info "Starting Spring Boot on port $PORT…"
    ( cd "$ROOT" && mvn -q -DskipTests spring-boot:run -Dspring-boot.run.arguments="--server.port=$PORT" ) &
    backend_pid=$!
    printf '%s' "$DIM"
    if wait_for_health 90; then
        printf '%s' "$RESET"
        ok "Backend ready at $APP_URL"
    else
        printf '%s' "$RESET"
        warn "Backend did not report healthy yet — Vite will proxy once it is ready."
    fi
    printf '\n'
    ok "Starting Vite at ${BOLD}http://localhost:5173${RESET}"
    printf '%s\n' "${DIM}    IPv4: http://127.0.0.1:5173   IPv6: http://[::1]:5173${RESET}"
    printf '%s\n\n' "${DIM}    Press Ctrl+C to stop both servers.${RESET}"
    ( cd "$FRONTEND" && VITE_API_TARGET="$APP_URL" npm run dev )
}

cmd_build() {
    check_toolchain
    build_all
    printf '\n'
    ok "Build complete. Run ${BOLD}./run.sh start${RESET} to launch the jar."
}

cmd_test() {
    check_toolchain dev
    install_ui_deps
    info "Running backend tests…"
    ( cd "$ROOT" && mvn test )
    info "Type-checking and building frontend…"
    ( cd "$FRONTEND" && npm run build )
    ok "All checks passed."
}

case "${1:-run}" in
    run)        cmd_run ;;
    start)      cmd_start ;;
    stop)       cmd_stop ;;
    restart)    cmd_stop; cmd_start ;;
    status)     cmd_status ;;
    dev)        cmd_dev ;;
    build)      cmd_build ;;
    test)       cmd_test ;;
    help|-h|--help) usage ;;
    *)
        fail "Unknown command: $1 (try ./run.sh help)"
        ;;
esac
