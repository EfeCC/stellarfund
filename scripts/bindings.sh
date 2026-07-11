#!/usr/bin/env bash
#
# Regenerate the typed TypeScript clients from the compiled contracts.
#
# `stellar contract bindings typescript` emits a whole npm package, but all we
# want is the module. Copying just `src/index.ts` into frontend/src/contracts
# means Vite compiles the clients along with the rest of the app: no nested
# install, no separate build step, and `tsc -b` type-checks them in CI.
#
# Usage: ./scripts/bindings.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

WASM_DIR="target/wasm32v1-none/release"
OUT_DIR="frontend/src/contracts"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

log() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }

log "Building contracts"
stellar contract build

mkdir -p "$OUT_DIR"

for name in campaign factory; do
  log "Generating $name client"
  stellar contract bindings typescript \
    --wasm "$WASM_DIR/$name.wasm" \
    --output-dir "$TMP/$name" \
    --overwrite >/dev/null

  cp "$TMP/$name/src/index.ts" "$OUT_DIR/$name.ts"
  log "  wrote $OUT_DIR/$name.ts"
done

log "Done. Commit the regenerated clients if the contract API changed."
