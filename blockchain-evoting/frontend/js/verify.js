/**
 * 验证模块
 * Verification Module
 */

const API_BASE = 'http://localhost:8000';

// 验证表单处理
document.getElementById('verifyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const commitment = document.getElementById('commitment').value;
    const salt = document.getElementById('salt').value;
    const status = document.getElementById('status');

    status.className = 'status';
    status.textContent = '验证中...';

    try {
        const res = await fetch(API_BASE + '/verify/commitment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vote: 0, salt, commitment })
        });
        const data = await res.json();

        if (data.valid) {
            status.className = 'status success';
            status.textContent = '验证通过！您的投票已被正确记录';
        } else {
            status.className = 'status error';
            status.textContent = '验证失败：凭证不匹配';
        }
    } catch (err) {
        status.className = 'status error';
        status.textContent = '验证失败';
    }
});
