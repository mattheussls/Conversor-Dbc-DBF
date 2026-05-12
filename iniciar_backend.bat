@echo off
setlocal
cd /d "%~dp0"
py -3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
