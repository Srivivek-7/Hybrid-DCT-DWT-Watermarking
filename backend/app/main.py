from typing import Any

import cv2
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

# ------------------------------------------------------------
# WATERMARKING ALGORITHMS
# ------------------------------------------------------------

from app.algorithms.dct import embed_dct, extract_dct
from app.algorithms.dwt import embed_dwt, extract_dwt
from app.algorithms.hybrid import embed_hybrid, extract_hybrid

# ------------------------------------------------------------
# ATTACKS
# ------------------------------------------------------------

from app.attacks.attacks import ATTACKS

# ------------------------------------------------------------
# METRICS
# ------------------------------------------------------------

from app.metrics.metrics import (
    calculate_ber,
    calculate_nc,
    calculate_psnr,
    calculate_ssim,
)

# ------------------------------------------------------------
# IMAGE UTILITIES
# ------------------------------------------------------------

from app.utils.image import (
    decode_bytes,
    encode_png,
    encode_png_b64,
)

# ------------------------------------------------------------
# AUTHENTICATION / DATABASE
# ------------------------------------------------------------

from app.auth.routes import router as auth_router
from app.database.database import Base, engine
from app.models.user import User
from app.models.experiment import Experiment

from app.api.experiments import router as experiments_router
from app.api.reports import router as reports_router

# ============================================================
# CONFIGURATION
# ============================================================

MAX_UPLOAD_BYTES = 20 * 1024 * 1024


ATTACK_CONFIGS = {
    "jpeg": 50,
    "gaussian_noise": 10,
    "salt_pepper": 0.02,
    "gaussian_blur": 5,
    "median_blur": 5,
    "resize": 0.5,
    "crop": 0.10,
    "rotation": 5,
    "brightness": 30,
    "contrast": 1.3,
}


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="Hybrid DCT-DWT Image Watermarking",
    description="Secure image watermarking and robustness analysis",
    version="1.3.0",
)


# ============================================================
# DATABASE INITIALIZATION
# ============================================================

Base.metadata.create_all(bind=engine)


# ============================================================
# AUTHENTICATION ROUTER
# ============================================================

app.include_router(auth_router)

app.include_router(experiments_router)
app.include_router(reports_router)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ERROR HANDLING
# ============================================================

@app.exception_handler(ValueError)
async def value_error_handler(
    _request,
    exc: ValueError,
):
    return JSONResponse(
        status_code=400,
        content={
            "detail": str(exc)
        },
    )


# ============================================================
# GENERAL HELPERS
# ============================================================

def fail(
    message: str,
    status_code: int = 400,
) -> None:
    raise HTTPException(
        status_code=status_code,
        detail=message,
    )


def validate_alpha(alpha: float) -> None:
    if alpha <= 0 or alpha > 1:
        fail(
            "Alpha must be greater than 0 and at most 1"
        )


def validate_secret_key(secret_key: str) -> str:
    key = secret_key.strip()

    if not key:
        fail(
            "Secret key cannot be empty"
        )

    return key


def validate_image_upload(
    upload: UploadFile,
) -> None:

    content_type = (
        upload.content_type or ""
    ).lower()

    if content_type and not (
        content_type.startswith("image/")
        or content_type
        == "application/octet-stream"
    ):
        fail(
            f"{upload.filename or 'Uploaded file'} "
            "must be an image"
        )


async def read_upload(
    upload: UploadFile,
    limit: int = MAX_UPLOAD_BYTES,
) -> bytes:

    validate_image_upload(upload)

    data = await upload.read()

    if not data:
        fail(
            f"{upload.filename or 'Uploaded file'} "
            "is empty"
        )

    if len(data) > limit:
        fail(
            "Uploaded file is too large "
            "(maximum 20 MB)"
        )

    return data


# ============================================================
# IMAGE DECODING
# ============================================================

def require_image(
    data: bytes,
    *,
    color: bool,
    label: str,
):
    image = decode_bytes(
        data,
        color=color,
    )

    if image is None:
        fail(
            f"Invalid {label}"
        )

    return image


# ============================================================
# IMAGE RESPONSE
# ============================================================

def png_response(
    image,
    filename: str,
) -> Response:

    encoded = encode_png(image)

    if encoded is None:
        fail(
            "Failed to encode image",
            status_code=500,
        )

    return Response(
        content=encoded,
        media_type="image/png",
        headers={
            "Content-Disposition":
                f'inline; filename="{filename}"'
        },
    )


# ============================================================
# METRIC HELPERS
# ============================================================

