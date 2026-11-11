#!/bin/bash
# Appends one line per hook firing to docs/kiro-evidence/hook-fires.log, so "does this hook
# really fire in the CLI?" is answered by a file, not by a guess. Usage: log-fire.sh <label>
cd "$(dirname "$0")/../../.." || exit 0
printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" >> docs/kiro-evidence/hook-fires.log
