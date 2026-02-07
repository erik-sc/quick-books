@echo off
title Leitor de Livros

echo ========================================
echo        Leitor de Livros
echo ========================================
echo.

echo Atualizando repositorio...
git pull
if %errorlevel% neq 0 (
    echo [AVISO] Falha ao atualizar repositorio. Continuando...
)
echo.

echo Instalando dependencias...
call npm install
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar dependencias.
    pause
    exit /b 1
)
echo.

echo Iniciando servidor...
echo Acesse: http://localhost:3000
echo Pressione Ctrl+C para fechar
echo.

start /B node server.js
timeout /t 2 /nobreak >nul
start http://localhost:3000
pause
