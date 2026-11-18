#!/usr/bin/env bash
set -euo pipefail

version=${1:-}
if [[ $# != 1 || ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Uso: bash scripts/build-image.sh MAJOR.MINOR.PATCH" >&2
  exit 2
fi

root=$(git rev-parse --show-toplevel)
commit=$(git -C "$root" rev-parse HEAD)
short_commit=${commit:0:7}
build_date=$(date -u +%Y-%m-%dT%H:%M:%SZ)
image="ghcr.io/distortr/pia-cloudcomputing:${version}-${short_commit}"

# Construir el mismo árbol que identifica el SHA, aunque haya cambios locales.
git -C "$root" archive "$commit" Dockerfile .dockerignore app |
  docker build --build-arg "APP_VERSION=$version" \
    --build-arg "APP_COMMIT_SHA=$commit" \
    --build-arg "APP_BUILD_DATE=$build_date" \
    --tag "$image" -
printf '%s\n' "$image"
