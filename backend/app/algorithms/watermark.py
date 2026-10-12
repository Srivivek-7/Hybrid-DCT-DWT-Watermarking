import cv2
import numpy as np

from app.utils.image import to_grayscale


def prepare_watermark(
    watermark: np.ndarray,
    target_shape: tuple,
) -> np.ndarray:
    """
    Convert watermark to grayscale, resize it to the target
    transform size, and normalize it to [0, 1].
    """
    watermark = to_grayscale(watermark)

    interpolation = (
        cv2.INTER_AREA
        if watermark.shape[0] > target_shape[0]
        or watermark.shape[1] > target_shape[1]
        else cv2.INTER_LINEAR
    )

    watermark = cv2.resize(
        watermark,
        (target_shape[1], target_shape[0]),
        interpolation=interpolation,
    )

    watermark = watermark.astype(np.float32) / 255.0

    return np.clip(watermark, 0.0, 1.0)


def normalize_image(image: np.ndarray) -> np.ndarray:
    """
    Convert reconstructed image data to valid 8-bit pixels.
    """
    image = np.nan_to_num(
        image,
        nan=0.0,
        posinf=255.0,
        neginf=0.0,
    )

    return np.clip(
        image,
        0,
        255,
    ).astype(np.uint8)