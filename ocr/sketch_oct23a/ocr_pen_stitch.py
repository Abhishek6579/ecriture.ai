import serial
import serial.tools.list_ports
import time
import cv2
import numpy as np
import os
import glob

BAUD         = 921600
OUTPUT_DIR   = os.path.join(os.path.dirname(os.path.abspath(__file__)), "captures")
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
            t_end = time.time() + timeout

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

    if length == 0xFFFFFFFF:
        return None, "not recording"

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


def stitch_images():

    here = os.path.dirname(os.path.abspath(__file__))

    files = sorted(
        f for ext in ("jpg", "jpeg", "png")
        for f in glob.glob(os.path.join(OUTPUT_DIR, f"*.{ext}"))
    )

    if not files:
        print("No images available for stitching.")
        return False

    print(f"\nLoaded {len(files)} frames for stitching.")

    CROP = (50, 210, 10, 270)
    MIN_SHIFT = 20
    MIN_CONF = 0.05
    MIN_STD = 3.0

    try:

        def load(f):
            img = cv2.imread(f)
            assert img is not None, f"Could not read {f}"
            y0, y1, x0, x1 = CROP
            return img[y0:y1, x0:x1]

        def prep(img):
            g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
            g = cv2.GaussianBlur(g, (0, 0), 1.0)
            g -= cv2.GaussianBlur(g, (0, 0), 15)
            return g

        frames = [load(f) for f in files]
        preps = [prep(f) for f in frames]

        valid = []

        for i, g in enumerate(preps):
            s = float(g.std())
            print(f"frame {i+1}: std={s:.2f}")

            if s >= MIN_STD:
                valid.append(i)

        assert valid, "All frames look blank. Lower MIN_STD."

        print(f"{len(valid)} usable frames, first = {valid[0]+1}")

        first = valid[0]

        kept = [frames[first]]
        offsets = [(0.0, 0.0)]

        prev_g = preps[first]

        win = cv2.createHanningWindow(
            prev_g.shape[::-1],
            cv2.CV_32F
        )

        for i in valid[1:]:

            g = preps[i]

            (dx, dy), conf = cv2.phaseCorrelate(prev_g, g, win)

            print(
                f"frame {i+1}: dx={dx:.1f} "
                f"dy={dy:.1f} conf={conf:.3f}"
            )

            if conf < MIN_CONF:
                print("  skip: low confidence")
                continue

            if abs(dx) < MIN_SHIFT and abs(dy) < MIN_SHIFT:
                continue

            ox, oy = offsets[-1]

            offsets.append((ox - dx, oy - dy))

            kept.append(frames[i])

            prev_g = g

        print(f"Kept {len(kept)} frames for stitching")

        h, w = kept[0].shape[:2]

        xs = [o[0] for o in offsets]
        ys = [o[1] for o in offsets]

        minx, miny = min(xs), min(ys)

        W = int(np.ceil(max(xs) - minx)) + w
        H = int(np.ceil(max(ys) - miny)) + h

        acc = np.zeros((H, W, 3), np.float32)
        wsum = np.zeros((H, W), np.float32)

        ramp = (
            np.minimum(
                np.arange(w),
                np.arange(w)[::-1]
            ).astype(np.float32) + 1
        )

        weight = np.tile(ramp, (h, 1))

        for img, (ox, oy) in zip(kept, offsets):

            x = int(round(ox - minx))
            y = int(round(oy - miny))

            acc[y:y+h, x:x+w] += img.astype(np.float32) * weight[..., None]

            wsum[y:y+h, x:x+w] += weight

        pano = (
            acc / np.maximum(wsum, 1e-6)[..., None]
        ).astype(np.uint8)

        pano = cv2.resize(
            pano,
            None,
            fx=3,
            fy=3,
            interpolation=cv2.INTER_CUBIC
        )

        blur = cv2.GaussianBlur(pano, (0, 0), 2)

        pano = cv2.addWeighted(pano, 1.6, blur, -0.6, 0)

        out_path = os.path.join(here, "stitched.png")

        if not cv2.imwrite(out_path, pano):
            raise RuntimeError("Could not save stitched image")

        print(
            f"Saved {out_path} "
            f"({pano.shape[1]}x{pano.shape[0]})"
        )

        # Delete captured images only after successful stitching
        for f in files:
            os.remove(f)

        print("Previous captured images deleted.")

        return True

    except Exception as e:

        print(f"Stitching failed: {e}")
        print("Captured images have been preserved.")

        return False


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
    session_active = False

    start = time.time()
    last_report = start

    try:
        while True:
            img, err = capture_jpeg(ser)
            if img is None:
                if err == "not recording":
                    fails = 0
                    if session_active:
                        print("\nRecording finished.")
                        cv2.destroyAllWindows()
                        if not stitch_images():
                            print("Stopping so captured images are not overwritten.")
                            break
                        session_active = False
                        frame_count = 0
                        start = time.time()
                        last_report = start
                        print("\nStitching complete. Waiting for next recording...")
                    time.sleep(0.05)
                    continue

                fails += 1
                print(f"  [drop] {err} (streak {fails})")
                drain_until_quiet(ser)
                if fails >= FAIL_LIMIT:

                    print("  Too many failures — resetting ESP32...")

                    if not reset_board(ser):
                        print("  Board did not report READY after reset.")
                    fails = 0
                continue
            fails = 0
            session_active = True
            frame_count += 1
            fname = os.path.join(
                OUTPUT_DIR,
                f"cap_{int(time.time()*1000)}.jpg"
            )
            if not cv2.imwrite(fname, img):
                print(f"Could not save {fname}")
                continue
            now = time.time()
            if now - last_report >= 1.0:
                fps = frame_count / (now - start)
                print(
                    f"  frame {frame_count}  "
                    f"{img.shape[1]}x{img.shape[0]}  "
                    f"fps: {fps:.2f}"
                )
                last_report = now
            if SHOW_PREVIEW:
                cv2.imshow("OCR Pen — Live (press Q to stop)", img)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

    except KeyboardInterrupt:
        print("\nCtrl+C — stopping.")
    finally:
        elapsed = time.time() - start
        print(
            f"\nFrames: {frame_count}  Time: {elapsed:.1f}s  "
            f"Avg FPS: {frame_count/elapsed if elapsed else 0:.2f}"
        )
        ser.close()
        cv2.destroyAllWindows()
if __name__ == "__main__":
    main()
