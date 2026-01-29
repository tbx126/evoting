/**
 * 认证模块
 * Authentication Module
 */

const API_BASE = 'http://localhost:8000';

/**
 * 显示状态消息
 */
function showStatus(msg, isError = false) {
    const el = document.getElementById('status');
    el.className = 'status ' + (isError ? 'error' : 'success');
    el.textContent = msg;
}

// 登录表单处理
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const res = await fetch(API_BASE + '/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('token', data.access_token);
                showStatus('登录成功');
                setTimeout(() => location.href = 'vote.html', 1000);
            } else {
                showStatus(data.detail || '登录失败', true);
            }
        } catch (err) {
            showStatus('网络错误', true);
        }
    });
}

// 注册表单处理
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const res = await fetch(API_BASE + '/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            const data = await res.json();

            if (res.ok) {
                showStatus('注册成功');
                setTimeout(() => location.href = 'index.html', 1000);
            } else {
                showStatus(data.detail || '注册失败', true);
            }
        } catch (err) {
            showStatus('网络错误', true);
        }
    });
}
