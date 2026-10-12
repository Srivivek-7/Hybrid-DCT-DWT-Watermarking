import cv2
import numpy as np


def jpeg_compression(image: np.ndarray, quality: int = 50) -> np.ndarray:
    quality = int(np.clip(quality, 1, 100))

    success, encoded = cv2.imencode(
        ".jpg",
        image,
        [cv2.IMWRITE_JPEG_QUALITY, quality],
    )
    if not success:
        raise ValueError("JPEG compression failed")

    decoded = cv2.imdecode(encoded, cv2.IMREAD_UNCHANGED)
    if decoded is None:
        raise ValueError("JPEG decompression failed")

    if decoded.ndim == 2 and image.ndim == 3:
        decoded = cv2.cvtColor(decoded, cv2.COLOR_GRAY2BGR)
    elif decoded.ndim == 3 and image.ndim == 2:
        decoded = cv2.cvtColor(decoded, cv2.COLOR_BGR2GRAY)

    return decoded


def gaussian_noise(image: np.ndarray, sigma: float = 10.0) -> np.ndarray:
    rng = np.random.default_rng()
    noise = rng.normal(0, sigma, image.shape).astype(np.float32)
    noisy = image.astype(np.float32) + noise
    return np.clip(noisy, 0, 255).astype(np.uint8)


def salt_pepper_noise(image: np.ndarray, amount: float = 0.02) -> np.ndarray:
    amount = float(np.clip(amount, 0, 1))
    rng = np.random.default_rng()
    noisy = image.copy()
    mask = rng.random(image.shape[:2])
    salt = mask < (amount / 2.0)
    pepper = (mask >= amount / 2.0) & (mask < amount)
    noisy[salt] = 255
    noisy[pepper] = 0
    return noisy


def gaussian_blur(image: np.ndarray, kernel_size: int = 5) -> np.ndarray:
    kernel_size = max(3, int(kernel_size))
    if kernel_size % 2 == 0:
        kernel_size += 1
    return cv2.GaussianBlur(image, (kernel_size, kernel_size), 0)


def median_blur(image: np.ndarray, kernel_size: int = 5) -> np.ndarray:
    kernel_size = max(3, int(kernel_size))
    if kernel_size % 2 == 0:
        kernel_size += 1
    return cv2.medianBlur(image, kernel_size)


def resize_attack(image: np.ndarray, scale: float = 0.5) -> np.ndarray:
    scale = float(np.clip(scale, 0.1, 2.0))
    height, width = image.shape[:2]
    new_width = max(1, int(width * scale))
    new_height = max(1, int(height * scale))

    resized = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)
    return cv2.resize(resized, (width, height), interpolation=cv2.INTER_LINEAR)


def crop_attack(image: np.ndarray, crop_ratio: float = 0.10) -> np.ndarray:
    crop_ratio = float(np.clip(crop_ratio, 0, 0.45))
    height, width = image.shape[:2]
    crop_x = int(width * crop_ratio)
    crop_y = int(height * crop_ratio)

    cropped = image[crop_y : height - crop_y, crop_x : width - crop_x]
    if cropped.size == 0:
        return image.copy()

    return cv2.resize(cropped, (width, height), interpolation=cv2.INTER_LINEAR)


def rotation_attack(image: np.ndarray, angle: float = 5.0) -> np.ndarray:
    height, width = image.shape[:2]
    matrix = cv2.getRotationMatrix2D((width / 2, height / 2), angle, 1.0)
    return cv2.warpAffine(
        image,
        matrix,
        (width, height),
        borderMode=cv2.BORDER_REFLECT,
    )


def brightness_attack(image: np.ndarray, value: int = 30) -> np.ndarray:
    brightened = image.astype(np.int16) + int(value)
    return np.clip(brightened, 0, 255).astype(np.uint8)


def contrast_attack(image: np.ndarray, factor: float = 1.3) -> np.ndarray:
    adjusted = (image.astype(np.float32) - 128) * factor + 128
    return np.clip(adjusted, 0, 255).astype(np.uint8)


ATTACKS = {
    "jpeg": jpeg_compression,
    "gaussian_noise": gaussian_noise,
    "salt_pepper": salt_pepper_noise,
    "gaussian_blur": gaussian_blur,
    "median_blur": median_blur,
    "resize": resize_attack,
    "crop": crop_attack,
    "rotation": rotation_attack,
    "brightness": brightness_attack,
    "contrast": contrast_attack,
}
