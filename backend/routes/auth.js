const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { 
  validateRegister, 
  validateLogin, 
  validateUpdateProfile 
} = require('../validators/authValidators');
const { auditMiddleware, ACTION_TYPES, ENTITY_TYPES } = require('../middleware/auditMiddleware');

const router = express.Router();


router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Auth service está funcionando!',
    timestamp: new Date().toISOString()
  });
});


const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 1000, 
  message: {
    success: false,
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 1000, 
  message: {
    success: false,
    message: 'Muitas tentativas de registro. Tente novamente em 1 hora.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});


router.post('/register', registerLimiter, validateRegister, auditMiddleware(ACTION_TYPES.REGISTER, ENTITY_TYPES.USER), authController.register);
router.post('/login', authLimiter, validateLogin, auditMiddleware(ACTION_TYPES.LOGIN, ENTITY_TYPES.USER), authController.login);
router.post('/login-wallet', authLimiter, auditMiddleware(ACTION_TYPES.LOGIN, ENTITY_TYPES.USER), authController.loginWithWallet);


router.get('/profile', authenticateToken, authController.getProfile);
router.put('/profile', authenticateToken, validateUpdateProfile, authController.updateProfile);
router.put('/change-password', authenticateToken, authController.changePassword);
router.post('/logout', authenticateToken, authController.logout);
router.put('/sync-wallet', authenticateToken, authController.syncWallet);


router.post('/link-wallet', authenticateToken, auditMiddleware(ACTION_TYPES.UPDATE, ENTITY_TYPES.USER), authController.linkWallet);
router.delete('/unlink-wallet', authenticateToken, auditMiddleware(ACTION_TYPES.UPDATE, ENTITY_TYPES.USER), authController.unlinkWallet);
router.get('/wallet-status', authenticateToken, authController.getWalletStatus);


router.get('/verify', authenticateToken, (req, res) => {
  try {
    console.log('🔐 Verificando token para usuário:', req.user.email);
    
    res.json({
      success: true,
      message: 'Token válido',
      data: {
        user: {
          id: req.user.id,
          email: req.user.email,
          full_name: req.user.full_name,
          username: req.user.username,
          created_at: req.user.created_at
        }
      }
    });
  } catch (error) {
    console.error('❌ Erro na verificação do token:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
