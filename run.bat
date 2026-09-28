@echo off
echo Starting Dracarys AI Assistant...
call "%~dp0venv\Scripts\activate.bat"
python "%~dp0main.py"
pause
