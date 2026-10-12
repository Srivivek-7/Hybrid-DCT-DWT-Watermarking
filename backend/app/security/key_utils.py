import hashlib
import numpy as np


def create_key_seed(secret_key: str) -> int:
    """
    Convert the user's secret key into a deterministic integer seed.
    """
    if not secret_key:
        raise ValueError("Secret key cannot be empty")

    digest = hashlib.sha256(secret_key.encode("utf-8")).digest()

    return int.from_bytes(digest[:8], byteorder="big")


def scramble_watermark(watermark: np.ndarray, secret_key: str) -> np.ndarray:
    """
    Scramble watermark pixels using a deterministic permutation
    generated from the secret key.
    """

    seed = create_key_seed(secret_key)

    rng = np.random.default_rng(seed)

    flat = watermark.flatten()

    permutation = rng.permutation(len(flat))

    scrambled = flat[permutation]

    return scrambled.reshape(watermark.shape)


def unscramble_watermark(watermark: np.ndarray, secret_key: str) -> np.ndarray:
    """
    Reverse the watermark scrambling using the same secret key.
    """

    seed = create_key_seed(secret_key)

    rng = np.random.default_rng(seed)

    flat = watermark.flatten()

    permutation = rng.permutation(len(flat))

    restored = np.empty_like(flat)

    restored[permutation] = flat

    return restored.reshape(watermark.shape)