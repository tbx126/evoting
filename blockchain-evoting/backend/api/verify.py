# -*- coding: utf-8 -*-
"""
验证 API 路由
Verification API Routes
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services.voting import VotingService

router = APIRouter(prefix="/verify", tags=["验证"])

voting_service = VotingService()


class VerifyRequest(BaseModel):
    """验证请求"""
    vote: int
    salt: str
    commitment: str


@router.post("/commitment")
async def verify_commitment(req: VerifyRequest):
    """验证投票承诺"""
    valid = voting_service.verify_commitment(
        req.vote, req.salt, req.commitment
    )
    return {"valid": valid}


@router.get("/proof/{index}")
async def get_merkle_proof(index: int):
    """获取 Merkle 证明"""
    try:
        proof = voting_service.get_merkle_proof(index)
        return {"proof": proof}
    except IndexError:
        raise HTTPException(status_code=404, detail="索引不存在")
