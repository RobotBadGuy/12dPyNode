# PyChain backend — FastAPI on :8001.
# Used by the root docker-compose.yml for one-command local dev.
FROM python:3.12-slim

WORKDIR /app

# Install Python deps first so the layer caches across source changes.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application. (At dev time docker-compose bind-mounts the source over
# this, so edits are live; the COPY keeps the image runnable on its own too.)
COPY . .

EXPOSE 8001

# Default run (standalone `docker run`). docker-compose overrides this with
# `uvicorn --reload` for hot reload.
CMD ["python", "main.py"]
