# ESP32-CAM OCR Pen — Linux launcher

This directory contains the host-side Python capture and stitching program, the
ESP32 sketch, and launchers for Windows and Linux.

## 1. Install the host dependencies

Python 3 and pip are required. From this directory, install the packages:

```bash
python3 -m pip install pyserial opencv-python numpy
```

If your Linux distribution marks its system Python as externally managed, create
and activate a virtual environment first:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install pyserial opencv-python numpy
```

The launcher uses `python3` by default. When using a virtual environment, activate
it before launching, or set `PYTHON` to its interpreter path.

## 2. Upload the ESP32 firmware

Open `sketch_oct23a.ino` in Arduino IDE, select the correct ESP32 board and serial
port, and upload the sketch. This is a separate, one-time firmware upload; the
launcher does not compile or flash the ESP32.

## 3. Allow access to the serial port

On many Debian/Ubuntu-based systems, the USB serial device is accessible to the
`dialout` group. Add your account if necessary:

```bash
sudo usermod -aG dialout "$USER"
```

Log out and log back in (or reboot) for the group change to take effect. The device
may appear as `/dev/ttyUSB0` or `/dev/ttyACM0`. Other distributions may use a
different group, such as `uucp`.

## 4. Start the OCR capture program

From this directory:

```bash
chmod +x ocr_starter.sh
./ocr_starter.sh
```

The script checks for Python and the required imports, switches to its own directory,
and starts `ocr_pen_stitch.py`. It does not install packages automatically.

Press the physical switch on the pen to start/stop recording. The Python program
shows a live preview; press `Q` in that preview or `Ctrl+C` in the terminal to stop.

## Troubleshooting

- **ESP32 not found:** reconnect the board and check `ls /dev/ttyUSB*` or
  `ls /dev/ttyACM*`. Confirm that the serial device is not open in Arduino IDE or
  another serial monitor.
- **Permission denied:** verify your serial-port group membership and log in again.
- **Missing Python modules:** install `pyserial`, `opencv-python`, and `numpy`
  in the same Python environment selected by the launcher.
- **No READY message:** confirm that the sketch was uploaded successfully, then
  press the board's reset button.
