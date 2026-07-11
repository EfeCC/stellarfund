.PHONY: default all build test lint fmt clean \
        web-install web-dev web-test web-build bindings deploy

default: build

all: lint test web-test build web-build

# --- Contracts ---------------------------------------------------------------

build:
	stellar contract build

# The factory's tests deploy the *compiled* campaign wasm, exactly as the factory
# does on-chain, so the wasm has to exist before `cargo test` compiles them.
test: build
	cargo test

fmt:
	cargo fmt --all

lint:
	cargo fmt --all --check
	cargo clippy --all-targets -- -D warnings

# --- Deployment --------------------------------------------------------------

# Deploy both contracts to testnet and write frontend/src/config/deployment.json.
deploy:
	./scripts/deploy.sh

# Regenerate the typed TS clients from the deployed contracts.
bindings:
	./scripts/bindings.sh

# --- Frontend ----------------------------------------------------------------

web-install:
	cd frontend && npm ci

web-dev:
	cd frontend && npm run dev

web-test:
	cd frontend && npm run test:run

web-build:
	cd frontend && npm run build

# --- Housekeeping ------------------------------------------------------------

clean:
	cargo clean
	rm -rf frontend/node_modules frontend/dist
