import numpy as np
import pywt

from app.algorithms.watermark import normalize_image, prepare_watermark
from app.utils.image import (
    match_size,
    merge_luminance,
    pad_even,
    recover_watermark,
    split_luminance,
)


def dwt2(image: np.ndarray, wavelet: str = "haar"):
    coeffs = pywt.dwt2(image, wavelet)
    ll, (lh, hl, hh) = coeffs
    return ll, lh, hl, hh


def idwt2(
    ll: np.ndarray,
    lh: np.ndarray,
    hl: np.ndarray,
    hh: np.ndarray,
    wavelet: str = "haar",
):
    return pywt.idwt2((ll, (lh, hl, hh)), wavelet)


def embed_dwt(
    image: np.ndarray,
    watermark: np.ndarray,
    alpha: float = 0.05,
) -> np.ndarray:
    luminance, chroma = split_luminance(image)
    padded, original_shape = pad_even(luminance)
    original_height, original_width = original_shape

    ll, lh, hl, hh = dwt2(padded)
    watermark_normalized = prepare_watermark(watermark, ll.shape)

    ll_watermarked = ll + alpha * watermark_normalized * 255.0
    watermarked = idwt2(ll_watermarked, lh, hl, hh)
    watermarked = watermarked[:original_height, :original_width]
    return merge_luminance(normalize_image(watermarked), chroma)


def extract_dwt(
    original_image: np.ndarray,
    watermarked_image: np.ndarray,
    alpha: float = 0.05,
) -> np.ndarray:
    original_gray, _ = split_luminance(original_image)
    watermarked_gray, _ = split_luminance(watermarked_image)

    if watermarked_gray.shape != original_gray.shape:
        watermarked_gray = match_size(watermarked_gray, original_gray).astype(np.float32)

    original_ll, _, _, _ = dwt2(pad_even(original_gray)[0])
    watermarked_ll, _, _, _ = dwt2(pad_even(watermarked_gray)[0])

    extracted = (watermarked_ll - original_ll) / (alpha * 255.0)
    return recover_watermark(extracted)
