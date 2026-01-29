# -*- coding: utf-8 -*-
"""
认证服务模块
Authentication Service Module

功能说明：
- 用户注册与登录
- JWT 令牌生成与验证
- 钱包签名验证
"""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..config import settings
from ..models.user import User


# 密码哈希上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:
    """认证服务类"""

    @staticmethod
    def hash_password(password: str) -> str:
        """哈希密码"""
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain: str, hashed: str) -> bool:
        """验证密码"""
        return pwd_context.verify(plain, hashed)

    @staticmethod
    def create_token(data: dict) -> str:
        """创建 JWT 令牌"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(
            minutes=settings.JWT_EXPIRE_MINUTES
        )
        to_encode.update({"exp": expire})
        return jwt.encode(
            to_encode,
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM
        )

    @staticmethod
    def decode_token(token: str) -> Optional[dict]:
        """解码 JWT 令牌"""
        try:
            return jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM]
            )
        except JWTError:
            return None

    @staticmethod
    async def register(
        db: AsyncSession,
        username: str,
        email: str,
        password: str
    ) -> User:
        """用户注册"""
        user = User(
            username=username,
            email=email,
            hashed_password=AuthService.hash_password(password)
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def login(
        db: AsyncSession,
        username: str,
        password: str
    ) -> Optional[str]:
        """用户登录，返回 JWT 令牌"""
        result = await db.execute(
            select(User).where(User.username == username)
        )
        user = result.scalar_one_or_none()

        if not user or not AuthService.verify_password(
            password, user.hashed_password
        ):
            return None

        return AuthService.create_token({"sub": str(user.id)})

    @staticmethod
    async def bind_wallet(
        db: AsyncSession,
        user_id: int,
        wallet_address: str
    ) -> bool:
        """绑定钱包地址"""
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            return False

        user.wallet_address = wallet_address
        await db.commit()
        return True
