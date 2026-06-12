@echo off
CHCP 65001 >nul
TITLE Alvarez POS
cd /d "%~dp0"

REM ============================================================
REM  Alvarez POS - Script de inicio
REM  Requisitos: Python, Node.js, MySQL (XAMPP)
REM ============================================================

echo.
echo  ============================================================
echo   Alvarez POS - Iniciando servidor...
echo  ============================================================
echo.

REM -- Verificar Python -----------------------------------------
python --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo ERROR: Python no encontrado
    echo Instala Python desde python.org
    pause
    exit /b 1
)

REM -- Activar venv ---------------------------------------------
IF NOT EXIST "venv\Scripts\activate.bat" (
    echo Creando entorno virtual...
    python -m venv venv
)
call venv\Scripts\activate.bat

REM -- Instalar dependencias ------------------------------------
echo Instalando dependencias...
pip install -r requirements.txt -q
pip install -r requirements_api.txt -q

REM -- Verificar MySQL en puerto 3306 ---------------------------
netstat -an | findstr "3306" | findstr "LISTENING" >nul
IF ERRORLEVEL 1 (
    echo.
    echo MySQL no esta corriendo.
    echo Abre XAMPP y presiona Start en MySQL.
    echo Luego cierra esta ventana y vuelve a ejecutar.
    echo.
    IF EXIST "C:\xampp\xampp-control.exe" start "" "C:\xampp\xampp-control.exe"
    IF EXIST "D:\xampp\xampp-control.exe" start "" "D:\xampp\xampp-control.exe"
    pause
    exit /b 1
)
echo MySQL OK

REM -- Compilar frontend si no existe dist ----------------------
IF NOT EXIST "frontend\dist\index.html" (
    echo Compilando frontend...
    cd frontend
    npm run build
    cd ..
)

REM -- Detectar IP local ----------------------------------------
FOR /f "tokens=2 delims=:" %%a IN (
    'ipconfig ^| findstr /i "IPv4"'
) DO (
    SET IP=%%a
    GOTO :found_ip
)
:found_ip
SET IP=%IP: =%

REM -- Mostrar URLs ---------------------------------------------
echo.
echo ================================
echo  Alvarez POS - Servidor listo
echo ================================
echo.
echo  Este PC:  http://localhost:8000
echo  Red WiFi: http://%IP%:8000
echo.
echo  Abriendo navegador...
echo.

REM -- Abrir navegador ------------------------------------------
timeout /t 2 /nobreak >nul
start "" "http://localhost:8000"

REM -- Lanzar servidor ------------------------------------------
REM  Un solo proceso: los carritos viven en memoria del proceso.
REM  No usar --workers.
uvicorn backend.main_api:app --host 0.0.0.0 --port 8000

echo.
echo El servidor se detuvo.
pause
