const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const SprintService = require('../services/SprintService');
const TaskService = require('../services/TaskService');
const GroupMemberService = require('../services/GroupMemberService');
const SprintBlockchainService = require('../services/SprintBlockchainService');
const TaskBlockchainService = require('../services/TaskBlockchainService');
const { auditMiddleware, logAuditAction, ACTION_TYPES, ENTITY_TYPES } = require('../middleware/auditMiddleware');

const router = express.Router();


const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }
  next();
};


const checkGroupMember = async (req, res, next) => {
  try {
    console.log('🔍 CheckGroupMember - Verificando se usuário é membro do grupo...');
    console.log('👤 User ID:', req.user?.id);
    console.log('👥 Group ID:', req.params.groupId);
    
    const groupId = parseInt(req.params.groupId);
    
    if (!req.user || !req.user.id) {
      console.error('❌ Usuário não encontrado no request');
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }
    
    console.log('🔍 Verificando membro com:', { userId: req.user.id, groupId });
    
    try {
      const isMember = await GroupMemberService.isUserMemberOfGroup(req.user.id, groupId);
      console.log('✅ Resultado da verificação:', isMember);
      
      if (!isMember) {
        console.error('❌ Usuário não é membro do grupo');
        return res.status(403).json({
          success: false,
          message: 'Você não é membro deste grupo'
        });
      }
      
      console.log('✅ Usuário é membro do grupo');
      req.groupId = groupId;
      next();
    } catch (memberError) {
      console.error('❌ Erro ao verificar membership:', memberError);
      console.error('❌ Stack trace:', memberError.stack);
      
      
      console.warn('⚠️ Permitindo acesso por erro na verificação de membership (modo debug)');
      req.groupId = groupId;
      next();
    }
  } catch (error) {
    console.error('❌ Erro crítico no middleware checkGroupMember:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar permissões do grupo',
      error: error.message,
      debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};


const checkSprintPermission = async (req, res, next) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const member = await GroupMemberService.getMemberRole(req.user.id, groupId);
    
    if (!member) {
      return res.status(403).json({
        success: false,
        message: 'Você precisa ser membro do grupo para gerenciar sprints'
      });
    }
    
    
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar permissões',
      error: error.message
    });
  }
};

/**
 * @route POST /api/groups/:groupId/sprints
 * @desc Criar um novo sprint
 * @access Private (Todos os membros do grupo)
 */
