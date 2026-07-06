FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

WORKDIR /app

# Install system dependencies (including compiler utilities)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy service files and directories
COPY app.py .
COPY whatsapp_service.py .
COPY omr_checker_adapter.py .
COPY PyWhatKit_DB.txt .
COPY omr_checker/ omr_checker/

# Run the FastAPI server
CMD uvicorn app:app --host 0.0.0.0 --port $PORT
