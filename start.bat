@echo off
chcp 65001 > nul
title MAVEN FREIGHT OS - Ситуационный центр логистики РФ и США
cd /d "%~dp0"

echo =====================================================================
echo    MAVEN FREIGHT OS // СИСТЕМА УПРАВЛЕНИЯ ЛОГИСТИКОЙ И ДАЛЬНОБОЙЩИКАМИ
echo =====================================================================
echo.

if not exist "logistics_ru.db" (
    echo [1/3] База данных РФ не обнаружена. Запуск data_pipeline_ru.py...
    python data_pipeline_ru.py
    if errorlevel 1 (
        echo [!] Ошибка при генерации данных РФ.
        pause
        exit /b 1
    )
    echo [OK] База данных РФ успешно сформирована.
) else (
    echo [OK] База данных logistics_ru.db найдена.
)

if not exist "logistics.db" (
    echo [2/3] База данных США не обнаружена. Запуск data_pipeline.py...
    python data_pipeline.py
    if errorlevel 1 (
        echo [!] Ошибка при генерации данных США.
        pause
        exit /b 1
    )
    echo [OK] База данных США успешно сформирована.
) else (
    echo [OK] База данных logistics.db найдена.
)

echo.
echo [3/3] Запуск локального сервера (порт 8080)...
start "" http://127.0.0.1:8080
python server.py

pause
