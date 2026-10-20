@echo off
chcp 65001 > nul
title MAVEN FREIGHT OS - Docker Stop
cd /d "%~dp0"

echo Останавливаем контейнер MAVEN FREIGHT OS...
docker compose down

echo.
echo [OK] Контейнер остановлен.
timeout /t 2 > nul
