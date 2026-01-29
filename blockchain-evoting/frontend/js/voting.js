/**
 * 投票模块
 * Voting Module
 */

let selectedCandidate = null;

// 模拟候选人数据
const candidates = [
    { id: 0, name: '候选人 A' },
    { id: 1, name: '候选人 B' },
    { id: 2, name: '候选人 C' }
];

// 页面加载时渲染候选人
document.addEventListener('DOMContentLoaded', () => {
    renderCandidates();
});

/**
 * 渲染候选人列表
 */
function renderCandidates() {
    const container = document.getElementById('candidates');
    container.innerHTML = candidates.map(c => `
        <div class="candidate" data-id="${c.id}">
            ${c.name}
        </div>
    `).join('');

    // 绑定点击事件
    container.querySelectorAll('.candidate').forEach(el => {
        el.addEventListener('click', () => selectCandidate(el));
    });
}

/**
 * 选择候选人
 */
function selectCandidate(el) {
    document.querySelectorAll('.candidate').forEach(c => {
        c.classList.remove('selected');
    });
    el.classList.add('selected');
    selectedCandidate = parseInt(el.dataset.id);
    document.getElementById('voteBtn').disabled = false;
}

// 钱包连接按钮
document.getElementById('connectBtn').addEventListener('click', async () => {
    try {
        const account = await connectWallet();
        document.getElementById('walletStatus').textContent =
            '已连接: ' + account.slice(0, 6) + '...' + account.slice(-4);
    } catch (err) {
        document.getElementById('walletStatus').textContent = err.message;
    }
});

// 投票按钮
document.getElementById('voteBtn').addEventListener('click', async () => {
    if (selectedCandidate === null) return;

    const status = document.getElementById('status');
    status.className = 'status';
    status.textContent = '正在提交投票...';

    try {
        const res = await fetch(API_BASE + '/vote/commitment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vote: selectedCandidate })
        });
        const data = await res.json();

        status.className = 'status success';
        status.innerHTML = '投票成功！请保存凭证用于验证';
    } catch (err) {
        status.className = 'status error';
        status.textContent = '投票失败';
    }
});
