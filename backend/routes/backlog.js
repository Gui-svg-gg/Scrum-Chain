const express = require('express');
const router = express.Router();
const BacklogService = require('../services/BacklogService');
const { authenticateToken } = require('../middleware/auth');


const validateBacklogPermission = (action) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const groupId = req.groupId || req.body.groupId || req.params.groupId;
      
      console.log('🔍 Middleware validateBacklogPermission:', { userId, groupId, action });
      
      if (!groupId) {
        console.error('❌ Group ID não fornecido');
        return res.status(400).json({
          success: false,
          message: 'Group ID é obrigatório'
        });
      }

      console.log('🔍 Chamando BacklogService.validatePermission...');
      const hasPermission = await BacklogService.validatePermission(userId, groupId, action);
      console.log('✅ Resultado da validação de permissão:', hasPermission);
      
      if (!hasPermission) {
        console.error('❌ Usuário sem permissão:', { userId, groupId, action });
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para esta ação'
        });
      }

      req.groupId = groupId;
      next();
    } catch (error) {
      console.error('❌ Erro ao validar permissão no middleware:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor ao validar permissões',
        error: error.message
      });
    }
  };
};

/**
 * @route GET /api/backlog/group/:groupId
 * @desc Buscar todos os itens do backlog de uma equipe
 * @access Private
 */
router.get('/group/:groupId', authenticateToken, validateBacklogPermission('read'), async (req, res) => {
  try {
    console.log('🔍 GET /group/:groupId - Iniciando busca para groupId:', req.params.groupId);
    const { groupId } = req.params;
    
    if (!groupId || isNaN(parseInt(groupId))) {
      return res.status(400).json({
        success: false,
        message: 'Group ID deve ser um número válido'
      });
    }
    
    console.log('🔍 Chamando BacklogService.getByGroupId com:', parseInt(groupId));
    const result = await BacklogService.getByGroupId(parseInt(groupId));
    console.log('✅ Resultado do BacklogService:', result);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Erro na rota GET /group/:groupId:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/backlog/
 * @desc Criar um novo item do backlog
 * @access Private
 */
router.post('/', authenticateToken, validateBacklogPermission('create'), async (req, res) => {
  try {
    console.log('🔍 POST / - Iniciando criação de item do backlog');
    console.log('📋 Body recebido:', JSON.stringify(req.body, null, 2));
    console.log('👤 Usuário:', req.user?.id);
    
    const { title, description, priority, storyPoints, groupId } = req.body;
    
    
    if (!title || title.trim().length === 0) {
      console.error('❌ Título não fornecido');
      return res.status(400).json({
        success: false,
        message: 'Título é obrigatório'
      });
    }
    
    if (!groupId) {
      console.error('❌ Group ID não fornecido');
      return res.status(400).json({
        success: false,
        message: 'Group ID é obrigatório'
      });
    }
    
    console.log('🔄 Convertendo prioridade:', { priority, type: typeof priority });
    
    
    let priorityNumber = 3; 
    if (priority) {
      if (typeof priority === 'number') {
        
        priorityNumber = priority;
      } else if (typeof priority === 'string') {
        
        switch (priority.toLowerCase()) {
          case 'critical':
          case 'urgent':
            priorityNumber = 1;
            break;
          case 'high':
            priorityNumber = 2;
            break;
          case 'medium':
            priorityNumber = 3;
            break;
          case 'low':
            priorityNumber = 4;
            break;
          default:
            priorityNumber = 3;
        }
      }
    }
    
    console.log('✅ Prioridade convertida:', priorityNumber);
    
    const itemData = {
      groupId: parseInt(groupId),
      title: title.trim(),
      description: description || '',
      priority: priorityNumber,
      storyPoints: parseInt(storyPoints) || 1,
      createdBy: req.user.id
    };
    
    console.log('🔍 Dados do item a ser criado:', JSON.stringify(itemData, null, 2));
    
    console.log('🔄 Chamando BacklogService.createItem...');
    const result = await BacklogService.createItem(itemData);
    console.log('✅ Item criado com sucesso:', result);

    
    const BlockchainTransactionService = require('../services/BlockchainTransactionService');
    
    console.log('🔗 Transação blockchain da criação do item do backlog será registrada quando a transação for executada no frontend');

    res.status(201).json({
      success: true,
      data: result,
      message: 'Item criado com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro na rota POST /:', error);
    console.error('📋 Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * @route PUT /api/backlog/:id
 * @desc Atualizar um item do backlog
 * @access Private
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 PUT /:id - Atualizando item do backlog');
    console.log('📋 ID:', req.params.id);
    
    const { id } = req.params;
    
    
    const existingItem = await BacklogService.getById(parseInt(id));
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: 'Item não encontrado'
      });
    }
    
    
    const hasPermission = await BacklogService.validatePermission(req.user.id, existingItem.group_id, 'update');
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para esta ação'
      });
    }
    console.log('📋 Body recebido:', JSON.stringify(req.body, null, 2));
    
    const { title, description, storyPoints, priority } = req.body;
    
    
    let priorityNumber = priority;
    if (typeof priority === 'string') {
      switch (priority.toLowerCase()) {
        case 'critical':
        case 'urgent':
          priorityNumber = 1;
          break;
        case 'high':
          priorityNumber = 2;
          break;
        case 'medium':
          priorityNumber = 3;
          break;
        case 'low':
          priorityNumber = 4;
          break;
        default:
          priorityNumber = 3;
      }
    }
    
    const updateData = {
      title,
      description,
      storyPoints: parseInt(storyPoints) || 1,
      priority: priorityNumber || 3
    };
    
    console.log('🔍 Dados para atualização:', JSON.stringify(updateData, null, 2));
    
    const result = await BacklogService.updateDetails(parseInt(id), updateData, req.user.id);
    console.log('✅ Item atualizado com sucesso:', result);

    
    const BlockchainTransactionService = require('../services/BlockchainTransactionService');
    
    console.log('🔗 Transação blockchain da edição do item do backlog será registrada quando a transação for executada no frontend');

    res.json({
      success: true,
      data: result,
      message: 'Item atualizado com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar item do backlog:', error);
    console.error('📋 Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * @route DELETE /api/backlog/:id
 * @desc Remover um item do backlog
 * @access Private
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    
    const existingItem = await BacklogService.getById(parseInt(id));
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: 'Item não encontrado'
      });
    }
    
    
    const itemData = {
      id: existingItem.id,
      title: existingItem.title,
      group_id: existingItem.group_id
    };
    
    
    const hasPermission = await BacklogService.validatePermission(req.user.id, existingItem.group_id, 'delete');
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para esta ação'
      });
    }
    
    const result = await BacklogService.removeItem(parseInt(id), req.user.id);

    
    const BlockchainTransactionService = require('../services/BlockchainTransactionService');
    
    console.log('🔗 Transação blockchain da exclusão do item do backlog será registrada quando a transação for executada no frontend');

    res.json({
      success: true,
      data: {
        ...result,
        deletedItem: itemData 
      },
      data: result,
      message: 'Item removido com sucesso'
    });
  } catch (error) {
    console.error('Erro ao remover item do backlog:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/backlog/:id
 * @desc Buscar um item específico do backlog
 * @access Private
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    
    const result = await BacklogService.getById(parseInt(id));
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Item não encontrado'
      });
    }
    
    
    const hasPermission = await BacklogService.validatePermission(req.user.id, result.group_id, 'read');
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para esta ação'
      });
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Erro ao buscar item do backlog:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

