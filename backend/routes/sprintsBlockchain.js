const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const SprintService = require('../services/SprintService');
const SprintBlockchainService = require('../services/SprintBlockchainService');
const TaskService = require('../services/TaskService');
const TaskBlockchainService = require('../services/TaskBlockchainService');
const GroupMemberService = require('../services/GroupMemberService');
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
    console.log('🔍 Verificando se usuário é membro do grupo...');
    console.log('User ID:', req.user?.id);
    console.log('Group ID:', req.params.groupId);
    
    const groupId = parseInt(req.params.groupId);
    
    if (!req.user || !req.user.id) {
      console.error('❌ Usuário não encontrado no request');
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }
    
    console.log('🔍 Verificando membro com:', { userId: req.user.id, groupId });
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
  } catch (error) {
    console.error('❌ Erro ao verificar permissões do grupo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar permissões do grupo',
      error: error.message
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
    
    
    if (!['Scrum Master', 'Product Owner'].includes(member.role)) {
      return res.status(403).json({
        success: false,
        message: 'Apenas Scrum Master e Product Owner podem gerenciar sprints'
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
 * @desc Criar um novo sprint (PostgreSQL + Blockchain)
 * @access Private (Scrum Master e Product Owner)
 */
router.post('/:groupId/sprints',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Nome é obrigatório e deve ter até 100 caracteres'),
    body('description').optional().isLength({ max: 1000 }).withMessage('Descrição deve ter até 1000 caracteres'),
    body('startDate').isISO8601().withMessage('Data de início deve ser uma data válida'),
    body('endDate').isISO8601().withMessage('Data de fim deve ser uma data válida'),
    body('userAddress').optional().isEthereumAddress().withMessage('Endereço Ethereum inválido')
  ],
  handleValidationErrors,
  checkGroupMember,
  checkSprintPermission,
  async (req, res) => {
    try {
      const { name, description, startDate, endDate, userAddress } = req.body;
      
      
      if (new Date(endDate) <= new Date(startDate)) {
        return res.status(400).json({
          success: false,
          message: 'Data de fim deve ser posterior à data de início'
        });
      }

      
      if (new Date(startDate) < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Data de início não pode estar no passado'
        });
      }

      
      const sprint = await SprintBlockchainService.createSprint(
        req.groupId, 
        { name, description, startDate, endDate }, 
        req.user.id,
        userAddress || req.user.wallet_address
      );

      res.status(201).json({
        success: true,
        message: 'Sprint criado com sucesso na blockchain e banco de dados',
        data: sprint
      });
    } catch (error) {
      console.error('Erro ao criar sprint:', error);
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
      const sprints = await SprintService.getSprintsByGroup(req.groupId);

      res.json({
        success: true,
        message: 'Sprints encontrados',
        data: sprints,
        count: sprints.length
      });
    } catch (error) {
      console.error('Erro ao buscar sprints:', error);
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
 * @desc Atualizar status de um sprint (PostgreSQL + Blockchain)
 * @access Private (Scrum Master e Product Owner)
 */
router.put('/:groupId/sprints/:sprintId/status',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo'),
    body('status').isIn(['planning', 'active', 'completed', 'cancelled']).withMessage('Status inválido'),
    body('userAddress').optional().isEthereumAddress().withMessage('Endereço Ethereum inválido')
  ],
  handleValidationErrors,
  checkGroupMember,
  checkSprintPermission,
  async (req, res) => {
    try {
      const { status, userAddress } = req.body;
      const sprintId = parseInt(req.params.sprintId);

      const updatedSprint = await SprintBlockchainService.updateSprintStatus(
        sprintId,
        status,
        req.user.id,
        userAddress || req.user.wallet_address
      );

      res.json({
        success: true,
        message: 'Status do sprint atualizado com sucesso',
        data: updatedSprint
      });
    } catch (error) {
      console.error('Erro ao atualizar status do sprint:', error);
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
 * @desc Editar um sprint (PostgreSQL + Blockchain)
 * @access Private (Scrum Master e Product Owner)
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
    body('userAddress').optional().isEthereumAddress().withMessage('Endereço Ethereum inválido')
  ],
  handleValidationErrors,
  checkGroupMember,
  checkSprintPermission,
  async (req, res) => {
    try {
      const { name, description, startDate, endDate, userAddress } = req.body;
      const sprintId = parseInt(req.params.sprintId);

      
      if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
        return res.status(400).json({
          success: false,
          message: 'Data de fim deve ser posterior à data de início'
        });
      }

      const updatedSprint = await SprintBlockchainService.updateSprint(
        sprintId,
        { name, description, startDate, endDate },
        req.user.id,
        userAddress || req.user.wallet_address
      );

      res.json({
        success: true,
        message: 'Sprint editado com sucesso',
        data: updatedSprint
      });
    } catch (error) {
      console.error('Erro ao editar sprint:', error);
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
 * @desc Deletar um sprint (PostgreSQL + Blockchain)
 * @access Private (Scrum Master e Product Owner)
 */
router.delete('/:groupId/sprints/:sprintId',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo'),
    body('userAddress').optional().isEthereumAddress().withMessage('Endereço Ethereum inválido')
  ],
  handleValidationErrors,
  checkGroupMember,
  checkSprintPermission,
  async (req, res) => {
    try {
      const sprintId = parseInt(req.params.sprintId);
      const { userAddress } = req.body;

      const deletedSprint = await SprintBlockchainService.deleteSprint(
        sprintId,
        req.user.id,
        userAddress || req.user.wallet_address
      );

      res.json({
        success: true,
        message: 'Sprint removido com sucesso',
        data: deletedSprint
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
 * @route POST /api/groups/:groupId/sprints/:sprintId/tasks
 * @desc Criar uma nova tarefa (PostgreSQL + Blockchain)
 * @access Private (Membros do grupo)
 */
router.post('/:groupId/sprints/:sprintId/tasks',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo'),
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Título é obrigatório e deve ter até 200 caracteres'),
    body('description').optional().isLength({ max: 1000 }).withMessage('Descrição deve ter até 1000 caracteres'),
    body('assignedTo').optional().isInt().withMessage('ID do usuário atribuído deve ser um número'),
    body('estimatedHours').optional().isFloat({ min: 0 }).withMessage('Horas estimadas deve ser um número positivo'),
    body('userAddress').optional().isEthereumAddress().withMessage('Endereço Ethereum inválido'),
    body('assignedToAddress').optional().isEthereumAddress().withMessage('Endereço do usuário atribuído inválido')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      const { title, description, assignedTo, estimatedHours, userAddress, assignedToAddress } = req.body;
      const sprintId = parseInt(req.params.sprintId);

      
      const sprint = await SprintService.getSprintById(sprintId);
      if (!sprint) {
        return res.status(404).json({
          success: false,
          message: 'Sprint não encontrado'
        });
      }

      if (!sprint.blockchain_address) {
        return res.status(400).json({
          success: false,
          message: 'Sprint não está sincronizado com a blockchain'
        });
      }

      const taskData = {
        title,
        description,
        sprintId,
        groupId: req.groupId,
        assignedTo,
        estimatedHours,
        createdBy: req.user.id,
        blockchainSprintId: sprint.blockchain_address,
        assignedToAddress
      };

      const task = await TaskBlockchainService.createTask(
        taskData,
        req.user.id,
        userAddress || req.user.wallet_address
      );

      res.status(201).json({
        success: true,
        message: 'Tarefa criada com sucesso na blockchain e banco de dados',
        data: task
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

/**
 * @route GET /api/groups/:groupId/sprints/:sprintId/tasks
 * @desc Buscar tarefas de um sprint
 * @access Private (Membros do grupo)
 */
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
      const tasks = await TaskService.getTasksBySprintId(sprintId);

      res.json({
        success: true,
        message: 'Tarefas encontradas',
        data: tasks,
        count: tasks.length
      });
    } catch (error) {
      console.error('Erro ao buscar tarefas:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route PUT /api/groups/:groupId/sprints/:sprintId/tasks/:taskId/status
 * @desc Atualizar status de uma tarefa (PostgreSQL + Blockchain)
 * @access Private (Membros do grupo)
 */
router.put('/:groupId/sprints/:sprintId/tasks/:taskId/status',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo'),
    param('taskId').isInt({ min: 1 }).withMessage('ID da tarefa deve ser um número inteiro positivo'),
    body('status').isIn(['todo', 'in_progress', 'review', 'done', 'removed']).withMessage('Status inválido'),
    body('userAddress').optional().isEthereumAddress().withMessage('Endereço Ethereum inválido')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      const { status, userAddress } = req.body;
      const taskId = parseInt(req.params.taskId);

      const updatedTask = await TaskBlockchainService.updateTaskStatus(
        taskId,
        status,
        req.user.id,
        userAddress || req.user.wallet_address
      );

      res.json({
        success: true,
        message: 'Status da tarefa atualizado com sucesso',
        data: updatedTask
      });
    } catch (error) {
      console.error('Erro ao atualizar status da tarefa:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route PUT /api/groups/:groupId/sprints/:sprintId/tasks/:taskId
 * @desc Editar uma tarefa (PostgreSQL + Blockchain)
 * @access Private (Membros do grupo)
 */
router.put('/:groupId/sprints/:sprintId/tasks/:taskId',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo'),
    param('taskId').isInt({ min: 1 }).withMessage('ID da tarefa deve ser um número inteiro positivo'),
    body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Título deve ter até 200 caracteres'),
    body('description').optional().isLength({ max: 1000 }).withMessage('Descrição deve ter até 1000 caracteres'),
    body('assignedTo').optional().isInt().withMessage('ID do usuário atribuído deve ser um número'),
    body('estimatedHours').optional().isFloat({ min: 0 }).withMessage('Horas estimadas deve ser um número positivo'),
    body('userAddress').optional().isEthereumAddress().withMessage('Endereço Ethereum inválido')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      const { title, description, assignedTo, estimatedHours, userAddress } = req.body;
      const taskId = parseInt(req.params.taskId);

      const updatedTask = await TaskBlockchainService.updateTask(
        taskId,
        { title, description, assignedTo, estimatedHours },
        req.user.id,
        userAddress || req.user.wallet_address
      );

      res.json({
        success: true,
        message: 'Tarefa editada com sucesso',
        data: updatedTask
      });
    } catch (error) {
      console.error('Erro ao editar tarefa:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route DELETE /api/groups/:groupId/sprints/:sprintId/tasks/:taskId
 * @desc Deletar uma tarefa (PostgreSQL + Blockchain)
 * @access Private (Membros do grupo)
 */
router.delete('/:groupId/sprints/:sprintId/tasks/:taskId',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo'),
    param('taskId').isInt({ min: 1 }).withMessage('ID da tarefa deve ser um número inteiro positivo'),
    body('userAddress').optional().isEthereumAddress().withMessage('Endereço Ethereum inválido')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const { userAddress } = req.body;

      const deletedTask = await TaskBlockchainService.deleteTask(
        taskId,
        req.user.id,
        userAddress || req.user.wallet_address
      );

      res.json({
        success: true,
        message: 'Tarefa removida com sucesso',
        data: deletedTask
      });
    } catch (error) {
      console.error('Erro ao deletar tarefa:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route PUT /api/groups/:groupId/sprints/:sprintId/tasks/:taskId/start
 * @desc Iniciar uma tarefa (atualizar status para in_progress)
 * @access Private (Membros do grupo)
 */
router.put('/:groupId/sprints/:sprintId/tasks/:taskId/start',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo'),
    param('taskId').isInt({ min: 1 }).withMessage('ID da tarefa deve ser um número inteiro positivo'),
    body('userAddress').optional().isEthereumAddress().withMessage('Endereço Ethereum inválido')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const { userAddress } = req.body;

      const updatedTask = await TaskBlockchainService.startTask(
        taskId,
        req.user.id,
        userAddress || req.user.wallet_address
      );

      res.json({
        success: true,
        message: 'Tarefa iniciada com sucesso',
        data: updatedTask
      });
    } catch (error) {
      console.error('Erro ao iniciar tarefa:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route PUT /api/groups/:groupId/sprints/:sprintId/tasks/:taskId/complete
 * @desc Marcar tarefa como concluída (atualizar status para done)
 * @access Private (Membros do grupo)
 */
router.put('/:groupId/sprints/:sprintId/tasks/:taskId/complete',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('sprintId').isInt({ min: 1 }).withMessage('ID do sprint deve ser um número inteiro positivo'),
    param('taskId').isInt({ min: 1 }).withMessage('ID da tarefa deve ser um número inteiro positivo'),
    body('userAddress').optional().isEthereumAddress().withMessage('Endereço Ethereum inválido')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const { userAddress } = req.body;

      const updatedTask = await TaskBlockchainService.completeTask(
        taskId,
        req.user.id,
        userAddress || req.user.wallet_address
      );

      res.json({
        success: true,
        message: 'Tarefa marcada como concluída com sucesso',
        data: updatedTask
      });
    } catch (error) {
      console.error('Erro ao completar tarefa:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

module.exports = router;
