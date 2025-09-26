class SocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.typingTimer = null;
    this.typingDelay = 1000; // Stop typing indicator after 1 second
  }

  async connect(token) {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io({
          auth: { token },
          timeout: 5000,
          transports: ['websocket', 'polling'],
        });

        this.setupEventListeners();

        this.socket.on('connect', () => {
          console.log('Connected to server');
          this.connected = true;
          this.reconnectAttempts = 0;

          // Show connection status
          this.updateConnectionStatus(true);

          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          this.connected = false;
          this.updateConnectionStatus(false);
          reject(error);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Disconnected:', reason);
          this.connected = false;
          this.updateConnectionStatus(false);

          // Auto-reconnect if not manually disconnected
          if (reason !== 'io client disconnect') {
            this.handleReconnect();
          }
        });
      } catch (error) {
        console.error('Socket connection error:', error);
        reject(error);
      }
    });
  }

  setupEventListeners() {
    // Authentication events
    this.socket.on('auth_error', (error) => {
      console.error('Authentication error:', error);
      window.chatApp.showNotification('Authentication failed', 'error');
      window.chatApp.logout();
    });

    // Room events
    this.socket.on('room_joined', (data) => {
      console.log('Joined room:', data);
      window.chatApp.updateCurrentRoom(data.room);

      // Load recent messages
      if (data.messages) {
        data.messages.forEach((message) => {
          window.chatApp.addMessage(message);
        });
      }

      window.chatApp.showNotification(
        `Joined room: ${data.room.name}`,
        'success'
      );
    });

    this.socket.on('room_join_error', (error) => {
      console.error('Room join error:', error);
      window.chatApp.showNotification(
        error.message || 'Failed to join room',
        'error'
      );
    });

    this.socket.on('room_left', (data) => {
      console.log('Left room:', data);
    });

    this.socket.on('room_created', (data) => {
      console.log('Room created:', data);
      // Room will be added to list via regular room updates
    });

    // Message events
    this.socket.on('new_message', (message) => {
      console.log('New message:', message);
      window.chatApp.addMessage(message);
    });

    this.socket.on('message_deleted', (data) => {
      console.log('Message deleted:', data);
      const messageElement = document.querySelector(
        `[data-message-id="${data.messageId}"]`
      );
      if (messageElement) {
        messageElement.remove();
      }
      window.chatApp.showNotification('Message deleted', 'info');
    });

    this.socket.on('private_message', (message) => {
      console.log('Private message:', message);
      window.chatApp.addMessage({
        ...message,
        isPrivate: true,
      });
    });

    // Typing events
    this.socket.on('user_typing_start', (data) => {
      console.log('User typing start:', data);
      this.handleTypingStart(data.username);
    });

    this.socket.on('user_typing_stop', (data) => {
      console.log('User typing stop:', data);
      this.handleTypingStop(data.username);
    });

    // User events
    this.socket.on('users_updated', (data) => {
      console.log('Users updated:', data);
      window.chatApp.updateOnlineUsers(data.users);
    });

    this.socket.on('user_joined', (data) => {
      console.log('User joined:', data);
      if (window.chatApp.currentRoom) {
        window.chatApp.addMessage({
          id: Date.now(),
          type: 'system',
          content: `${data.username} joined the room`,
          timestamp: new Date(),
        });
      }
    });

    this.socket.on('user_left', (data) => {
      console.log('User left:', data);
      if (window.chatApp.currentRoom) {
        window.chatApp.addMessage({
          id: Date.now(),
          type: 'system',
          content: `${data.username} left the room`,
          timestamp: new Date(),
        });
      }
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      window.chatApp.showNotification(
        error.message || 'Connection error',
        'error'
      );
    });

    this.socket.on('rate_limit_exceeded', (data) => {
      console.warn('Rate limit exceeded:', data);
      window.chatApp.showNotification(
        `Rate limit exceeded. Please wait ${Math.ceil(
          data.resetTime / 1000
        )} seconds.`,
        'warning'
      );
    });

    // Admin events
    this.socket.on('user_kicked', (data) => {
      console.log('User kicked:', data);
      window.chatApp.addMessage({
        id: Date.now(),
        type: 'system',
        content: `${data.username} was kicked from the room`,
        timestamp: new Date(),
      });
    });

    this.socket.on('user_banned', (data) => {
      console.log('User banned:', data);
      window.chatApp.addMessage({
        id: Date.now(),
        type: 'system',
        content: `${data.username} was banned`,
        timestamp: new Date(),
      });
    });

    this.socket.on('room_cleared', (data) => {
      console.log('Room cleared:', data);
      window.chatApp.clearMessages();
      window.chatApp.addMessage({
        id: Date.now(),
        type: 'system',
        content: 'Room messages have been cleared by a moderator',
        timestamp: new Date(),
      });
    });

    // Connection quality monitoring
    this.socket.on('ping', () => {
      this.socket.emit('pong');
    });

    // Handle server announcements
    this.socket.on('server_announcement', (data) => {
      console.log('Server announcement:', data);
      window.chatApp.addMessage({
        id: Date.now(),
        type: 'system',
        content: `📢 Server Announcement: ${data.message}`,
        timestamp: new Date(),
      });

      window.chatApp.showNotification(data.message, 'info', 8000);
    });
  }

  // Room methods
  joinRoom(roomId, password = null) {
    if (!this.connected) {
      window.chatApp.showNotification('Not connected to server', 'error');
      return;
    }

    console.log('Joining room:', roomId);
    this.socket.emit('join_room', {
      roomId,
      password,
    });
  }

  leaveRoom(roomId) {
    if (!this.connected) return;

    console.log('Leaving room:', roomId);
    this.socket.emit('leave_room', { roomId });
  }

  // Message methods
  sendMessage(roomId, content, type = 'text') {
    if (!this.connected) {
      window.chatApp.showNotification('Not connected to server', 'error');
      return;
    }

    if (!content.trim()) return;

    console.log('Sending message:', { roomId, content, type });
    this.socket.emit('send_message', {
      roomId,
      content: content.trim(),
      type,
    });
  }

  sendPrivateMessage(userId, content) {
    if (!this.connected) {
      window.chatApp.showNotification('Not connected to server', 'error');
      return;
    }

    if (!content.trim()) return;

    console.log('Sending private message:', { userId, content });
    this.socket.emit('send_private_message', {
      userId,
      content: content.trim(),
    });
  }

  deleteMessage(messageId, roomId) {
    if (!this.connected) {
      window.chatApp.showNotification('Not connected to server', 'error');
      return;
    }

    console.log('Deleting message:', { messageId, roomId });
    this.socket.emit('delete_message', {
      messageId,
      roomId,
    });
  }

  // Typing indicators
  sendTypingStart(roomId) {
    if (!this.connected || !roomId) return;

    // Clear existing timer
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }

    // Send typing start event
    this.socket.emit('typing_start', { roomId });

    // Set timer to automatically send typing stop
    this.typingTimer = setTimeout(() => {
      this.sendTypingStop(roomId);
    }, this.typingDelay);
  }

  sendTypingStop(roomId) {
    if (!this.connected || !roomId) return;

    // Clear timer
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }

    // Send typing stop event
    this.socket.emit('typing_stop', { roomId });
  }

  handleTypingStart(username) {
    // Add user to typing list
    if (!window.chatApp.typingUsers.has(username)) {
      window.chatApp.typingUsers.add(username);
      this.updateTypingIndicators();
    }

    // Set timeout to remove user if no typing stop received
    setTimeout(() => {
      if (window.chatApp.typingUsers.has(username)) {
        this.handleTypingStop(username);
      }
    }, 3000);
  }

  handleTypingStop(username) {
    // Remove user from typing list
    if (window.chatApp.typingUsers.has(username)) {
      window.chatApp.typingUsers.delete(username);
      this.updateTypingIndicators();
    }
  }

  updateTypingIndicators() {
    const typingArray = Array.from(window.chatApp.typingUsers);
    window.chatApp.updateTypingIndicators(typingArray);
  }

  // Admin methods
  kickUser(userId, roomId, reason = '') {
    if (!this.connected) {
      window.chatApp.showNotification('Not connected to server', 'error');
      return;
    }

    console.log('Kicking user:', { userId, roomId, reason });
    this.socket.emit('kick_user', {
      userId,
      roomId,
      reason,
    });
  }

  banUser(userId, reason = '', duration = 0) {
    if (!this.connected) {
      window.chatApp.showNotification('Not connected to server', 'error');
      return;
    }

    console.log('Banning user:', { userId, reason, duration });
    this.socket.emit('ban_user', {
      userId,
      reason,
      duration,
    });
  }

  clearRoom(roomId) {
    if (!this.connected) {
      window.chatApp.showNotification('Not connected to server', 'error');
      return;
    }

    console.log('Clearing room:', roomId);
    this.socket.emit('clear_room', { roomId });
  }

  // Connection management
  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      window.chatApp.showNotification(
        'Connection lost. Please refresh the page.',
        'error',
        10000
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`
    );

    window.chatApp.showNotification(
      `Connection lost. Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
      'warning'
    );

    setTimeout(() => {
      if (!this.connected) {
        this.socket.connect();
      }
    }, delay);
  }

  updateConnectionStatus(connected) {
    const statusIndicator = document.getElementById('connection-status');
    const statusText = statusIndicator.querySelector('.status-text');
    const statusDot = statusIndicator.querySelector('.status-dot');

    if (connected) {
      statusText.textContent = 'Connected';
      statusDot.className = 'status-dot connected';
      statusIndicator.title = 'Connected to chat server';
    } else {
      statusText.textContent = 'Disconnected';
      statusDot.className = 'status-dot disconnected';
      statusIndicator.title = 'Disconnected from chat server';
    }
  }

  // Utility methods
  getConnectionLatency() {
    return new Promise((resolve) => {
      const start = Date.now();
      this.socket.emit('ping', start);
      this.socket.once('pong', (startTime) => {
        const latency = Date.now() - startTime;
        resolve(latency);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      // Clear typing timer
      if (this.typingTimer) {
        clearTimeout(this.typingTimer);
        this.typingTimer = null;
      }

      // Disconnect socket
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.reconnectAttempts = 0;

      // Update UI
      this.updateConnectionStatus(false);

      console.log('Socket disconnected');
    }
  }

  // Health check
  isConnected() {
    return this.connected && this.socket && this.socket.connected;
  }

  // Get socket ID
  getSocketId() {
    return this.socket ? this.socket.id : null;
  }

  // Emit custom events
  emit(event, data) {
    if (this.connected && this.socket) {
      this.socket.emit(event, data);
    } else {
      console.warn('Cannot emit event - socket not connected:', event);
    }
  }

  // Listen for custom events
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  // Remove event listeners
  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

// Create global socket client instance
window.socketClient = new SocketClient();
