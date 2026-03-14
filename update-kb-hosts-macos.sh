#!/usr/bin/env bash

set -euo pipefail

HOST_NAME="kb-server.local"
TARGET_IP="${1:-127.0.0.1}"
HOSTS_FILE="/etc/hosts"

if ! [[ "$TARGET_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  echo "Invalid IPv4 address: $TARGET_IP" >&2
  exit 1
fi

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

awk -v host="$HOST_NAME" -v ip="$TARGET_IP" '
  BEGIN { updated = 0 }
  {
    if ($0 ~ ("(^|[[:space:]])" host "([[:space:]]|$)")) {
      if (!updated) {
        print ip " " host
        updated = 1
      }
      next
    }
    print $0
  }
  END {
    if (!updated) {
      print ip " " host
    }
  }
' "$HOSTS_FILE" > "$TMP_FILE"

echo "Updating $HOST_NAME -> $TARGET_IP in $HOSTS_FILE"
sudo cp "$TMP_FILE" "$HOSTS_FILE"
echo "Done:"
grep -n "$HOST_NAME" "$HOSTS_FILE" || true
