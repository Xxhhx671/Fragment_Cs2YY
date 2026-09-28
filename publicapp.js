let currentUser = null;
let currentChatPartner = null;
let ws = null;

function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabName).classList.add('active');
}

async function register() {
    const data = {
        name: document.getElementById('reg-name').value,
        inviteCode: document.getElementById('reg-invite').value,
        password: document.getElementById('reg-pass').value,
        confirmPassword: document.getElementById('reg-confirm-pass').value,
        referral: document.getElementById('reg-ref').value
    };

    const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const result = await res.json();

    if (result.success) {
        alert('Регистрация успешна! Теперь войдите в аккаунт.');
        showTab('login');
    } else {
        alert('Ошибка: ' + result.error);
    }
}

async function login() {
    const data = {
        name: document.getElementById('login-name').value,
        password: document.getElementById('login-pass').value
    };

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const result = await res.json();

    if (result.success) {
        currentUser = result.user;
        setupUserSession();
        showTab('profile');
    } else {
        alert('Ошибка: ' + result.error);
    }
}

function setupUserSession() {
    document.getElementById('nav-login').style.display = 'none';
    document.getElementById('nav-register').style.display = 'none';
    document.getElementById('nav-profile').style.display = 'inline-block';
    document.getElementById('nav-chat').style.display = 'inline-block';
    document.getElementById('nav-logout').style.display = 'inline-block';

    document.getElementById('prof-name').innerText = currentUser.name;
    document.getElementById('prof-sub').innerText = currentUser.sub_expires;
    document.getElementById('prof-ref').innerText = currentUser.referral;

    // Подключение к чат-серверу
    ws = new WebSocket(`ws://${location.host}`);
    ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', username: currentUser.name }));
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'message' && currentChatPartner && 
           (msg.sender === currentChatPartner || msg.sender === currentUser.name)) {
            appendMessage(msg.sender, msg.text);
        }
    };
}

function logout() {
    location.reload();
}

async function startChat() {
    const target = document.getElementById('target-user').value.trim();
    if (!target) return alert('Введите имя игрока!');
    if (target === currentUser.name) return alert('Нельзя писать самому себе!');

    currentChatPartner = target;
    document.getElementById('chat-with-title').innerText = `Чат с игроком: ${target}`;
    document.getElementById('messages-list').innerHTML = '';

    // Загрузка истории сообщений
    const res = await fetch(`/api/messages?user1=${currentUser.name}&user2=${target}`);
    const messages = await res.json();
    messages.forEach(m => appendMessage(m.sender, m.text));
}

function sendMessage() {
    const input = document.getElementById('msg-text');
    const text = input.value.trim();
    if (!text || !currentChatPartner) return;

    ws.send(JSON.stringify({
        type: 'private_message',
        sender: currentUser.name,
        receiver: currentChatPartner,
        text: text
    }));

    input.value = '';
}

function appendMessage(sender, text) {
    const list = document.getElementById('messages-list');
    const div = document.createElement('div');
    div.className = `message ${sender === currentUser.name ? 'sent' : 'received'}`;
    div.innerText = `${sender}: ${text}`;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
}
