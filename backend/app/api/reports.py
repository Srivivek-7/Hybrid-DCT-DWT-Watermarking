from fastapi import APIRouter, Depends
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Any

from app.auth.dependencies import get_current_user
from app.models.user import User
from app.reports.pdf_report import generate_experiment_report


router = APIRouter(
    prefix="/reports",
    tags=["Reports"],
)


class ExperimentReportRequest(BaseModel):
    algorithm: str
    alpha: float
    comparison: dict[str, dict[str, Any]]
    robustness_results: list[dict[str, Any]]


@router.post("/experiment")
def create_experiment_report(
    data: ExperimentReportRequest,
    current_user: User = Depends(get_current_user),
):
    pdf_bytes = generate_experiment_report(
        algorithm=data.algorithm,
        alpha=data.alpha,
        comparison=data.comparison,
        robustness_results=data.robustness_results,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                'attachment; filename="experiment-report.pdf"'
            )
        },
    )