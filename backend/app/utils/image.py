import base64

import cv2
import numpy as np


def to_grayscale(image: np.ndarray) -> np.ndarray:
    if image.ndim == 3:
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return image.copy()


def match_size(image: np.ndarray, reference: np.ndarray) -> np.ndarray:
    height, width = reference.shape[:2]
    if image.shape[:2] == (height, width):
        return image
    return cv2.resize(image, (width, height), interpolation=cv2.INTER_LINEAR)


def recover_watermark(coefficients):
    coefficients = np.asarray(coefficients, dtype=np.float32)

    coefficients = np.nan_to_num(
        coefficients,
        nan=0.0,
        posinf=1.0,
        neginf=0.0,
    )

    minimum = coefficients.min()
    maximum = coefficients.max()

    if maximum > minimum:
        normalized = (
            (coefficients - minimum)
            / (maximum - minimum)
        )
    else:
        normalized = np.zeros_like(coefficients)

    normalized = np.clip(
        normalized,
        0.0,
        1.0,
    )

    return np.rint(
        normalized * 255.0
    ).astype(np.uint8)


def pad_even(image: np.ndarray) -> tuple[np.ndarray, tuple[int, int]]:
    """Pad a 2-D image so both axes are even (Haar DWT-friendly)."""
    height, width = image.shape[:2]
    pad_h = height % 2
    pad_w = width % 2
    if pad_h == 0 and pad_w == 0:
        return image, (height, width)
    padded = np.pad(image, ((0, pad_h), (0, pad_w)), mode="edge")
    return padded, (height, width)


def split_luminance(image: np.ndarray) -> tuple[np.ndarray, np.ndarray | None]:
    """Return the Y channel and optional CrCb planes for color reconstruction."""
    if image.ndim == 2:
        return image.astype(np.float32), None

    ycrcb = cv2.cvtColor(image, cv2.COLOR_BGR2YCrCb)
    y_channel, cr, cb = cv2.split(ycrcb)
    chroma = np.stack((cr, cb), axis=-1)
    return y_channel.astype(np.float32), chroma


def merge_luminance(y_channel: np.ndarray, chroma: np.ndarray | None) -> np.ndarray:
    """Rebuild a BGR or grayscale image from a modified luminance channel."""
    y_uint8 = np.clip(y_channel, 0, 255).astype(np.uint8)
    if chroma is None:
        return y_uint8

    height, width = y_uint8.shape[:2]
    if chroma.shape[:2] != (height, width):
        chroma = cv2.resize(chroma, (width, height), interpolation=cv2.INTER_LINEAR)

    cr = chroma[:, :, 0]
    cb = chroma[:, :, 1]
    merged = cv2.merge((y_uint8, cr, cb))
    return cv2.cvtColor(merged, cv2.COLOR_YCrCb2BGR)


def decode_bytes(data: bytes, color: bool = True) -> np.ndarray | None:
    array = np.frombuffer(data, dtype=np.uint8)
    flag = cv2.IMREAD_COLOR if color else cv2.IMREAD_GRAYSCALE
    return cv2.imdecode(array, flag)


def encode_png(image: np.ndarray) -> bytes | None:
    success, encoded = cv2.imencode(".png", image)
    if not success:
        return None
    return encoded.tobytes()


def encode_png_b64(image: np.ndarray) -> str:
    encoded = encode_png(image)
    if encoded is None:
        raise ValueError("Failed to encode image")
    return base64.b64encode(encoded).decode("ascii")
