const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
  try {
    console.log('🔐 Middleware auth - Verificando token...');
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (!token) {
      console.error('❌ Token não fornecido');
      return res.status(401).json({
        success: false,
        message: 'Token de acesso requerido'
      });
    }

    console.log('🔍 Token encontrado, verificando...');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token decodificado:', { userId: decoded.id }); 
    
    
    const user = await User.findById(decoded.id); 
    if (!user || !user.is_active) {
      console.error('❌ Usuário não encontrado ou inativo:', decoded.id); 
      return res.status(401).json({
        success: false,
        message: 'Token inválido ou usuário não encontrado'
      });
    }

    console.log('✅ Usuário autenticado:', { id: user.id, email: user.email });
    
    
    req.userId = decoded.id; 
    req.user = user;
    
    next();
  } catch (error) {
    console.error('❌ Erro na autenticação:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }

    console.error('Erro na autenticação:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};


const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (user && user.is_active) {
      req.userId = decoded.userId;
      req.user = user;
    }

    next();
  } catch (error) {
    
    next();
  }
};

module.exports = {
  authenticateToken,
  optionalAuth
};
