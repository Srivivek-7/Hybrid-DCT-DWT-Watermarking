# Hybrid DCT-DWT Image Watermarking

Research lab for invisible image watermarking. The hybrid path runs Haar DWT, then DCT on the approximation band, then key-based scrambling before embedding. DCT-only and DWT-only baselines are included for comparison, along with quality metrics and ten robustness attacks.

Color hosts keep their chroma: the watermark is added to the Y channel of YCrCb, then the image is converted back to BGR.

## Run locally

Backend (from `backend/`):

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend (from `frontend/`):

```bash
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies API calls to FastAPI on port 8000.

## Tests

```bash
cd backend
PYTHONPATH=. python -m unittest discover -s tests
```

## API

| Endpoint | Purpose |
| --- | --- |
| `POST /watermark/process` | Embed, extract, and return metrics plus PNG payloads |
| `POST /watermark/embed` | Embed only (PNG) |
| `POST /watermark/extract` | Extract only (PNG) |
| `POST /comparison/test` | DCT vs DWT vs Hybrid |
| `POST /robustness/test` | Ten default attacks |
| `GET /health` | Liveness |
