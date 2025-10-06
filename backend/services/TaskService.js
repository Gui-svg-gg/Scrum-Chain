const db = require('../config/database');
const TimeUtils = require('../utils/TimeUtils');

class TaskService {

  static async createTask(taskData) {
    const { title, description, sprintId, groupId, assignedTo, estimatedHours, createdBy, blockchain_address } = taskData;

    console.log('🔍 TASK: Dados recebidos para criação de tarefa:', {
      title,
      description,
      sprintId,
      groupId,
      assignedTo,
      estimatedHours,
      createdBy,
      blockchain_address,
      assignedToType: typeof assignedTo
    });


    let finalAssignedTo = null;

    if (assignedTo !== null && assignedTo !== undefined && assignedTo !== '') {
      const assignedUserId = parseInt(assignedTo);
      console.log('🔍 TASK: Validando assignedTo:', assignedUserId, 'isNaN:', isNaN(assignedUserId));

      if (!isNaN(assignedUserId) && assignedUserId > 0) {
        console.log('🔍 TASK: Verificando se usuário existe:', assignedUserId);
        const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [assignedUserId]);
        console.log('🔍 TASK: Resultado da consulta de usuário:', userCheck.rows);

        if (userCheck.rows.length === 0) {

          const allUsers = await db.query('SELECT id, username FROM users ORDER BY id');
          console.log('🔍 TASK: Usuários disponíveis no sistema:', allUsers.rows);

          console.warn('⚠️ TASK: Usuário não encontrado, definindo assignedTo como null');
          finalAssignedTo = null;
        } else {
          finalAssignedTo = assignedUserId;
        }
      } else {
        console.log('🔍 TASK: assignedTo não é um número válido, definindo como null');
        finalAssignedTo = null;
      }
    } else {
      console.log('🔍 TASK: assignedTo está vazio ou null, definindo como null');
      finalAssignedTo = null;
    }


    const estimatedMinutes = TimeUtils.normalizeToMinutes(estimatedHours);

    console.log('⏱️ TASK: Conversão de tempo:', {
      entrada: estimatedHours,
      minutos: estimatedMinutes,
      formatoLegivel: TimeUtils.formatTimeDisplay(estimatedMinutes)
    });

    const query = `
      INSERT INTO sprint_tasks (title, description, sprint_id, group_id, assigned_to, estimated_minutes, created_by, status, created_at, updated_at, blockchain_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'todo', NOW(), NOW(), $8)
      RETURNING id, title, description, sprint_id, group_id, assigned_to, estimated_minutes, created_by, status, created_at, updated_at, blockchain_address
    `;

    const values = [
      title,
      description,
      sprintId,
      groupId,
      finalAssignedTo,
      estimatedMinutes,
      createdBy,
      blockchain_address || null
    ];

