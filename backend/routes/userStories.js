const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const UserStoryService = require('../services/UserStoryService');
const GroupMemberService = require('../services/GroupMemberService');

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
    const groupId = parseInt(req.params.groupId);
    const isMember = await GroupMemberService.isUserMemberOfGroup(req.user.id, groupId);
    
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Você não é membro deste grupo'
      });
    }
    
    req.groupId = groupId;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar permissões do grupo',
      error: error.message
    });
  }
};


const checkStoryPermission = async (req, res, next) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const member = await GroupMemberService.getMemberRole(req.user.id, groupId);
    
    if (!member || !['Scrum Master', 'Product Owner'].includes(member.role)) {
      return res.status(403).json({
        success: false,
        message: 'Apenas Scrum Master ou Product Owner podem gerenciar histórias'
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
 * @route POST /api/groups/:groupId/user-stories
 * @desc Criar uma nova história de usuário
 * @access Private (Product Owner)
 */
router.post('/:groupId/user-stories',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Título é obrigatório e deve ter até 200 caracteres'),
    body('description').optional().isLength({ max: 2000 }).withMessage('Descrição deve ter até 2000 caracteres'),
    body('acceptanceCriteria').optional().isLength({ max: 2000 }).withMessage('Critérios de aceitação devem ter até 2000 caracteres'),
    body('priority').optional().isInt({ min: 0, max: 3 }).withMessage('Prioridade deve ser um número entre 0 e 3'),
    body('storyPoints').optional().isInt({ min: 0 }).withMessage('Story points devem ser um número não negativo'),
    body('blockchainAddress').optional().isLength({ max: 42 }).withMessage('Endereço blockchain inválido')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      
      const member = await GroupMemberService.getMemberRole(req.user.id, req.groupId);
      if (!member || member.role !== 'Product Owner') {
        return res.status(403).json({
          success: false,
          message: 'Apenas o Product Owner pode criar histórias de usuário'
        });
      }

      const { title, description, acceptanceCriteria, priority, storyPoints, blockchainAddress } = req.body;

      const userStory = await UserStoryService.createUserStory(req.groupId, {
        title,
        description,
        acceptanceCriteria,
        priority,
        storyPoints,
        blockchainAddress
      }, req.user.id);

      res.status(201).json({
        success: true,
        message: 'História de usuário criada com sucesso',
        data: userStory
      });
    } catch (error) {
      console.error('Erro ao criar história de usuário:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/groups/:groupId/user-stories
 * @desc Buscar histórias de usuário de um grupo
 * @access Private (Membros do grupo)
 */
router.get('/:groupId/user-stories',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      const userStories = await UserStoryService.getUserStoriesByGroup(req.groupId);

      res.json({
        success: true,
        data: userStories
      });
    } catch (error) {
      console.error('Erro ao buscar histórias de usuário:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/groups/:groupId/product-backlog
 * @desc Buscar product backlog (histórias não atribuídas a sprints)
 * @access Private (Membros do grupo)
 */
router.get('/:groupId/product-backlog',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      const productBacklog = await UserStoryService.getProductBacklog(req.groupId);

      res.json({
        success: true,
        data: productBacklog
      });
    } catch (error) {
      console.error('Erro ao buscar product backlog:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/groups/:groupId/user-stories/:storyId
 * @desc Buscar uma história específica
 * @access Private (Membros do grupo)
 */
router.get('/:groupId/user-stories/:storyId',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('storyId').isInt({ min: 1 }).withMessage('ID da história deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      const storyId = parseInt(req.params.storyId);
      const userStory = await UserStoryService.getUserStoryById(storyId);

      if (!userStory) {
        return res.status(404).json({
          success: false,
          message: 'História de usuário não encontrada'
        });
      }

      
      if (userStory.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'História não pertence a este grupo'
        });
      }

      res.json({
        success: true,
        data: userStory
      });
    } catch (error) {
      console.error('Erro ao buscar história de usuário:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route PUT /api/groups/:groupId/user-stories/:storyId
 * @desc Atualizar uma história de usuário
 * @access Private (Product Owner, Scrum Master)
 */
router.put('/:groupId/user-stories/:storyId',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('storyId').isInt({ min: 1 }).withMessage('ID da história deve ser um número inteiro positivo'),
    body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Título deve ter até 200 caracteres'),
    body('description').optional().isLength({ max: 2000 }).withMessage('Descrição deve ter até 2000 caracteres'),
    body('acceptanceCriteria').optional().isLength({ max: 2000 }).withMessage('Critérios de aceitação devem ter até 2000 caracteres'),
    body('priority').optional().isInt({ min: 0, max: 3 }).withMessage('Prioridade deve ser um número entre 0 e 3'),
    body('storyPoints').optional().isInt({ min: 0 }).withMessage('Story points devem ser um número não negativo'),
    body('status').optional().isIn(['todo', 'in_progress', 'review', 'done', 'cancelled']).withMessage('Status inválido'),
    body('blockchainAddress').optional().isLength({ max: 42 }).withMessage('Endereço blockchain inválido')
  ],
  handleValidationErrors,
  checkGroupMember,
  checkStoryPermission,
  async (req, res) => {
    try {
      const storyId = parseInt(req.params.storyId);
      const { title, description, acceptanceCriteria, priority, storyPoints, status, blockchainAddress } = req.body;

      
      const existingStory = await UserStoryService.getUserStoryById(storyId);
      if (!existingStory) {
        return res.status(404).json({
          success: false,
          message: 'História de usuário não encontrada'
        });
      }

      if (existingStory.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'História não pertence a este grupo'
        });
      }

      const updatedStory = await UserStoryService.updateUserStory(storyId, {
        title,
        description,
        acceptanceCriteria,
        priority,
        storyPoints,
        status,
        blockchainAddress
      });

      res.json({
        success: true,
        message: 'História de usuário atualizada com sucesso',
        data: updatedStory
      });
    } catch (error) {
      console.error('Erro ao atualizar história de usuário:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route DELETE /api/groups/:groupId/user-stories/:storyId
 * @desc Deletar uma história de usuário
 * @access Private (Product Owner)
 */
router.delete('/:groupId/user-stories/:storyId',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('storyId').isInt({ min: 1 }).withMessage('ID da história deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      
      const member = await GroupMemberService.getMemberRole(req.user.id, req.groupId);
      if (!member || member.role !== 'Product Owner') {
        return res.status(403).json({
          success: false,
          message: 'Apenas o Product Owner pode deletar histórias de usuário'
        });
      }

      const storyId = parseInt(req.params.storyId);

      
      const existingStory = await UserStoryService.getUserStoryById(storyId);
      if (!existingStory) {
        return res.status(404).json({
          success: false,
          message: 'História de usuário não encontrada'
        });
      }

      if (existingStory.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'História não pertence a este grupo'
        });
      }

      await UserStoryService.deleteUserStory(storyId);

      res.json({
        success: true,
        message: 'História de usuário deletada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao deletar história de usuário:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/groups/:groupId/user-stories/:storyId/assign-sprint
 * @desc Atribuir história a um sprint
 * @access Private (Product Owner, Scrum Master)
 */
router.post('/:groupId/user-stories/:storyId/assign-sprint',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('storyId').isInt({ min: 1 }).withMessage('ID da história deve ser um número inteiro positivo'),
    body('sprintId').isInt({ min: 1 }).withMessage('ID do sprint é obrigatório')
  ],
  handleValidationErrors,
  checkGroupMember,
  checkStoryPermission,
  async (req, res) => {
    try {
      const storyId = parseInt(req.params.storyId);
      const { sprintId } = req.body;

      
      const existingStory = await UserStoryService.getUserStoryById(storyId);
      if (!existingStory) {
        return res.status(404).json({
          success: false,
          message: 'História de usuário não encontrada'
        });
      }

      if (existingStory.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'História não pertence a este grupo'
        });
      }

      const updatedStory = await UserStoryService.assignToSprint(storyId, sprintId);

      res.json({
        success: true,
        message: 'História atribuída ao sprint com sucesso',
        data: updatedStory
      });
    } catch (error) {
      console.error('Erro ao atribuir história ao sprint:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/groups/:groupId/user-stories/:storyId/remove-sprint
 * @desc Remover história de um sprint
 * @access Private (Product Owner, Scrum Master)
 */
router.post('/:groupId/user-stories/:storyId/remove-sprint',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('storyId').isInt({ min: 1 }).withMessage('ID da história deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  checkStoryPermission,
  async (req, res) => {
    try {
      const storyId = parseInt(req.params.storyId);

      
      const existingStory = await UserStoryService.getUserStoryById(storyId);
      if (!existingStory) {
        return res.status(404).json({
          success: false,
          message: 'História de usuário não encontrada'
        });
      }

      if (existingStory.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'História não pertence a este grupo'
        });
      }

      const updatedStory = await UserStoryService.removeFromSprint(storyId);

      res.json({
        success: true,
        message: 'História removida do sprint com sucesso',
        data: updatedStory
      });
    } catch (error) {
      console.error('Erro ao remover história do sprint:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route PUT /api/groups/:groupId/user-stories/:storyId/priority
 * @desc Alterar prioridade de uma história
 * @access Private (Product Owner)
 */
router.put('/:groupId/user-stories/:storyId/priority',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('storyId').isInt({ min: 1 }).withMessage('ID da história deve ser um número inteiro positivo'),
    body('priority').isInt({ min: 0, max: 3 }).withMessage('Prioridade deve ser um número entre 0 e 3')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      
      const member = await GroupMemberService.getMemberRole(req.user.id, req.groupId);
      if (!member || member.role !== 'Product Owner') {
        return res.status(403).json({
          success: false,
          message: 'Apenas o Product Owner pode alterar prioridades'
        });
      }

      const storyId = parseInt(req.params.storyId);
      const { priority } = req.body;

      
      const existingStory = await UserStoryService.getUserStoryById(storyId);
      if (!existingStory) {
        return res.status(404).json({
          success: false,
          message: 'História de usuário não encontrada'
        });
      }

      if (existingStory.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'História não pertence a este grupo'
        });
      }

      const updatedStory = await UserStoryService.updatePriority(storyId, priority);

      res.json({
        success: true,
        message: 'Prioridade da história atualizada com sucesso',
        data: updatedStory
      });
    } catch (error) {
      console.error('Erro ao atualizar prioridade da história:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route PUT /api/groups/:groupId/user-stories/:storyId/status
 * @desc Alterar status de uma história
 * @access Private (Membros do grupo)
 */
router.put('/:groupId/user-stories/:storyId/status',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo'),
    param('storyId').isInt({ min: 1 }).withMessage('ID da história deve ser um número inteiro positivo'),
    body('status').isIn(['todo', 'in_progress', 'review', 'done', 'cancelled']).withMessage('Status inválido')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      const storyId = parseInt(req.params.storyId);
      const { status } = req.body;

      
      const existingStory = await UserStoryService.getUserStoryById(storyId);
      if (!existingStory) {
        return res.status(404).json({
          success: false,
          message: 'História de usuário não encontrada'
        });
      }

      if (existingStory.group_id !== req.groupId) {
        return res.status(403).json({
          success: false,
          message: 'História não pertence a este grupo'
        });
      }

      const updatedStory = await UserStoryService.updateStatus(storyId, status);

      res.json({
        success: true,
        message: 'Status da história atualizado com sucesso',
        data: updatedStory
      });
    } catch (error) {
      console.error('Erro ao atualizar status da história:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/groups/:groupId/user-stories/stats
 * @desc Obter estatísticas das histórias de um grupo
 * @access Private (Membros do grupo)
 */
router.get('/:groupId/user-stories/stats',
  authenticateToken,
  [
    param('groupId').isInt({ min: 1 }).withMessage('ID do grupo deve ser um número inteiro positivo')
  ],
  handleValidationErrors,
  checkGroupMember,
  async (req, res) => {
    try {
      const stats = await UserStoryService.getGroupStoryStats(req.groupId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas das histórias:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/groups/:groupId/sprints/:sprintId/user-stories
 * @desc Buscar histórias de um sprint
 * @access Private (Membros do grupo)
 */
router.get('/:groupId/sprints/:sprintId/user-stories',
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
      const userStories = await UserStoryService.getUserStoriesBySprint(sprintId);

      res.json({
        success: true,
        data: userStories
      });
    } catch (error) {
      console.error('Erro ao buscar histórias do sprint:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/groups/:groupId/sprints/:sprintId/user-stories/stats
 * @desc Obter estatísticas das histórias de um sprint
 * @access Private (Membros do grupo)
 */
router.get('/:groupId/sprints/:sprintId/user-stories/stats',
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
      const stats = await UserStoryService.getSprintStoryStats(sprintId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas das histórias do sprint:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

module.exports = router;