/**
 * @route PUT /api/backlog/:id/status
 * @desc Atualizar o status de um item do backlog
 * @access Private
 */
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    
    const existingItem = await BacklogService.getById(parseInt(id));
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: 'Item não encontrado'
      });
    }
    
    
    const hasPermission = await BacklogService.validatePermission(req.user.id, existingItem.group_id, 'update');
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para esta ação'
      });
    }
    
    const result = await BacklogService.updateStatus(parseInt(id), status, req.user.id);
    
    const BlockchainTransactionService = require('../services/BlockchainTransactionService');
    
    console.log('🔗 Transação blockchain da alteração de status do backlog será registrada quando a transação for executada no frontend');
    res.json({
      success: true,
      data: result,
      message: 'Status atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar status do item:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/backlog/:id/history
 * @desc Buscar histórico de mudanças de um item
 * @access Private
 */
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    
    const existingItem = await BacklogService.getById(parseInt(id));
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: 'Item não encontrado'
      });
    }
    
    
    const hasPermission = await BacklogService.validatePermission(req.user.id, existingItem.group_id, 'read');
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para esta ação'
      });
    }
    
    const result = await BacklogService.getChangeHistory(parseInt(id));
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Erro ao buscar histórico do item:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});


router.post('/:itemId/blockchain-transaction', authenticateToken, async (req, res) => {
  try {
    console.log('🔗 RECEBENDO TRANSAÇÃO BLOCKCHAIN DO BACKLOG:');
    console.log('📊 Params:', { itemId: req.params.itemId });
    console.log('📦 Body:', req.body);
    
    const { itemId } = req.params;
    const { 
      transactionHash,
      contractName,
      methodName,
      gasUsed,
      gasPrice,
      blockNumber,
      network,
      itemType,
      itemTitle,
      previousStatus,
      newStatus
    } = req.body;
    const userId = req.user.id;
    
    console.log('👤 Usuário:', userId);
    
    
    console.log('🔍 Buscando informações do item do backlog...');
    let groupId;
    
    
    if (methodName === 'removeBacklogItem') {
      console.log('🗑️ Operação de exclusão detectada, buscando groupId alternativo...');
      
      try {
        
        const BlockchainTransactionService = require('../services/BlockchainTransactionService');
        const previousTransaction = await BlockchainTransactionService.findByItemId(itemId);
        
        if (previousTransaction && previousTransaction.team_id) {
          groupId = previousTransaction.team_id;
          console.log('🔍 GroupId encontrado em transação anterior:', groupId);
        } else {
          
          const GroupService = require('../services/GroupService');
          const userGroups = await GroupService.getUserGroups(userId);
          if (userGroups.length > 0) {
            groupId = userGroups[0].id; 
            console.log('👥 GroupId obtido da equipe do usuário:', groupId);
          } else {
            throw new Error('Não foi possível determinar o groupId');
          }
        }
      } catch (error) {
        console.error('❌ Erro ao buscar groupId alternativo:', error);
        
        const GroupService = require('../services/GroupService');
        const userGroups = await GroupService.getUserGroups(userId);
        if (userGroups.length > 0) {
          groupId = userGroups[0].id;
          console.log('👥 GroupId obtido dos grupos do usuário como fallback:', groupId);
        } else {
          return res.status(400).json({
            success: false,
            message: 'Item não encontrado e não foi possível determinar o grupo'
          });
        }
      }
    } else {
      
      const backlogItem = await BacklogService.getById(itemId);
      if (!backlogItem) {
        return res.status(404).json({
          success: false,
          message: 'Item do backlog não encontrado'
        });
      }
      groupId = backlogItem.group_id;
    }
    
    console.log('🏢 Group ID final:', groupId);

    
    console.log('🔍 Buscando endereço da carteira do usuário...');
    const userQuery = await require('../config/database').query(
      'SELECT wallet_address FROM users WHERE id = $1',
      [userId]
    );
    
    const userAddress = userQuery.rows[0]?.wallet_address;
    console.log('🏠 Endereço da carteira:', userAddress);

    const BlockchainTransactionService = require('../services/BlockchainTransactionService');
    
    
    let transactionType = 'BACKLOG_UPDATE';
    let description = `Ação no backlog: ${methodName}`;
    
    if (methodName === 'registerBacklogItem') {
      transactionType = 'BACKLOG_ITEM_CREATION';
      description = `Item do backlog criado: "${itemTitle}"`;
    } else if (methodName === 'updateItemDataHash') {
      transactionType = 'BACKLOG_ITEM_UPDATE';
      description = `Item do backlog editado: "${itemTitle}"`;
    } else if (methodName === 'updateItemStatus') {
      transactionType = 'BACKLOG_STATUS_UPDATE';
      description = `Status do item "${itemTitle}" alterado de "${previousStatus}" para "${newStatus}"`;
    } else if (methodName === 'removeBacklogItem') {
      transactionType = 'BACKLOG_ITEM_DELETION';
      description = `Item do backlog excluído: "${itemTitle}"`;
    }
    
    const transactionData = {
      transactionHash,
      transactionType,
      contractName: contractName || 'ProductBacklog',
      methodName: methodName || 'backlogAction',
      description,
      userAddress,
      userId,
      teamId: parseInt(groupId),
      itemId: parseInt(itemId),
      gasUsed: gasUsed ? parseInt(gasUsed) : null,
      gasPrice: gasPrice ? parseInt(gasPrice) : null,
      blockNumber: blockNumber ? parseInt(blockNumber) : null,
      network: network || 'localhost',
      status: 'confirmed'
    };
    
    console.log('💾 Dados da transação para salvar:', transactionData);
    
    
    const transaction = await BlockchainTransactionService.create(transactionData);
    console.log('✅ Transação do backlog salva no banco:', transaction);

    res.json({
      success: true,
      message: 'Transação blockchain do backlog registrada com sucesso',
      data: transaction
    });
    
  } catch (error) {
    console.error('❌ ERRO AO REGISTRAR TRANSAÇÃO BLOCKCHAIN DO BACKLOG:');
    console.error('📄 Stack:', error.stack);
    console.error('📝 Message:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});

module.exports = router;
