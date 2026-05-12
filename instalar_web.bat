@echo off
setlocal
cd /d "%~dp0"
py -3 -m pip install -r requirements.txt
cd frontend
npm install
echo.
echo Instalacao web concluida.
pause
