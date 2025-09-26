class AdminDashboard {
  constructor() {
    this.token = null;
    this.currentUser = null;
    this.users = new Map();
    this.rooms = new Map();
    this.stats = {};
    this.refreshInterval = null;

    this.init();
  }

  init() {
    this.checkAuth();
    this.setupEventListeners();
    this.startAutoRefresh();
  }

  async checkAuth() {
    const token = localStorage.getItem('chat-token');
    if (!token) {
      this.redirectToLogin();
      return;
    }

    try {
      const response = await fetch('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (
        data.success &&
        (data.user.role === 'admin' || data.user.role === 'moderator')
      ) {
        this.token = token;
        this.currentUser = data.user;
        this.updateUserInfo();
        this.loadDashboardData();
      } else {
        this.redirectToLogin();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      this.redirectToLogin();
    }
  }

  redirectToLogin() {
    window.location.href = '/';
  }

  updateUserInfo() {
    document.getElementById('admin-username').textContent =
      this.currentUser.username;
    document.getElementById('admin-role').textContent = this.currentUser.role;
  }

  setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        const section = e.target.dataset.section;
        this.showSection(section);
      });
    });

    // User management
    document
      .getElementById('refresh-users-btn')
      .addEventListener('click', this.loadUsers.bind(this));
    document
      .getElementById('user-search')
      .addEventListener('input', this.filterUsers.bind(this));

    // Room management
    document
      .getElementById('refresh-rooms-btn')
      .addEventListener('click', this.loadRooms.bind(this));
    document
      .getElementById('room-search')
      .addEventListener('input', this.filterRooms.bind(this));
    document
      .getElementById('create-room-btn')
      .addEventListener('click', this.showCreateRoomModal.bind(this));
    document
      .getElementById('admin-create-room-form')
      .addEventListener('submit', this.createRoom.bind(this));

    // System controls
    document
      .getElementById('refresh-stats-btn')
      .addEventListener('click', this.loadStats.bind(this));
    document
      .getElementById('clear-logs-btn')
      .addEventListener('click', this.clearLogs.bind(this));
    document
      .getElementById('broadcast-btn')
      .addEventListener('click', this.showBroadcastModal.bind(this));
    document
      .getElementById('broadcast-form')
      .addEventListener('submit', this.sendBroadcast.bind(this));

    // Settings
    document
      .getElementById('logout-btn')
      .addEventListener('click', this.logout.bind(this));

    // Modal handling
    document.querySelectorAll('.modal-close').forEach((btn) => {
      btn.addEventListener('click', this.hideModals.bind(this));
    });

    // Auto-refresh toggle
    document.getElementById('auto-refresh').addEventListener('change', (e) => {
      if (e.target.checked) {
        this.startAutoRefresh();
      } else {
        this.stopAutoRefresh();
      }
    });
  }

  showSection(sectionName) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.remove('active');
      if (item.dataset.section === sectionName) {
        item.classList.add('active');
      }
    });

    // Show section
    document.querySelectorAll('.section').forEach((section) => {
      section.classList.remove('active');
    });
    document.getElementById(`${sectionName}-section`).classList.add('active');

    // Load section data
    switch (sectionName) {
      case 'users':
        this.loadUsers();
        break;
      case 'rooms':
        this.loadRooms();
        break;
      case 'stats':
        this.loadStats();
        break;
      case 'logs':
        this.loadLogs();
        break;
    }
  }

  async loadDashboardData() {
    this.showLoading(true);

    try {
      await Promise.all([
        this.loadOverview(),
        this.loadUsers(),
        this.loadRooms(),
        this.loadStats(),
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.showNotification('Failed to load dashboard data', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async loadOverview() {
    try {
      const response = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      const data = await response.json();

      if (data.success) {
        const overview = data.overview;
        document.getElementById('total-users').textContent =
          overview.totalUsers;
        document.getElementById('online-users').textContent =
          overview.onlineUsers;
        document.getElementById('total-rooms').textContent =
          overview.totalRooms;
        document.getElementById('total-messages').textContent =
          overview.totalMessages;
      }
    } catch (error) {
      console.error('Error loading overview:', error);
    }
  }

  async loadUsers() {
    try {
      const response = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      const data = await response.json();

      if (data.success) {
        this.users.clear();
        data.users.forEach((user) => {
          this.users.set(user.id, user);
        });
        this.renderUsers();
      }
    } catch (error) {
      console.error('Error loading users:', error);
      this.showNotification('Failed to load users', 'error');
    }
  }

  renderUsers(filteredUsers = null) {
    const usersContainer = document.getElementById('users-list');
    usersContainer.innerHTML = '';

    const usersToRender = filteredUsers || Array.from(this.users.values());

    usersToRender.forEach((user) => {
      const userCard = document.createElement('div');
      userCard.className = 'user-card';
      userCard.innerHTML = `
                <div class="user-info">
                    <div class="user-avatar">${user.username
                      .charAt(0)
                      .toUpperCase()}</div>
                    <div class="user-details">
                        <div class="user-name">${user.username}</div>
                        <div class="user-meta">
                            <span class="user-role ${user.role}">${
        user.role
      }</span>
                            <span class="user-status ${
                              user.isOnline ? 'online' : 'offline'
                            }">
                                ${user.isOnline ? 'Online' : 'Offline'}
                            </span>
                        </div>
                        <div class="user-stats">
                            Messages: ${user.messageCount || 0} | 
                            Joined: ${new Date(
                              user.createdAt
                            ).toLocaleDateString()}
                            ${
                              user.lastSeen
                                ? `| Last seen: ${new Date(
                                    user.lastSeen
                                  ).toLocaleString()}`
                                : ''
                            }
                        </div>
                    </div>
                </div>
                <div class="user-actions">
                    ${
                      this.currentUser.role === 'admin'
                        ? `
                        <button class="btn btn-sm ${
                          user.role === 'admin' ? 'btn-warning' : 'btn-primary'
                        }" 
                                onclick="adminDashboard.toggleUserRole('${
                                  user.id
                                }')">
                            ${
                              user.role === 'admin'
                                ? 'Remove Admin'
                                : 'Make Admin'
                            }
                        </button>
                    `
                        : ''
                    }
                    <button class="btn btn-sm btn-warning" onclick="adminDashboard.kickUser('${
                      user.id
                    }')">
                        Kick
                    </button>
                    <button class="btn btn-sm ${
                      user.isBanned ? 'btn-success' : 'btn-danger'
                    }" 
                            onclick="adminDashboard.${
                              user.isBanned ? 'unban' : 'ban'
                            }User('${user.id}')">
                        ${user.isBanned ? 'Unban' : 'Ban'}
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="adminDashboard.viewUserDetails('${
                      user.id
                    }')">
                        Details
                    </button>
                </div>
            `;

      usersContainer.appendChild(userCard);
    });

    // Update count
    document.getElementById('users-count').textContent = usersToRender.length;
  }

  filterUsers(e) {
    const query = e.target.value.toLowerCase();
    if (!query) {
      this.renderUsers();
      return;
    }

    const filtered = Array.from(this.users.values()).filter(
      (user) =>
        user.username.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query)
    );

    this.renderUsers(filtered);
  }

  async loadRooms() {
    try {
      const response = await fetch('/api/admin/rooms', {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      const data = await response.json();

      if (data.success) {
        this.rooms.clear();
        data.rooms.forEach((room) => {
          this.rooms.set(room.id, room);
        });
        this.renderRooms();
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
      this.showNotification('Failed to load rooms', 'error');
    }
  }

  renderRooms(filteredRooms = null) {
    const roomsContainer = document.getElementById('rooms-list');
    roomsContainer.innerHTML = '';

    const roomsToRender = filteredRooms || Array.from(this.rooms.values());

    roomsToRender.forEach((room) => {
      const roomCard = document.createElement('div');
      roomCard.className = 'room-card';
      roomCard.innerHTML = `
                <div class="room-info">
                    <div class="room-icon">${room.isPrivate ? '🔒' : '#'}</div>
                    <div class="room-details">
                        <div class="room-name">${room.name}</div>
                        <div class="room-description">${
                          room.description || 'No description'
                        }</div>
                        <div class="room-stats">
                            Users: ${room.currentUsers || 0}/${
        room.maxUsers || 100
      } | 
                            Messages: ${room.messageCount || 0} | 
                            Created: ${new Date(
                              room.createdAt
                            ).toLocaleDateString()}
                        </div>
                    </div>
                </div>
                <div class="room-actions">
                    <button class="btn btn-sm btn-primary" onclick="adminDashboard.viewRoomDetails('${
                      room.id
                    }')">
                        Details
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="adminDashboard.clearRoomMessages('${
                      room.id
                    }')">
                        Clear Messages
                    </button>
                    ${
                      room.id !== 'general'
                        ? `
                        <button class="btn btn-sm btn-danger" onclick="adminDashboard.deleteRoom('${room.id}')">
                            Delete
                        </button>
                    `
                        : ''
                    }
                </div>
            `;

      roomsContainer.appendChild(roomCard);
    });

    // Update count
    document.getElementById('rooms-count').textContent = roomsToRender.length;
  }

  filterRooms(e) {
    const query = e.target.value.toLowerCase();
    if (!query) {
      this.renderRooms();
      return;
    }

    const filtered = Array.from(this.rooms.values()).filter(
      (room) =>
        room.name.toLowerCase().includes(query) ||
        room.description?.toLowerCase().includes(query)
    );

    this.renderRooms(filtered);
  }

  async loadStats() {
    try {
      const response = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      const data = await response.json();

      if (data.success) {
        this.stats = data.stats;
        this.renderStats();
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      this.showNotification('Failed to load statistics', 'error');
    }
  }

  renderStats() {
    const statsContainer = document.getElementById('stats-content');
    const stats = this.stats;

    statsContainer.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>System Performance</h4>
                    <p>Uptime: ${this.formatUptime(stats.uptime)}</p>
                    <p>Memory Usage: ${this.formatBytes(
                      stats.memoryUsage?.used || 0
                    )} / ${this.formatBytes(stats.memoryUsage?.total || 0)}</p>
                    <p>CPU Usage: ${stats.cpuUsage?.toFixed(1) || 0}%</p>
                </div>
                
                <div class="stat-card">
                    <h4>User Activity</h4>
                    <p>Total Users: ${stats.totalUsers || 0}</p>
                    <p>Online Users: ${stats.onlineUsers || 0}</p>
                    <p>New Users Today: ${stats.newUsersToday || 0}</p>
                    <p>Active Users (24h): ${stats.activeUsers24h || 0}</p>
                </div>
                
                <div class="stat-card">
                    <h4>Messages</h4>
                    <p>Total Messages: ${stats.totalMessages || 0}</p>
                    <p>Messages Today: ${stats.messagesToday || 0}</p>
                    <p>Messages Per Hour: ${stats.messagesPerHour || 0}</p>
                    <p>Average Message Length: ${
                      stats.avgMessageLength || 0
                    } chars</p>
                </div>
                
                <div class="stat-card">
                    <h4>Rooms</h4>
                    <p>Total Rooms: ${stats.totalRooms || 0}</p>
                    <p>Active Rooms: ${stats.activeRooms || 0}</p>
                    <p>Private Rooms: ${stats.privateRooms || 0}</p>
                    <p>Most Popular: ${stats.mostPopularRoom || 'N/A'}</p>
                </div>
            </div>
            
            <div class="charts-section">
                <div class="chart-container">
                    <h4>Daily Activity (Last 7 Days)</h4>
                    <div id="activity-chart" class="chart">
                        ${this.renderActivityChart(stats.dailyActivity || [])}
                    </div>
                </div>
                
                <div class="chart-container">
                    <h4>Room Usage</h4>
                    <div id="rooms-chart" class="chart">
                        ${this.renderRoomsChart(stats.roomUsage || [])}
                    </div>
                </div>
            </div>
        `;
  }

  renderActivityChart(data) {
    if (!data.length) return '<p>No data available</p>';

    const maxValue = Math.max(...data.map((d) => d.messages));

    return data
      .map((day) => {
        const height = maxValue > 0 ? (day.messages / maxValue) * 100 : 0;
        return `
                <div class="chart-bar">
                    <div class="bar" style="height: ${height}%" title="${
          day.date
        }: ${day.messages} messages"></div>
                    <div class="bar-label">${new Date(
                      day.date
                    ).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                </div>
            `;
      })
      .join('');
  }

  renderRoomsChart(data) {
    if (!data.length) return '<p>No data available</p>';

    return data
      .slice(0, 10)
      .map((room) => {
        const percentage =
          data.length > 0 ? (room.messages / data[0].messages) * 100 : 0;
        return `
                <div class="chart-item">
                    <div class="chart-label">${room.name}</div>
                    <div class="chart-progress">
                        <div class="chart-progress-bar" style="width: ${percentage}%"></div>
                    </div>
                    <div class="chart-value">${room.messages}</div>
                </div>
            `;
      })
      .join('');
  }

  async loadLogs() {
    try {
      const response = await fetch('/api/admin/logs', {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      const data = await response.json();

      if (data.success) {
        this.renderLogs(data.logs);
      }
    } catch (error) {
      console.error('Error loading logs:', error);
      this.showNotification('Failed to load logs', 'error');
    }
  }

  renderLogs(logs) {
    const logsContainer = document.getElementById('logs-content');

    if (!logs || !logs.length) {
      logsContainer.innerHTML = '<p>No logs available</p>';
      return;
    }

    logsContainer.innerHTML = logs
      .map(
        (log) => `
            <div class="log-entry ${log.level}">
                <div class="log-timestamp">${new Date(
                  log.timestamp
                ).toLocaleString()}</div>
                <div class="log-level">${log.level.toUpperCase()}</div>
                <div class="log-message">${log.message}</div>
                ${
                  log.meta
                    ? `<div class="log-meta">${JSON.stringify(
                        log.meta,
                        null,
                        2
                      )}</div>`
                    : ''
                }
            </div>
        `
      )
      .join('');
  }

  // User management actions
  async toggleUserRole(userId) {
    const user = this.users.get(userId);
    if (!user) return;

    const newRole = user.role === 'admin' ? 'user' : 'admin';
    const confirmed = confirm(
      `${newRole === 'admin' ? 'Grant' : 'Remove'} admin privileges ${
        newRole === 'admin' ? 'to' : 'from'
      } ${user.username}?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();

      if (data.success) {
        this.showNotification(`User role updated successfully`, 'success');
        this.loadUsers();
      } else {
        this.showNotification(
          data.message || 'Failed to update user role',
          'error'
        );
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      this.showNotification('Failed to update user role', 'error');
    }
  }

  async kickUser(userId) {
    const user = this.users.get(userId);
    if (!user) return;

    const reason = prompt(`Reason for kicking ${user.username}:`);
    if (reason === null) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}/kick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ reason }),
      });

      const data = await response.json();

      if (data.success) {
        this.showNotification(`User kicked successfully`, 'success');
        this.loadUsers();
      } else {
        this.showNotification(data.message || 'Failed to kick user', 'error');
      }
    } catch (error) {
      console.error('Error kicking user:', error);
      this.showNotification('Failed to kick user', 'error');
    }
  }

  async banUser(userId) {
    const user = this.users.get(userId);
    if (!user) return;

    const reason = prompt(`Reason for banning ${user.username}:`);
    if (reason === null) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ reason }),
      });

      const data = await response.json();

      if (data.success) {
        this.showNotification(`User banned successfully`, 'success');
        this.loadUsers();
      } else {
        this.showNotification(data.message || 'Failed to ban user', 'error');
      }
    } catch (error) {
      console.error('Error banning user:', error);
      this.showNotification('Failed to ban user', 'error');
    }
  }

  async unbanUser(userId) {
    const user = this.users.get(userId);
    if (!user) return;

    const confirmed = confirm(`Unban ${user.username}?`);
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}/unban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        this.showNotification(`User unbanned successfully`, 'success');
        this.loadUsers();
      } else {
        this.showNotification(data.message || 'Failed to unban user', 'error');
      }
    } catch (error) {
      console.error('Error unbanning user:', error);
      this.showNotification('Failed to unban user', 'error');
    }
  }

  viewUserDetails(userId) {
    const user = this.users.get(userId);
    if (!user) return;

    const modal = document.getElementById('user-details-modal');
    const content = modal.querySelector('.modal-content');

    content.innerHTML = `
            <div class="modal-header">
                <h3>User Details: ${user.username}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="user-detail-grid">
                    <div><strong>ID:</strong> ${user.id}</div>
                    <div><strong>Username:</strong> ${user.username}</div>
                    <div><strong>Email:</strong> ${
                      user.email || 'Not provided'
                    }</div>
                    <div><strong>Role:</strong> ${user.role}</div>
                    <div><strong>Status:</strong> ${
                      user.isOnline ? 'Online' : 'Offline'
                    }</div>
                    <div><strong>Banned:</strong> ${
                      user.isBanned ? 'Yes' : 'No'
                    }</div>
                    <div><strong>Joined:</strong> ${new Date(
                      user.createdAt
                    ).toLocaleString()}</div>
                    <div><strong>Last Seen:</strong> ${
                      user.lastSeen
                        ? new Date(user.lastSeen).toLocaleString()
                        : 'Never'
                    }</div>
                    <div><strong>Messages:</strong> ${
                      user.messageCount || 0
                    }</div>
                    <div><strong>Rooms Joined:</strong> ${
                      user.roomsJoined || 0
                    }</div>
                </div>
            </div>
        `;

    modal.classList.add('active');
  }

  // Room management actions
  showCreateRoomModal() {
    document.getElementById('create-room-modal').classList.add('active');
  }

  async createRoom(e) {
    e.preventDefault();
    const formData = new FormData(e.target);

    const roomData = {
      name: formData.get('name').trim(),
      description: formData.get('description').trim(),
      isPrivate: formData.get('isPrivate') === 'on',
      password: formData.get('password'),
      maxUsers: parseInt(formData.get('maxUsers')) || 100,
    };

    try {
      const response = await fetch('/api/admin/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(roomData),
      });

      const data = await response.json();

      if (data.success) {
        this.showNotification('Room created successfully', 'success');
        this.hideModals();
        this.loadRooms();
        e.target.reset();
      } else {
        this.showNotification(data.message || 'Failed to create room', 'error');
      }
    } catch (error) {
      console.error('Error creating room:', error);
      this.showNotification('Failed to create room', 'error');
    }
  }

  async clearRoomMessages(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const confirmed = confirm(
      `Clear all messages in "${room.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/rooms/${roomId}/clear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        this.showNotification('Room messages cleared successfully', 'success');
        this.loadRooms();
      } else {
        this.showNotification(
          data.message || 'Failed to clear room messages',
          'error'
        );
      }
    } catch (error) {
      console.error('Error clearing room messages:', error);
      this.showNotification('Failed to clear room messages', 'error');
    }
  }

  async deleteRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const confirmed = confirm(
      `Delete room "${room.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/rooms/${roomId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        this.showNotification('Room deleted successfully', 'success');
        this.loadRooms();
      } else {
        this.showNotification(data.message || 'Failed to delete room', 'error');
      }
    } catch (error) {
      console.error('Error deleting room:', error);
      this.showNotification('Failed to delete room', 'error');
    }
  }

  viewRoomDetails(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const modal = document.getElementById('room-details-modal');
    const content = modal.querySelector('.modal-content');

    content.innerHTML = `
            <div class="modal-header">
                <h3>Room Details: ${room.name}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="room-detail-grid">
                    <div><strong>ID:</strong> ${room.id}</div>
                    <div><strong>Name:</strong> ${room.name}</div>
                    <div><strong>Description:</strong> ${
                      room.description || 'No description'
                    }</div>
                    <div><strong>Type:</strong> ${
                      room.isPrivate ? 'Private' : 'Public'
                    }</div>
                    <div><strong>Created:</strong> ${new Date(
                      room.createdAt
                    ).toLocaleString()}</div>
                    <div><strong>Creator:</strong> ${
                      room.createdBy || 'System'
                    }</div>
                    <div><strong>Current Users:</strong> ${
                      room.currentUsers || 0
                    }</div>
                    <div><strong>Max Users:</strong> ${
                      room.maxUsers || 100
                    }</div>
                    <div><strong>Total Messages:</strong> ${
                      room.messageCount || 0
                    }</div>
                    <div><strong>Last Activity:</strong> ${
                      room.lastActivity
                        ? new Date(room.lastActivity).toLocaleString()
                        : 'No activity'
                    }</div>
                </div>
            </div>
        `;

    modal.classList.add('active');
  }

  // System actions
  async clearLogs() {
    const confirmed = confirm(
      'Clear all system logs? This action cannot be undone.'
    );
    if (!confirmed) return;

    try {
      const response = await fetch('/api/admin/logs', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        this.showNotification('Logs cleared successfully', 'success');
        this.loadLogs();
      } else {
        this.showNotification(data.message || 'Failed to clear logs', 'error');
      }
    } catch (error) {
      console.error('Error clearing logs:', error);
      this.showNotification('Failed to clear logs', 'error');
    }
  }

  showBroadcastModal() {
    document.getElementById('broadcast-modal').classList.add('active');
  }

  async sendBroadcast(e) {
    e.preventDefault();
    const formData = new FormData(e.target);

    const message = formData.get('message').trim();
    const type = formData.get('type');

    if (!message) {
      this.showNotification('Message is required', 'error');
      return;
    }

    try {
      const response = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ message, type }),
      });

      const data = await response.json();

      if (data.success) {
        this.showNotification('Broadcast sent successfully', 'success');
        this.hideModals();
        e.target.reset();
      } else {
        this.showNotification(
          data.message || 'Failed to send broadcast',
          'error'
        );
      }
    } catch (error) {
      console.error('Error sending broadcast:', error);
      this.showNotification('Failed to send broadcast', 'error');
    }
  }

  // Auto-refresh
  startAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(() => {
      this.loadOverview();

      // Refresh current section data
      const activeSection = document.querySelector('.nav-item.active');
      if (activeSection) {
        const section = activeSection.dataset.section;
        switch (section) {
          case 'users':
            this.loadUsers();
            break;
          case 'rooms':
            this.loadRooms();
            break;
          case 'stats':
            this.loadStats();
            break;
        }
      }
    }, 30000); // Refresh every 30 seconds
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // Utility methods
  formatUptime(uptime) {
    const seconds = Math.floor(uptime % 60);
    const minutes = Math.floor((uptime / 60) % 60);
    const hours = Math.floor((uptime / 3600) % 24);
    const days = Math.floor(uptime / 86400);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m ${seconds}s`;
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // UI helpers
  showLoading(show, message = 'Loading...') {
    const loadingScreen = document.getElementById('loading-screen');
    if (show) {
      loadingScreen.style.display = 'flex';
      loadingScreen.querySelector('p').textContent = message;
    } else {
      loadingScreen.style.display = 'none';
    }
  }

  showNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('notifications');
    const notification = document.createElement('div');

    notification.className = `notification ${type}`;
    notification.innerHTML = `
            <div class="notification-content">
                <strong>${
                  type.charAt(0).toUpperCase() + type.slice(1)
                }:</strong> ${message}
            </div>
        `;

    container.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  hideModals() {
    document.querySelectorAll('.modal').forEach((modal) => {
      modal.classList.remove('active');
    });
  }

  logout() {
    localStorage.removeItem('chat-token');
    window.location.href = '/';
  }
}

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', () => {
  window.adminDashboard = new AdminDashboard();
});
