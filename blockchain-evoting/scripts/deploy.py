# -*- coding: utf-8 -*-
"""
智能合约部署脚本
Smart Contract Deployment Script

功能说明：
- 编译 Solidity 合约
- 部署到指定网络
- 保存部署地址
"""

import json
import os
from pathlib import Path
from web3 import Web3
from solcx import compile_standard, install_solc

# 安装 Solidity 编译器
install_solc('0.8.19')


class ContractDeployer:
    """合约部署器"""

    def __init__(self, rpc_url: str, private_key: str):
        """
        初始化部署器

        Args:
            rpc_url: RPC 节点地址
            private_key: 部署账户私钥
        """
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.account = self.w3.eth.account.from_key(private_key)
        self.contracts_dir = Path(__file__).parent.parent / 'contracts'
        self.deployed = {}

    def compile_contract(self, filename: str) -> dict:
        """
        编译合约

        Args:
            filename: 合约文件名

        Returns:
            编译结果 (abi, bytecode)
        """
        contract_path = self.contracts_dir / filename
        with open(contract_path, 'r', encoding='utf-8') as f:
            source = f.read()

        contract_name = filename.replace('.sol', '')

        compiled = compile_standard({
            'language': 'Solidity',
            'sources': {filename: {'content': source}},
            'settings': {
                'outputSelection': {
                    '*': {'*': ['abi', 'evm.bytecode']}
                }
            }
        }, solc_version='0.8.19')

        contract_data = compiled['contracts'][filename][contract_name]
        return {
            'abi': contract_data['abi'],
            'bytecode': contract_data['evm']['bytecode']['object']
        }

    def deploy_contract(self, filename: str, *args) -> str:
        """
        部署合约

        Args:
            filename: 合约文件名
            *args: 构造函数参数

        Returns:
            部署的合约地址
        """
        print(f'编译合约: {filename}')
        compiled = self.compile_contract(filename)

        contract = self.w3.eth.contract(
            abi=compiled['abi'],
            bytecode=compiled['bytecode']
        )

        # 构建交易
        nonce = self.w3.eth.get_transaction_count(self.account.address)
        tx = contract.constructor(*args).build_transaction({
            'from': self.account.address,
            'nonce': nonce,
            'gas': 3000000,
            'gasPrice': self.w3.eth.gas_price
        })

        # 签名并发送
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        print(f'交易已发送: {tx_hash.hex()}')

        # 等待确认
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        address = receipt.contractAddress
        print(f'合约已部署: {address}')

        # 保存部署信息
        contract_name = filename.replace('.sol', '')
        self.deployed[contract_name] = {
            'address': address,
            'abi': compiled['abi']
        }

        return address

    def save_deployment(self, output_path: str):
        """
        保存部署信息到文件

        Args:
            output_path: 输出文件路径
        """
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.deployed, f, indent=2, ensure_ascii=False)
        print(f'部署信息已保存: {output_path}')


def deploy_all(rpc_url: str, private_key: str):
    """
    部署所有合约

    Args:
        rpc_url: RPC 节点地址
        private_key: 部署账户私钥
    """
    deployer = ContractDeployer(rpc_url, private_key)

    # 1. 部署选民注册合约
    print('\n=== 部署选民注册合约 ===')
    registry_addr = deployer.deploy_contract('VoterRegistry.sol')

    # 2. 部署 Merkle 验证合约
    print('\n=== 部署 Merkle 验证合约 ===')
    merkle_addr = deployer.deploy_contract('MerkleVerifier.sol')

    # 3. 部署投票合约（传入 VoterRegistry 地址）
    print('\n=== 部署投票合约 ===')
    voting_addr = deployer.deploy_contract(
        'Voting.sol',
        registry_addr
    )

    # 4. 设置 VoterRegistry 的授权投票合约地址
    print('\n=== 配置合约权限 ===')
    registry_contract = deployer.w3.eth.contract(
        address=registry_addr,
        abi=deployer.deployed['VoterRegistry']['abi']
    )
    nonce = deployer.w3.eth.get_transaction_count(deployer.account.address)
    tx = registry_contract.functions.setVotingContract(voting_addr).build_transaction({
        'from': deployer.account.address,
        'nonce': nonce,
        'gas': 100000,
        'gasPrice': deployer.w3.eth.gas_price
    })
    signed = deployer.account.sign_transaction(tx)
    tx_hash = deployer.w3.eth.send_raw_transaction(signed.rawTransaction)
    deployer.w3.eth.wait_for_transaction_receipt(tx_hash)
    print(f'VoterRegistry 已授权 Voting 合约: {voting_addr}')

    # 保存部署信息
    output_dir = Path(__file__).parent.parent / 'deployed'
    output_dir.mkdir(exist_ok=True)
    deployer.save_deployment(str(output_dir / 'contracts.json'))

    print('\n=== 部署完成 ===')
    print(f'VoterRegistry: {registry_addr}')
    print(f'MerkleVerifier: {merkle_addr}')
    print(f'Voting: {voting_addr}')

    return deployer.deployed


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='部署智能合约')
    parser.add_argument(
        '--network',
        default='sepolia',
        help='目标网络 (sepolia/mainnet)'
    )
    parser.add_argument(
        '--rpc',
        help='RPC URL (可选，默认使用 Infura)'
    )
    parser.add_argument(
        '--key',
        required=True,
        help='部署账户私钥'
    )

    args = parser.parse_args()

    # 设置 RPC URL
    if args.rpc:
        rpc_url = args.rpc
    else:
        # 默认使用环境变量中的 Infura 项目 ID
        infura_id = os.getenv('INFURA_PROJECT_ID', '')
        rpc_url = f'https://{args.network}.infura.io/v3/{infura_id}'

    deploy_all(rpc_url, args.key)
