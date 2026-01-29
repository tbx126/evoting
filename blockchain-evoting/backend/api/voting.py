# -*- coding: utf-8 -*-
"""
投票 API 路由
Voting API Routes
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

from ..services.voting import VotingService

router = APIRouter(prefix="/vote", tags=["投票"])

# 全局投票服务实例
voting_service = VotingService()


# ============ 请求模型 ============

class CommitmentRequest(BaseModel):
    """创建承诺请求"""
    vote: int


# ============ API 端点 ============

@router.post("/commitment")
async def create_commitment(req: CommitmentRequest):
    """创建投票承诺"""
    commitment, salt = voting_service.create_vote_commitment(req.vote)
    return {"commitment": commitment, "salt": salt}


@router.post("/submit")
async def submit_commitment(commitment: str):
    """提交承诺到 Merkle 树"""
    index = voting_service.add_commitment(commitment)
    return {"index": index}


@router.post("/build-tree")
async def build_merkle_tree():
    """构建 Merkle 树"""
    root = voting_service.build_merkle_tree()
    if not root:
        raise HTTPException(status_code=400, detail="无投票数据")
    return {"merkle_root": root}
