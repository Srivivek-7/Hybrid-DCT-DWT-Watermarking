from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database.database import get_db
from app.models.experiment import Experiment
from app.models.user import User
from app.schemas.experiment import (
    ExperimentCreate,
    ExperimentResponse,
)

router = APIRouter(
    prefix="/experiments",
    tags=["Experiments"],
)


@router.post(
    "",
    response_model=ExperimentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_experiment(
    experiment_data: ExperimentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    experiment = Experiment(
        user_id=current_user.id,
        algorithm=experiment_data.algorithm,
        alpha=experiment_data.alpha,
        psnr=experiment_data.psnr,
        ssim=experiment_data.ssim,
        nc=experiment_data.nc,
        ber=experiment_data.ber,
    )

    db.add(experiment)
    db.commit()
    db.refresh(experiment)

    return experiment


@router.get(
    "",
    response_model=list[ExperimentResponse],
)
def get_experiments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    experiments = (
        db.query(Experiment)
        .filter(Experiment.user_id == current_user.id)
        .order_by(Experiment.created_at.desc())
        .all()
    )

    return experiments


@router.delete(
    "/{experiment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_experiment(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    experiment = (
        db.query(Experiment)
        .filter(
            Experiment.id == experiment_id,
            Experiment.user_id == current_user.id,
        )
        .first()
    )

    if experiment is None:
        raise HTTPException(
            status_code=404,
            detail="Experiment not found",
        )

    db.delete(experiment)
    db.commit()