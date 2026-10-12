from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String

from app.database.database import Base


class Experiment(Base):
    __tablename__ = "experiments"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    algorithm = Column(
        String(50),
        nullable=False,
    )

    alpha = Column(
        Float,
        nullable=False,
    )

    psnr = Column(
        Float,
        nullable=False,
    )

    ssim = Column(
        Float,
        nullable=False,
    )

    nc = Column(
        Float,
        nullable=False,
    )

    ber = Column(
        Float,
        nullable=False,
    )

    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