    try {
      console.log('📝 TaskService: Executando query para criar tarefa...');
      console.log('Values:', values);

      const result = await db.query(query, values);
      const taskData = result.rows[0];



      console.log('✅ TaskService: Tarefa criada:', taskData);
      return taskData;
    } catch (error) {
      console.error('❌ TaskService: Erro ao criar tarefa:', error);
      throw error;
    }
  }


  static async getTasksBySprintId(sprintId) {
    const query = `
      SELECT 
        t.id,
        t.title,
        t.description,
        t.status,
        t.assigned_to,
        t.estimated_minutes,
        t.created_at,
        t.updated_at,
        t.blockchain_address,
        u.full_name as assigned_to_name
      FROM sprint_tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.sprint_id = $1
      ORDER BY t.created_at DESC
    `;

    try {
      console.log('📋 TaskService: Buscando tarefas para sprint:', sprintId);

      const result = await db.query(query, [sprintId]);

      console.log('✅ TaskService: Tarefas encontradas:', result.rows.length);
      return result.rows;
    } catch (error) {
      console.error('❌ TaskService: Erro ao buscar tarefas:', error);
      throw error;
    }
  }

  static async getTaskById(taskId) {
    const query = `
      SELECT 
        t.*,
        u.full_name as assigned_to_name
      FROM sprint_tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.id = $1
    `;

    try {
      console.log('🔍 TaskService: Buscando task por ID:', taskId);

      const result = await db.query(query, [taskId]);

      if (result.rows.length === 0) {
        console.log('⚠️ TaskService: Task não encontrada');
        return null;
      }

      console.log('✅ TaskService: Task encontrada');
      return result.rows[0];
    } catch (error) {
      console.error('❌ TaskService: Erro ao buscar tarefa:', error);
      throw error;
    }
  }


  static async updateTask(taskId, taskData) {
    const { title, description, assignedTo, estimatedHours, blockchain_address } = taskData;

    console.log('🔍 TASK: Dados recebidos para atualização de tarefa:', {
      taskId,
      title,
      description,
      assignedTo,
      estimatedHours,
      blockchain_address,
      assignedToType: typeof assignedTo
    });


    let finalAssignedTo = assignedTo;

    if (assignedTo !== null && assignedTo !== undefined && assignedTo !== '') {
      const assignedUserId = parseInt(assignedTo);
      console.log('🔍 TASK: Validando assignedTo na atualização:', assignedUserId, 'isNaN:', isNaN(assignedUserId));

      if (!isNaN(assignedUserId) && assignedUserId > 0) {
        console.log('🔍 TASK: Verificando se usuário existe para atualização:', assignedUserId);
        const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [assignedUserId]);
        console.log('🔍 TASK: Resultado da consulta de usuário na atualização:', userCheck.rows);

        if (userCheck.rows.length === 0) {

          const allUsers = await db.query('SELECT id, username FROM users ORDER BY id');
          console.log('🔍 TASK: Usuários disponíveis no sistema:', allUsers.rows);

          console.warn('⚠️ TASK: Usuário não encontrado na atualização, mantendo valor atual (não atualizando assignedTo)');
          finalAssignedTo = undefined;
        } else {
          finalAssignedTo = assignedUserId;
        }
      } else {
        console.log('🔍 TASK: assignedTo não é um número válido na atualização, não atualizando campo');
        finalAssignedTo = undefined;
      }
    }


    let estimatedMinutes = undefined;
    if (estimatedHours !== null && estimatedHours !== undefined) {
      estimatedMinutes = TimeUtils.normalizeToMinutes(estimatedHours);

      console.log('⏱️ TASK: Conversão de tempo na atualização:', {
        entrada: estimatedHours,
        minutos: estimatedMinutes,
        formatoLegivel: TimeUtils.formatTimeDisplay(estimatedMinutes)
      });
    }

    const query = `
      UPDATE sprint_tasks 
      SET 
        title = COALESCE($2, title),
        description = COALESCE($3, description), 
        assigned_to = COALESCE($4, assigned_to), 
        estimated_minutes = COALESCE($5, estimated_minutes),
        blockchain_address = COALESCE($6, blockchain_address),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const values = [taskId, title, description, finalAssignedTo, estimatedMinutes, blockchain_address];

    try {
      console.log('✏️ TaskService: Atualizando task:', taskId);
      console.log('Values:', values);

      const result = await db.query(query, values);

      if (result.rows.length === 0) {
        console.log('⚠️ TaskService: Task não encontrada para atualização');
        return null;
      }

      const updatedTask = result.rows[0];



      console.log('✅ TaskService: Task atualizada');
      return updatedTask;
    } catch (error) {
      console.error('❌ TaskService: Erro ao atualizar task:', error);
      throw error;
    }
  }


  static async updateTaskStatus(taskId, status, transactionHash, userId = 1) {
    const query = `
      UPDATE sprint_tasks 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    try {
      console.log('🔄 TaskService: Atualizando status da task:', taskId, 'para:', status);

      const result = await db.query(query, [status, taskId]);

      if (result.rows.length === 0) {
        console.log('⚠️ TaskService: Task não encontrada para atualização de status');
        return null;
      }

      const updatedTask = result.rows[0];



      console.log('✅ TaskService: Status da task atualizado');
      return updatedTask;
    } catch (error) {
      console.error('❌ TaskService: Erro ao atualizar status:', error);
      throw error;
    }
  }


  static async deleteTask(taskId, userId = 1) {
    const query = `
      DELETE FROM sprint_tasks 
      WHERE id = $1
      RETURNING *
    `;

    try {
      console.log('🗑️ TaskService: Deletando task:', taskId);

      const result = await db.query(query, [taskId]);

      if (result.rows.length === 0) {
        console.log('⚠️ TaskService: Task não encontrada para deleção');
        return null;
      }



      console.log('✅ TaskService: Task deletada');
      return result.rows[0];
    } catch (error) {
      console.error('❌ TaskService: Erro ao deletar task:', error);
      throw error;
    }
  }


  static async getTasksByGroup(groupId) {
    const query = `
      SELECT 
        t.id,
        t.title,
        t.description,
        t.status,
        t.assigned_to,
        t.estimated_minutes,
        t.sprint_id,
        t.group_id,
        t.created_at,
        t.updated_at,
        u.full_name as assigned_to_name,
        s.name as sprint_name
      FROM sprint_tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN sprints s ON t.sprint_id = s.id
      WHERE t.group_id = $1
      ORDER BY t.created_at DESC
    `;

    try {
      console.log('📋 TaskService: Buscando tarefas para grupo:', groupId);

      const result = await db.query(query, [groupId]);

      console.log('✅ TaskService: Tarefas encontradas:', result.rows.length);
      return result.rows;
    } catch (error) {
      console.error('❌ TaskService: Erro ao buscar tarefas do grupo:', error);
      throw error;
    }
  }

  static async assignTask(taskId, userId) {
    const query = `
      UPDATE sprint_tasks 
      SET assigned_to = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *, (SELECT full_name FROM users WHERE id = $1) as assigned_to_name
    `;

    try {
      console.log('👤 TaskService: Atribuindo tarefa', taskId, 'ao usuário', userId);

      const result = await db.query(query, [userId, taskId]);

      if (result.rows.length === 0) {
        throw new Error(`Task com ID ${taskId} não encontrada`);
      }

      console.log('✅ TaskService: Tarefa atribuída com sucesso');
      return result.rows[0];
    } catch (error) {
      console.error('❌ TaskService: Erro ao atribuir tarefa:', error);
      throw error;
    }
  }


  static async getSprintTaskStats(sprintId) {
    const query = `
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'todo' THEN 1 END) as todo,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'done' THEN 1 END) as done,
        COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked,
        COALESCE(SUM(estimated_minutes), 0) as total_estimated_minutes,
        COALESCE(SUM(CASE WHEN status = 'done' THEN estimated_minutes ELSE 0 END), 0) as completed_minutes
      FROM sprint_tasks
      WHERE sprint_id = $1
    `;

    try {
      console.log('📊 TaskService: Obtendo estatísticas da sprint:', sprintId);

      const result = await db.query(query, [sprintId]);

      const stats = {
        ...result.rows[0],
        total_tasks: parseInt(result.rows[0].total_tasks),
        todo: parseInt(result.rows[0].todo),
        in_progress: parseInt(result.rows[0].in_progress),
        done: parseInt(result.rows[0].done),
        blocked: parseInt(result.rows[0].blocked),
        progress_percentage: result.rows[0].total_tasks > 0
          ? Math.round((result.rows[0].done / result.rows[0].total_tasks) * 100)
          : 0
      };

      console.log('✅ TaskService: Estatísticas obtidas');
      return stats;
    } catch (error) {
      console.error('❌ TaskService: Erro ao obter estatísticas da sprint:', error);
      throw error;
    }
  }


  static async getGroupTaskStats(groupId) {
    const query = `
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'todo' THEN 1 END) as todo,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'done' THEN 1 END) as done,
        COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked,
        COALESCE(SUM(estimated_minutes), 0) as total_estimated_minutes,
        COALESCE(SUM(CASE WHEN status = 'done' THEN estimated_minutes ELSE 0 END), 0) as completed_minutes
      FROM sprint_tasks
      WHERE group_id = $1
    `;

    try {
      console.log('📊 TaskService: Obtendo estatísticas do grupo:', groupId);

      const result = await db.query(query, [groupId]);

      const stats = {
        ...result.rows[0],
        total_tasks: parseInt(result.rows[0].total_tasks),
        todo: parseInt(result.rows[0].todo),
        in_progress: parseInt(result.rows[0].in_progress),
        done: parseInt(result.rows[0].done),
        blocked: parseInt(result.rows[0].blocked),
        progress_percentage: result.rows[0].total_tasks > 0
          ? Math.round((result.rows[0].done / result.rows[0].total_tasks) * 100)
          : 0
      };

      console.log('✅ TaskService: Estatísticas obtidas');
      return stats;
    } catch (error) {
      console.error('❌ TaskService: Erro ao obter estatísticas do grupo:', error);
      throw error;
    }
  }


  static async createTasksFromBacklogItem(itemId, sprintId, tasks, userId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');
      console.log('📝 TaskService: Criando tarefas do backlog item:', itemId);

      const createdTasks = [];

      for (const taskData of tasks) {
        const query = `
          INSERT INTO sprint_tasks (
            title, description, status, assigned_to, estimated_minutes, 
            sprint_id, group_id, backlog_item_id, created_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING *
        `;


        const estimatedMinutes = TimeUtils.normalizeToMinutes(taskData.estimated_hours);

        const result = await client.query(query, [
          taskData.title,
          taskData.description || '',
          taskData.status || 'todo',
          taskData.assigned_to || null,
          estimatedMinutes,
          sprintId,
          taskData.group_id,
          itemId,
          userId
        ]);

        createdTasks.push(result.rows[0]);
      }

      await client.query('COMMIT');
      console.log('✅ TaskService: Tarefas criadas do backlog item');
      return createdTasks;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ TaskService: Erro ao criar tarefas do backlog item:', error);
      throw error;
    } finally {
      client.release();
    }
  }


  static async getTasksByBacklogItem(itemId) {
    const query = `
      SELECT 
        t.*,
        u.full_name as assigned_to_name,
        s.name as sprint_name
      FROM sprint_tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN sprints s ON t.sprint_id = s.id
      WHERE t.backlog_item_id = $1
      ORDER BY t.created_at DESC
    `;

    try {
      console.log('📋 TaskService: Buscando tarefas do backlog item:', itemId);

      const result = await db.query(query, [itemId]);

      console.log('✅ TaskService: Tarefas encontradas:', result.rows.length);
      return result.rows;
    } catch (error) {
      console.error('❌ TaskService: Erro ao buscar tarefas do backlog item:', error);
      throw error;
    }
  }


  static async getTaskById(taskId) {
    const query = `
      SELECT 
        t.*,
        u.full_name as assigned_to_name
      FROM sprint_tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.id = $1
    `;

    try {
      console.log('🔍 TaskService: Buscando task por ID:', taskId);

      const result = await db.query(query, [taskId]);

      if (result.rows.length === 0) {
        console.log('⚠️ TaskService: Task não encontrada');
        return null;
      }

      console.log('✅ TaskService: Task encontrada:', result.rows[0]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ TaskService: Erro ao buscar task por ID:', error);
      throw error;
    }
  }

  static async deleteTask(taskId) {
    const query = `
      DELETE FROM sprint_tasks 
      WHERE id = $1
      RETURNING *
    `;

    try {
      console.log('🗑️ TaskService: Deletando task:', taskId);

      const result = await db.query(query, [taskId]);

      if (result.rows.length === 0) {
        console.log('⚠️ TaskService: Task não encontrada para deletar');
        return null;
      }

      console.log('✅ TaskService: Task deletada:', result.rows[0]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ TaskService: Erro ao deletar task:', error);
      throw error;
    }
  }
}

module.exports = TaskService;
