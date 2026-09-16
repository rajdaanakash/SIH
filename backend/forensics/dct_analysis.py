"""
Tier 1 Pixel Forensics: Block DCT & Benford's Law Statistical Analysis
Detects double JPEG compression, AI inpainting, and synthetic text/photo splicing.
"""

import io
from typing import Dict, Any
import cv2
import numpy as np
from PIL import Image

BENFORD_DIST = np.array([np.log10(1.0 + 1.0 / d) for d in range(1, 10)])


def analyze_dct_benford(image_input: Any) -> Dict[str, Any]:
    """
    Divides image into 8x8 luminance blocks, computes Discrete Cosine Transform (DCT),
    and evaluates first-digit distribution of AC coefficients against Benford's Law.
    """
    if isinstance(image_input, bytes):
        pil_img = Image.open(io.BytesIO(image_input)).convert("L")
        gray = np.array(pil_img, dtype=np.float32)
    elif isinstance(image_input, Image.Image):
        gray = np.array(image_input.convert("L"), dtype=np.float32)
    elif isinstance(image_input, np.ndarray):
        gray = cv2.cvtColor(image_input, cv2.COLOR_BGR2GRAY).astype(np.float32) if len(image_input.shape) == 3 else image_input.astype(np.float32)
    else:
        return {"anomaly_score": 0.05, "benford_violation": False}

    h, w = gray.shape
    # Crop to multiples of 8
    h_blocks = (h // 8) * 8
    w_blocks = (w // 8) * 8

    if h_blocks < 32 or w_blocks < 32:
        return {"anomaly_score": 0.05, "benford_violation": False}

    gray = gray[:h_blocks, :w_blocks]

    first_digits = []
    # Process 8x8 blocks
    for y in range(0, h_blocks, 8):
        for x in range(0, w_blocks, 8):
            block = gray[y:y+8, x:x+8]
            dct_block = cv2.dct(block)
            # Take AC coefficients (excluding DC [0,0])
            ac = np.abs(dct_block[1:, 1:].flatten())
            for val in ac:
                if val >= 1.0:
                    s = str(int(val))
                    if s and s[0] in "123456789":
                        first_digits.append(int(s[0]))

    if len(first_digits) < 100:
        return {"anomaly_score": 0.05, "benford_violation": False}

    counts = np.array([first_digits.count(d) for d in range(1, 10)], dtype=np.float32)
    observed_dist = counts / np.sum(counts)

    # Chi-Square statistic against Benford's distribution
    expected = BENFORD_DIST * np.sum(counts)
    chi_square = float(np.sum(((counts - expected) ** 2) / (expected + 1e-5)))

    # Normalized anomaly score 0.0 to 1.0 (chi_square > 35 indicates statistical tamper)
    anomaly_score = min(1.0, max(0.02, chi_square / 75.0))
    violation = anomaly_score > 0.42

    return {
        "anomaly_score": round(anomaly_score, 2),
        "chi_square_stat": round(chi_square, 2),
        "benford_violation": violation,
        "sample_count": len(first_digits),
    }