def round_metrics(
    psnr_value,
    ssim_value,
    nc_value,
    ber_value,
) -> dict:

    return {
        "PSNR_dB": round(
            float(psnr_value),
            4,
        ),
        "SSIM": round(
            float(ssim_value),
            4,
        ),
        "NC": round(
            float(nc_value),
            4,
        ),
        "BER": round(
            float(ber_value),
            4,
        ),
    }


def quality_metrics(
    original,
    watermarked,
    watermark,
    extracted,
) -> dict:

    return round_metrics(
        calculate_psnr(
            original,
            watermarked,
        ),
        calculate_ssim(
            original,
            watermarked,
        ),
        calculate_nc(
            watermark,
            extracted,
        ),
        calculate_ber(
            watermark,
            extracted,
        ),
    )


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "message":
            "Hybrid DCT-DWT Image Watermarking API",
        "status": "running",
        "version": app.version,
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health():

    return {
        "status": "healthy",
        "backend": "connected",
    }


# ============================================================
# AVAILABLE ATTACKS
# ============================================================

@app.get("/attacks")
def list_attacks():

    return {
        "attacks": list(
            ATTACKS.keys()
        ),
        "defaults": ATTACK_CONFIGS,
    }


# ============================================================
# WATERMARK EMBEDDING
# ============================================================

@app.post("/watermark/embed")
async def embed_watermark(
    image: UploadFile = File(...),
    watermark: UploadFile = File(...),
    alpha: float = Form(0.05),
    secret_key: str = Form(...),
):

    validate_alpha(alpha)

    secret_key = validate_secret_key(
        secret_key
    )

    # Original image
    original_image = require_image(
        await read_upload(image),
        color=True,
        label="original image",
    )

    # Watermark
    watermark_image = require_image(
        await read_upload(watermark),
        color=False,
        label="watermark image",
    )

    # Hybrid embedding
    watermarked_image = embed_hybrid(
        original_image,
        watermark_image,
        alpha,
        secret_key,
    )

    return png_response(
        watermarked_image,
        "watermarked.png",
    )


# ============================================================
# WATERMARK EXTRACTION
# ============================================================

@app.post("/watermark/extract")
async def extract_watermark(
    original_image: UploadFile = File(...),
    watermarked_image: UploadFile = File(...),
    alpha: float = Form(0.05),
    secret_key: str = Form(...),
):

    validate_alpha(alpha)

    secret_key = validate_secret_key(
        secret_key
    )

    original = require_image(
        await read_upload(original_image),
        color=True,
        label="original image",
    )

    watermarked = require_image(
        await read_upload(watermarked_image),
        color=True,
        label="watermarked image",
    )

    extracted_watermark = extract_hybrid(
        original,
        watermarked,
        alpha,
        secret_key,
    )

    return png_response(
        extracted_watermark,
        "extracted-watermark.png",
    )


# ============================================================
# COMPLETE WATERMARK PROCESS
# ============================================================

@app.post("/watermark/process")
async def process_watermark(
    image: UploadFile = File(...),
    watermark: UploadFile = File(...),
    alpha: float = Form(0.05),
    secret_key: str = Form(...),
):

    validate_alpha(alpha)

    secret_key = validate_secret_key(
        secret_key
    )

    original = require_image(
        await read_upload(image),
        color=True,
        label="original image",
    )

    watermark_image = require_image(
        await read_upload(watermark),
        color=False,
        label="watermark image",
    )

    # Embed
    watermarked = embed_hybrid(
        original,
        watermark_image,
        alpha,
        secret_key,
    )

    # Extract
    extracted = extract_hybrid(
        original,
        watermarked,
        alpha,
        secret_key,
    )

    # Metrics
    metrics = quality_metrics(
        original,
        watermarked,
        watermark_image,
        extracted,
    )

    return {
        "metrics": metrics,

        "watermarked_image":
            encode_png_b64(
                watermarked
            ),

        "extracted_watermark":
            encode_png_b64(
                extracted
            ),

        "color_preserved":
            original.ndim == 3,
    }


# ============================================================
# METRICS EVALUATION
# ============================================================

@app.post("/metrics/evaluate")
async def evaluate_metrics(
    original_image: UploadFile = File(...),
    watermarked_image: UploadFile = File(...),
    original_watermark: UploadFile = File(...),
    extracted_watermark: UploadFile = File(...),
):

    original = require_image(
        await read_upload(original_image),
        color=True,
        label="original image",
    )

    watermarked = require_image(
        await read_upload(watermarked_image),
        color=True,
        label="watermarked image",
    )

    watermark = require_image(
        await read_upload(original_watermark),
        color=False,
        label="original watermark",
    )

    extracted = require_image(
        await read_upload(extracted_watermark),
        color=False,
        label="extracted watermark",
    )

    return quality_metrics(
        original,
        watermarked,
        watermark,
        extracted,
    )


