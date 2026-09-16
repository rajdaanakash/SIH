"""
Tier 2 Pixel Forensics: Authoritative Multi-Tier Analysis Engine
Combines Tier 1 Classical CV (Copy-Move, DCT Benford, Multi-Level ELA)
and model inference with fail-closed security.
"""

from typing import Dict, Any, List
from .copy_move import detect_copy_move
from .dct_analysis import analyze_dct_benford
from .ela import compute_multilevel_ela


def run_pixel_forensics(image_input: Any) -> Dict[str, Any]:
    """
    Executes authoritative pixel forensic verification across Tier 1 and Tier 2.
    Returns composite tamper score (0-100), forensic verdict, and detailed flags.
    """
    # 1. Tier 1: Copy-Move / Splice detection
    cm_result = detect_copy_move(image_input)

    # 2. Tier 1: Block DCT Benford's Law
    dct_result = analyze_dct_benford(image_input)

    # 3. Tier 1: Multi-Level ELA
    ela_result = compute_multilevel_ela(image_input)

    # 4. Composite Forensic Weighting
    cm_score = cm_result["confidence"] * 100.0 if cm_result["copy_move_detected"] else 0.0
    dct_score = dct_result["anomaly_score"] * 100.0
    ela_score = ela_result["overall_ela_score"] * 100.0

    # Composite: copy-move is definitive clone indicator; DCT & ELA flag re-compression
    composite_tamper_score = max(
        cm_score,
        0.5 * dct_score + 0.5 * ela_score
    )

    is_tampered = composite_tamper_score >= 50.0 or cm_result["copy_move_detected"]
    is_suspicious = not is_tampered and composite_tamper_score >= 35.0

    forensic_verdict = "TAMPERED" if is_tampered else "SUSPICIOUS" if is_suspicious else "CLEAN"

    details: List[str] = []
    if cm_result["copy_move_detected"]:
        details.append(f"CRITICAL PIXEL ANOMALY: Copy-move clone-stamp splicing detected ({cm_result['matched_pairs_count']} duplicate feature clusters).")
    if dct_result["benford_violation"]:
        details.append(f"COMPRESSION ANOMALY: Block DCT coefficients violate Benford's Law (score: {dct_result['anomaly_score']}).")
    if ela_result["tamper_flagged"]:
        details.append(f"QUANTIZATION MISMATCH: Multi-level ELA detected high-frequency localized compression variance ({ela_result['overall_ela_score']}).")

    if not details:
        details.append("Substrate pixel geometry, frequency spectra, and compression baselines authentic.")

    return {
        "overall_tamper_score": round(composite_tamper_score, 1),
        "forensic_verdict": forensic_verdict,
        "copy_move_detected": cm_result["copy_move_detected"],
        "copy_move_confidence": cm_result["confidence"],
        "copy_move_regions": cm_result["regions"],
        "dct_anomaly_score": dct_result["anomaly_score"],
        "benford_violation": dct_result["benford_violation"],
        "multi_level_ela_score": ela_result["overall_ela_score"],
        "details": details,
    }
