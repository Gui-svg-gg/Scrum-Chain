const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  constructor(userData) {
    this.id = userData.id;
    this.username = userData.username;
    this.email = userData.email;
    this.password_hash = userData.password_hash;
    this.full_name = userData.full_name;
    this.wallet_address = userData.wallet_address;
    this.scrum_role = userData.scrum_role;
    this.is_active = userData.is_active;
    this.created_at = userData.created_at;
    this.updated_at = userData.updated_at;
  }

  
  static async create(userData) {
    const { username, email, password, full_name } = userData;
    
    
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    
    
    const temp_wallet_address = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const query = `
      INSERT INTO users (username, email, password_hash, full_name, wallet_address)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, email, full_name, wallet_address, scrum_role, is_active, created_at
    `;

    try {
      const result = await pool.query(query, [
        username, 
        email, 
        password_hash, 
        full_name, 
        temp_wallet_address
      ]);
      return new User(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  
  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
    
    try {
      const result = await pool.query(query, [email]);
      return result.rows.length > 0 ? new User(result.rows[0]) : null;
    } catch (error) {
      throw error;
    }
  }

  
  static async findByUsername(username) {
    const query = 'SELECT * FROM users WHERE username = $1 AND is_active = true';
    
    try {
      const result = await pool.query(query, [username]);
      return result.rows.length > 0 ? new User(result.rows[0]) : null;
    } catch (error) {
      throw error;
    }
  }

  
  static async findByIdWithTeams(id) {
    const query = `
      SELECT 
        u.*,
        COALESCE(
          json_agg(
            CASE 
              WHEN g.id IS NOT NULL 
              THEN json_build_object(
                'id', g.id,
                'name', g.name,
                'description', g.description,
                'created_at', g.created_at,
                'role', gm.role
              )
              ELSE NULL
            END
          ) FILTER (WHERE g.id IS NOT NULL), 
          '[]'::json
        ) as teams
      FROM users u
      LEFT JOIN group_members gm ON u.id = gm.user_id
      LEFT JOIN groups g ON gm.group_id = g.id
      WHERE u.id = $1 AND u.is_active = true
      GROUP BY u.id
    `;
    
    try {
      const result = await pool.query(query, [id]);
      if (result.rows.length > 0) {
        const userData = result.rows[0];
        const user = new User(userData);
        user.teams = userData.teams;
        return user;
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  
  static async findByEmailWithTeams(email) {
    const query = `
      SELECT 
        u.*,
        COALESCE(
          json_agg(
            CASE 
              WHEN g.id IS NOT NULL 
              THEN json_build_object(
                'id', g.id,
                'name', g.name,
                'description', g.description,
                'created_at', g.created_at,
                'role', gm.role
              )
              ELSE NULL
            END
          ) FILTER (WHERE g.id IS NOT NULL), 
          '[]'::json
        ) as teams
      FROM users u
      LEFT JOIN group_members gm ON u.id = gm.user_id
      LEFT JOIN groups g ON gm.group_id = g.id
      WHERE u.email = $1 AND u.is_active = true
      GROUP BY u.id
    `;
    
    try {
      const result = await pool.query(query, [email]);
      if (result.rows.length > 0) {
        const userData = result.rows[0];
        const user = new User(userData);
        user.teams = userData.teams;
        return user;
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  
  static async findByUsernameWithTeams(username) {
    const query = `
      SELECT 
        u.*,
        COALESCE(
          json_agg(
            CASE 
              WHEN g.id IS NOT NULL 
              THEN json_build_object(
                'id', g.id,
                'name', g.name,
                'description', g.description,
                'created_at', g.created_at,
                'role', gm.role
              )
              ELSE NULL
            END
          ) FILTER (WHERE g.id IS NOT NULL), 
          '[]'::json
        ) as teams
      FROM users u
      LEFT JOIN group_members gm ON u.id = gm.user_id
      LEFT JOIN groups g ON gm.group_id = g.id
      WHERE u.username = $1 AND u.is_active = true
      GROUP BY u.id
    `;
    
    try {
      const result = await pool.query(query, [username]);
      if (result.rows.length > 0) {
        const userData = result.rows[0];
        const user = new User(userData);
        user.teams = userData.teams;
        return user;
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  
  static async findById(id) {
    const query = 'SELECT * FROM users WHERE id = $1 AND is_active = true';
    
    try {
      const result = await pool.query(query, [id]);
      return result.rows.length > 0 ? new User(result.rows[0]) : null;
    } catch (error) {
      throw error;
    }
  }

  
  static async findByWalletAddress(wallet_address) {
    const query = 'SELECT * FROM users WHERE wallet_address = $1 AND is_active = true';
    
    try {
      const result = await pool.query(query, [wallet_address]);
      return result.rows.length > 0 ? new User(result.rows[0]) : null;
    } catch (error) {
      throw error;
    }
  }

  
  async verifyPassword(password) {
    return await bcrypt.compare(password, this.password_hash);
  }

  
  async update(updateData) {
    const allowedFields = ['full_name', 'email', 'wallet_address'];
    const fieldsToUpdate = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        fieldsToUpdate.push(`${field} = $${paramIndex}`);
        values.push(updateData[field]);
        paramIndex++;
      }
    }

    if (fieldsToUpdate.length === 0) {
      throw new Error('Nenhum campo válido fornecido para atualização');
    }

    fieldsToUpdate.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(this.id);

    const query = `
      UPDATE users 
      SET ${fieldsToUpdate.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, username, email, full_name, wallet_address, scrum_role, is_active, updated_at
    `;

    try {
      const result = await pool.query(query, values);
      if (result.rows.length > 0) {
        Object.assign(this, result.rows[0]);
        return this;
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  
  async deactivate() {
    const query = `
      UPDATE users 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [this.id]);
      if (result.rows.length > 0) {
        this.is_active = false;
        this.updated_at = result.rows[0].updated_at;
        return this;
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  
  static async findByWalletAddress(walletAddress) {
    const query = 'SELECT * FROM users WHERE wallet_address = $1 AND is_active = true';
    
    try {
      const result = await pool.query(query, [walletAddress.toLowerCase()]);
      return result.rows.length > 0 ? new User(result.rows[0]) : null;
    } catch (error) {
      throw error;
    }
  }

  
  static async linkWalletToUser(userId, walletAddress) {
    
    const existingUser = await User.findByWalletAddress(walletAddress);
    if (existingUser && existingUser.id !== userId) {
      throw new Error('Esta carteira já está vinculada a outro usuário');
    }

    const query = `
      UPDATE users 
      SET wallet_address = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND is_active = true
      RETURNING id, username, email, full_name, wallet_address, scrum_role, is_active, updated_at
    `;

    try {
      const result = await pool.query(query, [walletAddress.toLowerCase(), userId]);
      if (result.rows.length > 0) {
        return new User(result.rows[0]);
      }
      throw new Error('Usuário não encontrado');
    } catch (error) {
      throw error;
    }
  }

  
  static async unlinkWalletFromUser(userId) {
    const query = `
      UPDATE users 
      SET wallet_address = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND is_active = true
      RETURNING id, username, email, full_name, wallet_address, scrum_role, is_active, updated_at
    `;

    try {
      const result = await pool.query(query, [userId]);
      if (result.rows.length > 0) {
        return new User(result.rows[0]);
      }
      throw new Error('Usuário não encontrado');
    } catch (error) {
      throw error;
    }
  }

  
  static async hasWalletLinked(userId) {
    const query = 'SELECT wallet_address FROM users WHERE id = $1 AND is_active = true';
    
    try {
      const result = await pool.query(query, [userId]);
      if (result.rows.length > 0) {
        const walletAddress = result.rows[0].wallet_address;
        return walletAddress && !walletAddress.startsWith('temp_');
      }
      return false;
    } catch (error) {
      throw error;
    }
  }

  
  toJSON() {
    const { password_hash, ...userWithoutPassword } = this;
    return userWithoutPassword;
  }
}

module.exports = User;
