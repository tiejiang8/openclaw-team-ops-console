#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
RUN_DIR="$PROJECT_DIR/.run"
LOG_DIR="$PROJECT_DIR/.logs"
PID_FILE="$RUN_DIR/dev.pgid"

DO_PULL=0
DO_INSTALL=0
FOREGROUND=0

for arg in "$@"; do
  case "$arg" in
    --pull)
      DO_PULL=1
      ;;
    --install)
      DO_INSTALL=1
      ;;
    --fg)
      FOREGROUND=1
      ;;
    *)
      echo "Unknown arg: $arg"
      echo "Usage: $0 [--pull] [--install] [--fg]"
      exit 1
      ;;
  esac
done

mkdir -p "$RUN_DIR" "$LOG_DIR"

log() {
  echo "[$(date '+%F %T')] $*"
}

is_pid_alive() {
  local pid="$1"
  kill -0 "$pid" 2>/dev/null
}

stop_by_pgid() {
  if [[ ! -f "$PID_FILE" ]]; then
    return 0
  fi

  local pgid
  pgid="$(cat "$PID_FILE" 2>/dev/null || true)"

  if [[ -z "${pgid:-}" ]]; then
    rm -f "$PID_FILE"
    return 0
  fi

  if ps -o pgid= -p "$pgid" >/dev/null 2>&1 || pgrep -g "$pgid" >/dev/null 2>&1; then
    log "Stopping dev process group: PGID=$pgid"
    kill -TERM -- "-$pgid" 2>/dev/null || true

    for _ in {1..10}; do
      sleep 1
      if ! pgrep -g "$pgid" >/dev/null 2>&1; then
        break
      fi
    done

    if pgrep -g "$pgid" >/dev/null 2>&1; then
      log "Force killing process group: PGID=$pgid"
      kill -KILL -- "-$pgid" 2>/dev/null || true
    fi
  fi

  rm -f "$PID_FILE"
}

fallback_kill_by_project() {
  log "Fallback cleanup: scanning repo-related processes"

  mapfile -t PIDS < <(
    pgrep -af "node|pnpm|vite|tsx|concurrently|esbuild" | \
    grep -F "$PROJECT_DIR" | \
    awk '{print $1}' | \
    sort -u
  )

  if [[ ${#PIDS[@]} -eq 0 ]]; then
    log "No leftover repo processes found"
    return 0
  fi

  log "Stopping leftover PIDs: ${PIDS[*]}"
  kill "${PIDS[@]}" 2>/dev/null || true

  for _ in {1..8}; do
    sleep 1
    local alive=()
    for pid in "${PIDS[@]}"; do
      if is_pid_alive "$pid"; then
        alive+=("$pid")
      fi
    done

    if [[ ${#alive[@]} -eq 0 ]]; then
      break
    fi

    PIDS=("${alive[@]}")
  done

  if [[ ${#PIDS[@]} -gt 0 ]]; then
    log "Force killing leftover PIDs: ${PIDS[*]}"
    kill -KILL "${PIDS[@]}" 2>/dev/null || true
  fi
}

maybe_pull() {
  if [[ "$DO_PULL" -eq 1 ]]; then
    log "Running git pull"
    git -C "$PROJECT_DIR" pull
  fi
}

maybe_install() {
  if [[ "$DO_INSTALL" -eq 1 ]]; then
    log "Running corepack pnpm install"
    (cd "$PROJECT_DIR" && corepack pnpm install)
  fi
}

start_foreground() {
  log "Starting dev in foreground"
  cd "$PROJECT_DIR"
  exec corepack pnpm dev
}

start_background() {
  local ts log_file launcher_pid pgid
  ts="$(date '+%F-%H%M%S')"
  log_file="$LOG_DIR/dev-$ts.log"

  log "Starting dev in background"
  log "Log file: $log_file"

  cd "$PROJECT_DIR"

  setsid bash -lc "cd '$PROJECT_DIR' && exec corepack pnpm dev" >"$log_file" 2>&1 &
  launcher_pid=$!

  sleep 1

  pgid="$(ps -o pgid= "$launcher_pid" | tr -d ' ')"
  if [[ -z "${pgid:-}" ]]; then
    log "Failed to capture PGID"
    exit 1
  fi

  echo "$pgid" > "$PID_FILE"

  log "Started. launcher_pid=$launcher_pid pgid=$pgid"
  log "Tail logs with: tail -f '$log_file'"
}

main() {
  log "Project dir: $PROJECT_DIR"

  stop_by_pgid
  fallback_kill_by_project

  maybe_pull
  maybe_install

  if [[ "$FOREGROUND" -eq 1 ]]; then
    start_foreground
  else
    start_background
  fi
}

main "$@"