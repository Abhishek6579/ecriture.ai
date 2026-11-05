import cv2
import numpy as np
import glob
import os

# ====== CONFIG ======
CAPTURES_DIR = "./captures"
OUTPUT_PANO  = "./panorama.jpg"
MIN_MATCHES  = 15

def get_homography_shift(img1, img2):
    orb = cv2.ORB_create(nfeatures=2000, fastThreshold=10)
    kp1, des1 = orb.detectAndCompute(img1, None)
    kp2, des2 = orb.detectAndCompute(img2, None)

    if des1 is None or des2 is None or len(kp1) < 10 or len(kp2) < 10:
        return None, 0

    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    matches = bf.match(des1, des2)

    if len(matches) < MIN_MATCHES:
        return None, len(matches)

    matches = sorted(matches, key=lambda x: x.distance)
    pts1 = np.float32([kp1[m.queryIdx].pt for m in matches])
    pts2 = np.float32([kp2[m.trainIdx].pt for m in matches])

    H, mask = cv2.findHomography(pts2, pts1, cv2.RANSAC, 5.0)

    if H is None:
        return None, len(matches)

    # Extract the shift values
    dx = H[0, 2]
    dy = H[1, 2]
    
    if abs(dx) > img1.shape[1] * 1.5:
        return None, len(matches)

    return dx, len(matches)

def build_panorama():
    # Delete old panorama so you don't look at a cached image
    if os.path.exists(OUTPUT_PANO):
        os.remove(OUTPUT_PANO)

    files = sorted(glob.glob(os.path.join(CAPTURES_DIR, "cap_*.jpg")))
    if not files:
        print("No frames found in ./captures/")
        return

    print(f"Loading {len(files)} frames...")
    
    frames = []
    for f in files:
        img = cv2.imread(f)
        if img is not None:
            top = (img.shape[0] - 120) // 2
            frames.append(img[top:top+120, :])

    if len(frames) < 2:
        print("Need at least 2 frames.")
        return

    print("Stitching (Forced Left-to-Right)...")
    result = frames[0].copy()
    
    added = 0
    skipped = 0

    for i in range(1, len(frames)):
        prev = frames[i-1]
        curr = frames[i]

        dx, num_matches = get_homography_shift(prev, curr)

        if dx is None:
            skipped += 1
            continue

        dx_int = int(round(dx))
        
        if abs(dx_int) < 5:
            skipped += 1
            continue

        # --- FORCED LEFT-TO-RIGHT LOGIC ---
        # Since moving L->R adds new content on the right,
        # we always append to the right side of our result.
        
        overlap = abs(dx_int)
        
        # If the camera moved further than the frame width, there is no overlap
        if overlap >= curr.shape[1]:
            result = cv2.hconcat([result, curr])
            print(f"  frame {i+1:3d}: dx={dx_int:3d} → NO OVERLAP, appended full frame")
        else:
            # Chop off the left side (the overlap) and append the new right side
            new_right_part = curr[:, overlap:]
            result = cv2.hconcat([result, new_right_part])
            print(f"  frame {i+1:3d}: dx={dx_int:3d} → appended {new_right_part.shape[1]} new cols")
        
        added += 1

    cv2.imwrite(OUTPUT_PANO, result)
    print(f"\nPanorama → {OUTPUT_PANO} ({result.shape[1]}x{result.shape[0]})")
    print(f"Stats: added={added}, skipped={skipped}")

if __name__ == "__main__":
    build_panorama()