import serial
import serial.tools.list_ports
import time
import cv2
import numpy as np
import os
import sys

# ====== CONFIG ======
BAUD         = 921600
OUTPUT_DIR   = "./captures"
SHOW_PREVIEW = True          # live video window

# ====== HELPERS ======
def find_esp32_port():
    for p in serial.tools.list_ports.comports():
        d = (p.description or "").lower()
        if "ch340" in d or "cp210" in d or "usb serial" in d or "usb-serial" in d:
            return p.device
    return None

def open_port_safe(port, baud):
    ser = serial.Serial()
    ser.port = port
    ser.baudrate = baud
    ser.timeout = 15
    ser.dtr = False
    ser.rts = False
    ser.open()
    ser.dtr = False
    ser.rts = False
    return ser

def read_exact(ser, n, timeout=15):
    ser.timeout = timeout
    data = b""
    t_end = time.time() + timeout
    while len(data) < n:
        if time.time() > t_end:
            return None
        chunk = ser.read(n - len(data))
        if chunk:
            data += chunk
            t_end = time.time() + timeout
    return data

def capture_jpeg(ser):
    """Request one JPEG frame from ESP32."""
    ser.write(b'C')
    ser.flush()

    len_bytes = read_exact(ser, 4)
    if len_bytes is None:
        return None, "timeout on length"
    length = int.from_bytes(len_bytes, "little")
    if length == 0:
        return None, "ESP32 camera error"
    if length > 500000:
        return None, f"bad length: {length}"

    jpg = read_exact(ser, length)
    if jpg is None:
        return None, "timeout on payload"

    img = cv2.imdecode(np.frombuffer(jpg, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        return None, "JPEG decode failed"

    return img, None

# ====== MAIN ======
def main():
    port = find_esp32_port()
    if port is None:
        print("ESP32 not found")
        return

    print(f"Opening {port} @ {BAUD} baud")
    ser = open_port_safe(port, BAUD)

    print("Waiting for READY...")
    ser.timeout = 0.5
    t_end = time.time() + 15
    ready = False
    while time.time() < t_end:
        line = ser.readline().decode(errors="ignore").strip()
        if "READY" in line:
            ready = True
            break
    if not ready:
        print("No READY. Press RST on the board.")
        ser.close()
        return
    print("Ready.\n")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=" * 60)
    print("LIVE VIDEO MODE — press 'Q' in window or Ctrl+C in terminal to stop")
    print("=" * 60)

    frame_count = 0
    start = time.time()
    last_report = start

    try:
        while True:
            img, err = capture_jpeg(ser)
            if img is None:
                print(f"  [drop] {err}")
                continue

            frame_count += 1

            # Save the frame to disk (every frame)
            fname = os.path.join(OUTPUT_DIR, f"cap_{int(time.time()*1000)}.jpg")
            cv2.imwrite(fname, img)

            # FPS counter
            now = time.time()
            if now - last_report >= 1.0:
                fps = frame_count / (now - start)
                print(f"  frame {frame_count}  {img.shape[1]}x{img.shape[0]}  "
                      f"running fps: {fps:.2f}  → {os.path.basename(fname)}")
                last_report = now

            # Show live preview
            if SHOW_PREVIEW:
                cv2.imshow("OCR Pen — Live (press Q to stop)", img)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    print("\nQ pressed — stopping.")
                    break

    except KeyboardInterrupt:
        print("\nCtrl+C — stopping.")

    finally:
        elapsed = time.time() - start
        avg_fps = frame_count / elapsed if elapsed > 0 else 0
        print(f"\n=== Session summary ===")
        print(f"Frames captured: {frame_count}")
        print(f"Total time:      {elapsed:.1f}s")
        print(f"Average FPS:     {avg_fps:.2f}")
        print(f"Saved to:        {OUTPUT_DIR}/")
        ser.close()
        if SHOW_PREVIEW:
            cv2.destroyAllWindows()

if __name__ == "__main__":
    main()