/**
 * Web3 工具模块
 * Web3 Utilities Module
 *
 * 功能说明：
 * - MetaMask 钱包连接
 * - 以太坊网络交互
 */

// API 基础地址
const API_BASE = 'http://localhost:8000';

// 全局状态
let web3 = null;
let userAccount = null;

/**
 * 连接 MetaMask 钱包
 */
async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        throw new Error('请安装 MetaMask');
    }

    const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
    });

    userAccount = accounts[0];
    return userAccount;
}

/**
 * 获取当前账户
 */
function getAccount() {
    return userAccount;
}

/**
 * 发送 API 请求
 */
async function apiRequest(endpoint, options = {}) {
    const response = await fetch(API_BASE + endpoint, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    return response.json();
}
