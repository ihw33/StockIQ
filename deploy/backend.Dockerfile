FROM python:3.12-slim

WORKDIR /app

# System dependencies for lxml, asyncpg
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev libxml2-dev libxslt1-dev \
    && rm -rf /var/lib/apt/lists/*

COPY deploy/requirements.docker.txt requirements.txt
RUN pip install --no-cache-dir --no-deps -r requirements.txt

# Copy backend code
COPY services/ai-engine/ .

# Copy data files (stock_master.json, stock_classifications.json)
# Path resolution: routers/stocks.py -> 4x parent -> /data/
COPY data/ /data/

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
