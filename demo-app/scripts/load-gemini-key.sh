#!/bin/bash
# Load GOOGLE_API_KEY from user env vars (HKCU\Environment) into the current session.
# Needed because Hermes terminal sessions don't inherit setx changes made mid-session.
# Usage: source scripts/load-gemini-key.sh
# Note: graphify reads GOOGLE_API_KEY or GEMINI_API_KEY.
KEY="$(reg query 'HKCU\Environment' /v GOOGLE_API_KEY 2>/dev/null | grep REG_SZ | awk '{print $3}')"
if [ -z "$KEY" ]; then
  echo "load-gemini-key: GOOGLE_API_KEY not found in HKCU\Environment" >&2
  return 1 2>/dev/null || exit 1
fi
export GOOGLE_API_KEY="$KEY"
echo "load-gemini-key: GOOGLE_API_KEY loaded (len ${#KEY})"