# ============================================================
# APPLY SINGLE ATTACK
# ============================================================

@app.post("/attacks/apply")
async def apply_attack(
    image: UploadFile = File(...),
    attack: str = Form(...),
    strength: float = Form(...),
):

    if attack not in ATTACKS:
        fail(
            f"Unknown attack: {attack}. "
            f"Available: {', '.join(ATTACKS)}"
        )

    original = require_image(
        await read_upload(image),
        color=True,
        label="image",
    )

    attacked = ATTACKS[attack](
        original,
        strength,
    )

    return png_response(
        attacked,
        f"attacked-{attack}.png",
    )


# ============================================================
# ROBUSTNESS TEST
# ============================================================

@app.post("/robustness/test")
async def robustness_test(
    original_image: UploadFile = File(...),
    watermarked_image: UploadFile = File(...),
    original_watermark: UploadFile = File(...),
    alpha: float = Form(0.05),
    secret_key: str = Form(...),
):

    validate_alpha(alpha)

    secret_key = validate_secret_key(
        secret_key
    )

    original = require_image(
        await read_upload(original_image),
        color=True,
        label="original image",
    )

    watermarked = require_image(
        await read_upload(watermarked_image),
        color=True,
        label="watermarked image",
    )

    watermark = require_image(
        await read_upload(original_watermark),
        color=False,
        label="original watermark",
    )

    results = []

    for attack_name, strength in (
        ATTACK_CONFIGS.items()
    ):

        attack_function = ATTACKS.get(
            attack_name
        )

        if attack_function is None:
            continue

        # Apply attack
        attacked = attack_function(
            watermarked,
            strength,
        )

        # Extract watermark
        extracted = extract_hybrid(
            original,
            attacked,
            alpha,
            secret_key,
        )

        # Calculate metrics
        metrics = quality_metrics(
            watermarked,
            attacked,
            watermark,
            extracted,
        )

        results.append(
            {
                "attack": attack_name,
                "strength": strength,
                **metrics,
            }
        )

    return {
        "total_attacks": len(results),
        "alpha": alpha,
        "results": results,
    }


# ============================================================
# ALGORITHM COMPARISON
# ============================================================

@app.post("/comparison/test")
async def comparison_test(
    original_image: UploadFile = File(...),
    original_watermark: UploadFile = File(...),
    alpha: float = Form(0.05),
    secret_key: str = Form(...),
):

    # Validate inputs
    validate_alpha(alpha)

    secret_key = validate_secret_key(
        secret_key
    )

    # Read original image
    original = require_image(
        await read_upload(original_image),
        color=True,
        label="original image",
    )

    # Read watermark
    watermark = require_image(
        await read_upload(original_watermark),
        color=False,
        label="watermark image",
    )

    results = {}

    # --------------------------------------------------------
    # DCT
    # --------------------------------------------------------

    dct_watermarked = embed_dct(
        original,
        watermark,
        alpha,
    )

    dct_extracted = extract_dct(
        original,
        dct_watermarked,
        alpha,
    )

    results["DCT"] = quality_metrics(
        original,
        dct_watermarked,
        watermark,
        dct_extracted,
    )

    # --------------------------------------------------------
    # DWT
    # --------------------------------------------------------

    dwt_watermarked = embed_dwt(
        original,
        watermark,
        alpha,
    )

    dwt_extracted = extract_dwt(
        original,
        dwt_watermarked,
        alpha,
    )

    results["DWT"] = quality_metrics(
        original,
        dwt_watermarked,
        watermark,
        dwt_extracted,
    )

    # --------------------------------------------------------
    # HYBRID DCT-DWT
    # --------------------------------------------------------

    hybrid_watermarked = embed_hybrid(
        original,
        watermark,
        alpha,
        secret_key,
    )

    hybrid_extracted = extract_hybrid(
        original,
        hybrid_watermarked,
        alpha,
        secret_key,
    )

    results["Hybrid"] = quality_metrics(
        original,
        hybrid_watermarked,
        watermark,
        hybrid_extracted,
    )

    # --------------------------------------------------------
    # FINAL RESPONSE
    # --------------------------------------------------------

    return {
        "alpha": alpha,
        "comparison": results,
    }