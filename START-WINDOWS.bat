@echo off
cd /d "%~dp0"
python -m backend.server
if errorlevel 1 (
  echo.
  echo Could not start LuMaCo. Install Python 3.10+ and make sure it is on PATH.
  pause
)
