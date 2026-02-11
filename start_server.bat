@echo off
echo ============================================================
echo   Blockchain E-Voting System - Local Development Server
echo ============================================================
echo.
echo Access voter page at: http://localhost:8000/
echo Access admin page at: http://localhost:8000/admin
echo.
echo NOTE: Make sure Hardhat node is running in another terminal:
echo   npx hardhat node
echo.
echo And contracts are deployed:
echo   npm run deploy:local
echo.
cd /d "%~dp0"
python -m uvicorn server:app --reload --port 8000
