// ====== DATABASE ======
class Database {
    constructor() {
        this.users = this.loadFromStorage('users') || {};
        this.messages = this.loadFromStorage('messages') || {};
        this.inviteCodes = this.loadFromStorage('inviteCodes') || this.initializeInviteCodes();
    }

    initializeInviteCodes() {
        const codes = {};
        const validCodes = ['BETA001', 'BETA002', 'BETA003', 'HERO001', 'HERO002', 'TEST001'];
        validCodes.forEach(code => {
            codes[code] = { used: false, usedBy: null };
        });
        this.saveToStorage('inviteCodes', codes);
        return codes;
    }

    loadFromStorage(key) {
        try {
            return JSON.parse(localStorage.getItem(key));
        } catch (e) {
            return null;
        }
    }

    saveToStorage(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    createUser(name, password, inviteCode, referralCode = null) {
        if (this.users[name]) {
            throw new Error('Пользователь с таким именем уже существует');
        }

        if (!this.inviteCodes[inviteCode] || this.inviteCodes[inviteCode].used) {
            throw new Error('Инвайт-код недействителен или уже использован');
        }

        const subscriptionExpiry = new Date();
        subscriptionExpiry.setDate(subscriptionExpiry.getDate() + 30);

        this.users[name] = {
            password: this.hashPassword(password),
            joinDate: new Date().toLocaleDateString('ru-RU'),
            subscriptionExpiry: subscriptionExpiry.toLocaleDateString('ru-RU'),
            referralCode: this.generateReferralCode(),
            referredBy: referralCode,
            referredCount: 0,
            messagesCount: 0,
            lastLogin: new Date().toLocaleString('ru-RU'),
            friends: [],
            status: 'active'
        };

        this.inviteCodes[inviteCode].used = true;
        this.inviteCodes[inviteCode].usedBy = name;
        this.messages[name] = {};

        this.saveToStorage('users', this.users);
        this.saveToStorage('inviteCodes', this.inviteCodes);

        return this.users[name];
    }

    authenticateUser(name, password) {
        const user = this.users[name];
        if (!user) {
            throw new Error('Пользователь не найден');
        }

        if (!this.verifyPassword(password, user.password)) {
            throw new Error('Неправильный пароль');
        }

        user.lastLogin = new Date().toLocaleString('ru-RU');
        this.saveToStorage('users', this.users);

        return user;
    }

    getUser(name) {
        return this.users[name];
    }

    hashPassword(password) {
        return btoa(password);
    }

    verifyPassword(password, hash) {
        return btoa(password) === hash;
    }

    generateReferralCode() {
        return 'REF' + Math.random().toString(36).substr(2, 9).toUpperCase();
    }

    addMessage(from, to, text) {
        if (!this.messages[from]) {
            this.messages[from] = {};
        }

        if (!this.messages[from][to]) {
            this.messages[from][to] = [];
        }

        this.messages[from][to].push({
            text: text,
            timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            from: from
        });

        if (!this.messages[to]) {
            this.messages[to] = {};
        }
        if (!this.messages[to][from]) {
            this.messages[to][from] = [];
        }
        this.messages[to][from].push({
            text: text,
            timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            from: from
        });

        this.users[from].messagesCount = (this.users[from].messagesCount || 0) + 1;
        this.saveToStorage('users', this.users);
        this.saveToStorage('messages', this.messages);
    }

    getMessages(user1, user2) {
        if (!this.messages[user1] || !this.messages[user1][user2]) {
            return [];
        }
        return this.messages[user1][user2];
    }

    getChats(username) {
        if (!this.messages[username]) {
            return [];
        }
        return Object.keys(this.messages[username]);
    }

    getAllUsers() {
        return Object.keys(this.users);
    }
}

const db = new Database();

// ====== STATE MANAGEMENT ======
let currentUser = null;
let selectedChat = null;

// ====== UI FUNCTIONS ======
function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

function showHome() {
    showPage('homePage');
}

function showRegister() {
    showPage('registerPage');
    document.getElementById('registerForm').reset();
    clearErrors();
}

function showLogin() {
    showPage('loginPage');
    document.getElementById('loginForm').reset();
    clearErrors();
}

function showProfile() {
    if (!currentUser) {
        showLogin();
        return;
    }
    showPage('profilePage');
    updateProfilePage();
}

function showChats() {
    if (!currentUser) {
        showLogin();
        return;
    }
    showPage('chatsPage');
    updateChatsList();
}

function clearErrors() {
    const errors = document.querySelectorAll('.error-message');
    errors.forEach(error => {
        error.classList.remove('show');
        error.textContent = '';
    });
}

// ====== VALIDATION ======
function validatePassword(password) {
    return password.length >= 6;
}

function validateName(name) {
    return name.length >= 2 && name.length <= 20 && /^[a-zA-Z0-9_]+$/.test(name);
}

// ====== REGISTER ======
function handleRegister(event) {
    event.preventDefault();
    clearErrors();

    const name = document.getElementById('regName').value.trim();
    const inviteCode = document.getElementById('inviteCode').value.trim().toUpperCase();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const referralCode = document.getElementById('referralCode').value.trim() || null;

    let hasError = false;

    // Validate name
    if (!validateName(name)) {
        showError('regNameError', 'Имя должно содержать 2-20 символов (буквы, цифры, _)');
        hasError = true;
    }

    // Validate invite code
    if (!inviteCode) {
        showError('inviteCodeError', 'Инвайт-код обязателен');
        hasError = true;
    }

    // Validate password
    if (!validatePassword(password)) {
        showError('regPasswordError', 'Пароль должен содержать минимум 6 символов');
        hasError = true;
    }

    // Validate confirm password
    if (password !== confirmPassword) {
        showError('confirmPasswordError', 'Пароли не совпадают');
        hasError = true;
    }

    if (hasError) return;

    try {
        db.createUser(name, password, inviteCode, referralCode);
        currentUser = name;
        updateNavigation();
        showHome();
        alert('Аккаунт успешно создан!');
    } catch (error) {
        if (error.message.includes('имя')) {
            showError('regNameError', error.message);
        } else if (error.message.includes('код')) {
            showError('inviteCodeError', error.message);
        } else {
            alert(error.message);
        }
    }
}

// ====== LOGIN ======
function handleLogin(event) {
    event.preventDefault();
    clearErrors();

    const name = document.getElementById('loginName').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!name || !password) {
        alert('Заполните все поля');
        return;
    }

