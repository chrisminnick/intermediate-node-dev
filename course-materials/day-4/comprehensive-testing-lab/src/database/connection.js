const { Pool } = require('pg');

class DatabaseConnection {
  constructor() {
    this.pool = null;
    this.connected = false;
  }

  async connect() {
    if (this.connected) {
      return this.pool;
    }

    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'task_management',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    // Use test database in test environment
    if (process.env.NODE_ENV === 'test') {
      config.database = process.env.TEST_DB_NAME || 'task_management_test';
    }

    try {
      this.pool = new Pool(config);

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.connected = true;
      console.log(`Connected to PostgreSQL database: ${config.database}`);

      return this.pool;
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.connected = false;
      console.log('Database connection closed');
    }
  }

  async query(text, params) {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;

      if (process.env.NODE_ENV === 'development') {
        console.log('Executed query', {
          text,
          duration,
          rows: result.rowCount,
        });
      }

      return result;
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }

  async transaction(callback) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async migrate() {
    const migrations = [
      // Users table
      `
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          role VARCHAR(50) DEFAULT 'user',
          avatar_url VARCHAR(500),
          is_active BOOLEAN DEFAULT true,
          last_login TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,

      // Teams table
      `
        CREATE TABLE IF NOT EXISTS teams (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,

      // Team members junction table
      `
        CREATE TABLE IF NOT EXISTS team_members (
          id SERIAL PRIMARY KEY,
          team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          role VARCHAR(50) DEFAULT 'member',
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(team_id, user_id)
        )
      `,

      // Projects table
      `
        CREATE TABLE IF NOT EXISTS projects (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
          status VARCHAR(50) DEFAULT 'active',
          priority VARCHAR(20) DEFAULT 'medium',
          start_date DATE,
          end_date DATE,
          budget DECIMAL(10,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,

      // Tasks table
      `
        CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
          assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
          status VARCHAR(50) DEFAULT 'todo',
          priority VARCHAR(20) DEFAULT 'medium',
          due_date TIMESTAMP,
          estimated_hours INTEGER,
          actual_hours INTEGER,
          tags TEXT[],
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,

      // Task comments table
      `
        CREATE TABLE IF NOT EXISTS task_comments (
          id SERIAL PRIMARY KEY,
          task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,

      // Indexes for performance
      `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
      `CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id)`,
      `CREATE INDEX IF NOT EXISTS idx_projects_team ON projects(team_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`,
      `CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id)`,
    ];

    for (const migration of migrations) {
      try {
        await this.query(migration);
      } catch (error) {
        console.error('Migration error:', error);
        throw error;
      }
    }

    console.log('Database migrations completed');
  }

  getPool() {
    return this.pool;
  }
}

// Export singleton instance
const database = new DatabaseConnection();
module.exports = database;
