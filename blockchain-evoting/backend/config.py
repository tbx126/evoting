# -*- coding: utf-8 -*-
"""
后端配置模块
Backend Configuration Module

功能说明：
- 集中管理所有配置项
- 支持环境变量覆盖
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """应用配置类"""

    # 应用基础配置
    APP_NAME: str = "Blockchain E-Voting System"
    DEBUG: bool = True

    # 数据库配置
    DATABASE_URL: str = "sqlite:///./evoting.db"

    # JWT 认证配置
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24  # 24小时

    # 区块链配置
    SEPOLIA_RPC_URL: str = ""
    PRIVATE_KEY: str = ""
    VOTER_REGISTRY_ADDRESS: str = ""
    VOTING_ADDRESS: str = ""
    MERKLE_VERIFIER_ADDRESS: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
