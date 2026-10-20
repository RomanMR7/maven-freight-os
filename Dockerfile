# MAVEN FREIGHT OS - US Logistics & Trucking Command Center
FROM python:3.12-alpine

WORKDIR /app

# SQLite and basic tools
RUN apk add --no-cache tzdata

# Set timezone
ENV TZ=America/New_York

# Copy project files
COPY data_pipeline.py server.py index.html styles.css app.js ./
COPY logistics.db ./

# Expose web & API port
EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/stats || exit 1

# Start Logistics Command Center Server
CMD ["python", "server.py"]
