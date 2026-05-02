const API_BASE = '/api/auth';

function showError(msg) {
    const alert = document.getElementById('errorAlert');
    if (alert) {
        alert.textContent = msg;
        alert.style.display = 'block';
    } else {
        alert(msg);
    }
}

// Handle Login
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            const res = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            
            if (data.success) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                window.location.href = '/dashboard.html';
            } else {
                showError(data.error);
            }
        } catch (err) {
            showError('An error occurred while connecting to the server.');
        }
    });
}

// Handle Register
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            const res = await fetch(`${API_BASE}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            const data = await res.json();
            
            if (data.success) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                window.location.href = '/dashboard.html';
            } else {
                showError(data.error);
            }
        } catch (err) {
            showError('An error occurred while connecting to the server.');
        }
    });
}

// Auth Guard for protected pages
function requireAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
    }
}

// Auth Check for public pages (redirect away from login if already logged in)
function redirectIfAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        window.location.href = '/dashboard.html';
    }
}

// Logout
function logout() {
    const token = localStorage.getItem('token');
    if(token) {
        fetch(`${API_BASE}/logout`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

// Initial checks based on pathname
const path = window.location.pathname;
if (path === '/' || path === '/login.html' || path === '/register.html') {
    redirectIfAuth();
} else if (path === '/dashboard.html' || path.startsWith('/result')) {
    requireAuth();
}
