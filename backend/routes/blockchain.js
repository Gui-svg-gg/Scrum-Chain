const express = require('express');
const router = express.Router();
const BlockchainTransactionService = require('../services/BlockchainTransactionService');
const { authenticateToken } = require('../middleware/auth');




router.post('/transactions', authenticateToken, async (req, res) => {
  try {
    const {
      transactionHash,
      transactionType,
      contractName,
      methodName,
      description,
      userAddress,
      teamId,
      itemId,
      gasUsed,
      gasPrice,
      blockNumber,
      network,
      status
    } = req.body;
    
    const userId = req.user.id;
    
    if (!transactionHash || !transactionType) {
      return res.status(400).json({
        success: false,
        message: 'Hash da transação e tipo são obrigatórios'
      });
    }
    
    const transaction = await BlockchainTransactionService.create({
      transactionHash,
      transactionType,
      contractName,
      methodName,
      description,
      userAddress,
      userId,
      teamId,
      itemId,
      gasUsed,
      gasPrice,
      blockNumber,
      network,
      status
    });
    
    res.status(201).json({
      success: true,
      message: 'Transação registrada com sucesso',
      data: transaction
    });
    
  } catch (error) {
    console.error('Erro ao registrar transação:', error);
    
    if (error.code === '23505') { 
      return res.status(409).json({
        success: false,
        message: 'Transação já registrada'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});


router.put('/transactions/:hash', authenticateToken, async (req, res) => {
  try {
    const { hash } = req.params;
    const { status, blockNumber, gasUsed, errorMessage } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status é obrigatório'
      });
    }
    
    const transaction = await BlockchainTransactionService.updateStatus(
      hash, 
      status, 
      blockNumber, 
      gasUsed, 
      errorMessage
    );
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transação não encontrada'
      });
    }
    
    res.json({
      success: true,
      message: 'Status da transação atualizado',
      data: transaction
    });
    
  } catch (error) {
    console.error('Erro ao atualizar transação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});


router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      transactionType,
      contractName,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    const filters = {
      transactionType,
      contractName,
      status,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };
    
    
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined || filters[key] === null || filters[key] === '') {
        delete filters[key];
      }
    });
    
    const [transactions, total] = await Promise.all([
      BlockchainTransactionService.findByUser(userId, filters),
      BlockchainTransactionService.count({ userId, ...filters })
    ]);
    
    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar transações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});


router.get('/transactions/team/:teamId', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const {
      transactionType,
      status,
      page = 1,
      limit = 20
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    const filters = {
      transactionType,
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };
    
    
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined || filters[key] === null || filters[key] === '') {
        delete filters[key];
      }
    });
    
    const [transactions, total] = await Promise.all([
      BlockchainTransactionService.findByTeam(parseInt(teamId), filters),
      BlockchainTransactionService.count({ teamId: parseInt(teamId), ...filters })
    ]);
    
    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar transações da equipe:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});


router.get('/transactions/all', authenticateToken, async (req, res) => {
  try {
    
    
    const {
      transactionType,
      contractName,
      status,
      userAddress,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    const filters = {
      transactionType,
      contractName,
      status,
      userAddress,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };
    
    
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined || filters[key] === null || filters[key] === '') {
        delete filters[key];
      }
    });
    
    const [transactions, total] = await Promise.all([
      BlockchainTransactionService.findAll(filters),
      BlockchainTransactionService.count(filters)
    ]);
    
    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar todas as transações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});


router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { teamId } = req.query;
    
    const filters = { userId };
    if (teamId) {
      filters.teamId = parseInt(teamId);
    }
    
    const stats = await BlockchainTransactionService.getStats(filters);
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});


router.delete('/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const transaction = await BlockchainTransactionService.deleteById(parseInt(id));
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transação não encontrada'
      });
    }
    
    res.json({
      success: true,
      message: 'Transação deletada com sucesso',
      data: transaction
    });
    
  } catch (error) {
    console.error('Erro ao deletar transação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});


router.delete('/transactions', authenticateToken, async (req, res) => {
  try {
    
    
    const deletedCount = await BlockchainTransactionService.deleteAll();
    
    res.json({
      success: true,
      message: `${deletedCount} transações deletadas com sucesso`,
      deletedCount
    });
    
  } catch (error) {
    console.error('Erro ao deletar todas as transações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});

module.exports = router;
