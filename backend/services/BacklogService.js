const db = require('../config/database');

class BacklogService {
  

  static async createItem(itemData) {
    const {
      groupId,
      title,
      description,
      priority = 3, 
      storyPoints = 1,
      createdBy
    } = itemData;

    if (!groupId || !title || !createdBy) {
      throw new Error('Dados obrigatórios não fornecidos');
    }

    
    const existingItem = await db.query(
      'SELECT id FROM backlog_items WHERE group_id = $1 AND title = $2 AND (status IS NULL OR status != $3)',
      [groupId, title, 'removed']
    );

    if (existingItem.rows.length > 0) {
      throw new Error('Já existe um item com este título no backlog');
    }

    const result = await db.query(
      `INSERT INTO backlog_items (group_id, title, description, priority, story_points, created_by, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [groupId, title, description, priority, storyPoints, createdBy, 'todo']
    );

    return result.rows[0];
  }

 
  static async getByGroupId(groupId) {
    if (!groupId) {
      throw new Error('Group ID é obrigatório');
    }

    const result = await db.query(
      `SELECT 
        bi.*,
        u.full_name as created_by_name
       FROM backlog_items bi
       LEFT JOIN users u ON bi.created_by = u.id
       WHERE bi.group_id = $1 AND (bi.status IS NULL OR bi.status != $2)
       ORDER BY 
         bi.priority DESC,
         bi.created_at ASC`,
      [groupId, 'removed']
    );

    return {
      success: true,
      data: result.rows,
      count: result.rows.length
    };
  }

 
  static async getById(itemId) {
    if (!itemId) {
      throw new Error('Item ID é obrigatório');
    }

    const result = await db.query(
      `SELECT 
        bi.*,
        u.full_name as created_by_name
       FROM backlog_items bi
       LEFT JOIN users u ON bi.created_by = u.id
       WHERE bi.id = $1`,
      [itemId]
    );

    if (result.rows.length === 0) {
      throw new Error('Item não encontrado');
    }

    return result.rows[0];
  }

  
  static async updateStatus(itemId, newStatus, userId) {
    const validStatuses = ['todo', 'in_progress', 'done', 'removed'];
    
    if (!validStatuses.includes(newStatus)) {
      throw new Error('Status inválido');
    }

    const result = await db.query(
      `UPDATE backlog_items 
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND status != $3
       RETURNING *`,
      [newStatus, itemId, 'removed']
    );

    if (result.rows.length === 0) {
      throw new Error('Item não encontrado ou já foi removido');
    }

    
    await this.logChange(itemId, 'status', newStatus, userId);

    return result.rows[0];
  }

 
  static async updatePriority(itemId, newPriority, userId) {
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    
    if (!validPriorities.includes(newPriority)) {
      throw new Error('Prioridade inválida');
    }

    const result = await db.query(
      `UPDATE backlog_items 
       SET priority = $1, updated_at = NOW()
       WHERE id = $2 AND status != $3
       RETURNING *`,
      [newPriority, itemId, 'removed']
    );

    if (result.rows.length === 0) {
      throw new Error('Item não encontrado ou já foi removido');
    }

    
    await this.logChange(itemId, 'priority', newPriority, userId);

    return result.rows[0];
  }

 
  static async updateDetails(itemId, updateData, userId) {
    const { title, description, storyPoints, priority } = updateData;
    
    if (!title || title.trim().length === 0) {
      throw new Error('Título é obrigatório');
    }

    
    const item = await this.getById(itemId);
    
    if (title !== item.title) {
      const existingItem = await db.query(
        'SELECT id FROM backlog_items WHERE group_id = $1 AND title = $2 AND id != $3 AND (status IS NULL OR status != $4)',
        [item.group_id, title, itemId, 'removed']
      );

      if (existingItem.rows.length > 0) {
        throw new Error('Já existe um item com este título no backlog');
      }
    }

    const result = await db.query(
      `UPDATE backlog_items 
       SET title = $1, description = $2, story_points = $3, priority = $4, updated_at = NOW()
       WHERE id = $5 AND (status IS NULL OR status != $6)
       RETURNING *`,
      [title, description || '', storyPoints || 1, priority || 3, itemId, 'removed']
    );

    if (result.rows.length === 0) {
      throw new Error('Item não encontrado ou já foi removido');
    }

    
    await this.logChange(itemId, 'details', 'updated', userId);

    return result.rows[0];
  }

  
  static async removeItem(itemId, userId) {
    
    const itemData = await this.getById(itemId);
    if (!itemData) {
      throw new Error('Item não encontrado');
    }

    
    await this.logChange(itemId, 'deleted', 'true', userId);

    
    const result = await db.query(
      `DELETE FROM backlog_items 
       WHERE id = $1
       RETURNING *`,
      [itemId]
    );

    if (result.rows.length === 0) {
      throw new Error('Item não encontrado');
    }

    return { ...result.rows[0], deleted: true };
  }

  static async getStats(groupId) {
    const result = await db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'todo' THEN 1 END) as todo,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'done' THEN 1 END) as done,
        SUM(story_points) as total_story_points,
        SUM(CASE WHEN status = 'done' THEN story_points ELSE 0 END) as completed_story_points
       FROM backlog_items 
       WHERE group_id = $1 AND status != $2`,
      [groupId, 'removed']
    );

    const stats = result.rows[0];
    
    return {
      total: parseInt(stats.total),
      todo: parseInt(stats.todo),
      inProgress: parseInt(stats.in_progress),
      done: parseInt(stats.done),
      totalStoryPoints: parseInt(stats.total_story_points) || 0,
      completedStoryPoints: parseInt(stats.completed_story_points) || 0,
      completionRate: stats.total_story_points > 0 
        ? Math.round((stats.completed_story_points / stats.total_story_points) * 100) 
        : 0
    };
  }

 
  static async logChange(itemId, field, newValue, userId) {
    try {
      await db.query(
        `INSERT INTO backlog_changes (item_id, field_changed, new_value, changed_by, changed_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [itemId, field, newValue, userId]
      );
    } catch (error) {
      console.warn('Erro ao registrar log de alteração:', error);
      
    }
  }


  static async getChangeHistory(itemId) {
    const result = await db.query(
      `SELECT 
        bc.*,
        u.full_name as changed_by_name
       FROM backlog_changes bc
       LEFT JOIN users u ON bc.changed_by = u.id
       WHERE bc.item_id = $1
       ORDER BY bc.changed_at DESC`,
      [itemId]
    );

    return result.rows;
  }


  static async validatePermission(userId, groupId, action = 'read') {
    try {
      console.log('🔍 Validando permissão:', { userId, groupId, action });
      
      
      const result = await db.query(
        `SELECT role FROM group_members 
         WHERE user_id = $1 AND group_id = $2 AND is_active = true`,
        [userId, groupId]
      );

      console.log('📋 Resultado da consulta de permissão:', result.rows);

      if (result.rows.length === 0) {
        console.warn('❌ Usuário não é membro desta equipe');
        return false; 
      }

      const userRole = result.rows[0].role;
      console.log('👤 Role do usuário:', userRole);

      
      let hasPermission = false;
      switch (action) {
        case 'create':
        case 'update':
        case 'delete':
          hasPermission = ['Product Owner', 'Scrum Master'].includes(userRole);
          break;
        case 'status':
          hasPermission = ['Product Owner', 'Scrum Master', 'Developer'].includes(userRole);
          break;
        case 'read':
          hasPermission = true; 
          break;
        default:
          hasPermission = false;
      }

      console.log('✅ Permissão:', hasPermission);
      return hasPermission;
    } catch (error) {
      console.error('❌ Erro ao validar permissão:', error);
      return false; 
    }
  }
}

module.exports = BacklogService;
