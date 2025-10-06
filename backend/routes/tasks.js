const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken } = require('../middleware/auth');
const TaskService = require('../services/TaskService');
const GroupMemberService = require('../services/GroupMemberService');


const checkGroupMember = async (req, res, next) => {
  try {
    console.log('🔍 TASK API: Verificando membro do grupo...');
    console.log('👤 User ID:', req.user?.id);
    console.log('👥 Group ID:', req.params.groupId);
    
    const groupId = parseInt(req.params.groupId);
    
    if (!req.user || !req.user.id) {
      console.error('❌ TASK API: Usuário não encontrado no request');
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }
    
    console.log('🔍 TASK API: Verificando membro com:', { userId: req.user.id, groupId });
    
    try {
      const isMember = await GroupMemberService.isUserMemberOfGroup(req.user.id, groupId);
      console.log('✅ TASK API: Resultado da verificação:', isMember);
      
      if (!isMember) {
        console.error('❌ TASK API: Usuário não é membro do grupo');
        return res.status(403).json({
          success: false,
          message: 'Você não é membro deste grupo'
        });
      }
      
      console.log('✅ TASK API: Usuário é membro do grupo');
      req.groupId = groupId;
      next();
    } catch (memberError) {
      console.error('❌ TASK API: Erro ao verificar membership:', memberError);
      console.error('❌ TASK API: Stack trace:', memberError.stack);
      
      
      console.warn('⚠️ TASK API: Permitindo acesso por erro na verificação de membership (modo debug)');
      req.groupId = groupId;
      next();
    }
  } catch (error) {
    console.error('❌ TASK API: Erro crítico no middleware checkGroupMember:', error);
    console.error('❌ TASK API: Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar permissões do grupo',
      error: error.message,
      debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};


router.post('/:groupId/sprints/:sprintId/tasks', authenticateToken, checkGroupMember, async (req, res) => {
  try {
    console.log('📝 TASK API: Criando task...');
    console.log('Group ID:', req.params.groupId);
    console.log('Sprint ID:', req.params.sprintId);
    console.log('Data recebida no body:', req.body);
    console.log('🔍 blockchain_address no body:', req.body.blockchain_address);

    const { title, description, assignedTo, estimatedHours, blockchain_address } = req.body;

    console.log('🔍 blockchain_address após destructuring:', blockchain_address);

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Título da task é obrigatório'
      });
    }

    const taskData = {
      title: title.trim(),
      description: description?.trim() || null,
      sprintId: req.params.sprintId,
      groupId: req.params.groupId,
      assignedTo: assignedTo || null,
      estimatedHours: estimatedHours || null,
      createdBy: req.user.id,
      blockchain_address: blockchain_address || null
    };

    console.log('🔍 taskData preparado:', taskData);

    const createdTask = await TaskService.createTask(taskData);

    console.log('✅ TASK API: Task criada:', createdTask);

    console.log('🔗 Hash blockchain da task criada:', createdTask?.blockchain_address);

    res.status(201).json({
      success: true,
      message: 'Tarefa criada com sucesso',
      data: createdTask,
      blockchain: {
        status: 'confirmed',
        message: '✅ Task registrada na blockchain',
        hash: createdTask?.blockchain_address
      }
    });
  } catch (error) {
    console.error('❌ TASK API: Erro ao criar task:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});


router.get('/:groupId/sprints/:sprintId/tasks', authenticateToken, checkGroupMember, async (req, res) => {
  try {
    console.log('📋 TASK API: Listando tasks...');
    console.log('Group ID:', req.params.groupId);
    console.log('Sprint ID:', req.params.sprintId);

    const tasks = await TaskService.getTasksBySprintId(req.params.sprintId);

    console.log('✅ TASK API: Tasks encontradas:', tasks.length);

    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('❌ TASK API: Erro ao listar tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});


router.put('/:groupId/sprints/:sprintId/tasks/:taskId', authenticateToken, checkGroupMember, async (req, res) => {
  try {
    console.log('✏️ TASK API: Atualizando task...');
    console.log('Group ID:', req.params.groupId);
    console.log('Sprint ID:', req.params.sprintId);
    console.log('Task ID:', req.params.taskId);
    console.log('Data:', req.body);

    const { title, description, status, assignedTo, estimatedHours, blockchain_address } = req.body;

    const taskData = {
      title: title?.trim() || undefined,
      description: description?.trim() || undefined,
      status: status || undefined,
      assignedTo: assignedTo || undefined,
      estimatedHours: estimatedHours || undefined,
      blockchain_address: blockchain_address || undefined
    };

    const updatedTask = await TaskService.updateTask(req.params.taskId, taskData);

    if (!updatedTask) {
      return res.status(404).json({
        success: false,
        message: 'Task não encontrada'
      });
    }

    console.log('✅ TASK API: Task atualizada:', updatedTask);

    
    const BlockchainTransactionService = require('../services/BlockchainTransactionService');
    
    console.log('🔗 Transação blockchain da atualização da task será registrada quando a transação for executada no frontend');

    res.json({
      success: true,
      message: 'Task atualizada com sucesso',
      data: updatedTask
    });
  } catch (error) {
    console.error('❌ TASK API: Erro ao atualizar task:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});


router.put('/:groupId/tasks/:taskId', authenticateToken, checkGroupMember, async (req, res) => {
  try {
    console.log('✏️ TASK API: Atualizando task...');
    console.log('Group ID:', req.params.groupId);
    console.log('Task ID:', req.params.taskId);
    console.log('Data:', req.body);

    const { title, description, assignedTo, estimatedHours, blockchain_address, transactionHash } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Título da task é obrigatório'
      });
    }

    const taskData = {
      title: title.trim(),
      description: description?.trim() || null,
      assignedTo: assignedTo || null,
      estimatedHours: estimatedHours || null,
      blockchain_address: blockchain_address || null,
      transactionHash: transactionHash || null
    };

    const updated = await TaskService.updateTask(req.params.taskId, taskData, req.user?.id);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Task não encontrada'
      });
    }

    console.log('✅ TASK API: Task atualizada');

    
    const BlockchainTransactionService = require('../services/BlockchainTransactionService');
    if (req.body.transactionHash) {
      await BlockchainTransactionService.create({
        transactionHash: req.body.transactionHash,
        transactionType: 'task_edit',
        contractName: 'TaskManagement',
        methodName: 'editTask',
        description: `Edição da tarefa '${taskData.title}' pelo usuário ${req.user.id}`,
        userAddress: req.user.wallet_address || null,
        userId: req.user.id,
        teamId: req.params.groupId,
        itemId: req.params.taskId,
        gasUsed: req.body.gasUsed || null,
        gasPrice: req.body.gasPrice || null,
        blockNumber: req.body.blockNumber || null,
        network: req.body.network || 'localhost',
        status: req.body.status || 'confirmed'
      });
    }

    res.json({
      success: true,
      message: 'Task atualizada com sucesso',
      data: updated,
      blockchain: {
        status: 'confirmed',
        message: '✅ Alterações registradas na blockchain',
        hash: updated?.blockchain_address
      }
    });
  } catch (error) {
    console.error('❌ TASK API: Erro ao atualizar task:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});


router.put('/:groupId/tasks/:taskId/status', authenticateToken, checkGroupMember, async (req, res) => {
  try {
    console.log('🔄 TASK API: Atualizando status da task...');
    console.log('Group ID:', req.params.groupId);
    console.log('Task ID:', req.params.taskId);
    console.log('Novo status:', req.body.status);

    const { status } = req.body;
    
    const validStatuses = ['todo', 'in_progress', 'review', 'done', 'removed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status inválido'
      });
    }

    const updated = await TaskService.updateTaskStatus(req.params.taskId, status, req.body.transactionHash, req.user?.id);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Task não encontrada'
      });
    }

    console.log('✅ TASK API: Status atualizado');

    
    const BlockchainTransactionService = require('../services/BlockchainTransactionService');
    if (req.body.transactionHash) {
      await BlockchainTransactionService.create({
        transactionHash: req.body.transactionHash,
        transactionType: 'task_status_update',
        contractName: 'TaskManagement',
        methodName: 'updateTaskStatus',
        description: `Alteração de status da tarefa ${req.params.taskId} para '${status}' pelo usuário ${req.user.id}`,
        userAddress: req.user.wallet_address || null,
        userId: req.user.id,
        teamId: req.params.groupId,
        itemId: req.params.taskId,
        gasUsed: req.body.gasUsed || null,
        gasPrice: req.body.gasPrice || null,
        blockNumber: req.body.blockNumber || null,
        network: req.body.network || 'localhost',
        status: req.body.status || 'confirmed'
      });
    }

    res.json({
      success: true,
      message: 'Status da task atualizado com sucesso',
      data: updated,
      blockchain: {
        status: 'confirmed',
        message: '✅ Status registrado na blockchain',
        hash: updated?.blockchain_address
      }
    });
  } catch (error) {
    console.error('❌ TASK API: Erro ao atualizar status:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});


router.delete('/:groupId/tasks/:taskId', authenticateToken, checkGroupMember, async (req, res) => {
  try {
    console.log('🗑️ TASK API: Deletando task...');
    console.log('Group ID:', req.params.groupId);
    console.log('Task ID:', req.params.taskId);

    const deleted = await TaskService.deleteTask(req.params.taskId, req.user?.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Task não encontrada'
      });
    }

    console.log('✅ TASK API: Task deletada');

    
    const BlockchainTransactionService = require('../services/BlockchainTransactionService');
    if (req.body.transactionHash) {
      await BlockchainTransactionService.create({
        transactionHash: req.body.transactionHash,
        transactionType: 'task_delete',
        contractName: 'TaskManagement',
        methodName: 'deleteTask',
        description: `Exclusão da tarefa ${req.params.taskId} pelo usuário ${req.user.id}`,
        userAddress: req.user.wallet_address || null,
        userId: req.user.id,
        teamId: req.params.groupId,
        itemId: req.params.taskId,
        gasUsed: req.body.gasUsed || null,
        gasPrice: req.body.gasPrice || null,
        blockNumber: req.body.blockNumber || null,
        network: req.body.network || 'localhost',
        status: req.body.status || 'confirmed'
      });
    }

    res.json({
      success: true,
      message: 'Task deletada com sucesso'
    });
  } catch (error) {
    console.error('❌ TASK API: Erro ao deletar task:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});



router.post('/:groupId/tasks/:taskId/start', authenticateToken, checkGroupMember, async (req, res) => {
  try {
    console.log('▶️ TASK API: Iniciando task...');
    console.log('Group ID:', req.params.groupId);
    console.log('Task ID:', req.params.taskId);
    console.log('Data:', req.body);

    const { blockchain_address } = req.body;

    const taskData = {
      status: 'in_progress',
      blockchain_address: blockchain_address
    };

    const updated = await TaskService.updateTask(req.params.taskId, taskData);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Task não encontrada'
      });
    }

    console.log('✅ TASK API: Task iniciada');
    console.log('🔗 Hash blockchain salvo para início da task:', blockchain_address);

    res.json({
      success: true,
      message: 'Task iniciada com sucesso',
      data: updated
    });
  } catch (error) {
    console.error('❌ TASK API: Erro ao iniciar task:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});


router.post('/:groupId/tasks/:taskId/complete', authenticateToken, checkGroupMember, async (req, res) => {
  try {
    console.log('✅ TASK API: Completando task...');
    console.log('Group ID:', req.params.groupId);
    console.log('Task ID:', req.params.taskId);
    console.log('Data:', req.body);

    const { blockchain_address } = req.body;

    const taskData = {
      status: 'done',
      blockchain_address: blockchain_address
    };

    const updated = await TaskService.updateTask(req.params.taskId, taskData);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Task não encontrada'
      });
    }

    console.log('✅ TASK API: Task completada');
    console.log('🔗 Hash blockchain salvo para conclusão da task:', blockchain_address);

    res.json({
      success: true,
      message: 'Task completada com sucesso',
      data: updated
    });
  } catch (error) {
    console.error('❌ TASK API: Erro ao completar task:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});


router.post('/tasks/:taskId/assign', authenticateToken, checkGroupMember, async (req, res) => {
  try {
    console.log('👤 TASK API: Atribuindo task...');
    console.log('Task ID:', req.params.taskId);
    console.log('User ID:', req.body.userId);

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'ID do usuário é obrigatório'
      });
    }

    const updated = await TaskService.updateTask(req.params.taskId, { assignedTo: userId });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Task não encontrada'
      });
    }

    console.log('✅ TASK API: Task atribuída');

    res.json({
      success: true,
      message: 'Task atribuída com sucesso'
    });
  } catch (error) {
    console.error('❌ TASK API: Erro ao atribuir task:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});


router.get('/:groupId/tasks', authenticateToken, checkGroupMember, async (req, res) => {
  try {
    console.log('📋 TASK API: Listando todas as tasks do grupo...');
    console.log('Group ID:', req.params.groupId);

    const tasks = await TaskService.getTasksByGroup(req.params.groupId);

    console.log('✅ TASK API: Tasks encontradas:', tasks.length);

    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('❌ TASK API: Erro ao listar tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});


router.post('/:groupId/tasks/blockchain-transaction',
  authenticateToken,
  async (req, res) => {
    try {
      console.log('🔗 NOVA TRANSAÇÃO BLOCKCHAIN TAREFA (rota alternativa):');
      console.log('👤 Usuário ID:', req.user.id);
      console.log('👥 Grupo ID:', req.params.groupId);
      console.log('📊 Dados da transação:', req.body);

      const {
        transactionHash,
        contractName,
        methodName,
        taskId,
        taskTitle,
        sprintId,
        teamId,
        additionalData
      } = req.body;

      
      if (!transactionHash) {
        return res.status(400).json({
          success: false,
          message: 'Hash da transação é obrigatório'
        });
      }

      
      let transactionType = methodName;
      let description = '';

      switch (methodName) {
        case 'createTask':
          description = `Tarefa criada: ${taskTitle || 'N/A'}`;
          break;
        case 'updateTask':
          description = `Tarefa atualizada: ${taskTitle || 'N/A'}`;
          break;
        case 'updateTaskStatus':
          description = `Status da tarefa alterado: ${taskTitle || 'N/A'}`;
          break;
        case 'assignTask':
          description = `Tarefa atribuída: ${taskTitle || 'N/A'}`;
          break;
        case 'deleteTask':
          description = `Tarefa removida: ${taskTitle || 'N/A'}`;
          break;
        default:
          description = `Operação tarefa: ${methodName}`;
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
        contractName: contractName || 'TaskManagement',
        methodName,
        description,
        userAddress,
        userId: req.user.id,
        teamId: parseInt(req.params.groupId),
        itemId: taskId ? parseInt(taskId) : null,
        gasUsed: additionalData?.gasUsed ? parseInt(additionalData.gasUsed) : null,
        gasPrice: additionalData?.gasPrice ? parseInt(additionalData.gasPrice) : null,
        blockNumber: additionalData?.blockNumber ? parseInt(additionalData.blockNumber) : null,
        network: additionalData?.network || 'localhost',
        status: 'confirmed'
      };

      console.log('💾 Salvando transação tarefa (rota alternativa):', transactionData);
      
      const savedTransaction = await BlockchainTransactionService.create(transactionData);
      
      console.log('✅ Transação tarefa salva (rota alternativa):', savedTransaction.id);

      res.json({
        success: true,
        message: 'Transação blockchain salva com sucesso',
        data: savedTransaction
      });

    } catch (error) {
      console.error('❌ Erro ao salvar transação blockchain tarefa:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);


router.post('/:groupId/blockchain-transaction',
  authenticateToken,
  async (req, res) => {
    try {
      console.log('🔗 NOVA TRANSAÇÃO BLOCKCHAIN TAREFA:');
      console.log('👤 Usuário ID:', req.user.id);
      console.log('📊 Dados da transação:', req.body);

      const {
        transactionHash,
        contractName,
        methodName,
        taskId,
        taskTitle,
        sprintId,
        teamId,
        additionalData
      } = req.body;

      
      if (!transactionHash) {
        return res.status(400).json({
          success: false,
          message: 'Hash da transação é obrigatório'
        });
      }

      
      let transactionType = methodName;
      let entityType = 'task';
      let description = '';

      switch (methodName) {
        case 'createTask':
          description = `Tarefa criada: ${taskTitle || 'N/A'}`;
          break;
        case 'updateTask':
          description = `Tarefa atualizada: ${taskTitle || 'N/A'}`;
          break;
        case 'updateTaskStatus':
          description = `Status da tarefa alterado: ${taskTitle || 'N/A'}`;
          break;
        case 'assignTask':
          description = `Tarefa atribuída: ${taskTitle || 'N/A'}`;
          break;
        case 'deleteTask':
          description = `Tarefa removida: ${taskTitle || 'N/A'}`;
          break;
        default:
          description = `Operação tarefa: ${methodName}`;
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
        contractName: contractName || 'TaskManagement',
        methodName,
        description,
        userAddress,
        userId: req.user.id,
        teamId: teamId || null,
        itemId: taskId ? parseInt(taskId) : null,
        gasUsed: additionalData?.gasUsed ? parseInt(additionalData.gasUsed) : null,
        gasPrice: additionalData?.gasPrice ? parseInt(additionalData.gasPrice) : null,
        blockNumber: additionalData?.blockNumber ? parseInt(additionalData.blockNumber) : null,
        network: additionalData?.network || 'localhost',
        status: 'confirmed'
      };

      console.log('💾 Salvando transação tarefa:', transactionData);
      
      const savedTransaction = await BlockchainTransactionService.create(transactionData);
      
      console.log('✅ Transação tarefa salva:', savedTransaction.id);

      res.json({
        success: true,
        message: 'Transação blockchain salva com sucesso',
        data: savedTransaction
      });

    } catch (error) {
      console.error('❌ Erro ao salvar transação blockchain tarefa:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);


router.delete('/:groupId/sprints/:sprintId/tasks/:taskId', authenticateToken, checkGroupMember, async (req, res) => {
  try {
    console.log('🗑️ TASK API: Deletando task...');
    console.log('Group ID:', req.params.groupId);
    console.log('Sprint ID:', req.params.sprintId);
    console.log('Task ID:', req.params.taskId);

    const taskId = parseInt(req.params.taskId);
    
    
    const existingTask = await TaskService.getTaskById(taskId);
    if (!existingTask) {
      return res.status(404).json({
        success: false,
        message: 'Task não encontrada'
      });
    }

    
    if (existingTask.sprint_id !== parseInt(req.params.sprintId) || 
        existingTask.group_id !== parseInt(req.params.groupId)) {
      return res.status(403).json({
        success: false,
        message: 'Task não pertence a este sprint ou grupo'
      });
    }

    await TaskService.deleteTask(taskId);

    console.log('✅ TASK API: Task deletada com sucesso');

    
    const BlockchainTransactionService = require('../services/BlockchainTransactionService');
    
    console.log('🔗 Transação blockchain da exclusão da task será registrada quando a transação for executada no frontend');

    res.json({
      success: true,
      message: 'Task deletada com sucesso'
    });
  } catch (error) {
    console.error('❌ TASK API: Erro ao deletar task:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

module.exports = router;
