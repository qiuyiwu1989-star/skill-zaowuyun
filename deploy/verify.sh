#!/usr/bin/env bash
set -euo pipefail

origin="${1:-http://127.0.0.1:4310}"
curl --fail --silent --show-error "${origin}/healthz"
curl --fail --silent --show-error "${origin}/readyz"
curl --fail --silent --show-error "${origin}/" | grep -q '可信技能市场'

