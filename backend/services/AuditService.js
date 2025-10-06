const db = require('../config/database');

class AuditService {

  static async logAction(actionData) {
    const { 
      userId, 
      actionType, 
      entityType, 
      entityId = null, 
      details = {}, 
      ipAddress = null, 
      userAgent = null,
      groupId = null,
      sprintId = null 
    } = actionData;

    try {
      const query = `
        INSERT INTO system_audit_log 
        (user_id, action_type, entity_type, entity_id, details, ip_address, user_agent, group_id, sprint_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id
      `;

      const values = [
        userId, 
        actionType, 
        entityType, 
        entityId, 
        JSON.stringify(details), 
        ipAddress, 
        userAgent,
        groupId,
        sprintId
      ];

      const result = await db.query(query, values);
      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Erro ao registrar log de auditoria:', error);
      
      return null;
    }
  }

 
  static async getAuditHistory(filters = {}) {
    const { 
      userId, 
      actionType, 
      entityType, 
      groupId, 
      sprintId, 
      startDate, 
      endDate, 
      limit = 100, 
      offset = 0 
    } = filters;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (actionType) {
      whereConditions.push(`sal.action_type = $${paramIndex++}`);
      queryParams.push(actionType);
    }

    if (entityType) {
      whereConditions.push(`sal.entity_type = $${paramIndex++}`);
      queryParams.push(entityType);
    }

    if (groupId) {
      whereConditions.push(`sal.group_id = $${paramIndex++}`);
      queryParams.push(groupId);
    }

    if (sprintId) {
      whereConditions.push(`sal.sprint_id = $${paramIndex++}`);
      queryParams.push(sprintId);
    }

    if (startDate) {
      whereConditions.push(`sal.created_at >= $${paramIndex++}`);
      queryParams.push(startDate);
    }

    if (endDate) {
      whereConditions.push(`sal.created_at <= $${paramIndex++}`);
      queryParams.push(endDate);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    const query = `
      SELECT 
        sal.*,
        u.full_name as user_name,
        u.email as user_email,
        g.name as group_name,
        s.name as sprint_name
      FROM system_audit_log sal
      LEFT JOIN users u ON sal.user_id = u.id
      LEFT JOIN groups g ON sal.group_id = g.id
      LEFT JOIN sprints s ON sal.sprint_id = s.id
      ${whereClause}
      ORDER BY sal.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);

    
    const countQuery = `
      SELECT COUNT(*) as total
      FROM system_audit_log sal
      ${whereClause}
    `;

    const countResult = await db.query(countQuery, queryParams.slice(0, -2)); 

    return {
      logs: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    };
  }


  static async getAuditStats(filters = {}) {
    const { groupId, startDate, endDate } = filters;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (groupId) {
      whereConditions.push(`group_id = $${paramIndex++}`);
      queryParams.push(groupId);
    }

    if (startDate) {
      whereConditions.push(`created_at >= $${paramIndex++}`);
      queryParams.push(startDate);
    }

    if (endDate) {
      whereConditions.push(`created_at <= $${paramIndex++}`);
      queryParams.push(endDate);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    try {
      
      const actionStatsQuery = `
        SELECT 
          action_type,
          COUNT(*) as count
        FROM system_audit_log
        ${whereClause}
        GROUP BY action_type
        ORDER BY count DESC
      `;

      
      const userStatsQuery = `
        SELECT 
          sal.user_id,
          u.full_name,
          COUNT(*) as count
        FROM system_audit_log sal
        LEFT JOIN users u ON sal.user_id = u.id
        ${whereClause}
        GROUP BY sal.user_id, u.full_name
        ORDER BY count DESC
        LIMIT 10
      `;

      
      let dailyStatsQuery;
      let dailyParams;
      
      if (whereConditions.length > 0) {
        
        dailyStatsQuery = `
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as count
          FROM system_audit_log
          ${whereClause}
          AND created_at >= NOW() - INTERVAL '30 days'
          GROUP BY DATE(created_at)
          ORDER BY date DESC
        `;
        dailyParams = queryParams;
      } else {
        
        dailyStatsQuery = `
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as count
          FROM system_audit_log
          WHERE created_at >= NOW() - INTERVAL '30 days'
          GROUP BY DATE(created_at)
          ORDER BY date DESC
        `;
        dailyParams = [];
      }

      const [actionStats, userStats, dailyStats] = await Promise.all([
        db.query(actionStatsQuery, queryParams),
        db.query(userStatsQuery, queryParams),
        db.query(dailyStatsQuery, dailyParams)
      ]);

      return {
        actionStats: actionStats.rows,
        userStats: userStats.rows,
        dailyStats: dailyStats.rows
      };
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas de auditoria:', error);
      throw error;
    }
  }

  static async getActionTypes() {
    const query = `
      SELECT DISTINCT action_type
      FROM system_audit_log
      ORDER BY action_type
    `;

    const result = await db.query(query);
    return result.rows.map(row => row.action_type);
  }


  static async getEntityTypes() {
    const query = `
      SELECT DISTINCT entity_type
      FROM system_audit_log
      ORDER BY entity_type
    `;

    const result = await db.query(query);
    return result.rows.map(row => row.entity_type);
  }


  static async cleanOldLogs(daysToKeep = 90) {
    const query = `
      DELETE FROM system_audit_log
      WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
    `;

    const result = await db.query(query);
    return result.rowCount;
  }


  static async clearAllLogs() {
    try {
      console.log('🗑️ Limpando todo o histórico de auditoria...');
      
      const query = 'DELETE FROM system_audit_log';
      const result = await db.query(query);
      
      console.log(`✅ ${result.rowCount} logs foram removidos`);
      return result.rowCount;
    } catch (error) {
      console.error('❌ Erro ao limpar todos os logs:', error);
      throw error;
    }
  }

  
  static async deleteLog(logId) {
    try {
      console.log('🗑️ Excluindo log específico:', logId);
      
      const query = 'DELETE FROM system_audit_log WHERE id = $1';
      const result = await db.query(query, [logId]);
      
      console.log(`✅ Log ${logId} foi removido (${result.rowCount} registros afetados)`);
      return result.rowCount;
    } catch (error) {
      console.error('❌ Erro ao excluir log específico:', error);
      throw error;
    }
  }
}

module.exports = AuditService;
