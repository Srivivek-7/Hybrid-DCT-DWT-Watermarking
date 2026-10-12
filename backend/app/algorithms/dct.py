import numpy as np
from scipy.fft import dct, idct

from app.algorithms.watermark import prepare_watermark
from app.utils.image import (
    match_size,
    merge_luminance,
    recover_watermark,
    split_luminance,
)


def dct2(image: np.ndarray) -> np.ndarray:
    image = np.asarray(
        image,
        dtype=np.float32,
    )

    return dct(
        dct(
            image,
            axis=0,
            norm="ortho",
        ),
        axis=1,
        norm="ortho",
    )


def idct2(coefficients: np.ndarray) -> np.ndarray:
    coefficients = np.asarray(
        coefficients,
        dtype=np.float32,
    )

    return idct(
        idct(
            coefficients,
            axis=0,
            norm="ortho",
        ),
        axis=1,
        norm="ortho",
    )


def embed_dct(
    image: np.ndarray,
    watermark: np.ndarray,
    alpha: float = 0.05,
) -> np.ndarray:

    luminance, chroma = split_luminance(image)

    image_dct = dct2(luminance)

    watermark_normalized = prepare_watermark(
        watermark,
        image_dct.shape,
    )

    watermarked_dct = (
        image_dct
        + alpha
        * watermark_normalized
        * 255.0
    )

    watermarked = idct2(
        watermarked_dct
    )

    # Preserve coefficient relationship.
    watermarked = np.nan_to_num(
        watermarked,
        nan=0.0,
        posinf=255.0,
        neginf=0.0,
    )

    watermarked = np.clip(
        watermarked,
        0,
        255,
    ).astype(np.uint8)

    return merge_luminance(
        watermarked,
        chroma,
    )


def extract_dct(
    original_image: np.ndarray,
    watermarked_image: np.ndarray,
    alpha: float = 0.05,
) -> np.ndarray:

    original_gray, _ = split_luminance(
        original_image
    )

    watermarked_gray, _ = split_luminance(
        watermarked_image
    )

    if watermarked_gray.shape != original_gray.shape:
        watermarked_gray = match_size(
            watermarked_gray,
            original_gray,
        ).astype(np.float32)

    original_dct = dct2(
        original_gray
    )

    watermarked_dct = dct2(
        watermarked_gray
    )

    extracted = (
        watermarked_dct
        - original_dct
    ) / (
        alpha * 255.0
    )

    extracted = np.nan_to_num(
        extracted,
        nan=0.0,
        posinf=1.0,
        neginf=0.0,
    )

    return recover_watermark(
        extracted
    )