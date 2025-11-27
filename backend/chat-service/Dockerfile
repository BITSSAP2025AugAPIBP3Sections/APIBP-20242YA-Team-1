FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN apt-get update && apt-get install -y gcc g++ libpq-dev && rm -rf /var/lib/apt/lists/* && \
    pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY data/ ./data/

ENV PYTHONUNBUFFERED=1 \
    CHAT_PORT=4005

EXPOSE 4005

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4005"]