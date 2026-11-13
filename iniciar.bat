@echo off
title Sistema de Turnos - GanaGana
color 0A
echo.
echo  ============================================
echo   SISTEMA DE TURNOS - GANAGANA
echo  ============================================
echo.
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo  [ERROR] Node.js no esta instalado. Descargalo en: https://nodejs.org
  pause
  exit /b 1
)

rem MySQL de XAMPP (donde se guardan los administradores): se enciende si existe y no esta encendido
if exist "C:\xampp\mysql\bin\mysqld.exe" (
  tasklist /FI "IMAGENAME eq mysqld.exe" | find /I "mysqld.exe" >nul
  if errorlevel 1 (
    echo  [0/3] Encendiendo MySQL de XAMPP...
    start "" /B "C:\xampp\mysql\bin\mysqld.exe" --defaults-file=C:\xampp\mysql\bin\my.ini --standalone
    timeout /t 4 /nobreak >nul
  )
)

echo  [1/3] Servidor: dependencias...
cd /d "%~dp0server"
if not exist node_modules (
  call npm install
  if %errorlevel% neq 0 ( echo  [ERROR] Fallo al instalar el servidor. & pause & exit /b 1 )
)

echo  [2/3] Cliente: compilando la interfaz...
cd /d "%~dp0client"
if not exist node_modules (
  call npm install
  if %errorlevel% neq 0 ( echo  [ERROR] Fallo al instalar el cliente. & pause & exit /b 1 )
)
if not exist dist\index.html (
  call npm run build
  if %errorlevel% neq 0 ( echo  [ERROR] Fallo al compilar el cliente. & pause & exit /b 1 )
)

echo  [3/3] Iniciando el servidor...
cd /d "%~dp0server"
start "Servidor Turnos" cmd /k "node index.js"
timeout /t 3 /nobreak >nul

echo.
echo  ============================================
echo   SISTEMA INICIADO  (todo en el puerto 3001)
echo  ============================================
echo   Inicio:            http://localhost:3001
echo   Panel admin:       http://localhost:3001/admin
echo   Pantalla publica:  http://localhost:3001/pantalla
echo   Caja 1 a 4:        http://localhost:3001/caja/1  ...  /caja/4
echo.
echo   Desde otros equipos: cambia "localhost" por la IP de este computador.
echo   Si cambiaste el codigo del cliente, borra client\dist y vuelve a ejecutar.
echo.
start "" "http://localhost:3001"
pause
