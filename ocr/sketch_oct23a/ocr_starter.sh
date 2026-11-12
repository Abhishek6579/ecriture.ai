#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="${PYTHON:-python3}"

if ! command -v "$PYTHON" >/dev/null 2>&1; then
    echo "Error: '$PYTHON' was not found."
    echo "Install Python 3, or set PYTHON to the interpreter you want to use."
    exit 1
fi

cd "$SCRIPT_DIR"

if ! "$PYTHON" -c "import serial, cv2, numpy" >/dev/null 2>&1; then
    echo "Error: one or more Python dependencies are missing."
    echo "Install them in the environment used by '$PYTHON' with:"
    echo "  $PYTHON -m pip install pyserial opencv-python numpy"
    exit 1
fi

echo "Starting ESP32-CAM OCR Pen..."
echo "Python: $("$PYTHON" --version 2>&1)"
echo "Working directory: $SCRIPT_DIR"
echo

exec "$PYTHON" "$SCRIPT_DIR/ocr_pen_stitch.py"