    try {
        db.authenticateUser(name, password);
        currentUser = name;
        updateNavigation();
        showHome();
        alert('Вы успешно вошли!');
    } catch (error) {
        if (error.message.includes('не найден')) {
            showError('loginNameError', error.message);
        } else {
            showError('loginPasswordError', error.message);
        }
    }
}

function showError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
    }
}

// ====== LOGOUT ======
function logout() {
    currentUser = null;
    updateNavigation();
    showHome();
}

// ====== NAVIGATION ======
function updateNavigation() {
    const profileNav = document.getElementById('profileNavItem');
    const chatsNav = document.getElementById('chatsNavItem');
    const logoutNav = document.getElementById('logoutNavItem');
    const loginNav = document.getElementById('loginNavItem');
    const registerNav = document.getElementById('registerNavItem');

    if (currentUser) {
        profileNav.style.display = 'li';
        chatsNav.style.display = 'li';
        logoutNav.style.display = 'li';
        loginNav.style.display = 'none';
        registerNav.style.display = 'none';
    } else {
        profileNav.style.display = 'none';
        chatsNav.style.display = 'none';
        logoutNav.style.display = 'none';
        loginNav.style.display = 'li';
        registerNav.style.display = 'li';
    }
}

// ====== PROFILE PAGE ======
function updateProfilePage() {
    if (!currentUser) return;

    const user = db.getUser(currentUser);
    if (!user) return;

    // Avatar letter
    document.getElementById('avatarLetter').textContent = currentUser.charAt(0).toUpperCase();

    // Profile header
    document.getElementById('profileName').textContent = currentUser;

    // Info
    document.getElementById('infoName').textContent = currentUser;
    document.getElementById('infoJoinDate').textContent = user.joinDate;

    // Subscription
    document.getElementById('subscriptionExpiry').textContent = user.subscriptionExpiry;
    
    const expiryDate = new Date(user.subscriptionExpiry.split('.').reverse().join('-'));
    const today = new Date();
    const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
    document.getElementById('daysLeft').textContent = Math.max(daysLeft, 0) + ' дней';

    // Statistics
    document.getElementById('messagesCount').textContent = user.messagesCount || 0;
    document.getElementById('friendsCount').textContent = user.friends?.length || 0;
    document.getElementById('lastLogin').textContent = user.lastLogin;

    // Referral
    document.getElementById('referralCodeValue').textContent = user.referralCode;
    document.getElementById('referredCount').textContent = user.referredCount || 0;
}

