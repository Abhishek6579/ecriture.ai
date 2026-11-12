import serial
import serial.tools.list_ports
import time
import cv2
import numpy as np
import os

BAUD         = 921600
OUTPUT_DIR   = "./captures"
SHOW_PREVIEW = True
MAX_LEN      = 500000
FAIL_LIMIT   = 5          # consecutive failures before resetting the board

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
    ser.timeout = 1
    ser.dtr = False
    ser.rts = False
    ser.open()
    ser.dtr = False
    ser.rts = False
    return ser

def read_exact(ser, n, timeout=5):
    ser.timeout = 0.5
    data = bytearray()
    t_end = time.time() + timeout
    while len(data) < n:
        if time.time() > t_end:
            return None
        chunk = ser.read(n - len(data))
        if chunk:
            data += chunk
            t_end = time.time() + timeout   # progress resets the timeout
    return bytes(data)

def drain_until_quiet(ser, quiet=0.25, max_wait=3.0):
    """Discard incoming bytes until the line has been silent for `quiet` seconds."""
    ser.timeout = 0.05
    t_quiet = time.time()
    t_limit = time.time() + max_wait
    while time.time() < t_limit:
        if ser.read(4096):
            t_quiet = time.time()
        elif time.time() - t_quiet >= quiet:
            break
    ser.reset_input_buffer()

def wait_ready(ser, timeout=20):
    ser.timeout = 1
    t_end = time.time() + timeout

    print("Listening to ESP32 serial output...")

    while time.time() < t_end:
        line = ser.readline().decode(
            errors="ignore"
        ).strip()

        if line:
            print("ESP32:", repr(line))

        if "READY" in line:
            return True

    return False

def reset_board(ser):
    """Pulse EN via RTS (typical auto-reset wiring), then wait for READY."""
    ser.dtr = False
    ser.rts = True
    time.sleep(0.1)
    ser.rts = False
    return wait_ready(ser)

def capture_jpeg(ser):
    ser.write(b'C')
    ser.flush()

    len_bytes = read_exact(ser, 4)
    if len_bytes is None:
        return None, "timeout on length"
    length = int.from_bytes(len_bytes, "little")
    if length == 0:
        return None, "ESP32 camera error"
    if length > MAX_LEN:
        return None, f"bad length: {length}"

    jpg = read_exact(ser, length)
    if jpg is None:
        return None, "timeout on payload"

    if jpg[:2] != b'\xff\xd8' or jpg[-2:] != b'\xff\xd9':
        return None, "payload is not a complete JPEG (misaligned?)"

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
    if not wait_ready(ser):
        print("No READY. Press RST on the board.")
        ser.close()
        return
    print("Ready.\n")

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    frame_count = 0
    fails = 0
    start = time.time()
    last_report = start

    try:
        while True:
            img, err = capture_jpeg(ser)

            if img is None:
                fails += 1
                print(f"  [drop] {err} (streak {fails})")
                drain_until_quiet(ser)          # resync before the next request
                if fails >= FAIL_LIMIT:
                    print("  Too many failures — resetting ESP32...")
                    if not reset_board(ser):
                        print("  Board did not report READY after reset.")
                    fails = 0
                continue

            fails = 0
            frame_count += 1

            fname = os.path.join(OUTPUT_DIR, f"cap_{int(time.time()*1000)}.jpg")
            cv2.imwrite(fname, img)

            now = time.time()
            if now - last_report >= 1.0:
                fps = frame_count / (now - start)
                print(f"  frame {frame_count}  {img.shape[1]}x{img.shape[0]}  "
                      f"fps: {fps:.2f}")
                last_report = now

            if SHOW_PREVIEW:
                cv2.imshow("OCR Pen — Live (press Q to stop)", img)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

    except KeyboardInterrupt:
        print("\nCtrl+C — stopping.")
    finally:
        elapsed = time.time() - start
        print(f"\nFrames: {frame_count}  Time: {elapsed:.1f}s  "
              f"Avg FPS: {frame_count/elapsed if elapsed else 0:.2f}")
        ser.close()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    main()