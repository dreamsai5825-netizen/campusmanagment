FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

WORKDIR /app

# Install system dependencies (including compiler & runtime libraries)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libglib2.0-0 \
    libgomp1 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy service files and directories
COPY app.py .
COPY whatsapp_service.py .
COPY omr_checker_adapter.py .
COPY omr_ml_classifier.py .
COPY PyWhatKit_DB.txt .
COPY omr_checker/ omr_checker/
COPY .omr_ml_model/ .omr_ml_model/
COPY .omr_ml_dataset/ .omr_ml_dataset/

# Run the FastAPI server with dynamic PORT environment variable binding
CMD ["sh", "-c", "exec uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080}"]