// ====== CHATS PAGE ======
function updateChatsList() {
    if (!currentUser) return;

    const chatList = document.getElementById('chatList');
    chatList.innerHTML = '';

    const chats = db.getChats(currentUser);
    const allUsers = db.getAllUsers();
    
    // Show existing chats first
    if (chats.length > 0) {
        chats.forEach(username => {
            if (username !== currentUser) {
                addChatItemToList(username);
            }
        });
    }

    // Add all other users if no chats yet
    if (chats.length === 0) {
        allUsers.forEach(username => {
            if (username !== currentUser) {
                addChatItemToList(username);
            }
        });
    }

    if (chats.length === 0 && allUsers.length === 1) {
        chatList.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Нет доступных пользователей</div>';
    }
}

function addChatItemToList(username) {
    const chatList = document.getElementById('chatList');
    const messages = db.getMessages(currentUser, username);
    const lastMessage = messages.length > 0 ? messages[messages.length - 1].text : 'Нет сообщений';

    const chatItem = document.createElement('div');
    chatItem.className = 'chat-item';
    if (selectedChat === username) chatItem.classList.add('active');

    chatItem.innerHTML = `
        <div class="chat-avatar">${username.charAt(0).toUpperCase()}</div>
        <div class="chat-item-info">
            <div class="chat-item-name">${username}</div>
            <div class="chat-item-preview">${lastMessage.substring(0, 30)}${lastMessage.length > 30 ? '...' : ''}</div>
        </div>
    `;

    chatItem.onclick = () => selectChat(username);
    chatList.appendChild(chatItem);
}

function selectChat(username) {
    selectedChat = username;
    document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
    event.currentTarget.classList.add('active');

    // Update chat header
    document.getElementById('chatTitle').textContent = username;
    document.getElementById('chatStatus').textContent = 'Online';

    // Show messages
    displayMessages(username);

    // Show input
    document.getElementById('chatInputBox').style.display = 'flex';
}

function displayMessages(username) {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = '';

    const messages = db.getMessages(currentUser, username);

    if (messages.length === 0) {
        messagesContainer.innerHTML = '<div class="empty-state">Нет сообщений. Начните разговор!</div>';
        return;
    }

    messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message' + (msg.from === currentUser ? ' own' : '');
        messageDiv.innerHTML = `
            <div class="message-avatar">${msg.from.charAt(0).toUpperCase()}</div>
            <div class="message-content">
                <div class="message-text">${escapeHtml(msg.text)}</div>
                <div class="message-time">${msg.timestamp}</div>
            </div>
        `;
        messagesContainer.appendChild(messageDiv);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendMessage() {
    if (!selectedChat) return;

    const input = document.getElementById('messageInput');
    const text = input.value.trim();

    if (!text) return;

    db.addMessage(currentUser, selectedChat, text);
    input.value = '';

    displayMessages(selectedChat);
}

function handleMessageKeypress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function searchPlayers() {
    const searchTerm = document.getElementById('playerSearch').value.toLowerCase().trim();
    const chatList = document.getElementById('chatList');
    chatList.innerHTML = '';

    if (!searchTerm) {
        updateChatsList();
        return;
    }

    const allUsers = db.getAllUsers();
    const filtered = allUsers.filter(username => 
        username !== currentUser && username.toLowerCase().includes(searchTerm)
    );

    if (filtered.length === 0) {
        chatList.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Игроков не найдено</div>';
        return;
    }

    filtered.forEach(username => {
        addChatItemToList(username);
    });
}

// ====== INITIALIZE ======
document.addEventListener('DOMContentLoaded', function() {
    updateNavigation();
    showHome();

    // Add demo users for testing
    if (Object.keys(db.users).length === 0) {
        db.createUser('Player1', 'password123', 'BETA001');
        db.createUser('Player2', 'password123', 'BETA002');
        db.createUser('Player3', 'password123', 'BETA003');
    }
});
