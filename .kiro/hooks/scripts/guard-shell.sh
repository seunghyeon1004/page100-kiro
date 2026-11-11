#!/bin/bash
# PreToolUse guard for shell commands. Reads the hook event from stdin and refuses (exit 2)
# anything that stages, commits or pushes, or that reads a secrets file or a parent directory.
# tech.md rules 1 and 2 say the same in words; this makes them a wall.
event="$(cat)"
here="$(cd "$(dirname "$0")" && pwd)"
if printf '%s' "$event" | grep -Eq 'git +(add|commit|push|reset +--hard|clean)\b'; then
  "$here/log-fire.sh" "PreToolUse guard-shell BLOCKED git write"
  echo "Blocked by .kiro/hooks/guard-shell: the owner stages, commits and pushes (tech.md rule 1)." >&2
  exit 2
fi
if printf '%s' "$event" | grep -Eq '(\.secrets|\.env($|[^.a-zA-Z]|\.[a-df-z])|(^|[ "/])\.\./\.\.)'; then
  "$here/log-fire.sh" "PreToolUse guard-shell BLOCKED secrets or parent path"
  echo "Blocked by .kiro/hooks/guard-shell: no secrets files, nothing above the repository (tech.md rule 2)." >&2
  exit 2
fi
"$here/log-fire.sh" "PreToolUse guard-shell allowed"
exit 0
