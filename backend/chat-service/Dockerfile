FROM python:3.11

WORKDIR /app

RUN pip install --no-cache-dir torch transformers sentence-transformers

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


COPY app/ ./app/
COPY data/ ./data/

EXPOSE 4005
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4005"]
