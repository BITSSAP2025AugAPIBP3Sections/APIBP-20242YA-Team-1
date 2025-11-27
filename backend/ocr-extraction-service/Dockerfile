FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN apt-get update && apt-get install -y gcc g++ libpq-dev poppler-utils tesseract-ocr libtesseract-dev && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
RUN mkdir -p invoices_json invoices_pdf
EXPOSE 4003
CMD ["python", "-m", "app.main"]