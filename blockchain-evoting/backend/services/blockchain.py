# -*- coding: utf-8 -*-
"""
区块链交互服务模块
Blockchain Service Module

功能说明：
- 与以太坊网络交互
- 调用智能合约方法
- 管理交易签名与发送
"""

from web3 import Web3
from eth_account import Account
from typing import Optional, Dict, Any

from ..config import settings


class BlockchainService:
    """区块链交互服务类"""

    def __init__(self):
        """初始化 Web3 连接"""
        self.w3 = Web3(Web3.HTTPProvider(settings.SEPOLIA_RPC_URL))
        self.account = None
        if settings.PRIVATE_KEY:
            self.account = Account.from_key(settings.PRIVATE_KEY)

    def is_connected(self) -> bool:
        """检查是否连接到网络"""
        return self.w3.is_connected()

    def get_balance(self, address: str) -> float:
        """获取地址余额（ETH）"""
        balance_wei = self.w3.eth.get_balance(address)
        return self.w3.from_wei(balance_wei, 'ether')

    def verify_signature(
        self, message: str, signature: str, address: str
    ) -> bool:
        """验证钱包签名"""
        try:
            msg_hash = self.w3.keccak(text=message)
            recovered = self.w3.eth.account.recover_message(
                message, signature=signature
            )
            return recovered.lower() == address.lower()
        except Exception:
            return False
