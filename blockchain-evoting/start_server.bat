@echo off
echo Starting Blockchain E-Voting System Backend...
echo Access voter page at: http://localhost:8000/
echo Access admin page at: http://localhost:8000/admin
echo.
uvicorn backend.main:app --reload --port 8000
