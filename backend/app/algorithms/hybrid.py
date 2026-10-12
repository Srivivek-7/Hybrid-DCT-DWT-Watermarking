import cv2
import numpy as np

from app.algorithms.dct import dct2, idct2
from app.algorithms.dwt import dwt2, idwt2
from app.algorithms.watermark import prepare_watermark
from app.security.key_utils import (
    scramble_watermark,
    unscramble_watermark,
)
from app.utils.image import (
    match_size,
    merge_luminance,
    pad_even,
    recover_watermark,
    split_luminance,
)


def embed_hybrid(
    image,
    watermark,
    alpha=0.05,
    secret_key=None,
):
    """
    Hybrid DWT-DCT watermark embedding.

    Steps:
    1. Convert image to luminance
    2. Pad image if required
    3. Apply DWT
    4. Apply DCT to LL sub-band
    5. Prepare and scramble watermark
    6. Embed watermark into DCT coefficients
    7. Apply inverse DCT
    8. Apply inverse DWT
    9. Restore original image size
    10. Clip to valid 8-bit range
    11. Merge luminance with original chroma
    """

    if not secret_key:
        raise ValueError("Secret key is required")

    if alpha <= 0:
        raise ValueError("Alpha must be greater than 0")

    # ---------------------------------------------------------
    # 1. Split image into luminance and chroma
    # ---------------------------------------------------------
    luminance, chroma = split_luminance(image)

    # ---------------------------------------------------------
    # 2. Pad luminance so DWT dimensions are valid
    # ---------------------------------------------------------
    padded, original_shape = pad_even(luminance)

    original_height, original_width = original_shape

    # ---------------------------------------------------------
    # 3. Apply DWT
    # ---------------------------------------------------------
    ll, lh, hl, hh = dwt2(padded)

    # ---------------------------------------------------------
    # 4. Apply DCT to LL sub-band
    # ---------------------------------------------------------
    ll_dct = dct2(ll)

    # ---------------------------------------------------------
    # 5. Prepare watermark to match LL-DCT dimensions
    # ---------------------------------------------------------
    watermark_normalized = prepare_watermark(
        watermark,
        ll_dct.shape,
    )

    watermark_normalized = watermark_normalized.astype(
        np.float32
    )

    # ---------------------------------------------------------
    # 6. Scramble watermark using secret key
    # ---------------------------------------------------------
    watermark_scrambled = scramble_watermark(
        watermark_normalized,
        secret_key,
    )

    watermark_scrambled = watermark_scrambled.astype(
        np.float32
    )

    # ---------------------------------------------------------
    # 7. Embed watermark into DCT coefficients
    # ---------------------------------------------------------
    watermarked_dct = (
        ll_dct
        + alpha * watermark_scrambled * 255.0
    )

    # ---------------------------------------------------------
    # 8. Inverse DCT
    # ---------------------------------------------------------
    ll_watermarked = idct2(
        watermarked_dct
    )

    # ---------------------------------------------------------
    # 9. Inverse DWT
    # ---------------------------------------------------------
    watermarked = idwt2(
        ll_watermarked,
        lh,
        hl,
        hh,
    )

    # ---------------------------------------------------------
    # 10. Restore original image dimensions
    # ---------------------------------------------------------
    watermarked = watermarked[
        :original_height,
        :original_width,
    ]

    # ---------------------------------------------------------
    # IMPORTANT:
    # Do NOT use normalize_image() here.
    #
    # Min-max normalization changes the relationship between
    # the original and watermarked transform coefficients.
    # Extraction relies on that difference.
    # ---------------------------------------------------------
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
    )

    watermarked = np.rint(
        watermarked
    ).astype(np.uint8)

    # ---------------------------------------------------------
    # 11. Merge modified luminance with original chroma
    # ---------------------------------------------------------
    return merge_luminance(
        watermarked,
        chroma,
    )


def extract_hybrid(
    original_image,
    watermarked_image,
    alpha=0.05,
    secret_key=None,
):
    """
    Hybrid DWT-DCT watermark extraction.

    Steps:
    1. Extract luminance from original and watermarked images
    2. Match dimensions
    3. Apply DWT
    4. Apply DCT to LL sub-bands
    5. Calculate coefficient difference
    6. Recover scrambled watermark
    7. Unscramble using secret key
    8. Recover final watermark
    """

    if not secret_key:
        raise ValueError("Secret key is required")

    if alpha <= 0:
        raise ValueError("Alpha must be greater than 0")

    # ---------------------------------------------------------
    # 1. Extract luminance
    # ---------------------------------------------------------
    original_gray, _ = split_luminance(
        original_image
    )

    watermarked_gray, _ = split_luminance(
        watermarked_image
    )

    # ---------------------------------------------------------
    # 2. Make sure both images have the same dimensions
    # ---------------------------------------------------------
    if watermarked_gray.shape != original_gray.shape:
        watermarked_gray = match_size(
            watermarked_gray,
            original_gray,
        )

    # ---------------------------------------------------------
    # 3. Pad both images exactly as during embedding
    # ---------------------------------------------------------
    original_padded, _ = pad_even(
        original_gray
    )

    watermarked_padded, _ = pad_even(
        watermarked_gray
    )

    # ---------------------------------------------------------
    # 4. Apply DWT
    # ---------------------------------------------------------
    original_ll, _, _, _ = dwt2(
        original_padded
    )

    watermarked_ll, _, _, _ = dwt2(
        watermarked_padded
    )

    # ---------------------------------------------------------
    # 5. Apply DCT
    # ---------------------------------------------------------
    original_dct = dct2(
        original_ll
    )

    watermarked_dct = dct2(
        watermarked_ll
    )

    # ---------------------------------------------------------
    # 6. Recover embedded scrambled watermark
    # ---------------------------------------------------------
    extracted = (
        watermarked_dct - original_dct
    ) / (alpha * 255.0)

    # ---------------------------------------------------------
    # 7. Clean invalid numerical values
    # ---------------------------------------------------------
    extracted = np.nan_to_num(
        extracted,
        nan=0.0,
        posinf=255.0,
        neginf=0.0,
    )

    # ---------------------------------------------------------
    # 8. Unscramble watermark using secret key
    # ---------------------------------------------------------
    restored = unscramble_watermark(
        extracted,
        secret_key,
    )

    # ---------------------------------------------------------
    # 9. Recover final watermark image
    # ---------------------------------------------------------
    return recover_watermark(
        restored
    )