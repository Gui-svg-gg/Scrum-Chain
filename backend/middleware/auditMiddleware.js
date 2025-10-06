const AuditService = require('../services/AuditService');

const auditMiddleware = (actionType, entityType) => {
  return (req, res, next) => {
    
    const originalSend = res.send;
    const originalJson = res.json;

    
    const auditData = {
      userId: req.user?.id || null,
      actionType,
      entityType,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      groupId: req.params.groupId ? parseInt(req.params.groupId) : null,
      sprintId: req.params.sprintId ? parseInt(req.params.sprintId) : null,
    };

    
    const requestData = {
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      query: req.query,
      timestamp: new Date().toISOString()
    };

    
    res.send = function(data) {
      
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const responseData = typeof data === 'string' ? JSON.parse(data) : data;
        
        
        let entityId = null;
        if (responseData.data?.id) {
          entityId = responseData.data.id;
        } else if (responseData.id) {
          entityId = responseData.id;
        } else if (req.params.id) {
          entityId = parseInt(req.params.id);
        }

        const details = {
          request: requestData,
          response: {
            status: res.statusCode,
            success: responseData.success !== false
          }
        };

        
        if (req.body && Object.keys(req.body).length > 0) {
          details.requestBody = req.body;
        }

        AuditService.logAction({
          ...auditData,
          entityId,
          details
        }).catch(error => {
          console.error('Erro ao registrar auditoria:', error);
        });
      }

      return originalSend.call(this, data);
    };

    res.json = function(data) {
      
      if (res.statusCode >= 200 && res.statusCode < 300) {
        
        let entityId = null;
        if (data.data?.id) {
          entityId = data.data.id;
        } else if (data.id) {
          entityId = data.id;
        } else if (req.params.id) {
          entityId = parseInt(req.params.id);
        }

        const details = {
          request: requestData,
          response: {
            status: res.statusCode,
            success: data.success !== false
          }
        };

        
        if (req.body && Object.keys(req.body).length > 0) {
          details.requestBody = req.body;
        }

        AuditService.logAction({
          ...auditData,
          entityId,
          details
        }).catch(error => {
          console.error('Erro ao registrar auditoria:', error);
        });
      }

      return originalJson.call(this, data);
    };

    next();
  };
};


const logAuditAction = async (req, actionType, entityType, entityId, extraDetails = {}) => {
  try {
    const auditData = {
      userId: req.user?.id || null,
      actionType,
      entityType,
      entityId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      groupId: req.params.groupId ? parseInt(req.params.groupId) : null,
      sprintId: req.params.sprintId ? parseInt(req.params.sprintId) : null,
      details: {
        method: req.method,
        url: req.originalUrl,
        params: req.params,
        query: req.query,
        timestamp: new Date().toISOString(),
        ...extraDetails
      }
    };

    return await AuditService.logAction(auditData);
  } catch (error) {
    console.error('Erro ao registrar ação de auditoria:', error);
    return null;
  }
};


const ACTION_TYPES = {
  
  LOGIN: 'USER_LOGIN',
  LOGOUT: 'USER_LOGOUT',
  REGISTER: 'USER_REGISTER',
  
  
  CREATE: 'CREATE',
  READ: 'READ',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  
  
  GROUP_CREATE: 'GROUP_CREATE',
  GROUP_UPDATE: 'GROUP_UPDATE',
  GROUP_DELETE: 'GROUP_DELETE',
  GROUP_JOIN: 'GROUP_JOIN',
  GROUP_LEAVE: 'GROUP_LEAVE',
  MEMBER_ADD: 'MEMBER_ADD',
  MEMBER_REMOVE: 'MEMBER_REMOVE',
  MEMBER_ROLE_CHANGE: 'MEMBER_ROLE_CHANGE',
  
  
  SPRINT_CREATE: 'SPRINT_CREATE',
  SPRINT_UPDATE: 'SPRINT_UPDATE',
  SPRINT_DELETE: 'SPRINT_DELETE',
  SPRINT_START: 'SPRINT_START',
  SPRINT_COMPLETE: 'SPRINT_COMPLETE',
  
  
  TASK_CREATE: 'TASK_CREATE',
  TASK_UPDATE: 'TASK_UPDATE',
  TASK_DELETE: 'TASK_DELETE',
  TASK_STATUS_CHANGE: 'TASK_STATUS_CHANGE',
  TASK_ASSIGN: 'TASK_ASSIGN',
  
  
  BACKLOG_CREATE: 'BACKLOG_CREATE',
  BACKLOG_UPDATE: 'BACKLOG_UPDATE',
  BACKLOG_DELETE: 'BACKLOG_DELETE',
  BACKLOG_PRIORITIZE: 'BACKLOG_PRIORITIZE',
  
  
  STORY_CREATE: 'STORY_CREATE',
  STORY_UPDATE: 'STORY_UPDATE',
  STORY_DELETE: 'STORY_DELETE',
  
  
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  SYSTEM_WARNING: 'SYSTEM_WARNING',
  AUDIT_CLEANUP: 'AUDIT_CLEANUP',
  AUDIT_CLEAR_ALL: 'AUDIT_CLEAR_ALL',
  AUDIT_DELETE_LOG: 'AUDIT_DELETE_LOG'
};


const ENTITY_TYPES = {
  USER: 'USER',
  GROUP: 'GROUP',
  SPRINT: 'SPRINT',
  TASK: 'TASK',
  BACKLOG_ITEM: 'BACKLOG_ITEM',
  USER_STORY: 'USER_STORY',
  SYSTEM: 'SYSTEM'
};

module.exports = {
  auditMiddleware,
  logAuditAction,
  ACTION_TYPES,
  ENTITY_TYPES
};
