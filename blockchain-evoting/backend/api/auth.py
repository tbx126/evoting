# -*- coding: utf-8 -*-
"""
认证 API 路由
Authentication API Routes
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["认证"])


# ============ 请求模型 ============

class RegisterRequest(BaseModel):
    """注册请求"""
    username: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    """登录请求"""
    username: str
    password: str


# ============ API 端点 ============

@router.post("/register")
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """用户注册"""
    try:
        user = await AuthService.register(
            db, req.username, req.email, req.password
        )
        return {"message": "注册成功", "user_id": user.id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """用户登录"""
    token = await AuthService.login(db, req.username, req.password)
    if not token:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    return {"access_token": token, "token_type": "bearer"}
