const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');




router.get('/tables', async (req, res) => {
  try {
    console.log('📋 ADMIN: Listando todas as tabelas do banco...');
    
    const query = `
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count,
             pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    const result = await pool.query(query);
    
    
    const tablesWithCounts = await Promise.all(
      result.rows.map(async (table) => {
        try {
          const countQuery = `SELECT COUNT(*) as count FROM ${table.table_name}`;
          const countResult = await pool.query(countQuery);
          return {
            ...table,
            record_count: parseInt(countResult.rows[0].count)
          };
        } catch (error) {
          console.warn(`⚠️ Erro ao contar registros da tabela ${table.table_name}:`, error);
          return {
            ...table,
            record_count: 0
          };
        }
      })
    );
    
    console.log(`✅ Encontradas ${tablesWithCounts.length} tabelas`);
    
    res.json({
      success: true,
      data: {
        tables: tablesWithCounts,
        total_tables: tablesWithCounts.length
      },
      message: 'Tabelas listadas com sucesso'
    });
    
  } catch (error) {
    console.error('❌ Erro ao listar tabelas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});


router.get('/table/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    console.log(`📋 ADMIN: Buscando dados da tabela: ${tableName}`);
    
    
    const allowedTables = [
      'users', 'user_sessions', 'groups', 'group_members', 'sprints',
      'user_stories', 'backlog_items', 'sprint_tasks', 'removed_members',
      'blockchain_transactions', 'system_audit_log', 'backlog_changes'
    ];
    
    if (!allowedTables.includes(tableName)) {
      return res.status(400).json({
        success: false,
        message: `Tabela '${tableName}' não permitida para consulta`
      });
    }
    
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;
    
    
    const dataQuery = `SELECT * FROM ${tableName} ORDER BY id DESC LIMIT $1 OFFSET $2`;
    const countQuery = `SELECT COUNT(*) as total FROM ${tableName}`;
    
    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, [limit, offset]),
      pool.query(countQuery)
    ]);
    
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);
    
    console.log(`✅ Encontrados ${dataResult.rows.length} registros da tabela ${tableName}`);
    
    res.json({
      success: true,
      data: {
        table_name: tableName,
        records: dataResult.rows,
        pagination: {
          current_page: page,
          per_page: limit,
          total_records: total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_previous: page > 1
        }
      },
      message: `Dados da tabela '${tableName}' recuperados com sucesso`
    });
    
  } catch (error) {
    console.error(`❌ Erro ao buscar dados da tabela ${req.params.tableName}:`, error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});


router.delete('/tables/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    console.log(`🗑️ ADMIN: Excluindo todos os dados da tabela: ${tableName}`);
    
    
    const allowedTables = [
      'users', 'user_sessions', 'groups', 'group_members', 'sprints',
      'user_stories', 'backlog_items', 'sprint_tasks', 'removed_members',
      'blockchain_transactions', 'system_audit_log', 'backlog_changes'
    ];
    
    if (!allowedTables.includes(tableName)) {
      return res.status(400).json({
        success: false,
        message: `Tabela '${tableName}' não permitida para exclusão`
      });
    }
    
    
    const countBefore = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    const recordsBefore = parseInt(countBefore.rows[0].count);
    
    
    await pool.query('SET session_replication_role = replica;');
    
    
    const deleteQuery = `DELETE FROM ${tableName}`;
    const result = await pool.query(deleteQuery);
    
    
    await pool.query('SET session_replication_role = DEFAULT;');
    
    
    try {
      const sequenceQuery = `
        SELECT pg_get_serial_sequence('${tableName}', 'id') as sequence_name
      `;
      const sequenceResult = await pool.query(sequenceQuery);
      
      if (sequenceResult.rows[0]?.sequence_name) {
        await pool.query(`ALTER SEQUENCE ${sequenceResult.rows[0].sequence_name} RESTART WITH 1`);
        console.log(`🔄 Sequence da tabela ${tableName} resetada`);
      }
    } catch (seqError) {
      console.log(`ℹ️ Tabela ${tableName} não possui sequence para resetar`);
    }
    
    console.log(`✅ Excluídos ${recordsBefore} registros da tabela ${tableName}`);
    
    res.json({
      success: true,
      data: {
        table: tableName,
        records_deleted: recordsBefore,
        rows_affected: result.rowCount
      },
      message: `Todos os dados da tabela '${tableName}' foram excluídos com sucesso`
    });
    
  } catch (error) {
    
    try {
      await pool.query('SET session_replication_role = DEFAULT;');
    } catch (e) {}
    
    console.error(`❌ Erro ao excluir dados da tabela ${req.params.tableName}:`, error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});


router.delete('/all', async (req, res) => {
  try {
    console.log('🗑️ ADMIN: Excluindo TODOS os dados do banco...');
    
    const tablesInOrder = [
      
      'blockchain_transactions',
      'system_audit_log',
      'backlog_changes',
      'removed_members',
      'sprint_tasks',
      'user_stories',
      'backlog_items',
      'sprints',
      'group_members',
      'groups',
      'user_sessions',
      'users'
    ];
    
    let totalRecordsDeleted = 0;
    const deletionResults = [];
    
    
    await pool.query('SET session_replication_role = replica;');
    
    for (const tableName of tablesInOrder) {
      try {
        
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        const recordsBefore = parseInt(countResult.rows[0].count);
        
        if (recordsBefore > 0) {
          
          await pool.query(`DELETE FROM ${tableName}`);
          
          
          try {
            const sequenceQuery = `SELECT pg_get_serial_sequence('${tableName}', 'id') as sequence_name`;
            const sequenceResult = await pool.query(sequenceQuery);
            
            if (sequenceResult.rows[0]?.sequence_name) {
              await pool.query(`ALTER SEQUENCE ${sequenceResult.rows[0].sequence_name} RESTART WITH 1`);
            }
          } catch (seqError) {
            
          }
          
          totalRecordsDeleted += recordsBefore;
          deletionResults.push({
            table: tableName,
            records_deleted: recordsBefore
          });
          
          console.log(`✅ ${tableName}: ${recordsBefore} registros excluídos`);
        } else {
          deletionResults.push({
            table: tableName,
            records_deleted: 0
          });
          console.log(`ℹ️ ${tableName}: já estava vazia`);
        }
      } catch (error) {
        console.warn(`⚠️ Erro ao excluir tabela ${tableName}:`, error.message);
        deletionResults.push({
          table: tableName,
          error: error.message
        });
      }
    }
    
    
    await pool.query('SET session_replication_role = DEFAULT;');
    
    console.log(`✅ LIMPEZA COMPLETA: ${totalRecordsDeleted} registros excluídos no total`);
    
    res.json({
      success: true,
      data: {
        total_records_deleted: totalRecordsDeleted,
        tables_processed: tablesInOrder.length,
        deletion_results: deletionResults
      },
      message: `Banco de dados limpo com sucesso! ${totalRecordsDeleted} registros excluídos`
    });
    
  } catch (error) {
    
    try {
      await pool.query('SET session_replication_role = DEFAULT;');
    } catch (e) {}
    
    console.error('❌ Erro ao limpar banco de dados:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});


router.get('/debug/tasks/:sprintId', async (req, res) => {
  try {
    const sprintId = parseInt(req.params.sprintId);
    console.log(`🐛 ADMIN DEBUG: Testando busca de tasks para sprint ${sprintId}`);
    
    
    const simpleQuery = `
      SELECT COUNT(*) as count 
      FROM sprint_tasks 
      WHERE sprint_id = $1
    `;
    
    const countResult = await pool.query(simpleQuery, [sprintId]);
    console.log(`🐛 DEBUG: ${countResult.rows[0].count} tasks encontradas`);
    
    
    const fullQuery = `
      SELECT 
        t.id,
        t.title,
        t.description,
        t.status,
        t.assigned_to,
        t.estimated_hours,
        t.created_at,
        t.updated_at,
        t.blockchain_address,
        t.transaction_hash,
        u.full_name as assigned_to_name
      FROM sprint_tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.sprint_id = $1
      ORDER BY t.created_at DESC
    `;
    
    const fullResult = await pool.query(fullQuery, [sprintId]);
    
    res.json({
      success: true,
      debug: true,
      data: {
        sprint_id: sprintId,
        total_count: parseInt(countResult.rows[0].count),
        tasks: fullResult.rows,
        query_executed: fullQuery.replace(/\s+/g, ' ').trim()
      }
    });
    
  } catch (error) {
    console.error(`❌ DEBUG: Erro ao testar tasks do sprint ${req.params.sprintId}:`, error);
    res.status(500).json({
      success: false,
      debug: true,
      error: error.message,
      stack: error.stack
    });
  }
});


router.get('/stats', async (req, res) => {
  try {
    console.log('📊 ADMIN: Gerando estatísticas do banco...');
    
    
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    const tablesResult = await pool.query(tablesQuery);
    
    
    const sizeQuery = `
      SELECT pg_size_pretty(pg_database_size(current_database())) as database_size;
    `;
    
    const sizeResult = await pool.query(sizeQuery);
    
    
    let totalRecords = 0;
    for (const table of tablesResult.rows) {
      try {
        const countQuery = `SELECT COUNT(*) as count FROM ${table.table_name}`;
        const countResult = await pool.query(countQuery);
        totalRecords += parseInt(countResult.rows[0].count);
      } catch (error) {
        console.warn(`⚠️ Erro ao contar registros da tabela ${table.table_name}:`, error);
      }
    }
    
    res.json({
      success: true,
      data: {
        database_size: sizeResult.rows[0].database_size,
        total_records: totalRecords,
        total_tables: tablesResult.rows.length
      },
      message: 'Estatísticas geradas com sucesso'
    });
    
  } catch (error) {
    console.error('❌ Erro ao gerar estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});

module.exports = router;