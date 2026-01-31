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
from datetime import datetime, timedelta
from web3 import Web3
from solcx import compile_standard, install_solc

# 安装 Solidity 编译器
install_solc('0.8.20')


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
        }, solc_version='0.8.20')

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

    def call_contract_function(self, contract_name: str, function_name: str, *args):
        """
        调用合约函数

        Args:
            contract_name: 合约名称
            function_name: 函数名称
            *args: 函数参数
        """
        contract = self.w3.eth.contract(
            address=self.deployed[contract_name]['address'],
            abi=self.deployed[contract_name]['abi']
        )
        nonce = self.w3.eth.get_transaction_count(self.account.address)
        func = getattr(contract.functions, function_name)
        tx = func(*args).build_transaction({
            'from': self.account.address,
            'nonce': nonce,
            'gas': 200000,
            'gasPrice': self.w3.eth.gas_price
        })
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        self.w3.eth.wait_for_transaction_receipt(tx_hash)
        print(f'调用 {contract_name}.{function_name}() 成功')

    def save_deployment(self, output_path: str):
        """
        保存部署信息到文件

        Args:
            output_path: 输出文件路径
        """
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.deployed, f, indent=2, ensure_ascii=False)
        print(f'部署信息已保存: {output_path}')


def deploy_all(
    rpc_url: str,
    private_key: str,
    title: str = "示例选举",
    description: str = "这是一个区块链电子投票示例",
    duration_hours: int = 24
):
    """
    部署所有合约

    Args:
        rpc_url: RPC 节点地址
        private_key: 部署账户私钥
        title: 选举标题
        description: 选举描述
        duration_hours: 选举持续时间（小时）
    """
    deployer = ContractDeployer(rpc_url, private_key)

    # 计算选举时间
    start_time = int(datetime.now().timestamp()) + 300  # 5分钟后开始
    end_time = start_time + (duration_hours * 3600)

    # 1. 部署选民注册合约
    print('\n=== 部署选民注册合约 ===')
    registry_addr = deployer.deploy_contract('VoterRegistry.sol')

    # 2. 部署 Merkle 验证合约
    print('\n=== 部署 Merkle 验证合约 ===')
    merkle_addr = deployer.deploy_contract('MerkleVerifier.sol')

    # 3. 部署投票合约（传入选举参数）
    print('\n=== 部署投票合约 ===')
    print(f'选举标题: {title}')
    print(f'开始时间: {datetime.fromtimestamp(start_time)}')
    print(f'结束时间: {datetime.fromtimestamp(end_time)}')
    voting_addr = deployer.deploy_contract(
        'Voting.sol',
        registry_addr,
        title,
        description,
        start_time,
        end_time
    )

    # 4. 设置 VoterRegistry 的授权投票合约地址
    print('\n=== 配置合约权限 ===')
    deployer.call_contract_function('VoterRegistry', 'setVotingContract', voting_addr)
    print(f'VoterRegistry 已授权 Voting 合约')

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
    parser.add_argument(
        '--title',
        default='区块链电子投票',
        help='选举标题'
    )
    parser.add_argument(
        '--description',
        default='基于以太坊的安全电子投票系统',
        help='选举描述'
    )
    parser.add_argument(
        '--duration',
        type=int,
        default=24,
        help='选举持续时间（小时）'
    )

    args = parser.parse_args()

    # 设置 RPC URL
    if args.rpc:
        rpc_url = args.rpc
    else:
        # 默认使用环境变量中的 Infura 项目 ID
        infura_id = os.getenv('INFURA_PROJECT_ID', '')
        rpc_url = f'https://{args.network}.infura.io/v3/{infura_id}'

    deploy_all(
        rpc_url,
        args.key,
        title=args.title,
        description=args.description,
        duration_hours=args.duration
    )
