from __future__ import annotations

import os
from pathlib import Path
from typing import List, Sequence

import cv2
import numpy as np
import torch
from PIL import Image
from transformers import TrOCRProcessor, VisionEncoderDecoderModel


class FullPageOCR:
    """Pretrained DBNet + TrOCR baseline for single-column page images.

    Printed-text OCR using pretrained DBNet detection and TrOCR recognition.
    """

    def __init__(self, detector_path: str | Path, trocr_model_id: str | None = None):
        self.detector_path = Path(detector_path)
        if not self.detector_path.is_file():
            raise FileNotFoundError(
                f"DBNet model not found at {self.detector_path}. Run download_detector.py first."
            )

        self.device = torch.device("cpu")
        torch.set_num_threads(max(1, int(os.getenv("TORCH_NUM_THREADS", "2"))))
        cv2.setNumThreads(1)

        # Prefer local models/trocr-small-stage1 directory if it exists
        default_local_trocr = self.detector_path.parent / "trocr-small-stage1"
        if trocr_model_id:
            self.trocr_model_id = trocr_model_id
        elif os.getenv("TROCR_MODEL_ID"):
            self.trocr_model_id = os.getenv("TROCR_MODEL_ID")
        elif (default_local_trocr / "config.json").is_file():
            self.trocr_model_id = str(default_local_trocr)
        else:
            self.trocr_model_id = "microsoft/trocr-small-stage1"

        is_local_dir = Path(self.trocr_model_id).is_dir()

        self.min_crop_std = float(os.getenv("MIN_CROP_STD", "12.0"))
        self.batch_size = max(1, int(os.getenv("OCR_BATCH_SIZE", "4")))
        self.backend = os.getenv("OCR_BACKEND", "pytorch").strip().lower()

        # OpenCV's DB_TD500 model is documented for a 736 x 736 input.
        self.detector = cv2.dnn_TextDetectionModel_DB(str(self.detector_path))
        self.detector.setBinaryThreshold(0.3)
        self.detector.setPolygonThreshold(0.5)
        self.detector.setUnclipRatio(2.0)
        self.detector.setInputParams(
            scale=1.0 / 255.0,
            size=(736, 736),
            mean=(122.67891434, 116.66876762, 104.00698793),
            swapRB=True,
        )
        self.processor = TrOCRProcessor.from_pretrained(
            self.trocr_model_id,
            use_fast=False,
            local_files_only=is_local_dir,
        )

        if self.backend == "onnx":
            onnx_dir = os.getenv("TROCR_ONNX_DIR", "models/trocr-onnx")
            try:
                from optimum.onnxruntime import ORTModelForVision2Seq
            except ImportError as exc:
                raise RuntimeError(
                    "OCR_BACKEND=onnx but optimum-onnx is not installed. "
                    "Install requirements.txt and export the model first."
                ) from exc
            self.recognizer = ORTModelForVision2Seq.from_pretrained(
                onnx_dir,
                provider="CPUExecutionProvider",
                local_files_only=Path(onnx_dir).is_dir(),
            )
        elif self.backend == "pytorch":
            self.recognizer = VisionEncoderDecoderModel.from_pretrained(
                self.trocr_model_id,
                local_files_only=is_local_dir,
            ).to(self.device)
            self.recognizer.eval()
        else:
            raise ValueError("OCR_BACKEND must be 'pytorch' or 'onnx'.")

    @staticmethod
    def _order_quad_points(points: np.ndarray) -> np.ndarray:
        points = np.asarray(points, dtype=np.float32).reshape(4, 2)
        rect = np.zeros((4, 2), dtype=np.float32)
        sums = points.sum(axis=1)
        differences = np.diff(points, axis=1).reshape(-1)
        rect[0] = points[np.argmin(sums)]       # top-left
        rect[2] = points[np.argmax(sums)]       # bottom-right
        rect[1] = points[np.argmin(differences)]  # top-right
        rect[3] = points[np.argmax(differences)]  # bottom-left
        return rect

    @classmethod
    def _warp_crop(
        cls, image_bgr: np.ndarray, polygon: np.ndarray, pad_x: int = 6, pad_y: int = 4
    ) -> np.ndarray | None:
        try:
            rect = cls._order_quad_points(polygon)
        except (ValueError, TypeError):
            return None

        tl, tr, br, bl = rect
        content_w = int(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl)))
        content_h = int(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl)))
        if content_w < 2 or content_h < 2:
            return None

        width = content_w + 2 * pad_x
        height = content_h + 2 * pad_y
        destination = np.array(
            [
                [pad_x, pad_y],
                [width - pad_x - 1, pad_y],
                [width - pad_x - 1, height - pad_y - 1],
                [pad_x, height - pad_y - 1],
            ],
            dtype=np.float32,
        )
        transform = cv2.getPerspectiveTransform(rect, destination)
        crop = cv2.warpPerspective(
            image_bgr,
            transform,
            (width, height),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE,
        )
        if crop.size == 0:
            return None
        return crop

    @staticmethod
    def _split_wide_crop(crop_bgr: np.ndarray, max_aspect_ratio: float = 10.0) -> List[np.ndarray]:
        """Split exceptionally wide crops near vertical-projection whitespace valleys.

        This is a heuristic for TrOCR's square input resize. It may still split a word,
        so inspect these crops on the target document type.
        """
        height, width = crop_bgr.shape[:2]
        if width / max(1, height) <= max_aspect_ratio:
            return [crop_bgr]

        number_of_chunks = int(np.ceil((width / max(1, height)) / max_aspect_ratio))
        gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
        _, binary = cv2.threshold(
            gray, 0, 1, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
        )
        vertical_projection = np.sum(binary, axis=0)
        kernel_width = min(width, max(3, int(height * 0.15)))
        smoothed = np.convolve(
            vertical_projection,
            np.ones(kernel_width, dtype=np.float32) / kernel_width,
            mode="same",
        )

        split_xs = [0]
        target_step = max(1, width // number_of_chunks)
        search_radius = int(target_step * 0.25)
        for index in range(1, number_of_chunks):
            target_x = index * target_step
            left = max(split_xs[-1] + height, target_x - search_radius)
            right = min(width - height, target_x + search_radius)
            if left < right:
                valley_x = left + int(np.argmin(smoothed[left:right]))
                split_xs.append(valley_x)
            else:
                split_xs.append(target_x)
        split_xs.append(width)

        chunks = []
        for start, end in zip(split_xs[:-1], split_xs[1:]):
            part = crop_bgr[:, start:end]
            if part.shape[1] > 8:
                chunks.append(part)
        return chunks or [crop_bgr]

    @staticmethod
    def _group_reading_rows(polygons: Sequence[np.ndarray]) -> List[List[np.ndarray]]:
        """Simple single-column reading order heuristic; multi-column layout needs more logic."""
        metadata = []
        for polygon in polygons:
            points = np.asarray(polygon, dtype=np.float32).reshape(4, 2)
            x_min = float(points[:, 0].min())
            y_min = float(points[:, 1].min())
            y_max = float(points[:, 1].max())
            height = max(1.0, y_max - y_min)
            y_center = (y_min + y_max) / 2.0
            metadata.append((polygon, x_min, y_center, height))

        if not metadata:
            return []

        median_h = float(np.median([item[3] for item in metadata]))
        tolerance = max(6.0, 0.5 * median_h)
        metadata.sort(key=lambda item: item[2])
        rows: List[List[tuple]] = []

        for item in metadata:
            best_row = None
            best_distance = None
            for row in rows:
                row_center = float(np.mean([entry[2] for entry in row]))
                distance = abs(item[2] - row_center)
                if distance <= tolerance and (best_distance is None or distance < best_distance):
                    best_row = row
                    best_distance = distance
            if best_row is None:
                rows.append([item])
            else:
                best_row.append(item)

        rows.sort(key=lambda row: float(np.mean([entry[2] for entry in row])))
        result = []
        for row in rows:
            row.sort(key=lambda item: item[1])
            result.append([item[0] for item in row])
        return result

    def predict_page(self, image_bgr: np.ndarray) -> str:
        if image_bgr is None or image_bgr.ndim != 3:
            raise ValueError("Expected a valid BGR image with three channels.")

        polygons, _scores = self.detector.detect(image_bgr)
        if polygons is None or len(polygons) == 0:
            return ""

        rows = self._group_reading_rows(list(polygons))
        crop_images: List[Image.Image] = []
        owner_rows: List[int] = []

        for row_idx, row_polygons in enumerate(rows):
            for polygon in row_polygons:
                crop_bgr = self._warp_crop(image_bgr, polygon)
                if crop_bgr is None or crop_bgr.shape[0] < 8 or crop_bgr.shape[1] < 8:
                    continue

                # TrOCR resizes crops to its expected input dimensions. Split only
                # extremely wide crops to reduce horizontal compression.
                for part in self._split_wide_crop(crop_bgr):
                    if part.shape[0] < 8 or part.shape[1] < 8:
                        continue

                    # Avoid sending near-uniform false-positive regions to TrOCR.
                    gray_crop = cv2.cvtColor(part, cv2.COLOR_BGR2GRAY)
                    if float(np.std(gray_crop)) < self.min_crop_std:
                        continue

                    crop_rgb = cv2.cvtColor(part, cv2.COLOR_BGR2RGB)
                    crop_images.append(Image.fromarray(crop_rgb))
                    owner_rows.append(row_idx)

        if not crop_images:
            return ""

        decoded: List[str] = []
        with torch.inference_mode():
            for start in range(0, len(crop_images), self.batch_size):
                batch = crop_images[start : start + self.batch_size]
                pixel_values = self.processor(
                    images=batch,
                    return_tensors="pt",
                ).pixel_values.to(self.device)

                generated_ids = self.recognizer.generate(
                    pixel_values=pixel_values,
                    max_new_tokens=128,
                    num_beams=1,
                )
                decoded.extend(
                    self.processor.batch_decode(generated_ids, skip_special_tokens=True)
                )

        row_texts: dict[int, List[str]] = {}
        for row_idx, text in zip(owner_rows, decoded):
            cleaned = " ".join(text.split())
            if cleaned:
                row_texts.setdefault(row_idx, []).append(cleaned)

        output_lines = [
            " ".join(row_texts.get(row_idx, [])).strip()
            for row_idx in range(len(rows))
        ]
        return "\n".join(line for line in output_lines if line)
