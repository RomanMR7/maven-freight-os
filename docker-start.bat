@echo off
chcp 65001 > nul
title MAVEN FREIGHT OS - Docker Launcher
cd /d "%~dp0"

echo =====================================================================
echo    MAVEN FREIGHT OS // ЗАПУСК В DOCKER КОНТЕЙНЕРЕ
echo =====================================================================
echo.

:: 1. Проверяем наличие базы данных
if not exist "logistics.db" (
    echo [*] База данных logistics.db не найдена. Создание локально...
    python data_pipeline.py
    if errorlevel 1 (
        echo [!] Не удалось сгенерировать базу данных через Python.
    )
)

:: 2. Проверяем, запущен ли демон Docker
echo [*] Проверка работы Docker Daemon...
docker info > nul 2>&1
if errorlevel 1 (
    echo [!] Docker Daemon не запущен.
    if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
        echo [*] Запуск Docker Desktop...
        start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        echo [*] Ожидание инициализации Docker Daemon (это может занять до 20-30 сек)...
        
        :wait_docker
        timeout /t 3 /nobreak > nul
        docker info > nul 2>&1
        if errorlevel 1 (
            echo     ...ожидаем Docker engine...
            goto wait_docker
        )
        echo [OK] Docker успешно запущен и готов к работе!
    ) else (
        echo [!] Docker Desktop не найден в стандартной директории. Пожалуйста, запустите Docker вручную.
        pause
        exit /b 1
    )
) else (
    echo [OK] Docker Daemon активен.
)

echo.
echo [*] Сборка и запуск контейнера (docker compose up -d --build)...
docker compose up -d --build

if errorlevel 1 (
    echo [!] Ошибка при запуске контейнера Docker.
    pause
    exit /b 1
)

echo.
echo [OK] Контейнер успешно запущен!
echo [*] Открытие интерфейса: http://127.0.0.1:8080
start "" http://127.0.0.1:8080

echo.
echo =====================================================================
echo Статус контейнера:
docker compose ps
echo =====================================================================
echo Чтобы остановить контейнер, используйте docker-stop.bat или нажмите CTRL+C
echo.
pause
