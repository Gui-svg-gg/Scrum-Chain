const { body } = require('express-validator');


const validateRegister = [
  body('username')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('Nome de usuário deve ter entre 3 e 50 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Nome de usuário pode conter apenas letras, números e underscore'),

  body('email')
    .isEmail()
    .withMessage('Email deve ter um formato válido')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres'),


  body('full_name')
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome completo deve ter entre 2 e 100 caracteres')
    .trim(),

  body('wallet_address')
    .optional()
    .custom((value) => {
      if (value && value !== '' && !value.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new Error('Endereço de carteira deve ser um endereço Ethereum válido');
      }
      return true;
    })
];


const validateLogin = [
  body('emailOrUsername')
    .notEmpty()
    .withMessage('Email ou nome de usuário é obrigatório')
    .trim(),

  body('password')
    .notEmpty()
    .withMessage('Senha é obrigatória')
];


const validateUpdateProfile = [
  body('full_name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome completo deve ter entre 2 e 100 caracteres')
    .trim(),

  body('email')
    .optional()
    .isEmail()
    .withMessage('Email deve ter um formato válido')
    .normalizeEmail(),

  body('wallet_address')
    .optional()
    .custom((value) => {
      if (value && value !== '' && !value.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new Error('Endereço de carteira deve ser um endereço Ethereum válido');
      }
      return true;
    })
];

module.exports = {
  validateRegister,
  validateLogin,
  validateUpdateProfile
};
