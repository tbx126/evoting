# -*- coding: utf-8 -*-
"""
区块链电子投票系统 - 后端主入口
Blockchain E-Voting System - Backend Main Entry

功能说明：
- FastAPI 应用初始化
- 路由注册
- 中间件配置
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .api import auth_router, voting_router, verify_router

# 创建 FastAPI 应用
app = FastAPI(
    title="区块链电子投票系统",
    description="基于以太坊的安全电子投票系统",
    version="1.0.0"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth_router)
app.include_router(voting_router)
app.include_router(verify_router)


@app.on_event("startup")
async def startup():
    """应用启动时初始化数据库"""
    await init_db()


@app.get("/")
async def root():
    """根路由"""
    return {"message": "区块链电子投票系统 API"}
