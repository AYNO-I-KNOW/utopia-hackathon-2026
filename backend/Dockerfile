# Hugging Face Spaces (Docker SDK). Build context = backend/
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HOME=/home/user \
    MPLBACKEND=Agg

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 1000 user

WORKDIR /home/user/app

# CPU-only torch first (avoids the multi-GB CUDA wheel), then the rest.
RUN pip install torch==2.14.1 --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY --chown=user:user app ./app
COPY --chown=user:user knowledge ./knowledge
COPY --chown=user:user models ./models
COPY --chown=user:user tts_cache ./tts_cache

# Pre-fetch PANNs Cnn14 checkpoint (~327 MB) + AudioSet labels into ~/panns_data.
# app.model.ensure_panns_files uses the same URLs panns_inference would `wget`.
USER user
RUN python -c "from app.model import ensure_panns_files; ensure_panns_files()" \
    && python -c "import panns_inference; print(len(panns_inference.labels))"

EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
