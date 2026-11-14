import cv2
import glob
import os

CAPTURES_DIR = "./captures"
OUTPUT_VIDEO = "./captures_video.mp4"
FPS = 5

def create_video():
    files = sorted(glob.glob(os.path.join(CAPTURES_DIR, "cap_*.jpg")))
    
    if not files:
        print("No images found in ./captures/")
        return

    print(f"Found {len(files)} images. Creating video...")

    first_img = cv2.imread(files[0])
    if first_img is None:
        print("Could not read first image.")
        return

    h, w = first_img.shape[:2]
    
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(OUTPUT_VIDEO, fourcc, FPS, (w, h))

    for f in files:
        img = cv2.imread(f)
        if img is not None:
            if img.shape[1] != w or img.shape[0] != h:
                img = cv2.resize(img, (w, h))
            
            writer.write(img)

    writer.release()
    print(f"Success! Video saved to {OUTPUT_VIDEO}")

if __name__ == "__main__":
    create_video()
