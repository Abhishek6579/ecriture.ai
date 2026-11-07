import os, glob
import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = sorted(
    f for ext in ("jpg", "jpeg", "png")
    for f in glob.glob(os.path.join(HERE, "captures", f"*.{ext}"))
)
assert FILES, f"No images found in {os.path.join(HERE, 'captures')}"
print(f"Loaded {len(FILES)} frames")

CROP = (50, 210, 10, 270)   
MIN_SHIFT = 20              
MIN_CONF = 0.05
MIN_STD = 3.0             


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


frames = [load(f) for f in FILES]
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
kept, offsets = [frames[first]], [(0.0, 0.0)]
prev_g = preps[first]
win = cv2.createHanningWindow(prev_g.shape[::-1], cv2.CV_32F)

for i in valid[1:]:
    g = preps[i]
    (dx, dy), conf = cv2.phaseCorrelate(prev_g, g, win)
    print(f"frame {i+1}: dx={dx:.1f} dy={dy:.1f} conf={conf:.3f}")
    if conf < MIN_CONF:
        print("  skip: low confidence"); continue
    if abs(dx) < MIN_SHIFT and abs(dy) < MIN_SHIFT:
        continue    
    ox, oy = offsets[-1]
    offsets.append((ox - dx, oy - dy))
    kept.append(frames[i])
    prev_g = g

print(f"Kept {len(kept)} frames for stitching")

h, w = kept[0].shape[:2]
xs = [o[0] for o in offsets]; ys = [o[1] for o in offsets]
minx, miny = min(xs), min(ys)
W = int(np.ceil(max(xs) - minx)) + w
H = int(np.ceil(max(ys) - miny)) + h
acc = np.zeros((H, W, 3), np.float32)
wsum = np.zeros((H, W), np.float32)
ramp = np.minimum(np.arange(w), np.arange(w)[::-1]).astype(np.float32) + 1
weight = np.tile(ramp, (h, 1))

for img, (ox, oy) in zip(kept, offsets):
    x, y = int(round(ox - minx)), int(round(oy - miny))
    acc[y:y + h, x:x + w] += img.astype(np.float32) * weight[..., None]
    wsum[y:y + h, x:x + w] += weight

pano = (acc / np.maximum(wsum, 1e-6)[..., None]).astype(np.uint8)

pano = cv2.resize(pano, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
blur = cv2.GaussianBlur(pano, (0, 0), 2)
pano = cv2.addWeighted(pano, 1.6, blur, -0.6, 0)

out_path = os.path.join(HERE, "stitched.png")
cv2.imwrite(out_path, pano)
print(f"Saved {out_path}  ({pano.shape[1]}x{pano.shape[0]})")