class ChatApplication {
  constructor() {
    this.currentUser = null;
    this.currentRoom = null;
    this.token = null;
    this.rooms = new Map();
    this.onlineUsers = new Map();
    this.typingUsers = new Set();
    this.notifications = [];
    this.lastActivity = Date.now();

    // Settings
    this.settings = {
      theme: 'light',
      notifications: true,
      soundEnabled: true,
    };

    this.init();
  }

  init() {
    this.loadSettings();
    this.setupEventListeners();
    this.showAuthModal();
    this.setupKeyboardShortcuts();
    this.startActivityTracking();
  }

  loadSettings() {
    const saved = localStorage.getItem('chat-settings');
    if (saved) {
      this.settings = { ...this.settings, ...JSON.parse(saved) };
      this.applyTheme();
    }
  }

  saveSettings() {
    localStorage.setItem('chat-settings', JSON.stringify(this.settings));
  }

  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.settings.theme);
  }

  setupEventListeners() {
    // Authentication
    document
      .getElementById('login-form-element')
      .addEventListener('submit', this.handleLogin.bind(this));
    document
      .getElementById('guest-login-btn')
      .addEventListener('click', this.handleGuestLogin.bind(this));

    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach((tab) => {
      tab.addEventListener('click', this.switchAuthTab.bind(this));
    });

    // Message input
    const messageInput = document.getElementById('message-input');
    messageInput.addEventListener('input', this.handleMessageInput.bind(this));
    messageInput.addEventListener(
      'keydown',
      this.handleMessageKeydown.bind(this)
    );

    // Send button
    document
      .getElementById('send-btn')
      .addEventListener('click', this.sendMessage.bind(this));

    // File upload
    document
      .getElementById('file-upload-btn')
      .addEventListener('click', this.openFileUpload.bind(this));
    document
      .getElementById('file-input')
      .addEventListener('change', this.handleFileUpload.bind(this));

    // Room management
    document
      .getElementById('create-room-btn')
      .addEventListener('click', this.showCreateRoomModal.bind(this));
    document
      .getElementById('create-room-form')
      .addEventListener('submit', this.handleCreateRoom.bind(this));
    document
      .getElementById('room-private')
      .addEventListener('change', this.togglePasswordField.bind(this));

    // Settings
    document
      .getElementById('settings-btn')
      .addEventListener('click', this.showSettingsModal.bind(this));
    document
      .getElementById('save-settings-btn')
      .addEventListener('click', this.saveUserSettings.bind(this));
    document
      .getElementById('dark-theme')
      .addEventListener('change', this.toggleTheme.bind(this));

    // Other buttons
    document
      .getElementById('logout-btn')
      .addEventListener('click', this.logout.bind(this));
    document
      .getElementById('room-info-btn')
      .addEventListener('click', this.showRoomInfo.bind(this));
    document
      .getElementById('toggle-sidebar-btn')
      .addEventListener('click', this.toggleSidebar.bind(this));

    // Modal handling
    document.querySelectorAll('.modal-close, [data-modal]').forEach((btn) => {
      btn.addEventListener('click', this.handleModalClose.bind(this));
    });

    // Context menu
    document.addEventListener('contextmenu', this.handleContextMenu.bind(this));
    document.addEventListener('click', this.hideContextMenu.bind(this));

    // Drag and drop for files
    this.setupDragAndDrop();

    // Resize handling
    window.addEventListener('resize', this.handleResize.bind(this));

    // Prevent accidental page leave
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Enter to send message
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.sendMessage();
      }

      // Escape to close modals
      if (e.key === 'Escape') {
        this.hideAllModals();
        this.hideContextMenu();
      }

      // Ctrl/Cmd + K for quick room search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        // Implement room search functionality
      }
    });
  }

  startActivityTracking() {
    // Track user activity for auto-logout
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
    ];
    events.forEach((event) => {
      document.addEventListener(
        event,
        () => {
          this.lastActivity = Date.now();
        },
        { passive: true }
      );
    });

    // Check activity every minute
    setInterval(() => {
      const inactiveTime = Date.now() - this.lastActivity;
      const maxInactiveTime = 30 * 60 * 1000; // 30 minutes

      if (inactiveTime > maxInactiveTime && this.currentUser) {
        this.showNotification(
          'You have been logged out due to inactivity',
          'warning'
        );
        this.logout();
      }
    }, 60000);
  }

  setupDragAndDrop() {
    const messagesContainer = document.getElementById('messages-container');

    messagesContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      messagesContainer.classList.add('drag-over');
    });

    messagesContainer.addEventListener('dragleave', (e) => {
      if (!messagesContainer.contains(e.relatedTarget)) {
        messagesContainer.classList.remove('drag-over');
      }
    });

    messagesContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      messagesContainer.classList.remove('drag-over');

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        this.uploadFile(files[0]);
      }
    });
  }

  // Authentication Methods
  async handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const username = formData.get('username').trim();
    const password = formData.get('password');

    if (!username) {
      this.showAuthError('Username is required');
      return;
    }

    this.showLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        this.token = data.token;
        this.currentUser = data.user;
        localStorage.setItem('chat-token', this.token);
        this.hideAuthModal();
        this.initializeChat();
      } else {
        this.showAuthError(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      this.showAuthError('Connection error. Please try again.');
    } finally {
      this.showLoading(false);
    }
  }

  async handleGuestLogin() {
    this.showLoading(true);

    try {
      const response = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (data.success) {
        this.token = data.token;
        this.currentUser = data.user;
        localStorage.setItem('chat-token', this.token);
        this.hideAuthModal();
        this.initializeChat();
      } else {
        this.showAuthError(data.message || 'Failed to create guest account');
      }
    } catch (error) {
      console.error('Guest login error:', error);
      this.showAuthError('Connection error. Please try again.');
    } finally {
      this.showLoading(false);
    }
  }

  switchAuthTab(e) {
    const tab = e.target.dataset.tab;

    // Update tab buttons
    document
      .querySelectorAll('.auth-tab')
      .forEach((t) => t.classList.remove('active'));
    e.target.classList.add('active');

    // Update forms
    document
      .querySelectorAll('.auth-form')
      .forEach((f) => f.classList.remove('active'));
    document.getElementById(`${tab}-form`).classList.add('active');
  }

  showAuthError(message) {
    const errorDiv = document.getElementById('auth-error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }

  showAuthModal() {
    document.getElementById('auth-modal').classList.add('active');
  }

  hideAuthModal() {
    document.getElementById('auth-modal').classList.remove('active');
  }

  async initializeChat() {
    this.showLoading(true, 'Initializing chat...');

    try {
      // Initialize socket connection
      if (window.socketClient) {
        await window.socketClient.connect(this.token);
      }

      // Update UI with user info
      this.updateUserInfo();

      // Load initial data
      await Promise.all([this.loadRooms(), this.loadOnlineUsers()]);

      // Show chat app
      document.getElementById('chat-app').style.display = 'flex';

      this.showNotification(
        `Welcome, ${this.currentUser.username}!`,
        'success'
      );
    } catch (error) {
      console.error('Chat initialization error:', error);
      this.showNotification('Failed to initialize chat', 'error');
      this.logout();
    } finally {
      this.showLoading(false);
    }
  }

  updateUserInfo() {
    const avatar = document.getElementById('user-avatar');
    const username = document.getElementById('current-username');

    avatar.textContent = this.currentUser.username.charAt(0).toUpperCase();
    username.textContent = this.currentUser.username;

    // Update settings form
    document.getElementById('settings-username').value =
      this.currentUser.username;
    document.getElementById('settings-email').value =
      this.currentUser.email || '';
  }

  // Room Management
  async loadRooms() {
    try {
      const response = await fetch('/api/rooms', {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      const data = await response.json();

      if (data.success) {
        this.rooms.clear();
        data.rooms.forEach((room) => {
          this.rooms.set(room.id, room);
        });
        this.renderRooms();

        // Auto-join general room
        if (this.rooms.has('general')) {
          this.joinRoom('general');
        }
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
    }
  }

  renderRooms() {
    const roomList = document.getElementById('room-list');
    roomList.innerHTML = '';

    this.rooms.forEach((room) => {
      const roomElement = document.createElement('div');
      roomElement.className = 'room-item';
      roomElement.dataset.roomId = room.id;

      roomElement.innerHTML = `
                <div class="room-icon">${room.isPrivate ? '🔒' : '#'}</div>
                <div class="room-info">
                    <div class="room-name">${room.name}</div>
                    <div class="room-stats">${
                      room.currentUsers || 0
                    } users</div>
                </div>
            `;

      roomElement.addEventListener('click', () => this.joinRoom(room.id));
      roomList.appendChild(roomElement);
    });
  }

  async joinRoom(roomId, password = null) {
    if (this.currentRoom === roomId) return;

    try {
      const room = this.rooms.get(roomId);
      if (!room) return;

      // Handle private rooms
      if (room.isPrivate && !password) {
        password = prompt(`Enter password for "${room.name}":`);
        if (!password) return;
      }

      // Update UI immediately
      this.updateCurrentRoom(room);

      // Join via socket
      if (window.socketClient) {
        window.socketClient.joinRoom(roomId, password);
      }
    } catch (error) {
      console.error('Error joining room:', error);
      this.showNotification('Failed to join room', 'error');
    }
  }

  updateCurrentRoom(room) {
    // Update current room reference
    this.currentRoom = room.id;

    // Update header
    document.getElementById('current-room-name').textContent = room.name;
    document.getElementById('room-users-count').textContent = `${
      room.currentUsers || 0
    } users`;

    // Update room selection in sidebar
    document.querySelectorAll('.room-item').forEach((item) => {
      item.classList.remove('active');
      if (item.dataset.roomId === room.id) {
        item.classList.add('active');
      }
    });

    // Clear messages
    this.clearMessages();

    // Hide welcome message
    document.querySelector('.welcome-message')?.remove();
  }

  showCreateRoomModal() {
    document.getElementById('create-room-modal').classList.add('active');
  }

  async handleCreateRoom(e) {
    e.preventDefault();
    const formData = new FormData(e.target);

    const roomData = {
      name: formData.get('name').trim(),
      description: formData.get('description').trim(),
      isPrivate: formData.get('isPrivate') === 'on',
      password: formData.get('password'),
    };

    if (!roomData.name) {
      this.showNotification('Room name is required', 'error');
      return;
    }

    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(roomData),
      });

      const data = await response.json();

      if (data.success) {
        this.hideModal('create-room-modal');
        this.showNotification('Room created successfully!', 'success');

        // Add to rooms list
        this.rooms.set(data.room.id, data.room);
        this.renderRooms();

        // Join the new room
        this.joinRoom(data.room.id);

        // Reset form
        e.target.reset();
        this.togglePasswordField({ target: { checked: false } });
      } else {
        this.showNotification(data.message || 'Failed to create room', 'error');
      }
    } catch (error) {
      console.error('Error creating room:', error);
      this.showNotification('Failed to create room', 'error');
    }
  }

  togglePasswordField(e) {
    const passwordGroup = document.getElementById('password-group');
    if (e.target.checked) {
      passwordGroup.style.display = 'block';
      document.getElementById('room-password').required = true;
    } else {
      passwordGroup.style.display = 'none';
      document.getElementById('room-password').required = false;
    }
  }

  // Message Handling
  handleMessageInput(e) {
    const input = e.target;
    const charCount = document.getElementById('char-count');
    const sendBtn = document.getElementById('send-btn');

    // Update character count
    const length = input.value.length;
    const maxLength = 500;
    charCount.textContent = `${length}/${maxLength}`;

    // Update character count styling
    charCount.classList.remove('warning', 'error');
    if (length > maxLength * 0.8) {
      charCount.classList.add('warning');
    }
    if (length >= maxLength) {
      charCount.classList.add('error');
    }

    // Enable/disable send button
    sendBtn.disabled = !input.value.trim() || length > maxLength;

    // Auto-resize textarea
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';

    // Send typing indicator
    if (input.value.trim() && window.socketClient) {
      window.socketClient.sendTypingStart(this.currentRoom);
    } else if (window.socketClient) {
      window.socketClient.sendTypingStop(this.currentRoom);
    }
  }

  handleMessageKeydown(e) {
    // Send message on Enter (but not Shift+Enter)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();

    if (!content || !this.currentRoom) return;

    if (window.socketClient) {
      window.socketClient.sendMessage(this.currentRoom, content);
    }

    // Clear input
    input.value = '';
    input.style.height = 'auto';
    document.getElementById('char-count').textContent = '0/500';
    document.getElementById('send-btn').disabled = true;

    // Stop typing indicator
    if (window.socketClient) {
      window.socketClient.sendTypingStop(this.currentRoom);
    }
  }

  // Message Display
  addMessage(message) {
    const messagesList = document.getElementById('messages-list');

    // Remove welcome message if present
    const welcomeMsg = messagesList.querySelector('.welcome-message');
    if (welcomeMsg) {
      welcomeMsg.remove();
    }

    const messageElement = this.createMessageElement(message);
    messagesList.appendChild(messageElement);

    // Scroll to bottom
    this.scrollToBottom();

    // Play sound if enabled and not own message
    if (this.settings.soundEnabled && message.userId !== this.currentUser.id) {
      this.playNotificationSound();
    }

    // Show browser notification for private messages
    if (message.isPrivate && this.settings.notifications) {
      this.showBrowserNotification(
        `Private message from ${message.senderUsername}`,
        message.content
      );
    }
  }

  createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.dataset.messageId = message.id;

    const isOwnMessage = message.userId === this.currentUser.id;
    const isSystemMessage = message.type === 'system';
    const isPrivateMessage = message.isPrivate;

    if (isOwnMessage) messageDiv.classList.add('own');
    if (isSystemMessage) messageDiv.classList.add('system');
    if (isPrivateMessage) messageDiv.classList.add('private');

    if (isSystemMessage) {
      messageDiv.innerHTML = `
                <div class="message-content">
                    <div class="message-text">${this.formatMessageContent(
                      message.content
                    )}</div>
                </div>
            `;
    } else {
      const timestamp = new Date(
        message.timestamp || message.createdAt
      ).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const username = message.username || message.senderUsername;
      const avatar = username.charAt(0).toUpperCase();

      messageDiv.innerHTML = `
                <div class="message-avatar">${avatar}</div>
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-username">${username}</span>
                        <span class="message-timestamp">${timestamp}</span>
                        ${
                          isPrivateMessage
                            ? '<span class="private-indicator">🔒 Private</span>'
                            : ''
                        }
                    </div>
                    <div class="message-text">${this.formatMessageContent(
                      message.content
                    )}</div>
                </div>
            `;
    }

    // Add context menu for non-system messages
    if (!isSystemMessage) {
      messageDiv.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showContextMenu(e, message);
      });
    }

    // Add click handler for usernames to send private messages
    const usernameEl = messageDiv.querySelector('.message-username');
    if (usernameEl && !isOwnMessage) {
      usernameEl.style.cursor = 'pointer';
      usernameEl.addEventListener('click', () => {
        this.startPrivateMessage(message.userId, username);
      });
    }

    return messageDiv;
  }

  formatMessageContent(content) {
    // Simple text formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
      .replace(/`(.*?)`/g, '<code>$1</code>') // Code
      .replace(/\n/g, '<br>'); // Line breaks
  }

  clearMessages() {
    const messagesList = document.getElementById('messages-list');
    messagesList.innerHTML = '';
  }

  scrollToBottom() {
    const messagesContainer = document.getElementById('messages-container');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Typing Indicators
  updateTypingIndicators(users) {
    const container = document.getElementById('typing-indicators');
    container.innerHTML = '';

    if (users.length === 0) return;

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';

    const userText =
      users.length === 1
        ? `${users[0]} is typing`
        : users.length === 2
        ? `${users[0]} and ${users[1]} are typing`
        : `${users[0]} and ${users.length - 1} others are typing`;

    indicator.innerHTML = `
            <span>${userText}</span>
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;

    container.appendChild(indicator);
  }

  // File Handling
  openFileUpload() {
    document.getElementById('file-input').click();
  }

  handleFileUpload(e) {
    const file = e.target.files[0];
    if (file) {
      this.uploadFile(file);
    }
  }

  async uploadFile(file) {
    if (!this.currentRoom) {
      this.showNotification('Please join a room first', 'warning');
      return;
    }

    // Validate file
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'text/plain'];

    if (file.size > maxSize) {
      this.showNotification('File size must be less than 5MB', 'error');
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      this.showNotification('File type not supported', 'error');
      return;
    }

    // Show upload progress
    this.showUploadProgress(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('roomId', this.currentRoom);

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        // Send file message via socket
        const fileMessage = `📎 Shared: ${file.name}\n${data.file.url}`;
        if (window.socketClient) {
          window.socketClient.sendMessage(
            this.currentRoom,
            fileMessage,
            'file'
          );
        }

        this.showNotification('File uploaded successfully!', 'success');
      } else {
        this.showNotification(data.message || 'Upload failed', 'error');
      }
    } catch (error) {
      console.error('Upload error:', error);
      this.showNotification('Upload failed', 'error');
    } finally {
      this.showUploadProgress(false);
    }
  }

  showUploadProgress(show) {
    const progressDiv = document.getElementById('upload-progress');
    if (show) {
      progressDiv.style.display = 'block';
      // Simulate progress animation
      const fill = document.getElementById('upload-progress-fill');
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        fill.style.width = `${progress}%`;
      }, 100);

      progressDiv.dataset.interval = interval;
    } else {
      progressDiv.style.display = 'none';
      if (progressDiv.dataset.interval) {
        clearInterval(progressDiv.dataset.interval);
      }
    }
  }

  // Online Users
  async loadOnlineUsers() {
    try {
      const response = await fetch('/api/users/online', {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      const data = await response.json();

      if (data.success) {
        this.updateOnlineUsers(data.users);
      }
    } catch (error) {
      console.error('Error loading online users:', error);
    }
  }

  updateOnlineUsers(users) {
    this.onlineUsers.clear();
    users.forEach((user) => {
      this.onlineUsers.set(user.id, user);
    });

    this.renderOnlineUsers();
    document.getElementById('online-count').textContent = users.length;
  }

  renderOnlineUsers() {
    const usersList = document.getElementById('online-users');
    usersList.innerHTML = '';

    this.onlineUsers.forEach((user) => {
      if (user.id === this.currentUser.id) return; // Don't show self

      const userElement = document.createElement('div');
      userElement.className = 'user-item';
      userElement.dataset.userId = user.id;

      userElement.innerHTML = `
                <div class="user-avatar">${user.username
                  .charAt(0)
                  .toUpperCase()}</div>
                <div class="user-details">
                    <div class="username">${user.username}</div>
                    <div class="user-status">Online</div>
                </div>
            `;

      userElement.addEventListener('click', () => {
        this.startPrivateMessage(user.id, user.username);
      });

      usersList.appendChild(userElement);
    });
  }

  startPrivateMessage(userId, username) {
    const message = prompt(`Send a private message to ${username}:`);
    if (message && message.trim()) {
      if (window.socketClient) {
        window.socketClient.sendPrivateMessage(userId, message.trim());
      }
      this.showNotification(`Private message sent to ${username}`, 'success');
    }
  }

  // Context Menu
  showContextMenu(e, message) {
    const contextMenu = document.getElementById('context-menu');
    const isOwnMessage = message.userId === this.currentUser.id;
    const isAdmin =
      this.currentUser.role === 'admin' ||
      this.currentUser.role === 'moderator';

    // Show/hide admin options
    document.getElementById('context-delete').style.display =
      isOwnMessage || isAdmin ? 'block' : 'none';

    // Position menu
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${e.pageX}px`;
    contextMenu.style.top = `${e.pageY}px`;

    // Store message reference
    contextMenu.dataset.messageId = message.id;
    contextMenu.dataset.userId = message.userId;
    contextMenu.dataset.username = message.username || message.senderUsername;

    // Add event listeners
    document.getElementById('context-reply').onclick = () => {
      this.replyToMessage(message);
      this.hideContextMenu();
    };

    document.getElementById('context-private-message').onclick = () => {
      this.startPrivateMessage(
        message.userId,
        message.username || message.senderUsername
      );
      this.hideContextMenu();
    };

    document.getElementById('context-copy').onclick = () => {
      navigator.clipboard.writeText(message.content);
      this.showNotification('Message copied to clipboard', 'success');
      this.hideContextMenu();
    };

    document.getElementById('context-delete').onclick = () => {
      this.deleteMessage(message.id);
      this.hideContextMenu();
    };
  }

  hideContextMenu() {
    document.getElementById('context-menu').style.display = 'none';
  }

  handleContextMenu(e) {
    const messageEl = e.target.closest('.message');
    if (!messageEl || messageEl.classList.contains('system')) {
      e.preventDefault();
    }
  }

  replyToMessage(message) {
    const input = document.getElementById('message-input');
    const username = message.username || message.senderUsername;
    input.value = `@${username} `;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  deleteMessage(messageId) {
    if (confirm('Are you sure you want to delete this message?')) {
      if (window.socketClient) {
        window.socketClient.deleteMessage(messageId, this.currentRoom);
      }
    }
  }

  // Settings
  showSettingsModal() {
    // Pre-populate settings
    document.getElementById('settings-username').value =
      this.currentUser.username;
    document.getElementById('settings-email').value =
      this.currentUser.email || '';
    document.getElementById('notifications-enabled').checked =
      this.settings.notifications;
    document.getElementById('sound-enabled').checked =
      this.settings.soundEnabled;
    document.getElementById('dark-theme').checked =
      this.settings.theme === 'dark';

    document.getElementById('settings-modal').classList.add('active');
  }

  async saveUserSettings() {
    const username = document.getElementById('settings-username').value.trim();
    const email = document.getElementById('settings-email').value.trim();

    // Update app settings
    this.settings = {
      theme: document.getElementById('dark-theme').checked ? 'dark' : 'light',
      notifications: document.getElementById('notifications-enabled').checked,
      soundEnabled: document.getElementById('sound-enabled').checked,
    };

    this.saveSettings();
    this.applyTheme();

    // Update user profile if changed
    if (
      username !== this.currentUser.username ||
      email !== (this.currentUser.email || '')
    ) {
      try {
        const response = await fetch('/api/users/me', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({ username, email }),
        });

        const data = await response.json();

        if (data.success) {
          this.currentUser = data.user;
          this.updateUserInfo();
          this.showNotification('Settings saved successfully!', 'success');
        } else {
          this.showNotification(
            data.message || 'Failed to save profile',
            'error'
          );
          return;
        }
      } catch (error) {
        console.error('Error saving profile:', error);
        this.showNotification('Failed to save profile', 'error');
        return;
      }
    } else {
      this.showNotification('Settings saved successfully!', 'success');
    }

    this.hideModal('settings-modal');
  }

  toggleTheme(e) {
    this.settings.theme = e.target.checked ? 'dark' : 'light';
    this.applyTheme();
  }

  // Room Info
  async showRoomInfo() {
    if (!this.currentRoom) return;

    try {
      const response = await fetch(`/api/rooms/${this.currentRoom}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      const data = await response.json();

      if (data.success) {
        const room = data.room;
        const content = document.getElementById('room-info-content');

        content.innerHTML = `
                    <div class="room-info-details">
                        <h4>${room.name}</h4>
                        <p><strong>Description:</strong> ${
                          room.description || 'No description'
                        }</p>
                        <p><strong>Created:</strong> ${new Date(
                          room.createdAt
                        ).toLocaleDateString()}</p>
                        <p><strong>Privacy:</strong> ${
                          room.isPrivate ? 'Private' : 'Public'
                        }</p>
                        <p><strong>Users:</strong> ${room.currentUsers || 0}/${
          room.maxUsers || 100
        }</p>
                        <p><strong>Messages:</strong> ${
                          room.messageCount || 0
                        }</p>
                    </div>
                    <div class="room-users-list">
                        <h5>Online Users:</h5>
                        ${room.onlineUsers
                          .map(
                            (user) => `
                            <div class="user-item">
                                <div class="user-avatar">${user.username
                                  .charAt(0)
                                  .toUpperCase()}</div>
                                <span>${user.username}</span>
                            </div>
                        `
                          )
                          .join('')}
                    </div>
                `;

        document.getElementById('room-info-modal').classList.add('active');
      }
    } catch (error) {
      console.error('Error loading room info:', error);
      this.showNotification('Failed to load room info', 'error');
    }
  }

  // UI Helpers
  showModal(modalId) {
    document.getElementById(modalId).classList.add('active');
  }

  hideModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
  }

  hideAllModals() {
    document.querySelectorAll('.modal').forEach((modal) => {
      modal.classList.remove('active');
    });
  }

  handleModalClose(e) {
    if (
      e.target.classList.contains('modal-close') ||
      e.target.hasAttribute('data-modal')
    ) {
      const modalId =
        e.target.getAttribute('data-modal') || e.target.closest('.modal').id;
      this.hideModal(modalId);
    } else if (e.target.classList.contains('modal')) {
      e.target.classList.remove('active');
    }
  }

  toggleSidebar() {
    const chatApp = document.getElementById('chat-app');
    const sidebar = document.querySelector('.sidebar');

    chatApp.classList.toggle('sidebar-open');
    sidebar.classList.toggle('open');
  }

  handleResize() {
    // Close sidebar on mobile if window is resized to desktop
    if (window.innerWidth > 768) {
      document.getElementById('chat-app').classList.remove('sidebar-open');
      document.querySelector('.sidebar').classList.remove('open');
    }
  }

  handleBeforeUnload(e) {
    if (this.currentUser && !this.currentUser.isGuest) {
      e.preventDefault();
      e.returnValue = 'Are you sure you want to leave the chat?';
    }
  }

  // Notifications
  showNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('notifications');
    const notification = document.createElement('div');

    notification.className = `notification ${type}`;
    notification.innerHTML = `
            <div class="notification-title">${this.getNotificationTitle(
              type
            )}</div>
            <div class="notification-message">${message}</div>
        `;

    container.appendChild(notification);

    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);

    // Hide notification
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  getNotificationTitle(type) {
    const titles = {
      success: 'Success',
      error: 'Error',
      warning: 'Warning',
      info: 'Info',
    };
    return titles[type] || 'Notification';
  }

  showBrowserNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: body.substring(0, 100) + (body.length > 100 ? '...' : ''),
        icon: '/favicon.ico',
      });
    }
  }

  playNotificationSound() {
    if (this.settings.soundEnabled) {
      // Create a simple beep sound
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        0.1,
        audioContext.currentTime + 0.01
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.3
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    }
  }

  showLoading(show, message = 'Loading...') {
    const loadingScreen = document.getElementById('loading-screen');
    const loadingText = loadingScreen.querySelector('p');

    loadingText.textContent = message;
    loadingScreen.style.display = show ? 'flex' : 'none';
  }

  // Logout
  logout() {
    // Disconnect socket
    if (window.socketClient) {
      window.socketClient.disconnect();
    }

    // Clear data
    this.currentUser = null;
    this.currentRoom = null;
    this.token = null;
    localStorage.removeItem('chat-token');

    // Reset UI
    document.getElementById('chat-app').style.display = 'none';
    this.clearMessages();
    this.showAuthModal();

    this.showNotification('You have been logged out', 'info');
  }

  // Auto-login with stored token
  async autoLogin() {
    const storedToken = localStorage.getItem('chat-token');
    if (!storedToken) {
      this.showLoading(false);
      return;
    }

    try {
      // Verify token by getting user info
      const response = await fetch('/api/users/me', {
        headers: { Authorization: `Bearer ${storedToken}` },
      });

      const data = await response.json();

      if (data.success) {
        this.token = storedToken;
        this.currentUser = data.user;
        this.hideAuthModal();
        this.initializeChat();
      } else {
        localStorage.removeItem('chat-token');
        this.showLoading(false);
      }
    } catch (error) {
      console.error('Auto-login failed:', error);
      localStorage.removeItem('chat-token');
      this.showLoading(false);
    }
  }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Initialize chat application
  window.chatApp = new ChatApplication();

  // Try auto-login
  window.chatApp.autoLogin();
});
