const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');


const generateToken = (userId) => {
  return jwt.sign(
    { id: userId }, 
    process.env.JWT_SECRET || 'scrum_chain_super_secret_2024',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};


const register = async (req, res) => {
  try {
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos fornecidos',
        errors: errors.array()
      });
    }

    const { username, email, password, full_name } = req.body;

    
    const existingUserByEmail = await User.findByEmail(email);
    if (existingUserByEmail) {
      return res.status(409).json({
        success: false,
        message: 'Email já está em uso'
      });
    }

    const existingUserByUsername = await User.findByUsername(username);
    if (existingUserByUsername) {
      return res.status(409).json({
        success: false,
        message: 'Nome de usuário já está em uso'
      });
    }

    
    const newUser = await User.create({
      username,
      email,
      password,
      full_name
    });

    
    const token = generateToken(newUser.id);

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: {
        user: newUser.toJSON(),
        token
      }
    });

  } catch (error) {
    console.error('❌ Erro no registro:', error.message);
    console.error('🔍 Stack completo:', error.stack);
    
    
    if (error.message.includes('connect') || error.message.includes('ENOTFOUND')) {
      console.error('🔗 Erro de conexão com banco de dados detectado');
      console.error('💡 Verificar se PostgreSQL Railway está funcionando');
    }
    
    
    if (error.code === '23505') { 
      const field = error.constraint.includes('email') ? 'email' : 
                   error.constraint.includes('username') ? 'username' : 'campo';
      return res.status(409).json({
        success: false,
        message: `${field} já está em uso`
      });
    }

    
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      ...(isDevelopment && { 
        debug: {
          error: error.message,
          code: error.code,
          type: error.constructor.name
        }
      })
    });
  }
};


const login = async (req, res) => {
  try {
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos fornecidos',
        errors: errors.array()
      });
    }

    const { emailOrUsername, password } = req.body;

    
    let user = await User.findByEmailWithTeams(emailOrUsername);
    if (!user) {
      user = await User.findByUsernameWithTeams(emailOrUsername);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    
    const isPasswordValid = await user.verifyPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    
    const token = generateToken(user.id);

    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        user: user.toJSON(),
        token
      }
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};


const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        user: user.toJSON()
      }
    });

  } catch (error) {
    console.error('Erro ao obter perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};


const updateProfile = async (req, res) => {
  try {
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos fornecidos',
        errors: errors.array()
      });
    }

    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    const { full_name, email, wallet_address } = req.body;

    
    if (email && email !== user.email) {
      const existingUserByEmail = await User.findByEmail(email);
      if (existingUserByEmail && existingUserByEmail.id !== user.id) {
        return res.status(409).json({
          success: false,
          message: 'Email já está em uso'
        });
      }
    }

    
    if (wallet_address && wallet_address !== user.wallet_address) {
      const existingUserByWallet = await User.findByWalletAddress(wallet_address);
      if (existingUserByWallet) {
        return res.status(409).json({
          success: false,
          message: 'Endereço de carteira já está em uso'
        });
      }
    }

    
    const updatedUser = await user.update({
      full_name,
      email,
      wallet_address
    });

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: {
        user: updatedUser.toJSON()
      }
    });

  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Endereço de carteira já está em uso'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};


const logout = async (req, res) => {
  try {
    
    
    res.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });

  } catch (error) {
    console.error('Erro no logout:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};


const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Senha atual e nova senha são obrigatórias'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Nova senha deve ter pelo menos 6 caracteres'
      });
    }

    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    
    const isPasswordValid = await user.verifyPassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Senha atual incorreta'
      });
    }

    
    const bcrypt = require('bcryptjs');
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    const { pool } = require('../config/database');
    const query = `
      UPDATE users 
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, username, email, full_name, wallet_address, scrum_role, updated_at
    `;

    const result = await pool.query(query, [newPasswordHash, req.userId]);

    if (result.rows.length > 0) {
      res.json({
        success: true,
        message: 'Senha alterada com sucesso'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Erro ao atualizar senha'
      });
    }

  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};


const loginWithWallet = async (req, res) => {
  try {
    const { wallet_address } = req.body;

    if (!wallet_address) {
      return res.status(400).json({
        success: false,
        message: 'Endereço de carteira é obrigatório'
      });
    }

    
    const user = await User.findByWalletAddress(wallet_address);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado com este endereço de carteira'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Conta de usuário está inativa'
      });
    }

    
    const token = generateToken(user.id);

    res.json({
      success: true,
      message: 'Login com carteira realizado com sucesso',
      data: {
        user: user.toJSON(),
        token
      }
    });

  } catch (error) {
    console.error('Erro no login com carteira:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};


const syncWallet = async (req, res) => {
  try {
    const { wallet_address } = req.body;

    if (!wallet_address) {
      return res.status(400).json({
        success: false,
        message: 'Endereço de carteira é obrigatório'
      });
    }

    
    const existingUserByWallet = await User.findByWalletAddress(wallet_address);
    if (existingUserByWallet && existingUserByWallet.id !== req.userId) {
      return res.status(409).json({
        success: false,
        message: 'Endereço de carteira já está em uso por outro usuário'
      });
    }

    
    const { pool } = require('../config/database');
    const query = `
      UPDATE users 
      SET wallet_address = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, username, email, full_name, wallet_address, scrum_role, updated_at
    `;

    const result = await pool.query(query, [wallet_address, req.userId]);

    if (result.rows.length > 0) {
      
      const updatedUser = await User.findByIdWithTeams(req.userId);
      
      res.json({
        success: true,
        message: 'Carteira sincronizada com sucesso',
        data: {
          user: updatedUser.toJSON()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Erro ao sincronizar carteira'
      });
    }

  } catch (error) {
    console.error('Erro ao sincronizar carteira:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};


const linkWallet = async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const userId = req.userId;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Endereço da carteira é obrigatório'
      });
    }

    
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethAddressRegex.test(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Endereço da carteira inválido'
      });
    }

    
    const hasWallet = await User.hasWalletLinked(userId);
    if (hasWallet) {
      return res.status(409).json({
        success: false,
        message: 'Usuário já possui uma carteira vinculada'
      });
    }

    
    const updatedUser = await User.linkWalletToUser(userId, walletAddress);

    res.json({
      success: true,
      message: 'Carteira vinculada com sucesso',
      data: {
        user: updatedUser.toJSON()
      }
    });

  } catch (error) {
    console.error('Erro ao vincular carteira:', error);
    
    if (error.message === 'Esta carteira já está vinculada a outro usuário') {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};


const unlinkWallet = async (req, res) => {
  try {
    const userId = req.userId;

    
    const hasWallet = await User.hasWalletLinked(userId);
    if (!hasWallet) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não possui carteira vinculada'
      });
    }

    
    const updatedUser = await User.unlinkWalletFromUser(userId);

    res.json({
      success: true,
      message: 'Carteira desvinculada com sucesso',
      data: {
        user: updatedUser.toJSON()
      }
    });

  } catch (error) {
    console.error('Erro ao desvincular carteira:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};


const getWalletStatus = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findByIdWithTeams(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    const hasWallet = await User.hasWalletLinked(userId);
    const walletAddress = hasWallet ? user.wallet_address : null;

    res.json({
      success: true,
      data: {
        hasWallet,
        walletAddress,
        isLinked: hasWallet
      }
    });

  } catch (error) {
    console.error('Erro ao verificar status da carteira:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

module.exports = {
  register,
  login,
  loginWithWallet,
  getProfile,
  updateProfile,
  logout,
  changePassword,
  syncWallet,
  linkWallet,
  unlinkWallet,
  getWalletStatus
};
