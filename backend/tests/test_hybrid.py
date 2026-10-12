import unittest

import numpy as np

from app.algorithms.dct import embed_dct, extract_dct
from app.algorithms.dwt import embed_dwt, extract_dwt
from app.algorithms.hybrid import embed_hybrid, extract_hybrid
from app.attacks.attacks import crop_attack, jpeg_compression, salt_pepper_noise
from app.metrics.metrics import calculate_ber, calculate_nc, calculate_psnr
from app.security.key_utils import scramble_watermark, unscramble_watermark


class HybridWatermarkingTests(unittest.TestCase):
    def setUp(self):
        rng = np.random.default_rng(7)
        self.host = rng.integers(0, 256, size=(64, 64), dtype=np.uint8)
        self.color_host = rng.integers(0, 256, size=(64, 64, 3), dtype=np.uint8)
        self.watermark = np.zeros((32, 32), dtype=np.uint8)
        self.watermark[8:24, 8:24] = 255
        self.alpha = 0.08
        self.key = "research-key"

    def test_scramble_roundtrip(self):
        scrambled = scramble_watermark(self.watermark, self.key)
        restored = unscramble_watermark(scrambled, self.key)
        np.testing.assert_array_equal(restored, self.watermark)

    def test_hybrid_extracts_watermark(self):
        watermarked = embed_hybrid(self.host, self.watermark, self.alpha, self.key)
        extracted = extract_hybrid(self.host, watermarked, self.alpha, self.key)

        self.assertEqual(watermarked.shape, self.host.shape)
        self.assertGreater(calculate_psnr(self.host, watermarked), 20)
        self.assertGreater(calculate_nc(self.watermark, extracted), 0.7)
        self.assertLess(calculate_ber(self.watermark, extracted), 0.25)

    def test_hybrid_preserves_color(self):
        watermarked = embed_hybrid(self.color_host, self.watermark, self.alpha, self.key)
        extracted = extract_hybrid(self.color_host, watermarked, self.alpha, self.key)

        self.assertEqual(watermarked.shape, self.color_host.shape)
        self.assertEqual(watermarked.ndim, 3)
        self.assertGreater(calculate_nc(self.watermark, extracted), 0.7)

    def test_wrong_key_fails(self):
        watermarked = embed_hybrid(self.host, self.watermark, self.alpha, self.key)
        extracted = extract_hybrid(self.host, watermarked, self.alpha, "wrong-key")
        self.assertLess(calculate_nc(self.watermark, extracted), 0.4)

    def test_dct_and_dwt_roundtrip(self):
        for embed, extract in ((embed_dct, extract_dct), (embed_dwt, extract_dwt)):
            watermarked = embed(self.host, self.watermark, self.alpha)
            extracted = extract(self.host, watermarked, self.alpha)
            self.assertGreater(calculate_nc(self.watermark, extracted), 0.7)

    def test_odd_size_hybrid(self):
        host = np.random.default_rng(3).integers(0, 256, size=(65, 63), dtype=np.uint8)
        watermarked = embed_hybrid(host, self.watermark, self.alpha, self.key)
        extracted = extract_hybrid(host, watermarked, self.alpha, self.key)
        self.assertEqual(watermarked.shape, host.shape)
        self.assertGreater(calculate_nc(self.watermark, extracted), 0.55)

    def test_attacks_keep_shape(self):
        attacked = jpeg_compression(self.color_host, 40)
        self.assertEqual(attacked.shape, self.color_host.shape)
        noisy = salt_pepper_noise(self.color_host, 0.05)
        self.assertEqual(noisy.shape, self.color_host.shape)
        cropped = crop_attack(self.color_host, 0.1)
        self.assertEqual(cropped.shape, self.color_host.shape)


if __name__ == "__main__":
    unittest.main()
