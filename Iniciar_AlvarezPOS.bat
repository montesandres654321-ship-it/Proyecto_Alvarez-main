@echo off
chcp 65001 >nul 2>&1
title Alvarez Fast Food — POS

echo.
echo  =====================================================
echo    ALVAREZ FAST FOOD - Sistema de Ventas
echo    Edicion Copa Mundial 2026
echo  =====================================================
echo.

REM --------------------------------------------------------
REM  Ir al directorio del script (rutas relativas correctas)
REM --------------------------------------------------------
cd /d "%~dp0"

REM --------------------------------------------------------
REM  1. Verificar que Python esta instalado
REM --------------------------------------------------------
where python >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python no esta instalado o no esta en el PATH.
    echo.
    echo  Solucion:
    echo    1. Descargue Python desde https://www.python.org/downloads/
    echo    2. Durante la instalacion active "Add Python to PATH"
    echo    3. Reinicie el computador y vuelva a ejecutar este archivo
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo  Python detectado: %%v

REM --------------------------------------------------------
REM  2. Crear entorno virtual si no existe
REM --------------------------------------------------------
if not exist "venv\Scripts\activate.bat" (
    echo.
    echo  Configurando entorno virtual por primera vez...
    python -m venv venv
    if errorlevel 1 (
        echo.
        echo  [ERROR] No se pudo crear el entorno virtual.
        echo  Verifique que Python este instalado correctamente.
        echo.
        pause
        exit /b 1
    )
    echo  Entorno virtual creado correctamente.
)

REM --------------------------------------------------------
REM  3. Activar entorno virtual
REM --------------------------------------------------------
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo.
    echo  [ERROR] No se pudo activar el entorno virtual.
    echo  Intente eliminar la carpeta "venv" y ejecute este archivo de nuevo.
    echo.
    pause
    exit /b 1
)

REM --------------------------------------------------------
REM  4. Instalar o actualizar dependencias Python
REM --------------------------------------------------------
echo.
echo  Verificando dependencias (pymysql, openpyxl)...
pip install -r requirements.txt --quiet --disable-pip-version-check
if errorlevel 1 (
    echo.
    echo  [ERROR] No se pudieron instalar las dependencias.
    echo.
    echo  Posibles causas:
    echo    - Sin conexion a internet (requerida la primera vez)
    echo    - El archivo requirements.txt no se encuentra
    echo.
    echo  Verifique la conexion e intente de nuevo.
    echo.
    pause
    exit /b 1
)
echo  Dependencias OK.

REM --------------------------------------------------------
REM  5. Verificar conexion con MySQL (XAMPP)
REM --------------------------------------------------------
echo.
echo  Verificando conexion con MySQL...
python -c "from persistencia import probar_conexion; ok,msg=probar_conexion(); print('  '+msg); exit(0 if ok else 1)"

if errorlevel 1 (
    echo.
    echo  ====================================================
    echo   ATENCION: MySQL no esta corriendo
    echo  ====================================================
    echo.
    echo   Para iniciar MySQL:
    echo     1. Abra el panel de control de XAMPP
    echo     2. Haga clic en "Start" junto a MySQL
    echo     3. Espere a que el indicador se ponga en verde
    echo     4. Cierre esta ventana y ejecute este archivo de nuevo
    echo.
    echo   Si XAMPP no esta instalado:
    echo     Descargue desde https://www.apachefriends.org/
    echo     (es gratuito)
    echo.
    pause
    exit /b 1
)

REM --------------------------------------------------------
REM  6. Lanzar la aplicacion
REM --------------------------------------------------------
echo.
echo  Todo listo. Iniciando Alvarez Fast Food POS...
echo.
python main.py
set APP_EXIT=%errorlevel%

REM Codigo 0 = el usuario cerro la app normalmente
if %APP_EXIT% equ 0 exit /b 0

REM Cualquier otro codigo indica un error inesperado
echo.
echo  ====================================================
echo   La aplicacion cerro con un error (codigo %APP_EXIT%)
echo  ====================================================
echo.
echo  Posibles causas:
echo    - MySQL se detuvo mientras la app estaba abierta
echo    - Un archivo del programa fue modificado o eliminado
echo.
echo  Verifique que XAMPP-MySQL este corriendo e intente
echo  ejecutar este archivo de nuevo.
echo.
pause
exit /b %APP_EXIT%