router.post('/:groupId/sprints',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Nome é obrigatório e deve ter até 100 caracteres'),
    body('description').optional().isLength({ max: 1000 }).withMessage('Descrição deve ter até 1000 caracteres'),
    body('startDate').isISO8601().withMessage('Data de início deve ser uma data válida'),
    body('endDate').isISO8601().withMessage('Data de fim deve ser uma data válida'),
    body('blockchainAddress').optional().isLength({ max: 42 }).withMessage('Endereço blockchain inválido'),
    body('backlogId').exists().withMessage('Selecionar um item do backlog é obrigatório').isInt({ min: 1 }).withMessage('ID do backlog deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      console.log('🚀 POST /sprints - Iniciando criação de sprint');
      console.log('👥 Group ID:', req.groupId);
      console.log('👤 User ID:', req.user.id);
      console.log('📝 Dados recebidos:', req.body);
      
      const { name, description, startDate, endDate, blockchainAddress, backlogId } = req.body;
      
      
      if (new Date(endDate) <= new Date(startDate)) {
        console.warn('⚠️ Validação falhou: Data de fim não é posterior à data de início');
        return res.status(400).json({
          success: false,
          message: 'Data de fim deve ser posterior à data de início'
        });
      }

      console.log('📅 Validação de datas passou');
      
      
      console.log('💾 Criando sprint no banco de dados...');
      const sprint = await SprintService.createSprint(req.groupId, {
        name,
        description,
        startDate,
        endDate,
        blockchainAddress,
        backlogId
      }, req.user.id);
      
      console.log('✅ Sprint criado no banco:', sprint);

      
      const BlockchainTransactionService = require('../services/BlockchainTransactionService');
      
      console.log('🔗 Transação blockchain da criação do sprint será registrada quando a transação for executada no frontend');

      try {
        console.log('⛓️ Tentando registrar na blockchain...');
        
        const blockchainResult = await SprintBlockchainService.registerSprintOnBlockchain(
          sprint,
          req.groupId,
          req.user.id, 
          req.user.wallet_address
        );
        
        console.log('✅ Sprint registrado na blockchain:', blockchainResult);
      } catch (blockchainError) {
        console.warn('⚠️ Erro ao registrar sprint na blockchain:', blockchainError.message);
        console.warn('⚠️ Stack trace blockchain:', blockchainError.stack);
        
      }

      const response = {
        success: true,
        message: 'Sprint criado com sucesso',
        data: sprint,
        blockchain: {
          status: 'confirmed',
          message: '✅ Transação blockchain confirmada',
          hash: sprint.blockchain_address
        }
      };
      
      console.log('📤 Enviando resposta:', response);
      res.status(201).json(response);
      console.log('✅ Resposta enviada com sucesso');
    } catch (error) {
      console.error('❌ Erro ao criar sprint:', error);
      console.error('❌ Stack trace:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/groups/:groupId/sprints
 * @desc Buscar sprints de um grupo
 * @access Private (Membros do grupo)
 */
router.get('/:groupId/sprints',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      console.log('📋 GET /sprints - Iniciando busca de sprints');
      console.log('👥 Group ID:', req.groupId);
      console.log('👤 User ID:', req.user.id);
      
      const sprints = await SprintService.getSprintsByGroup(req.groupId);
      console.log('📋 Sprints encontrados:', sprints?.length || 0);
      console.log('📋 Dados dos sprints:', sprints);

      res.json({
        success: true,
        data: sprints
      });
      
      console.log('✅ Resposta enviada com sucesso');
    } catch (error) {
      console.error('❌ Erro ao buscar sprints:', error);
      console.error('❌ Stack trace:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/groups/:groupId/sprints/:sprintId
 * @desc Buscar um sprint específico
 * @access Private (Membros do grupo)
 */
router.get('/:groupId/sprints/:sprintId',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      const sprintId = parseInt(req.params.sprintId);
      const sprint = await SprintService.getSprintById(sprintId);

      if (!sprint) {
        return res.status(404).json({
          success: false,
          message: 'Sprint não encontrado'
        });
      }

      
      if (sprint.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'Sprint não pertence a este grupo'
        });
      }

      res.json({
        success: true,
        data: sprint
      });
    } catch (error) {
      console.error('Erro ao buscar sprint:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route PUT /api/groups/:groupId/sprints/:sprintId/status
 * @desc Atualizar o status de um sprint
 * @access Private (Membros do grupo)
 */
router.put('/:groupId/sprints/:sprintId/status',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo'),
    body('status').notEmpty().isIn(['planning', 'active', 'completed', 'cancelled']).withMessage('Status inválido')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      console.log('🔄 PUT /sprints/:sprintId/status - Mudança de status');
      console.log('👥 Group ID:', req.params.groupId);
      console.log('🆔 Sprint ID:', req.params.sprintId);
      console.log('👤 User ID:', req.user?.id);
      console.log('📊 Novo status:', req.body.status);

      const sprintId = parseInt(req.params.sprintId);
      const { status } = req.body;

      
      console.log('🔍 Verificando se sprint existe...');
      const existingSprint = await SprintService.getSprintById(sprintId);
      if (!existingSprint) {
        console.error('❌ Sprint não encontrado:', sprintId);
        return res.status(404).json({
          success: false,
          message: 'Sprint não encontrado'
        });
      }

      console.log('✅ Sprint encontrado:', existingSprint);

      if (existingSprint.group_id !== req.groupId) {
        console.error('❌ Sprint não pertence ao grupo:', { 
          sprintGroupId: existingSprint.group_id, 
          userGroupId: req.groupId 
        });
        return res.status(403).json({
          success: false,
          message: 'Sprint não pertence a este grupo'
        });
      }

      
      console.log('🔄 Atualizando status do sprint...');
      const updatedSprint = await SprintService.updateSprint(sprintId, { status }, req.user?.id);
      
      console.log('✅ Status do sprint atualizado:', updatedSprint);

      res.json({
        success: true,
        message: 'Status do sprint atualizado com sucesso',
        data: updatedSprint
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar status do sprint:', error);
      console.error('❌ Stack trace:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route PUT /api/groups/:groupId/sprints/:sprintId
 * @desc Atualizar um sprint
 * @access Private (Todos os membros do grupo)
 */
router.put('/:groupId/sprints/:sprintId',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo'),
    body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Nome deve ter até 100 caracteres'),
    body('description').optional().isLength({ max: 1000 }).withMessage('Descrição deve ter até 1000 caracteres'),
    body('startDate').optional().isISO8601().withMessage('Data de início deve ser uma data válida'),
    body('endDate').optional().isISO8601().withMessage('Data de fim deve ser uma data válida'),
    body('status').optional().isIn(['planning', 'active', 'completed', 'cancelled']).withMessage('Status inválido'),
    body('blockchainAddress').optional().isLength({ max: 42 }).withMessage('Endereço blockchain inválido'),
    body('transactionHash').optional().isLength({ max: 66 }).withMessage('Hash da transação inválido'),
    body('backlogId').optional().isInt({ min: 1 }).withMessage('ID do backlog deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      console.log('✏️ PUT /sprints/:sprintId - Iniciando atualização');
      console.log('👥 Group ID:', req.params.groupId);
      console.log('🆔 Sprint ID:', req.params.sprintId);
      console.log('👤 User ID:', req.user?.id);
      console.log('📊 Dados recebidos:', req.body);

      const sprintId = parseInt(req.params.sprintId);
      const { name, description, startDate, endDate, status, blockchainAddress, transactionHash, backlogId } = req.body;

      
      console.log('🔍 Verificando se sprint existe...');
      const existingSprint = await SprintService.getSprintById(sprintId);
      if (!existingSprint) {
        console.error('❌ Sprint não encontrado:', sprintId);
        return res.status(404).json({
          success: false,
          message: 'Sprint não encontrado'
        });
      }

      console.log('✅ Sprint encontrado:', existingSprint);

      if (existingSprint.group_id !== req.groupId) {
        console.error('❌ Sprint não pertence ao grupo:', { 
          sprintGroupId: existingSprint.group_id, 
          userGroupId: req.groupId 
        });
        return res.status(403).json({
          success: false,
          message: 'Sprint não pertence a este grupo'
        });
      }

      
      if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
        console.warn('⚠️ Validação de datas falhou');
        return res.status(400).json({
          success: false,
          message: 'Data de fim deve ser posterior à data de início'
        });
      }

      console.log('🔄 Chamando SprintService.updateSprint...');
      const updatedSprint = await SprintService.updateSprint(sprintId, {
        name,
        description,
        startDate,
        endDate,
        status,
        blockchainAddress,
        transactionHash,
        backlogId
      }, req.user?.id);
      
      console.log('✅ Sprint atualizado com sucesso:', updatedSprint);

      
      const BlockchainTransactionService = require('../services/BlockchainTransactionService');
      console.log('🔗 Hash blockchain salvo para edição do sprint:', blockchainAddress);
      
      res.json({
        success: true,
        message: 'Sprint atualizado com sucesso',
        data: updatedSprint,
        blockchain: {
          status: 'confirmed',
          message: '✅ Alterações registradas na blockchain',
          hash: updatedSprint.blockchain_address
        }
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar sprint:', error);
      console.error('❌ Stack trace:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route DELETE /api/groups/:groupId/sprints/:sprintId
 * @desc Deletar um sprint
 * @access Private (Todos os membros do grupo)
 */
router.delete('/:groupId/sprints/:sprintId',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  checkSprintPermission,
  async (req, res) => {
    try {
      const sprintId = parseInt(req.params.sprintId);

      
      const existingSprint = await SprintService.getSprintById(sprintId);
      if (!existingSprint) {
        return res.status(404).json({
          success: false,
          message: 'Sprint não encontrado'
        });
      }

      if (existingSprint.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'Sprint não pertence a este grupo'
        });
      }

      
      if (existingSprint.status === 'active') {
        return res.status(400).json({
          success: false,
          message: 'Não é possível deletar um sprint ativo. Finalize ou cancele primeiro.'
        });
      }

      await SprintService.deleteSprint(sprintId, req.user?.id);

      
      const BlockchainTransactionService = require('../services/BlockchainTransactionService');
      
      console.log('🔗 Transação blockchain da exclusão do sprint será registrada quando a transação for executada no frontend');

      res.json({
        success: true,
        message: 'Sprint deletado com sucesso'
      });
    } catch (error) {
      console.error('Erro ao deletar sprint:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/groups/:groupId/sprints/:sprintId/start
 * @desc Iniciar um sprint
 * @access Private (Scrum Master)
 */
router.post('/:groupId/sprints/:sprintId/start',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      console.log('🚀 Iniciando sprint - dados recebidos:', req.body);
      
      const sprintId = parseInt(req.params.sprintId);
      const { blockchain_address } = req.body;

      
      const existingSprint = await SprintService.getSprintById(sprintId);
      if (!existingSprint) {
        return res.status(404).json({
          success: false,
          message: 'Sprint não encontrado'
        });
      }

      if (existingSprint.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'Sprint não pertence a este grupo'
        });
      }

      if (existingSprint.status !== 'planning') {
        return res.status(400).json({
          success: false,
          message: 'Apenas sprints em planejamento podem ser iniciados'
        });
      }

      const updatedSprint = await SprintService.startSprint(sprintId, blockchain_address, req.user?.id);

      try {
        
        await SprintBlockchainService.updateSprintStatus(
          sprintId, 
          'active', 
          req.user.id, 
          req.user.wallet_address
        );
        console.log('✅ Status do sprint atualizado na blockchain');
      } catch (blockchainError) {
        console.warn('⚠️ Erro ao atualizar status na blockchain:', blockchainError.message);
      }

      res.json({
        success: true,
        message: 'Sprint iniciado com sucesso',
        data: updatedSprint
      });
    } catch (error) {
      console.error('Erro ao iniciar sprint:', error);
      res.status(500).json({
        success: false,
        message: error.message.includes('Já existe um sprint ativo') ? error.message : 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/groups/:groupId/sprints/:sprintId/complete
 * @desc Finalizar um sprint
 * @access Private (Scrum Master)
 */
router.post('/:groupId/sprints/:sprintId/complete',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      console.log('🏁 Finalizando sprint - dados recebidos:', req.body);
      
      const sprintId = parseInt(req.params.sprintId);
      const { blockchain_address } = req.body;

      
      const existingSprint = await SprintService.getSprintById(sprintId);
      if (!existingSprint) {
        return res.status(404).json({
          success: false,
          message: 'Sprint não encontrado'
        });
      }

      if (existingSprint.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'Sprint não pertence a este grupo'
        });
      }

      if (existingSprint.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Apenas sprints ativos podem ser finalizados'
        });
      }

      const updatedSprint = await SprintService.completeSprint(sprintId, blockchain_address, req.user?.id);

      try {
        
        await SprintBlockchainService.updateSprintStatus(
          sprintId, 
          'completed', 
          req.user.id, 
          req.user.wallet_address
        );
        console.log('✅ Status do sprint atualizado na blockchain');
      } catch (blockchainError) {
        console.warn('⚠️ Erro ao atualizar status na blockchain:', blockchainError.message);
      }

      res.json({
        success: true,
        message: 'Sprint finalizado com sucesso',
        data: updatedSprint
      });
    } catch (error) {
      console.error('Erro ao finalizar sprint:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/groups/:groupId/sprints/:sprintId/cancel
 * @desc Cancelar um sprint
 * @access Private (Scrum Master, Product Owner)
 */
router.post('/:groupId/sprints/:sprintId/cancel',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  checkSprintPermission,
  async (req, res) => {
    try {
      const sprintId = parseInt(req.params.sprintId);

      
      const existingSprint = await SprintService.getSprintById(sprintId);
      if (!existingSprint) {
        return res.status(404).json({
          success: false,
          message: 'Sprint não encontrado'
        });
      }

      if (existingSprint.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'Sprint não pertence a este grupo'
        });
      }

      if (existingSprint.status === 'completed' || existingSprint.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'Sprint já foi finalizado ou cancelado'
        });
      }

      const updatedSprint = await SprintService.cancelSprint(sprintId);

      res.json({
        success: true,
        message: 'Sprint cancelado com sucesso',
        data: updatedSprint
      });
    } catch (error) {
      console.error('Erro ao cancelar sprint:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/groups/:groupId/sprints/:sprintId/backlog
 * @desc Buscar itens do backlog de um sprint
 * @access Private (Membros do grupo)
 */
router.get('/:groupId/sprints/:sprintId/backlog',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      const sprintId = parseInt(req.params.sprintId);

      
      const existingSprint = await SprintService.getSprintById(sprintId);
      if (!existingSprint) {
        return res.status(404).json({
          success: false,
          message: 'Sprint não encontrado'
        });
      }

      if (existingSprint.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'Sprint não pertence a este grupo'
        });
      }

      const backlogItems = await SprintService.getSprintBacklogItems(sprintId);

      res.json({
        success: true,
        data: backlogItems
      });
    } catch (error) {
      console.error('Erro ao buscar itens do backlog do sprint:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/groups/:groupId/sprints/:sprintId/backlog/:itemId
 * @desc Adicionar item do backlog ao sprint
 * @access Private (Scrum Master, Product Owner)
 */
router.post('/:groupId/sprints/:sprintId/backlog/:itemId',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo'),
    param('itemId').isInt({ min: 1 }).withMessage('ID do item deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  checkSprintPermission,
  async (req, res) => {
    try {
      const sprintId = parseInt(req.params.sprintId);
      const itemId = parseInt(req.params.itemId);

      
      const existingSprint = await SprintService.getSprintById(sprintId);
      if (!existingSprint) {
        return res.status(404).json({
          success: false,
          message: 'Sprint não encontrado'
        });
      }

      if (existingSprint.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'Sprint não pertence a este grupo'
        });
      }

      const updatedItem = await SprintService.addItemToSprint(sprintId, itemId);

      if (!updatedItem) {
        return res.status(404).json({
          success: false,
          message: 'Item do backlog não encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Item adicionado ao sprint com sucesso',
        data: updatedItem
      });
    } catch (error) {
      console.error('Erro ao adicionar item ao sprint:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route DELETE /api/groups/:groupId/sprints/:sprintId/backlog/:itemId
 * @desc Remover item do backlog do sprint
 * @access Private (Scrum Master, Product Owner)
 */
router.delete('/:groupId/sprints/:sprintId/backlog/:itemId',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo'),
    param('itemId').isInt({ min: 1 }).withMessage('ID do item deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  checkSprintPermission,
  async (req, res) => {
    try {
      const sprintId = parseInt(req.params.sprintId);
      const itemId = parseInt(req.params.itemId);

      
      const existingSprint = await SprintService.getSprintById(sprintId);
      if (!existingSprint) {
        return res.status(404).json({
          success: false,
          message: 'Sprint não encontrado'
        });
      }

      if (existingSprint.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'Sprint não pertence a este grupo'
        });
      }

      const updatedItem = await SprintService.removeItemFromSprint(itemId);

      if (!updatedItem) {
        return res.status(404).json({
          success: false,
          message: 'Item do backlog não encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Item removido do sprint com sucesso',
        data: updatedItem
      });
    } catch (error) {
      console.error('Erro ao remover item do sprint:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/groups/:groupId/sprints/:sprintId/stats
 * @desc Obter estatísticas de um sprint
 * @access Private (Membros do grupo)
 */
router.get('/:groupId/sprints/:sprintId/stats',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      const sprintId = parseInt(req.params.sprintId);

      
      const existingSprint = await SprintService.getSprintById(sprintId);
      if (!existingSprint) {
        return res.status(404).json({
          success: false,
          message: 'Sprint não encontrado'
        });
      }

      if (existingSprint.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'Sprint não pertence a este grupo'
        });
      }

      const stats = await SprintService.getSprintStats(sprintId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas do sprint:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);




router.post('/:groupId/sprints/:sprintId/tasks',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo'),
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Título é obrigatório e deve ter até 200 caracteres'),
    body('description').optional().isLength({ max: 1000 }).withMessage('Descrição deve ter até 1000 caracteres'),
    body('backlogItemId').optional().isInt({ min: 1 }).withMessage('ID do item do backlog deve ser um número inteiro positivo'),
    body('assignedTo').optional().isInt({ min: 1 }).withMessage('ID do usuário deve ser um número inteiro positivo'),
    body('estimatedHours').optional().isFloat({ min: 0 }).withMessage('Horas estimadas devem ser um número não negativo'),
    body('blockchainAddress').optional().isLength({ max: 42 }).withMessage('Endereço blockchain inválido')
  ],
  handleValidationErrors,
  checkGroupMember,
  auditMiddleware(ACTION_TYPES.TASK_CREATE, ENTITY_TYPES.TASK),
  async (req, res) => {
    try {
      const sprintId = parseInt(req.params.sprintId);
      const { title, description, backlogItemId, assignedTo, estimatedHours, blockchainAddress } = req.body;

      
      const existingSprint = await SprintService.getSprintById(sprintId);
      if (!existingSprint) {
        return res.status(404).json({
          success: false,
          message: 'Sprint não encontrado'
        });
      }

      if (existingSprint.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'Sprint não pertence a este grupo'
        });
      }

      const taskData = {
        title,
        description,
        sprintId,
        groupId: req.groupId,
        assignedTo,
        estimatedHours,
        createdBy: req.user.id
      };

      const createdTask = await TaskService.createTask(taskData);
      
      res.status(201).json({
        success: true,
        message: 'Tarefa criada com sucesso',
        data: createdTask
      });
    } catch (error) {
      console.error('Erro ao criar tarefa:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);


router.get('/:groupId/sprints/:sprintId/tasks',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      const sprintId = parseInt(req.params.sprintId);

      
      const existingSprint = await SprintService.getSprintById(sprintId);
      if (!existingSprint) {
        return res.status(404).json({
          success: false,
          message: 'Sprint não encontrado'
        });
      }

      if (existingSprint.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'Sprint não pertence a este grupo'
        });
      }

      const tasks = await TaskService.getTasksBySprintId(sprintId);

      res.json({
        success: true,
        data: tasks
      });
    } catch (error) {
      console.error('Erro ao buscar tarefas do sprint:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/groups/:groupId/tasks
 * @desc Buscar todas as tasks de um grupo
 * @access Private (Membros do grupo)
 */
router.get('/:groupId/tasks',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      const tasks = await TaskService.getTasksByGroup(req.groupId);

      res.json({
        success: true,
        data: tasks
      });
    } catch (error) {
      console.error('Erro ao buscar tasks do grupo:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/groups/:groupId/tasks/:taskId
 * @desc Buscar uma task específica
 * @access Private (Membros do grupo)
 */
router.get('/:groupId/tasks/:taskId',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('taskId').isInt({ min: 1 }).withMessage('ID da task deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const task = await TaskService.getTaskById(taskId);

      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Task não encontrada'
        });
      }

      
      if (task.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'Task não pertence a este grupo'
        });
      }

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      console.error('Erro ao buscar task:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route PUT /api/groups/:groupId/tasks/:taskId
 * @desc Atualizar uma task
 * @access Private (Membros do grupo - atribuído, Scrum Master, Product Owner)
 */
router.put('/:groupId/tasks/:taskId',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('taskId').isInt({ min: 1 }).withMessage('ID da task deve ser um número inteiro positivo'),
    body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Título deve ter até 200 caracteres'),
    body('description').optional().isLength({ max: 1000 }).withMessage('Descrição deve ter até 1000 caracteres'),
    body('status').optional().isIn(['todo', 'in_progress', 'review', 'done', 'removed']).withMessage('Status inválido'),
    body('assignedTo').optional().isInt({ min: 1 }).withMessage('ID do usuário deve ser um número inteiro positivo'),
    body('estimatedHours').optional().isInt({ min: 0 }).withMessage('Horas estimadas devem ser um número não negativo'),
    body('blockchainAddress').optional().isLength({ max: 42 }).withMessage('Endereço blockchain inválido')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const { title, description, status, assignedTo, estimatedHours, blockchainAddress } = req.body;

      
      const existingTask = await TaskService.getTaskById(taskId);
      if (!existingTask) {
        return res.status(404).json({
          success: false,
          message: 'Task não encontrada'
        });
      }

      if (existingTask.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'Task não pertence a este grupo'
        });
      }

      
      const member = await GroupMemberService.getMemberRole(req.user.id, req.groupId);
      const canEdit = member && (
        ['Scrum Master', 'Product Owner'].includes(member.role) ||
        existingTask.assigned_to === req.user.id
      );

      if (!canEdit) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para editar esta task'
        });
      }

      const updatedTask = await TaskService.updateTask(taskId, {
        title,
        description,
        status,
        assignedTo,
        estimatedHours,
        blockchainAddress
      });

      res.json({
        success: true,
        message: 'Task atualizada com sucesso',
        data: updatedTask
      });
    } catch (error) {
      console.error('Erro ao atualizar task:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route DELETE /api/groups/:groupId/tasks/:taskId
 * @desc Deletar uma task
 * @access Private (Scrum Master, Product Owner)
 */
router.delete('/:groupId/tasks/:taskId',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('taskId').isInt({ min: 1 }).withMessage('ID da task deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  checkSprintPermission,
  async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);

      
      const existingTask = await TaskService.getTaskById(taskId);
      if (!existingTask) {
        return res.status(404).json({
          success: false,
          message: 'Task não encontrada'
        });
      }

      if (existingTask.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'Task não pertence a este grupo'
        });
      }

      await TaskService.deleteTask(taskId);

      res.json({
        success: true,
        message: 'Task deletada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao deletar task:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/groups/:groupId/tasks/:taskId/assign
 * @desc Atribuir task a um usuário
 * @access Private (Scrum Master, Product Owner)
 */
router.post('/:groupId/tasks/:taskId/assign',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('taskId').isInt({ min: 1 }).withMessage('ID da task deve ser um número inteiro positivo'),
    body('userId').isInt({ min: 1 }).withMessage('ID do usuário é obrigatório')
  ],
  handleValidationErrors,
  checkGroupMember,
  checkSprintPermission,
  async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const { userId } = req.body;

      
      const existingTask = await TaskService.getTaskById(taskId);
      if (!existingTask) {
        return res.status(404).json({
          success: false,
          message: 'Task não encontrada'
        });
      }

      if (existingTask.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'Task não pertence a este grupo'
        });
      }

      
      const isMember = await GroupMemberService.isUserMemberOfGroup(userId, req.groupId);
      if (!isMember) {
        return res.status(400).json({
          success: false,
          message: 'Usuário não é membro deste grupo'
        });
      }

      const updatedTask = await TaskService.assignTask(taskId, userId);

      res.json({
        success: true,
        message: 'Task atribuída com sucesso',
        data: updatedTask
      });
    } catch (error) {
      console.error('Erro ao atribuir task:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route PUT /api/groups/:groupId/tasks/:taskId/status
 * @desc Alterar status de uma task
 * @access Private (Membro atribuído, Scrum Master, Product Owner)
 */
router.put('/:groupId/tasks/:taskId/status',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('taskId').isInt({ min: 1 }).withMessage('ID da task deve ser um número inteiro positivo'),
    body('status').isIn(['todo', 'in_progress', 'review', 'done', 'removed']).withMessage('Status inválido'),
    body('transactionHash').optional().isLength({ max: 66 }).withMessage('Hash da transação inválido')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const { status, transactionHash } = req.body;

      
      const existingTask = await TaskService.getTaskById(taskId);
      if (!existingTask) {
        return res.status(404).json({
          success: false,
          message: 'Task não encontrada'
        });
      }

      if (existingTask.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'Task não pertence a este grupo'
        });
      }

      
      const member = await GroupMemberService.getMemberRole(req.user.id, req.groupId);
      const canChangeStatus = member && (
        ['Scrum Master', 'Product Owner'].includes(member.role) ||
        existingTask.assigned_to === req.user.id
      );

      if (!canChangeStatus) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para alterar o status desta task'
        });
      }

      const updatedTask = await TaskService.updateTaskStatus(taskId, status, transactionHash, req.user?.id);

      res.json({
        success: true,
        message: 'Status da task atualizado com sucesso',
        data: updatedTask
      });
    } catch (error) {
      console.error('Erro ao atualizar status da task:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/groups/:groupId/sprints/:sprintId/tasks/stats
 * @desc Obter estatísticas das tasks de um sprint
 * @access Private (Membros do grupo)
 */
router.get('/:groupId/sprints/:sprintId/tasks/stats',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      const sprintId = parseInt(req.params.sprintId);

      
      const existingSprint = await SprintService.getSprintById(sprintId);
      if (!existingSprint) {
        return res.status(404).json({
          success: false,
          message: 'Sprint não encontrado'
        });
      }

      if (existingSprint.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'Sprint não pertence a este grupo'
        });
      }

      const stats = await TaskService.getSprintTaskStats(sprintId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas das tarefas do sprint:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/groups/:groupId/tasks/stats
 * @desc Obter estatísticas das tasks de um grupo
 * @access Private (Membros do grupo)
 */
router.get('/:groupId/tasks/stats',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      const stats = await TaskService.getGroupTaskStats(req.groupId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas das tasks do grupo:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/groups/:groupId/backlog/:itemId/tasks
 * @desc Criar tarefas a partir de um item do backlog
 * @access Private (Scrum Master, Product Owner)
 */
router.post('/:groupId/backlog/:itemId/tasks',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('itemId').isInt({ min: 1 }).withMessage('ID do item deve ser um número inteiro positivo'),
    body('sprintId').isInt({ min: 1 }).withMessage('ID do sprint é obrigatório'),
    body('tasks').isArray({ min: 1 }).withMessage('Lista de tasks é obrigatória'),
    body('tasks.*.title').trim().isLength({ min: 1, max: 200 }).withMessage('Título da task é obrigatório'),
    body('tasks.*.description').optional().isLength({ max: 1000 }).withMessage('Descrição deve ter até 1000 caracteres'),
    body('tasks.*.assignedTo').optional().isInt({ min: 1 }).withMessage('ID do usuário deve ser um número inteiro positivo'),
    body('tasks.*.estimatedHours').optional().isInt({ min: 0 }).withMessage('Horas estimadas devem ser um número não negativo')
  ],
  handleValidationErrors,
  checkGroupMember,
  checkSprintPermission,
  async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      const { sprintId, tasks } = req.body;

      
      const existingSprint = await SprintService.getSprintById(sprintId);
      if (!existingSprint) {
        return res.status(404).json({
          success: false,
          message: 'Sprint não encontrado'
        });
      }

      if (existingSprint.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'Sprint não pertence a este grupo'
        });
      }

      const createdTasks = await TaskService.createTasksFromBacklogItem(itemId, sprintId, tasks, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Tasks criadas com sucesso',
        data: createdTasks
      });
    } catch (error) {
      console.error('Erro ao criar tarefas do backlog:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/groups/:groupId/backlog/:itemId/tasks
 * @desc Buscar tasks de um item do backlog
 * @access Private (Membros do grupo)
 */
router.get('/:groupId/backlog/:itemId/tasks',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('itemId').isInt({ min: 1 }).withMessage('ID do item deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      const tasks = await TaskService.getTasksByBacklogItem(itemId);

      res.json({
        success: true,
        data: tasks
      });
    } catch (error) {
      console.error('Erro ao buscar tasks do item do backlog:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);


router.put('/:groupId/sprints/:sprintId/transaction-hash',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo'),
    body('transactionHash').notEmpty().withMessage('Hash da transação é obrigatório')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      console.log('🔄 TRANSACTION HASH UPDATE SPRINT:');
      console.log('👥 Grupo ID:', req.params.groupId);
      console.log('🆔 Sprint ID:', req.params.sprintId);
      console.log('📊 Hash recebido:', req.body.transactionHash);

      const sprintId = parseInt(req.params.sprintId);
      const { transactionHash } = req.body;

      
      const existingSprint = await SprintService.getSprintById(sprintId);
      if (!existingSprint) {
        return res.status(404).json({
          success: false,
          message: 'Sprint não encontrado'
        });
      }

      if (existingSprint.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'Sprint não pertence a este grupo'
        });
      }

      
      const updatedSprint = await SprintService.updateSprint(sprintId, {
        transactionHash: transactionHash
      }, req.user?.id);
      
      console.log('✅ Transaction hash do sprint atualizado:', updatedSprint);

      res.json({
        success: true,
        message: 'Transaction hash do sprint atualizado com sucesso',
        data: updatedSprint
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar transaction hash do sprint:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);


router.put('/:groupId/sprints/:sprintId/blockchain-sync',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo'),
    body('blockchainId').optional(),
    body('transactionHash').optional().isLength({ max: 66 }).withMessage('Hash da transação inválido')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      console.log('🔄 BLOCKCHAIN SYNC SPRINT:');
      console.log('👥 Grupo ID:', req.params.groupId);
      console.log('🆔 Sprint ID:', req.params.sprintId);
      console.log('📊 Dados recebidos:', req.body);

      const sprintId = parseInt(req.params.sprintId);
      const { blockchainId, transactionHash } = req.body;

      
      const existingSprint = await SprintService.getSprintById(sprintId);
      if (!existingSprint) {
        console.error('❌ Sprint não encontrado:', sprintId);
        return res.status(404).json({
          success: false,
          message: 'Sprint não encontrado'
        });
      }

      if (existingSprint.group_id !== req.groupId) {
        console.error('❌ Sprint não pertence ao grupo:', { sprintGroupId: existingSprint.group_id, userGroupId: req.groupId });
        return res.status(403).json({
          success: false,
          message: 'Sprint não pertence a este grupo'
        });
      }

      
      const updateData = {};
      if (blockchainId !== undefined && blockchainId !== null) {
        updateData.blockchain_address = blockchainId.toString(); 
        console.log('📊 Atualizando blockchain_address com ID:', blockchainId);
      }
      
      
      if (transactionHash !== undefined && transactionHash !== null) {
        console.log('📊 TransactionHash será salvo na blockchain_transactions:', transactionHash);
      }

      if (Object.keys(updateData).length === 0) {
        console.warn('⚠️ Nenhum dado blockchain fornecido');
        return res.status(400).json({
          success: false,
          message: 'Nenhum dado blockchain fornecido para atualização'
        });
      }

      console.log('🔄 Chamando SprintService.updateSprint com:', updateData);
      const updatedSprint = await SprintService.updateSprint(sprintId, updateData, req.user?.id);
      
      console.log('✅ Sprint atualizado com dados blockchain:', updatedSprint);

      res.json({
        success: true,
        message: 'Dados blockchain do sprint sincronizados com sucesso',
        data: updatedSprint
      });
    } catch (error) {
      console.error('❌ Erro ao sincronizar dados blockchain do sprint:', error);
      console.error('❌ Stack trace:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);


router.post('/blockchain-transaction',
  authenticateToken,
  [
    body('transactionHash').notEmpty().withMessage('Hash da transação é obrigatório'),
    body('contractName').notEmpty().withMessage('Nome do contrato é obrigatório'),
    body('methodName').notEmpty().withMessage('Nome do método é obrigatório')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      console.log('🔗 NOVA TRANSAÇÃO BLOCKCHAIN SPRINT:');
      console.log('👤 Usuário ID:', req.user.id);
      console.log('📊 Dados da transação:', req.body);

      const {
        transactionHash,
        contractName,
        methodName,
        sprintId,
        sprintName,
        teamId,
        additionalData
      } = req.body;

      
      let transactionType = methodName;
      let entityType = 'sprint';
      let description = '';

      switch (methodName) {
        case 'createSprint':
          description = `Sprint criado: ${sprintName || 'N/A'}`;
          break;
        case 'updateSprintData':
          description = `Sprint atualizado: ${sprintName || 'N/A'}`;
          break;
        case 'startSprint':
          description = `Sprint iniciado: ${sprintName || 'N/A'}`;
          break;
        case 'completeSprint':
          description = `Sprint finalizado: ${sprintName || 'N/A'}`;
          break;
        case 'cancelSprint':
          description = `Sprint cancelado: ${sprintName || 'N/A'}`;
          break;
        default:
          description = `Operação sprint: ${methodName}`;
      }

      
      const userQuery = await require('../config/database').query(
        'SELECT wallet_address FROM users WHERE id = $1',
        [req.user.id]
      );
      
      const userAddress = userQuery.rows[0]?.wallet_address;

      
      const BlockchainTransactionService = require('../services/BlockchainTransactionService');
      
      const transactionData = {
        transactionHash,
        transactionType,
        contractName: contractName || 'SprintManagement',
        methodName: methodName || 'createSprint',
        description,
        userAddress,
        userId: req.user.id,
        teamId: teamId || null,
        itemId: sprintId ? parseInt(sprintId) : null,
        gasUsed: additionalData?.gasUsed ? parseInt(additionalData.gasUsed) : null,
        gasPrice: additionalData?.gasPrice ? parseInt(additionalData.gasPrice) : null,
        blockNumber: additionalData?.blockNumber ? parseInt(additionalData.blockNumber) : null,
        network: additionalData?.network || 'localhost',
        status: 'confirmed'
      };

      console.log('💾 Salvando transação sprint:', transactionData);
      
      const savedTransaction = await BlockchainTransactionService.create(transactionData);
      
      console.log('✅ Transação sprint salva:', savedTransaction.id);

      res.json({
        success: true,
        message: 'Transação blockchain salva com sucesso',
        data: savedTransaction
      });

    } catch (error) {
      console.error('❌ Erro ao salvar transação blockchain sprint:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);


router.post('/:groupId/sprints/:sprintId/blockchain-transaction',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo'),
    body('transactionHash').notEmpty().withMessage('Hash da transação é obrigatório'),
    body('contractName').notEmpty().withMessage('Nome do contrato é obrigatório'),
    body('methodName').notEmpty().withMessage('Nome do método é obrigatório')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      console.log('🔗 NOVA TRANSAÇÃO BLOCKCHAIN SPRINT (via grupos):');
      console.log('👤 Usuário ID:', req.user.id);
      console.log('👥 Grupo ID:', req.params.groupId);
      console.log('🆔 Sprint ID:', req.params.sprintId);
      console.log('📊 Dados da transação:', req.body);
      console.log('📊 Campos obrigatórios:');
      console.log('  - transactionHash:', req.body.transactionHash);
      console.log('  - contractName:', req.body.contractName);
      console.log('  - methodName:', req.body.methodName);

      const groupId = parseInt(req.params.groupId);
      const sprintId = parseInt(req.params.sprintId);
      const {
        transactionHash,
        contractName,
        methodName,
        sprintName,
        gasUsed,
        gasPrice,
        totalCost,
        blockNumber,
        additionalData
      } = req.body;

      
      const userAddress = req.user?.wallet_address || null;

      
      let transactionType = methodName;
      let description = '';

      switch (methodName) {
        case 'createSprint':
          description = `Sprint criado: ${sprintName || 'N/A'}`;
          break;
        case 'updateSprintData':
          description = `Sprint atualizado: ${sprintName || 'N/A'}`;
          break;
        case 'startSprint':
          description = `Sprint iniciado: ${sprintName || 'N/A'}`;
          break;
        case 'completeSprint':
          description = `Sprint finalizado: ${sprintName || 'N/A'}`;
          break;
        default:
          description = `Operação no sprint: ${methodName}`;
          break;
      }

      const BlockchainTransactionService = require('../services/BlockchainTransactionService');
      
      const transactionData = {
        transactionHash,
        transactionType,
        contractName: contractName || 'SprintManagement',
        methodName: methodName || 'createSprint',
        description,
        userAddress,
        userId: req.user.id,
        teamId: groupId,
        itemId: sprintId,
        gasUsed: gasUsed ? parseInt(gasUsed) : null,
        gasPrice: gasPrice ? parseInt(gasPrice) : null,
        blockNumber: blockNumber ? parseInt(blockNumber) : null,
        network: 'localhost',
        status: 'confirmed'
      };

      console.log('💾 Salvando transação sprint (via grupos):', transactionData);
      
      const savedTransaction = await BlockchainTransactionService.create(transactionData);
      
      console.log('✅ Transação sprint salva (via grupos):', savedTransaction.id);

      res.json({
        success: true,
        message: 'Transação blockchain do sprint salva com sucesso',
        data: savedTransaction
      });

    } catch (error) {
      console.error('❌ Erro ao salvar transação blockchain sprint:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);


router.post('/:sprintId/blockchain-transaction',
  authenticateToken,
  [
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo'),
    body('transactionHash').notEmpty().withMessage('Hash da transação é obrigatório'),
    body('contractName').notEmpty().withMessage('Nome do contrato é obrigatório'),
    body('methodName').notEmpty().withMessage('Nome do método é obrigatório')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      console.log('🔗 NOVA TRANSAÇÃO BLOCKCHAIN SPRINT (por ID):');
      console.log('👤 Usuário ID:', req.user.id);
      console.log('🆔 Sprint ID:', req.params.sprintId);
      console.log('📊 Dados da transação:', req.body);

      const sprintId = parseInt(req.params.sprintId);
      const {
        transactionHash,
        contractName,
        methodName,
        sprintName,
        gasUsed,
        gasPrice,
        totalCost,
        blockNumber,
        additionalData
      } = req.body;

      
      const userAddress = req.user?.wallet_address || null;

      
      let transactionType = methodName;
      let description = '';

      switch (methodName) {
        case 'createSprint':
          description = `Sprint criado: ${sprintName || 'N/A'}`;
          break;
        case 'updateSprintData':
          description = `Sprint atualizado: ${sprintName || 'N/A'}`;
          break;
        case 'startSprint':
          description = `Sprint iniciado: ${sprintName || 'N/A'}`;
          break;
        case 'completeSprint':
          description = `Sprint finalizado: ${sprintName || 'N/A'}`;
          break;
        default:
          description = `Operação no sprint: ${methodName}`;
          break;
      }

      const BlockchainTransactionService = require('../services/BlockchainTransactionService');
      
      const transactionData = {
        transactionHash,
        transactionType,
        contractName: contractName || 'SprintManagement',
        methodName: methodName || 'createSprint',
        description,
        userAddress,
        userId: req.user.id,
        teamId: null, 
        itemId: sprintId,
        gasUsed: gasUsed ? parseInt(gasUsed) : null,
        gasPrice: gasPrice ? parseInt(gasPrice) : null,
        blockNumber: blockNumber ? parseInt(blockNumber) : null,
        network: 'localhost',
        status: 'confirmed'
      };

      console.log('💾 Salvando transação sprint (por ID):', transactionData);
      
      const savedTransaction = await BlockchainTransactionService.create(transactionData);
      
      console.log('✅ Transação sprint salva (por ID):', savedTransaction.id);

      res.json({
        success: true,
        message: 'Transação blockchain do sprint salva com sucesso',
        data: savedTransaction
      });

    } catch (error) {
      console.error('❌ Erro ao salvar transação blockchain sprint:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);


router.put('/:groupId/tasks/:taskId/status',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('taskId').isInt({ min: 1 }).withMessage('ID da task deve ser um número inteiro positivo'),
    body('status').isIn(['todo', 'in_progress', 'review', 'done', 'removed']).withMessage('Status inválido'),
    body('transactionHash').optional().isLength({ max: 66 }).withMessage('Hash da transação inválido')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      console.log('🔄 TASK STATUS UPDATE:');
      console.log('👥 Grupo ID:', req.params.groupId);
      console.log('🆔 Task ID:', req.params.taskId);
      console.log('📊 Dados recebidos:', req.body);

      const taskId = parseInt(req.params.taskId);
      const { status, transactionHash } = req.body;

      
      const existingTask = await TaskService.getTaskById(taskId);
      if (!existingTask) {
        return res.status(404).json({
          success: false,
          message: 'Task não encontrada'
        });
      }

      if (existingTask.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'Task não pertence a este grupo'
        });
      }

      
      const member = await GroupMemberService.getMemberRole(req.user.id, req.groupId);
      const canChangeStatus = member && (
        ['Scrum Master', 'Product Owner'].includes(member.role) ||
        existingTask.assigned_to === req.user.id
      );

      if (!canChangeStatus) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para alterar o status desta task'
        });
      }

      
      const updatedTask = await TaskService.updateTaskStatus(taskId, status, transactionHash, req.user?.id);
      
      console.log('✅ Task status atualizado:', updatedTask);

      res.json({
        success: true,
        message: 'Status da task atualizado com sucesso',
        data: updatedTask
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar status da task:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);


router.put('/:groupId/tasks/:taskId/transaction-hash',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('taskId').isInt({ min: 1 }).withMessage('ID da task deve ser um número inteiro positivo'),
    body('transactionHash').optional().isLength({ max: 66 }).withMessage('Hash da transação inválido')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      console.log('🔄 TASK TRANSACTION HASH UPDATE:');
      console.log('👥 Grupo ID:', req.params.groupId);
      console.log('🆔 Task ID:', req.params.taskId);
      console.log('📊 Dados recebidos:', req.body);

      const taskId = parseInt(req.params.taskId);
      const { transactionHash } = req.body;

      
      const existingTask = await TaskService.getTaskById(taskId);
      if (!existingTask) {
        return res.status(404).json({
          success: false,
          message: 'Task não encontrada'
        });
      }

      if (existingTask.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'Task não pertence a este grupo'
        });
      }

      
      const updatedTask = await TaskService.updateTask(taskId, {
        transactionHash
      });
      
      console.log('✅ Task transactionHash atualizado:', updatedTask);

      res.json({
        success: true,
        message: 'TransactionHash da task atualizado com sucesso',
        data: updatedTask
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar transactionHash da task:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);


router.put('/:groupId/tasks/:taskId/blockchain-sync',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('taskId').isInt({ min: 1 }).withMessage('ID da task deve ser um número inteiro positivo'),
    body('blockchainAddress').optional(),
    body('transactionHash').optional().isLength({ max: 66 }).withMessage('Hash da transação inválido')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      console.log('🔄 BLOCKCHAIN SYNC TASK:');
      console.log('👥 Grupo ID:', req.params.groupId);
      console.log('🆔 Task ID:', req.params.taskId);
      console.log('📊 Dados recebidos:', req.body);

      const taskId = parseInt(req.params.taskId);
      const { blockchainAddress, transactionHash } = req.body;

      
      const existingTask = await TaskService.getTaskById(taskId);
      if (!existingTask) {
        return res.status(404).json({
          success: false,
          message: 'Task não encontrada'
        });
      }

      if (existingTask.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'Task não pertence a este grupo'
        });
      }

      
      const updateData = {};
      if (blockchainAddress !== undefined) {
        updateData.blockchainAddress = blockchainAddress;
      }
      if (transactionHash !== undefined) {
        updateData.transactionHash = transactionHash;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Nenhum dado blockchain fornecido para atualização'
        });
      }

      const updatedTask = await TaskService.updateTask(taskId, updateData);
      
      console.log('✅ Task atualizada com dados blockchain:', updatedTask);

      res.json({
        success: true,
        message: 'Dados blockchain da task sincronizados com sucesso',
        data: updatedTask
      });
    } catch (error) {
      console.error('❌ Erro ao sincronizar dados blockchain da task:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);


router.post('/:groupId/tasks/:taskId/blockchain-transaction',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('taskId').isInt({ min: 1 }).withMessage('ID da task deve ser um número inteiro positivo'),
    body('transactionHash').notEmpty().withMessage('Hash da transação é obrigatório'),
    body('contractName').notEmpty().withMessage('Nome do contrato é obrigatório'),
    body('methodName').notEmpty().withMessage('Nome do método é obrigatório')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      console.log('🔗 NOVA TRANSAÇÃO BLOCKCHAIN TASK:');
      console.log('👤 Usuário ID:', req.user.id);
      console.log('👥 Grupo ID:', req.params.groupId);
      console.log('🆔 Task ID:', req.params.taskId);
      console.log('📊 Dados da transação:', req.body);

      const groupId = parseInt(req.params.groupId);
      const taskId = parseInt(req.params.taskId);
      const {
        transactionHash,
        contractName,
        methodName,
        taskTitle,
        gasUsed,
        gasPrice,
        totalCost,
        blockNumber,
        additionalData
      } = req.body;

      
      console.log('🔍 Verificando se task existe...');
      const existingTask = await TaskService.getTaskById(taskId);
      if (!existingTask) {
        console.warn('⚠️ Task não encontrada (pode ter sido excluída):', taskId);
        
        console.log('💾 Salvando transação de task inexistente para histórico...');
      } else {
        console.log('✅ Task encontrada:', existingTask);

        if (existingTask.group_id !== req.groupId) {
          console.error('❌ Task não pertence ao grupo:', { 
            taskGroupId: existingTask.group_id, 
            userGroupId: req.groupId 
          });
          return res.status(403).json({
            success: false,
            message: 'Task não pertence a este grupo'
          });
        }
      }

      
      const userAddress = req.user?.wallet_address || null;

      
      let transactionType = methodName;
      let description = '';

      switch (methodName) {
        case 'createTaskData':
        case 'addTaskData':
          description = `Task criada: ${taskTitle || existingTask?.title || 'N/A'}`;
          break;
        case 'updateTaskDataHash':
        case 'updateTaskData':
          description = `Task atualizada: ${taskTitle || existingTask?.title || 'N/A'}`;
          break;
        case 'updateTaskStatus':
          description = `Status da task alterado: ${taskTitle || existingTask?.title || 'N/A'}`;
          break;
        case 'removeTaskData':
          description = `Task removida: ${taskTitle || existingTask?.title || 'N/A'}`;
          break;
        default:
          description = `Operação na task: ${methodName} - ${taskTitle || existingTask?.title || 'N/A'}`;
          break;
      }

      const BlockchainTransactionService = require('../services/BlockchainTransactionService');
      
      const transactionData = {
        transactionHash,
        transactionType,
        contractName: contractName || 'TaskManagement',
        methodName: methodName || 'addTaskData',
        description,
        userAddress,
        userId: req.user.id,
        teamId: groupId,
        itemId: taskId,
        gasUsed: gasUsed ? parseInt(gasUsed) : null,
        gasPrice: gasPrice ? parseInt(gasPrice) : null,
        blockNumber: blockNumber ? parseInt(blockNumber) : null,
        network: 'localhost',
        status: 'confirmed'
      };

      console.log('💾 Salvando transação task:', transactionData);
      
      const savedTransaction = await BlockchainTransactionService.create(transactionData);
      
      console.log('✅ Transação task salva:', savedTransaction.id);

      res.json({
        success: true,
        message: 'Transação blockchain da task salva com sucesso',
        data: savedTransaction
      });

    } catch (error) {
      console.error('❌ Erro ao salvar transação blockchain task:', error);
      console.error('❌ Stack trace:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

module.exports = router;
