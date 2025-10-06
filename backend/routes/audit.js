const express = require('express');
const router = express.Router();
const AuditService = require('../services/AuditService');
const { authenticateToken } = require('../middleware/auth');
const { auditMiddleware, logAuditAction, ACTION_TYPES, ENTITY_TYPES } = require('../middleware/auditMiddleware');


router.use((req, res, next) => {
  console.log(`🔍 [AUDIT] ${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
  next();
});

/**
 * @route GET /api/audit/test
 * @desc Testar se as rotas estão funcionando
 * @access Private
 */
router.get('/test', authenticateToken, (req, res) => {
  console.log('✅ Rota de teste funcionando!');
  res.json({
    success: true,
    message: 'Rotas de auditoria estão funcionando',
    timestamp: new Date().toISOString()
  });
});

/**
 * @route GET /api/audit/history
 * @desc Buscar histórico de auditoria
 * @access Private
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    console.log('📜 Recebendo requisição para histórico de auditoria');
    const {
      userId,
      actionType,
      entityType,
      groupId,
      sprintId,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const filters = {
      userId: userId ? parseInt(userId) : null,
      actionType,
      entityType,
      groupId: groupId ? parseInt(groupId) : null,
      sprintId: sprintId ? parseInt(sprintId) : null,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset
    };

    console.log('🔍 Filtros de histórico:', filters);

    const result = await AuditService.getAuditHistory(filters);
    
    console.log('✅ Histórico obtido:', {
      logsCount: result.logs.length,
      total: result.total
    });

    
    await logAuditAction(req, ACTION_TYPES.READ, ENTITY_TYPES.SYSTEM, null, {
      filters,
      resultsCount: result.logs.length
    });

    res.json({
      success: true,
      data: result.logs,
      pagination: {
        total: result.total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(result.total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar histórico de auditoria:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/audit/stats
 * @desc Buscar estatísticas de auditoria
 * @access Private
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    console.log('📊 Recebendo requisição para estatísticas de auditoria');
    const { groupId, startDate, endDate } = req.query;

    const filters = {
      groupId: groupId ? parseInt(groupId) : null,
      startDate,
      endDate
    };

    console.log('🔍 Filtros aplicados:', filters);
    
    const stats = await AuditService.getAuditStats(filters);
    
    console.log('✅ Estatísticas obtidas:', {
      actionStats: stats.actionStats.length,
      userStats: stats.userStats.length,
      dailyStats: stats.dailyStats.length
    });

    
    await logAuditAction(req, ACTION_TYPES.READ, ENTITY_TYPES.SYSTEM, null, {
      type: 'stats_access',
      filters
    });

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas de auditoria:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/audit/action-types
 * @desc Buscar tipos de ação disponíveis
 * @access Private
 */
router.get('/action-types', authenticateToken, async (req, res) => {
  try {
    console.log('🏷️ Recebendo requisição para tipos de ação');
    const actionTypes = await AuditService.getActionTypes();
    
    console.log('✅ Tipos de ação obtidos:', actionTypes);

    res.json({
      success: true,
      data: actionTypes
    });

  } catch (error) {
    console.error('❌ Erro ao buscar tipos de ação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/audit/entity-types
 * @desc Buscar tipos de entidade disponíveis
 * @access Private
 */
router.get('/entity-types', authenticateToken, async (req, res) => {
  try {
    console.log('🏢 Recebendo requisição para tipos de entidade');
    const entityTypes = await AuditService.getEntityTypes();
    
    console.log('✅ Tipos de entidade obtidos:', entityTypes);

    res.json({
      success: true,
      data: entityTypes
    });

  } catch (error) {
    console.error('❌ Erro ao buscar tipos de entidade:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/audit/manual-log
 * @desc Registrar log manual (para ações específicas)
 * @access Private
 */
router.post('/manual-log', authenticateToken, async (req, res) => {
  try {
    const { actionType, entityType, entityId, details } = req.body;

    if (!actionType || !entityType) {
      return res.status(400).json({
        success: false,
        message: 'actionType e entityType são obrigatórios'
      });
    }

    const logId = await logAuditAction(req, actionType, entityType, entityId, details);

    res.json({
      success: true,
      data: { logId },
      message: 'Log registrado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao registrar log manual:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/audit/log/:id
 * @desc Excluir um log específico de auditoria
 * @access Private - Admin only
 */
router.delete('/log/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Recebendo requisição para excluir log:', id);
    console.log('🔍 Verificando se log existe...');
    
    const deletedCount = await AuditService.deleteLog(parseInt(id));

    if (deletedCount === 0) {
      console.log('❌ Log não encontrado:', id);
      return res.status(404).json({
        success: false,
        message: 'Log não encontrado'
      });
    }

    
    await logAuditAction(req, 'AUDIT_DELETE_LOG', ENTITY_TYPES.SYSTEM, id, {
      deletedLogId: parseInt(id)
    });

    console.log(`✅ Log ${id} foi removido`);

    res.json({
      success: true,
      data: { deletedCount },
      message: `Log ${id} foi removido com sucesso`
    });

  } catch (error) {
    console.error('❌ Erro ao excluir log:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/audit/clear-all
 * @desc Limpar todo o histórico (apenas para administradores)
 * @access Private - Admin only
 */
router.delete('/clear-all', authenticateToken, async (req, res) => {
  try {
    console.log('🗑️ Recebendo requisição para limpar todo o histórico');
    console.log('🔍 Iniciando limpeza do histórico...');
    
    const deletedCount = await AuditService.clearAllLogs();

    
    await logAuditAction(req, 'AUDIT_CLEAR_ALL', ENTITY_TYPES.SYSTEM, null, {
      deletedCount
    });

    console.log(`✅ ${deletedCount} logs foram removidos`);

    res.json({
      success: true,
      data: { deletedCount },
      message: `Todo o histórico foi limpo. ${deletedCount} logs foram removidos`
    });

  } catch (error) {
    console.error('❌ Erro ao limpar todo o histórico:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/audit/cleanup
 * @desc Limpar logs antigos (apenas para administradores)
 * @access Private - Admin only
 */
router.delete('/cleanup', authenticateToken, async (req, res) => {
  try {
    
    
    
    const { daysToKeep = 90 } = req.body;

    const deletedCount = await AuditService.cleanOldLogs(parseInt(daysToKeep));

    
    await logAuditAction(req, 'AUDIT_CLEANUP', ENTITY_TYPES.SYSTEM, null, {
      daysToKeep: parseInt(daysToKeep),
      deletedCount
    });

    res.json({
      success: true,
      data: { deletedCount },
      message: `${deletedCount} logs antigos foram removidos`
    });

  } catch (error) {
    console.error('Erro ao limpar logs antigos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

module.exports = router;
