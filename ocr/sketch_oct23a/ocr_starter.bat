
@echo off
cd /d "%~dp0"

echo Starting ESP32-CAM OCR Pen...
echo.

python ocr_pen_stitch.py

echo.
echo Program stopped.
pause
