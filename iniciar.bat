@echo off
title Sistema de Turnos - GanaGana
color 0A
echo.
echo  ============================================
echo   SISTEMA DE TURNOS - GANAGANA
echo  ============================================
echo.

:: Verificar Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo  [ERROR] Node.js no esta instalado.
  echo  Descargalo en: https://nodejs.org
  pause
  exit /b 1
)

echo  [1/3] Instalando dependencias del servidor...
cd /d "%~dp0server"
if not exist node_modules (
  call npm install
  if %errorlevel% neq 0 (
    echo  [ERROR] Fallo al instalar dependencias del servidor.
    pause
    exit /b 1
  )
)

echo.
echo  [2/3] Instalando dependencias del cliente...
cd /d "%~dp0client"
if not exist node_modules (
  call npm install
  if %errorlevel% neq 0 (
    echo  [ERROR] Fallo al instalar dependencias del cliente.
    pause
    exit /b 1
  )
)

echo.
echo  [3/3] Iniciando servidor en segundo plano...
cd /d "%~dp0server"
start "Servidor Turnos" cmd /k "node index.js"

timeout /t 2 /nobreak >nul

echo.
echo  [4/4] Iniciando cliente (panel de cajas)...
cd /d "%~dp0client"
start "Cliente Turnos" cmd /k "npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo  ============================================
echo   SISTEMA INICIADO
echo  ============================================
echo.
echo  Panel de cajas:    http://localhost:5173
echo  Pantalla publica:  http://localhost:3001/display
echo  Panel admin:       http://localhost:5173/admin
echo.
echo  Para usar desde otros computadores de la red,
echo  reemplaza "localhost" con la IP de este equipo.
echo.
echo  Presiona cualquier tecla para abrir el navegador...
pause >nul

start "" "http://localhost:5173"

echo.
echo  Cierra esta ventana cuando quieras detener el sistema.
pause
