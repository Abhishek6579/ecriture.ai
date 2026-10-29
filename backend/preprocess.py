from __future__ import annotations
import cv2
import numpy as np


def apply_clahe(
    image_bgr: np.ndarray,
    clip_limit: float = 5.0,
    tile_grid_size: tuple[int, int] = (8, 8),
    brightness_offset: int = 30,
) -> np.ndarray:
    """Applies CLAHE and brightness normalization at native resolution, returning a 3-channel BGR image."""
    if image_bgr is None or image_bgr.ndim != 3:
        raise ValueError("Expected a valid 3-channel BGR image.")

    image_bw = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)

    equalized = clahe.apply(image_bw).astype(np.int16) + brightness_offset
    clahe_img = np.clip(equalized, 0, 255).astype(np.uint8)

    return cv2.cvtColor(clahe_img, cv2.COLOR_GRAY2BGR)


if __name__ == "__main__":
    image_path = "sample/image.jpg"
    raw_image = cv2.imread(image_path)
    if raw_image is None:
        raise FileNotFoundError(f"Could not load image at {image_path}")

    clahe_result = apply_clahe(raw_image, clip_limit=5.0, brightness_offset=30)
    cv2.imwrite("sample/debug_clahe.jpg", clahe_result)