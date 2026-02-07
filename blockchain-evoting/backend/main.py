# -*- coding: utf-8 -*-
"""
区块链电子投票系统 - 静态文件服务器
Blockchain E-Voting System - Static File Server
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

app = FastAPI(
    title="区块链电子投票系统",
    description="基于以太坊的安全电子投票系统",
    version="1.0.0"
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
    """主页 - 选民投票页面"""
    return FileResponse(FRONTEND_DIR / "voting-app.html")


@app.get("/admin")
async def admin_page():
    """管理员控制台"""
    return FileResponse(FRONTEND_DIR / "admin.html")


@app.get("/config.js")
async def config_js():
    """合约配置文件（由 deploy.js 生成）"""
    return FileResponse(FRONTEND_DIR / "config.js", media_type="application/javascript")
