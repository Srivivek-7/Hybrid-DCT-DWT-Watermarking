from io import BytesIO
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


def generate_experiment_report(
    algorithm: str,
    alpha: float,
    comparison: dict,
    robustness_results: list[dict],
) -> bytes:
    """
    Generate a PDF experiment report.

    Returns:
        PDF document as bytes.
    """

    buffer = BytesIO()

    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        alignment=TA_CENTER,
        fontSize=20,
        leading=24,
        spaceAfter=8,
    )

    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        alignment=TA_CENTER,
        fontSize=10,
        textColor=colors.grey,
        spaceAfter=18,
    )

    heading_style = ParagraphStyle(
        "ReportHeading",
        parent=styles["Heading2"],
        fontSize=14,
        leading=18,
        spaceBefore=12,
        spaceAfter=8,
    )

    normal_style = ParagraphStyle(
        "ReportNormal",
        parent=styles["Normal"],
        fontSize=9.5,
        leading=14,
    )

    story = []

    # ---------------------------------------------------------
    # TITLE
    # ---------------------------------------------------------

    story.append(
        Paragraph(
            "Hybrid DCT-DWT Image Watermarking",
            title_style,
        )
    )

    story.append(
        Paragraph(
            "Experimental Analysis Report",
            subtitle_style,
        )
    )

    # ---------------------------------------------------------
    # EXPERIMENT INFORMATION
    # ---------------------------------------------------------

    story.append(
        Paragraph(
            "1. Experiment Information",
            heading_style,
        )
    )

    experiment_data = [
        ["Parameter", "Value"],
        ["Algorithm", algorithm],
        ["Embedding Strength (Alpha)", f"{alpha:.2f}"],
        [
            "Generated On",
            datetime.now().strftime(
                "%d %B %Y, %H:%M"
            ),
        ],
    ]

    experiment_table = Table(
        experiment_data,
        colWidths=[65 * mm, 100 * mm],
    )

    experiment_table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.HexColor("#1f2937"),
                ),
                (
                    "TEXTCOLOR",
                    (0, 0),
                    (-1, 0),
                    colors.white,
                ),
                (
                    "FONTNAME",
                    (0, 0),
                    (-1, 0),
                    "Helvetica-Bold",
                ),
                (
                    "FONTNAME",
                    (0, 1),
                    (0, -1),
                    "Helvetica-Bold",
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.5,
                    colors.grey,
                ),
                (
                    "PADDING",
                    (0, 0),
                    (-1, -1),
                    7,
                ),
            ]
        )
    )

    story.append(experiment_table)
    story.append(Spacer(1, 8))

    # ---------------------------------------------------------
    # ALGORITHM COMPARISON
    # ---------------------------------------------------------

    story.append(
        Paragraph(
            "2. Algorithm Comparison",
            heading_style,
        )
    )

    comparison_data = [
        [
            "Algorithm",
            "PSNR (dB)",
            "SSIM",
            "NC",
            "BER",
        ]
    ]

    for name in ["DCT", "DWT", "Hybrid"]:
        result = comparison.get(name)

        if not result:
            continue

        comparison_data.append(
            [
                name,
                f"{result.get('PSNR_dB', 0):.4f}",
                f"{result.get('SSIM', 0):.4f}",
                f"{result.get('NC', 0):.4f}",
                f"{result.get('BER', 0):.4f}",
            ]
        )

    comparison_table = Table(
        comparison_data,
        colWidths=[
            35 * mm,
            32 * mm,
            32 * mm,
            32 * mm,
            32 * mm,
        ],
    )

    comparison_table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.HexColor("#1f2937"),
                ),
                (
                    "TEXTCOLOR",
                    (0, 0),
                    (-1, 0),
                    colors.white,
                ),
                (
                    "FONTNAME",
                    (0, 0),
                    (-1, 0),
                    "Helvetica-Bold",
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.5,
                    colors.grey,
                ),
                (
                    "ALIGN",
                    (1, 1),
                    (-1, -1),
                    "CENTER",
                ),
                (
                    "PADDING",
                    (0, 0),
                    (-1, -1),
                    7,
                ),
            ]
        )
    )

    story.append(comparison_table)

    # ---------------------------------------------------------
    # ROBUSTNESS RESULTS
    # ---------------------------------------------------------

    story.append(
        Paragraph(
            "3. Robustness Analysis",
            heading_style,
        )
    )

    robustness_data = [
        [
            "Attack",
            "Strength",
            "PSNR",
            "SSIM",
            "NC",
            "BER",
        ]
    ]

    for result in robustness_results:
        if "error" in result:
            continue

        robustness_data.append(
            [
                result.get("attack", "-"),
                str(result.get("strength", "-")),
                f"{result.get('PSNR_dB', 0):.3f}",
                f"{result.get('SSIM', 0):.4f}",
                f"{result.get('NC', 0):.4f}",
                f"{result.get('BER', 0):.4f}",
            ]
        )

    robustness_table = Table(
        robustness_data,
        repeatRows=1,
        colWidths=[
            38 * mm,
            25 * mm,
            25 * mm,
            25 * mm,
            25 * mm,
            25 * mm,
        ],
    )

    robustness_table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.HexColor("#1f2937"),
                ),
                (
                    "TEXTCOLOR",
                    (0, 0),
                    (-1, 0),
                    colors.white,
                ),
                (
                    "FONTNAME",
                    (0, 0),
                    (-1, 0),
                    "Helvetica-Bold",
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.4,
                    colors.grey,
                ),
                (
                    "ALIGN",
                    (1, 1),
                    (-1, -1),
                    "CENTER",
                ),
                (
                    "FONTSIZE",
                    (0, 0),
                    (-1, -1),
                    8,
                ),
                (
                    "PADDING",
                    (0, 0),
                    (-1, -1),
                    5,
                ),
            ]
        )
    )

    story.append(robustness_table)

    # ---------------------------------------------------------
    # CONCLUSION
    # ---------------------------------------------------------

    story.append(
        Paragraph(
            "4. Experimental Conclusion",
            heading_style,
        )
    )

    story.append(
        Paragraph(
            (
                "The experimental results demonstrate a trade-off "
                "between watermark recovery and visual quality. "
                "The comparison evaluates DCT, DWT and Hybrid "
                "DCT-DWT watermarking using PSNR, SSIM, NC and BER. "
                "The robustness analysis further evaluates the "
                "watermark under multiple image-processing attacks."
            ),
            normal_style,
        )
    )

    document.build(story)

    return buffer.getvalue()