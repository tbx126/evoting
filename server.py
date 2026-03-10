from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

FRONTEND_DIR = Path(__file__).resolve().parent / "frontend"

app = FastAPI(
    title="区块链电子投票系统",
    description="基于以太坊的安全电子投票系统",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return FileResponse(FRONTEND_DIR / "voting-app.html")


@app.get("/admin")
async def admin_page():
    return FileResponse(FRONTEND_DIR / "admin.html")


@app.get("/config.js")
async def config_js():
    return FileResponse(FRONTEND_DIR / "config.js", media_type="application/javascript")


app.mount("/lib", StaticFiles(directory=FRONTEND_DIR / "lib"), name="lib")
app.mount("/zk", StaticFiles(directory=FRONTEND_DIR / "zk"), name="zk")
