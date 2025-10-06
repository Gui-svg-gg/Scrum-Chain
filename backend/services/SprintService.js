const { pool } = require('../config/database');

class SprintService {

  static async createSprint(groupId, data, createdBy) {
    console.log('🚀 SprintService.createSprint - Iniciando');
    console.log('👥 Group ID:', groupId);
    console.log('📝 Dados:', data);
    console.log('👤 Created by:', createdBy);
    
    const client = await pool.connect();
    try {
      const { name, description, startDate, endDate, blockchainAddress, backlogId } = data;
      
      console.log('� Dados recebidos para criação do sprint:');
      console.log(`   - name: ${name}`);
      console.log(`   - description: ${description}`);
      console.log(`   - backlogId: ${backlogId}`);
      console.log(`   - blockchainAddress: ${blockchainAddress}`);
      
      console.log('�💾 Executando query de inserção...');
      const result = await client.query(`
        INSERT INTO sprints (group_id, name, description, start_date, end_date, status, blockchain_address, created_by, backlog_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [groupId, name, description, startDate, endDate, 'planning', blockchainAddress, createdBy, backlogId]);

      const sprint = result.rows[0];
      
      console.log('✅ Sprint inserido no banco:');
      console.log(`   - ID: ${sprint.id}`);
      console.log(`   - Nome: ${sprint.name}`);
      console.log(`   - backlog_id: ${sprint.backlog_id}`);
      console.log(`   - blockchain_address: ${sprint.blockchain_address}`);
      
      

      console.log('✅ Sprint criado com sucesso:', sprint);
      return sprint;
    } catch (error) {
      console.error('❌ Erro na query de criação:', error);
      throw error;
    } finally {
      client.release();
    }
  }


  static async getSprintsByGroup(groupId) {
    console.log('🚀 SprintService.getSprintsByGroup - Iniciando');
    console.log('👥 Group ID:', groupId);
    
    const client = await pool.connect();
    try {
      console.log('💾 Executando query de busca...');
      const result = await client.query(`
        SELECT s.*,
               u.username as created_by_username,
               bl.title as backlog_title,
               bl.description as backlog_description
        FROM sprints s
        LEFT JOIN users u ON s.created_by = u.id
        LEFT JOIN backlog_items bl ON s.backlog_id = bl.id
        WHERE s.group_id = $1
        ORDER BY s.created_at DESC
      `, [groupId]);

      console.log('✅ Sprints encontrados:', result.rows.length);
      
      
      result.rows.forEach((sprint, index) => {
        console.log(`📋 Sprint ${index + 1}:`);
        console.log(`   - ID: ${sprint.id}`);
        console.log(`   - Nome: ${sprint.name}`);
        console.log(`   - backlog_id: ${sprint.backlog_id}`);
        console.log(`   - blockchain_address: ${sprint.blockchain_address}`);
        console.log(`   - backlog_title: ${sprint.backlog_title}`);
      });
      
      return result.rows;
    } catch (error) {
      console.error('❌ Erro na query de busca:', error);
      throw error;
    } finally {
      client.release();
    }
  }


  static async getSprintById(sprintId) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT s.*, 
               u.username as created_by_username,
               COUNT(bi.id) as backlog_items_count
        FROM sprints s
        LEFT JOIN users u ON s.created_by = u.id
        LEFT JOIN backlog_items bi ON s.id = bi.sprint_id
        WHERE s.id = $1
        GROUP BY s.id, u.username
      `, [sprintId]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }


  static async updateSprint(sprintId, data, userId = 1) {
    const client = await pool.connect();
    try {
      const { name, description, startDate, endDate, status, blockchain_address, backlogId } = data;
      
      console.log('🔄 SprintService.updateSprint - Atualizando sprint:', sprintId);
      console.log('📊 Dados para atualização:', data);

      const result = await client.query(`
        UPDATE sprints SET 
          name = COALESCE($2, name),
          description = COALESCE($3, description),
          start_date = COALESCE($4, start_date),
          end_date = COALESCE($5, end_date),
          status = COALESCE($6, status),
          blockchain_address = COALESCE($7, blockchain_address),
          backlog_id = COALESCE($8, backlog_id),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [sprintId, name, description, startDate, endDate, status, blockchain_address, backlogId]);

      if (result.rows.length === 0) {
        throw new Error('Sprint não encontrado para atualização');
      }

      const updatedSprint = result.rows[0];
      
      

      console.log('✅ SprintService.updateSprint - Sprint atualizado:', updatedSprint.id);
      return updatedSprint;
    } catch (error) {
      console.error('❌ SprintService.updateSprint - Erro:', error);
      throw error;
    } finally {
      client.release();
    }
  }

 
  static async deleteSprint(sprintId, userId = 1) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      
      await client.query(`
        DELETE FROM system_audit_log 
        WHERE sprint_id = $1
      `, [sprintId]);

      
      await client.query(`
        UPDATE backlog_items 
        SET sprint_id = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE sprint_id = $1
      `, [sprintId]);

      
      const result = await client.query(`
        DELETE FROM sprints WHERE id = $1 RETURNING *
      `, [sprintId]);

      

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async startSprint(sprintId, blockchainAddress, userId = 1) {
    const client = await pool.connect();
    try {
      
      const activeSprintCheck = await client.query(`
        SELECT s1.id, s1.name
        FROM sprints s1
        INNER JOIN sprints s2 ON s1.group_id = s2.group_id
        WHERE s2.id = $1 AND s1.status = 'active' AND s1.id != $1
      `, [sprintId]);

      if (activeSprintCheck.rows.length > 0) {
        throw new Error(`Já existe um sprint ativo: ${activeSprintCheck.rows[0].name}`);
      }

      const result = await client.query(`
        UPDATE sprints SET 
          status = 'active',
          blockchain_address = COALESCE($2, blockchain_address),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [sprintId, blockchainAddress]);

      if (result.rows.length === 0) {
        throw new Error('Sprint não encontrado');
      }

      const updatedSprint = result.rows[0];
      
      

      return updatedSprint;
    } finally {
      client.release();
    }
  }


  static async completeSprint(sprintId, blockchainAddress, userId = 1) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        UPDATE sprints SET 
          status = 'completed',
          blockchain_address = COALESCE($2, blockchain_address),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [sprintId, blockchainAddress]);

      const completedSprint = result.rows[0];
      
      

      return completedSprint;
    } finally {
      client.release();
    }
  }

  static async cancelSprint(sprintId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      
      await client.query(`
        UPDATE backlog_items 
        SET sprint_id = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE sprint_id = $1
      `, [sprintId]);

      
      const result = await client.query(`
        UPDATE sprints SET 
          status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [sprintId]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  
  static async getSprintBacklogItems(sprintId) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT bi.*, 
               u.username as assigned_to_username,
               uc.username as created_by_username
        FROM backlog_items bi
        LEFT JOIN users u ON bi.assigned_to = u.id
        LEFT JOIN users uc ON bi.created_by = uc.id
        WHERE bi.sprint_id = $1
        ORDER BY bi.priority DESC, bi.created_at ASC
      `, [sprintId]);

      return result.rows;
    } finally {
      client.release();
    }
  }

  
  static async addItemToSprint(sprintId, backlogItemId) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        UPDATE backlog_items 
        SET sprint_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [sprintId, backlogItemId]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }

 
  static async removeItemFromSprint(backlogItemId) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        UPDATE backlog_items 
        SET sprint_id = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [backlogItemId]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  
  static async getSprintStats(sprintId) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total_items,
          COUNT(CASE WHEN status = 'todo' THEN 1 END) as todo_items,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_items,
          COUNT(CASE WHEN status = 'done' THEN 1 END) as done_items,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_items,
          SUM(story_points) as total_story_points,
          SUM(CASE WHEN status = 'done' THEN story_points ELSE 0 END) as completed_story_points
        FROM backlog_items
        WHERE sprint_id = $1
      `, [sprintId]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }
}

module.exports = SprintService;
