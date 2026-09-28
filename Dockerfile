# Multi-stage Dockerfile for Dracarys AI Virtual Assistant
FROM python:3.11-slim

# Install system dependencies for audio, pywhatkit, and X11/Eel
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libasound2-dev \
    portaudio19-dev \
    libportaudio2 \
    libportaudiocpp0 \
    ffmpeg \
    espeak \
    chromium \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Expose default Eel port
EXPOSE 8000

ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Command to run assistant
CMD ["python", "main.py"]
