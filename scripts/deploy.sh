#!/usr/bin/env bash
#
# Deploy StellarFund and record where it landed.
#
# Uploads the campaign wasm, deploys the factory pointing at that wasm hash, and
# writes frontend/src/config/deployment.json — the single source of truth the
# frontend reads for contract addresses. Re-running it deploys a *fresh* factory
# with an empty registry.
#
# Usage:
#   ./scripts/deploy.sh                    # testnet, using the `deployer` identity
#   NETWORK=testnet SOURCE=alice ./scripts/deploy.sh
#
# In CI the identity comes from STELLAR_SECRET_KEY instead (see
# .github/workflows/deploy-contracts.yml).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:-deployer}"

WASM_DIR="target/wasm32v1-none/release"
CONFIG="frontend/src/config/deployment.json"

case "$NETWORK" in
  testnet)
    RPC_URL="https://soroban-testnet.stellar.org"
    PASSPHRASE="Test SDF Network ; September 2015"
    EXPLORER="https://stellar.expert/explorer/testnet"
    ;;
  mainnet|public)
    RPC_URL="https://mainnet.sorobanrpc.com"
    PASSPHRASE="Public Global Stellar Network ; September 2015"
    EXPLORER="https://stellar.expert/explorer/public"
    ;;
  *)
    echo "error: unsupported network '$NETWORK' (expected testnet or mainnet)" >&2
    exit 1
    ;;
esac

log() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }

log "Building contracts"
stellar contract build

# The factory instantiates campaigns from a wasm hash, so the campaign code is
# uploaded but never deployed directly.
log "Uploading campaign wasm"
CAMPAIGN_WASM_HASH="$(stellar contract upload \
  --wasm "$WASM_DIR/campaign.wasm" \
  --source "$SOURCE" \
  --network "$NETWORK")"
log "  campaign wasm hash: $CAMPAIGN_WASM_HASH"

ADMIN="$(stellar keys address "$SOURCE")"

log "Deploying factory (admin: $ADMIN)"
FACTORY_ID="$(stellar contract deploy \
  --wasm "$WASM_DIR/factory.wasm" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  -- \
  --admin "$ADMIN" \
  --campaign_wasm_hash "$CAMPAIGN_WASM_HASH")"
log "  factory: $FACTORY_ID"

# Campaigns raise in native XLM, which on Soroban is an ordinary token contract.
NATIVE_TOKEN_ID="$(stellar contract id asset --asset native --network "$NETWORK")"
log "  native XLM SAC: $NATIVE_TOKEN_ID"

mkdir -p "$(dirname "$CONFIG")"
cat > "$CONFIG" <<JSON
{
  "network": "$NETWORK",
  "networkPassphrase": "$PASSPHRASE",
  "rpcUrl": "$RPC_URL",
  "explorerUrl": "$EXPLORER",
  "factoryId": "$FACTORY_ID",
  "nativeTokenId": "$NATIVE_TOKEN_ID",
  "campaignWasmHash": "$CAMPAIGN_WASM_HASH",
  "admin": "$ADMIN",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON

log "Wrote $CONFIG"
log "Factory: $EXPLORER/contract/$FACTORY_ID"
