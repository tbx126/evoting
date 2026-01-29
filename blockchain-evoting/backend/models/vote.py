# -*- coding: utf-8 -*-
"""
投票数据模型
Vote Data Model
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from ..database import Base


class Election(Base):
    """选举表（链下缓存）"""
    __tablename__ = "elections"

    id = Column(Integer, primary_key=True)
    chain_id = Column(Integer, unique=True)
    title = Column(String(200))
    description = Column(String(1000))
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    status = Column(String(20))
    merkle_root = Column(String(66), nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class VoteRecord(Base):
    """投票记录表（链下存储）"""
    __tablename__ = "vote_records"

    id = Column(Integer, primary_key=True)
    election_id = Column(Integer, ForeignKey("elections.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    commitment = Column(String(66))
    salt = Column(String(66))
    vote_index = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())
