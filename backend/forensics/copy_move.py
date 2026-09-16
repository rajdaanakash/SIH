"""
Tier 1 Pixel Forensics: Copy-Move / Clone-Stamp Splicing Detection
Uses ORB feature detection, descriptor matching, and spatial clustering
to detect cloned or pasted regions across the document substrate.
"""

import io
from typing import Dict, Any, List
import cv2
import numpy as np
from PIL import Image


def detect_copy_move(
    image_input: Any,
    min_match_count: int = 8,
    min_spatial_distance: float = 35.0
) -> Dict[str, Any]:
    """
    Detects copy-move forgery by finding identical/near-identical feature patches
    separated by non-trivial spatial distance.
    """
    # Normalize image to BGR / Gray
    if isinstance(image_input, bytes):
        pil_img = Image.open(io.BytesIO(image_input)).convert("RGB")
        img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    elif isinstance(image_input, Image.Image):
        img = cv2.cvtColor(np.array(image_input.convert("RGB")), cv2.COLOR_RGB2BGR)
    elif isinstance(image_input, np.ndarray):
        img = image_input
    else:
        return {"copy_move_detected": False, "confidence": 0.0, "regions": []}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    # Initialize ORB detector with dense features
    orb = cv2.ORB_create(nfeatures=1500, scaleFactor=1.2, nlevels=8)
    keypoints, descriptors = orb.detectAndCompute(gray, None)

    if descriptors is None or len(keypoints) < 15:
        return {"copy_move_detected": False, "confidence": 0.0, "regions": []}

    # Match descriptors against themselves using BFMatcher with k-nearest neighbors (k=3)
    # Exclude trivial self-matches (distance = 0)
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
    matches = bf.knnMatch(descriptors, descriptors, k=3)

    clone_pairs = []
    flagged_pts = []

    for match_set in matches:
        if len(match_set) < 2:
            continue
        # match_set[0] is self-match (distance == 0)
        # match_set[1] is the closest distinct keypoint
        m1 = match_set[1]
        
        # Check descriptor distance threshold
        if m1.distance < 45:
            pt1 = keypoints[m1.queryIdx].pt
            pt2 = keypoints[m1.trainIdx].pt

            # Euclidean spatial distance between keypoints
            dist = np.sqrt((pt1[0] - pt2[0]) ** 2 + (pt1[1] - pt2[1]) ** 2)

            if dist >= min_spatial_distance:
                clone_pairs.append((pt1, pt2))
                flagged_pts.append(pt1)
                flagged_pts.append(pt2)

    # Calculate cluster density and bounding boxes
    detected = len(clone_pairs) >= min_match_count
    confidence = min(1.0, max(0.0, len(clone_pairs) / 25.0)) if detected else 0.0

    regions: List[Dict[str, float]] = []
    if detected and flagged_pts:
        pts_arr = np.array(flagged_pts)
        x_min, y_min = np.min(pts_arr, axis=0)
        x_max, y_max = np.max(pts_arr, axis=0)
        # Bounding box in percentage coordinates (0 to 100)
        regions.append({
            "x": round(float(x_min / w * 100), 1),
            "y": round(float(y_min / h * 100), 1),
            "width": round(float((x_max - x_min) / w * 100), 1),
            "height": round(float((y_max - y_min) / h * 100), 1),
        })

    return {
        "copy_move_detected": detected,
        "matched_pairs_count": len(clone_pairs),
        "confidence": round(confidence, 2),
        "regions": regions,
    }
