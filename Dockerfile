# syntax=docker/dockerfile:1.7
FROM python:3.12-slim AS app

# Prevent Python from writing .pyc files & enable unbuffered logs
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install curl (for uv installer) and certs, then install uv
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && curl -LsSf https://astral.sh/uv/install.sh | sh \
  && ln -s /root/.local/bin/uv /usr/local/bin/uv

# Copy only requirements first to leverage Docker layer caching
COPY requirements.txt .

# Install Python dependencies with uv (no BuildKit cache mount)
RUN uv pip install --system -r requirements.txt

# Now copy the application code
COPY server ./server
COPY orbit_api ./orbit_api
COPY wombat_api ./wombat_api
COPY library ./library


# Create non-root user and fix ownership
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Run FastAPI using the command you specified
CMD ["python", "-m", "uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]
