from datetime import datetime

from pydantic import BaseModel, Field


class ExperimentCreate(BaseModel):
    algorithm: str = Field(
        min_length=1,
        max_length=50,
    )

    alpha: float = Field(
        gt=0,
        le=1,
    )

    psnr: float
    ssim: float
    nc: float
    ber: float


class ExperimentResponse(BaseModel):
    id: int
    algorithm: str
    alpha: float
    psnr: float
    ssim: float
    nc: float
    ber: float
    created_at: datetime

    class Config:
        from_attributes = True
