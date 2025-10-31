#!/usr/bin/env bash
# clean_cache.sh - Remove Python cache artifacts in this service.
# Usage:
#   ./clean_cache.sh            # cleans caches relative to this script's directory
#   ./clean_cache.sh /path/dir  # cleans caches under provided directory
#
# What it removes:
#   - __pycache__ directories
#   - *.pyc / *.pyo files
#   - .pytest_cache directories (if present)

set -euo pipefail

TARGET_DIR="${1:-$(dirname "$0")}"

if [ ! -d "$TARGET_DIR" ]; then
  echo "Target directory does not exist: $TARGET_DIR" >&2
  exit 1
fi

echo "Cleaning Python cache artifacts under: $TARGET_DIR"

# Remove __pycache__ directories
find "$TARGET_DIR" -type d -name "__pycache__" -exec rm -rf {} +

# Remove .pytest_cache directories
find "$TARGET_DIR" -type d -name ".pytest_cache" -exec rm -rf {} +

# Remove compiled Python files
find "$TARGET_DIR" -type f \( -name "*.pyc" -o -name "*.pyo" \) -delete

echo "Cleanup complete."