# -*- coding: utf-8 -*-
"""
API 路由模块初始化
API Routes Module Init
"""

from .auth import router as auth_router
from .voting import router as voting_router
from .verify import router as verify_router

__all__ = ['auth_router', 'voting_router', 'verify_router']
