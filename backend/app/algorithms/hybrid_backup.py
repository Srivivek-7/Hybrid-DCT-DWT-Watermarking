from app.algorithms.dct import dct2, idct2
from app.algorithms.dwt import dwt2, idwt2
from app.algorithms.watermark import normalize_image, prepare_watermark
from app.security.key_utils import scramble_watermark, unscramble_watermark
from app.utils.image import (
    match_size,
    merge_luminance,
    pad_even,
    recover_watermark,
    split_luminance,
)


def embed_hybrid(image, watermark, alpha=0.05, secret_key=None):
    if not secret_key:
        raise ValueError("Secret key is required")

    luminance, chroma = split_luminance(image)
    padded, original_shape = pad_even(luminance)
    original_height, original_width = original_shape

    ll, lh, hl, hh = dwt2(padded)
    ll_dct = dct2(ll)

    watermark_normalized = prepare_watermark(watermark, ll_dct.shape)
    watermark_normalized = scramble_watermark(watermark_normalized, secret_key)

    watermarked_dct = ll_dct + alpha * watermark_normalized * 255.0
    ll_watermarked = idct2(watermarked_dct)
    watermarked = idwt2(ll_watermarked, lh, hl, hh)
    watermarked = watermarked[:original_height, :original_width]

    return merge_luminance(normalize_image(watermarked), chroma)


def extract_hybrid(
    original_image,
    watermarked_image,
    alpha=0.05,
    secret_key=None,
):
    if not secret_key:
        raise ValueError("Secret key is required")

    original_gray, _ = split_luminance(original_image)
    watermarked_gray, _ = split_luminance(watermarked_image)

    if watermarked_gray.shape != original_gray.shape:
        watermarked_gray = match_size(watermarked_gray, original_gray)

    original_ll, _, _, _ = dwt2(pad_even(original_gray)[0])
    watermarked_ll, _, _, _ = dwt2(pad_even(watermarked_gray)[0])

    extracted = (dct2(watermarked_ll) - dct2(original_ll)) / (alpha * 255.0)
    restored = unscramble_watermark(extracted, secret_key)
    return recover_watermark(restored)
