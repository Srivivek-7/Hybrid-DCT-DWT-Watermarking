import cv2
import numpy as np
from skimage.metrics import structural_similarity as ssim

from app.utils.image import match_size, to_grayscale


def _finite(value: float, cap: float = 99.99) -> float:
    if not np.isfinite(value):
        return cap
    return float(value)


def calculate_psnr(
    original: np.ndarray,
    watermarked: np.ndarray,
) -> float:
    """Peak Signal-to-Noise Ratio. Higher means less visible distortion."""
    original = to_grayscale(original).astype(np.float32)
    watermarked = match_size(to_grayscale(watermarked), original).astype(np.float32)

    mse = np.mean((original - watermarked) ** 2)
    if mse == 0:
        return 99.99

    return _finite(10 * np.log10((255.0 ** 2) / mse))


def calculate_ssim(
    original: np.ndarray,
    watermarked: np.ndarray,
) -> float:
    """Structural Similarity Index in [0, 1]."""
    original = to_grayscale(original)
    watermarked = match_size(to_grayscale(watermarked), original)

    score = ssim(original, watermarked, data_range=255)
    return _finite(float(score), cap=1.0)


def calculate_nc(
    original_watermark: np.ndarray,
    extracted_watermark: np.ndarray,
) -> float:
    """Normalized correlation between original and extracted watermarks."""
    original_watermark = match_size(
        to_grayscale(original_watermark),
        extracted_watermark,
    ).astype(np.float32)
    extracted_watermark = to_grayscale(extracted_watermark).astype(np.float32)

    original_watermark -= np.mean(original_watermark)
    extracted_watermark -= np.mean(extracted_watermark)

    numerator = np.sum(original_watermark * extracted_watermark)
    denominator = np.sqrt(
        np.sum(original_watermark ** 2) * np.sum(extracted_watermark ** 2)
    )

    if denominator == 0:
        return 0.0

    return float(np.clip(numerator / denominator, -1.0, 1.0))


def calculate_ber(
    original_watermark: np.ndarray,
    extracted_watermark: np.ndarray,
) -> float:
    """Bit Error Rate after binarizing both watermarks."""
    extracted_watermark = to_grayscale(extracted_watermark)
    original_watermark = match_size(
        to_grayscale(original_watermark),
        extracted_watermark,
    )

    _, original_binary = cv2.threshold(original_watermark, 127, 1, cv2.THRESH_BINARY)
    _, extracted_binary = cv2.threshold(extracted_watermark, 127, 1, cv2.THRESH_BINARY)

    original_binary = original_binary.astype(np.uint8)
    extracted_binary = extracted_binary.astype(np.uint8)

    total_bits = original_binary.size
    if total_bits == 0:
        return 0.0

    different_bits = np.sum(original_binary != extracted_binary)
    return float(different_bits / total_bits)
