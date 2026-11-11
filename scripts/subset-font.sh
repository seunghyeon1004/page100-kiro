#!/bin/bash
# Rebuilds public/fonts/bedstead-extended-subset.woff2 from Bedstead Extended.
# Needs python3 with fonttools and brotli (pip install fonttools brotli) and network access.
# Usage: scripts/subset-font.sh [path-to-bedstead-extended.otf]
set -euo pipefail
cd "$(dirname "$0")/.."
src="${1:-}"
if [ -z "$src" ]; then
  src="$(mktemp -d)/bedstead-extended.otf"
  curl -fsSL -o "$src" https://bjh21.me.uk/bedstead/bedstead-extended.otf
fi
# Keep in step with src/grid/repertoire.ts; test/fonts/coverage.test.ts fails if they drift.
unicodes="U+0020-007E,U+00A3,U+00B0,U+20AC,U+00C0-00D6,U+00D8-00F6,U+00F8-00FF"
unicodes="$unicodes,U+258C,U+2590,U+2588,U+1FB00-1FB3B,U+1CE51-1CE8F"
out=public/fonts/bedstead-extended-subset.woff2
pyftsubset "$src" --unicodes="$unicodes" --flavor=woff2 --layout-features='' --no-hinting \
  --desubroutinize --name-IDs='1,2,4,6,14' --output-file="$out"
python3 - "$out" <<'PY'
import json, sys
from fontTools.ttLib import TTFont
cmap = sorted(TTFont(sys.argv[1]).getBestCmap())
json.dump(cmap, open(sys.argv[1].replace(".woff2", ".coverage.json"), "w"))
print(len(cmap), "code points")
PY
ls -l "$out"
