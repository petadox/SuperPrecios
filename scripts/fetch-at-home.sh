#!/bin/bash
# Eroski and Caprabo block GitHub's servers, so their prices are fetched from
# this computer and pushed, encrypted, to the home-data branch, which only ever
# holds the latest copy (force-pushed so the repo doesn't grow every day).
# Runs daily from ~/Library/LaunchAgents/com.superprecios.fetch-at-home.plist.
set -euo pipefail
cd "$(dirname "$0")/.."

HOME_DATA_KEY="$(cat "$HOME/.config/superprecios/home-data-key")"
export HOME_DATA_KEY

echo "== $(date '+%F %T') descargando Eroski y Caprabo"
node scripts/fetch-prices.mjs eroski caprabo

out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
node scripts/home-data.mjs pack "$out"

git -C "$out" init -q -b home-data
git -C "$out" add -A
git -C "$out" commit -qm "Precios de Eroski y Caprabo descargados desde casa"
git -C "$out" push -qf "$(git remote get-url origin)" home-data
echo "== $(date '+%F %T') subido a home-data, publicando"

gh workflow run deploy.yml -R petadox/SuperPrecios
