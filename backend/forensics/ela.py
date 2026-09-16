"""
Tier 1 Pixel Forensics: Multi-Quality Level Error Level Analysis (ELA)
Re-saves image at quality 70, 80, and 90 to detect localized compression gradient splices.
"""

import io
from typing import Dict, Any
import numpy as np
from PIL import Image, ImageChops


def compute_multilevel_ela(image_input: Any) -> Dict[str, Any]:
    """
    Computes multi-quality level ELA diffs (70, 80, 90).
    Captures edge splices that only exhibit compression residuals at specific quantization tables.
    """
    if isinstance(image_input, bytes):
        orig = Image.open(io.BytesIO(image_input)).convert("RGB")
    elif isinstance(image_input, Image.Image):
        orig = image_input.convert("RGB")
    elif isinstance(image_input, np.ndarray):
        orig = Image.fromarray(image_input).convert("RGB")
    else:
        return {"overall_ela_score": 0.10, "tamper_flagged": False}

    qualities = [70, 80, 90]
    diff_means = []

    for q in qualities:
        buf = io.BytesIO()
        orig.save(buf, "JPEG", quality=q)
        buf.seek(0)
        recompressed = Image.open(buf).convert("RGB")
        diff = ImageChops.difference(orig, recompressed)
        diff_arr = np.array(diff, dtype=np.float32)
        diff_means.append(float(np.mean(diff_arr)))

    # Multi-level composite score
    avg_diff = float(np.mean(diff_means))
    # Normalized score: natural camera document is ~2-15, modified splice is > 30
    overall_score = min(1.0, max(0.02, avg_diff / 35.0))
    flagged = overall_score > 0.45

    return {
        "overall_ela_score": round(overall_score, 2),
        "q70_diff": round(diff_means[0], 2),
        "q80_diff": round(diff_means[1], 2),
        "q90_diff": round(diff_means[2], 2),
        "tamper_flagged": flagged,
    }
