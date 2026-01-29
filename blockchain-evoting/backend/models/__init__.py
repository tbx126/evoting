# -*- coding: utf-8 -*-
"""
数据模型模块初始化
Models Module Init
"""

from .user import User
from .vote import Election, VoteRecord

__all__ = ['User', 'Election', 'VoteRecord']
