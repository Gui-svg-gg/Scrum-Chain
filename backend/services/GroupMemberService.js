const db = require('../config/database');

class GroupMemberService {
  
  
  static async addMember(data) {
    try {
      const { groupId, userId, role } = data;
      
      console.log('👤 Adicionando membro ao grupo:', { groupId, userId, role });
      
      
      const existingQuery = `
        SELECT id FROM group_members 
        WHERE group_id = $1 AND user_id = $2
      `;
      const existing = await db.query(existingQuery, [groupId, userId]);
      
      if (existing.rows.length > 0) {
        
        const updateQuery = `
          UPDATE group_members 
          SET is_active = true, role = $1, updated_at = CURRENT_TIMESTAMP
          WHERE group_id = $2 AND user_id = $3
          RETURNING *
        `;
        const result = await db.query(updateQuery, [role, groupId, userId]);
        return result.rows[0];
      } else {
        
        const insertQuery = `
          INSERT INTO group_members (group_id, user_id, role)
          VALUES ($1, $2, $3)
          RETURNING *
        `;
        const result = await db.query(insertQuery, [groupId, userId, role]);
        return result.rows[0];
      }
    } catch (error) {
      console.error('❌ Erro ao adicionar membro:', error);
      throw error;
    }
  }
  
  
  static async findByGroupId(groupId) {
    try {
      const query = `
        SELECT 
          gm.*,
          u.id as user_id,
          u.full_name,
          u.email,
          u.username,
          u.wallet_address
        FROM group_members gm
        LEFT JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = $1 AND gm.is_active = true
        ORDER BY 
          CASE gm.role 
            WHEN 'Scrum Master' THEN 1
            WHEN 'Product Owner' THEN 2
            WHEN 'Developer' THEN 3
            WHEN 'Stakeholder' THEN 4
            ELSE 5
          END,
          gm.created_at ASC
      `;
      
      const result = await db.query(query, [groupId]);
      return result.rows;
    } catch (error) {
      console.error('❌ Erro ao buscar membros do grupo:', error);
      throw error;
    }
  }
  
  
  static async findByGroupAndWallet(groupId, walletAddress) {
    try {
      const query = `
        SELECT 
          gm.*,
          u.full_name,
          u.email,
          u.username
        FROM group_members gm
        LEFT JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = $1 AND gm.wallet_address = $2 AND gm.is_active = true
      `;
      
      const result = await db.query(query, [groupId, walletAddress.toLowerCase()]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Erro ao buscar membro específico:', error);
      throw error;
    }
  }

  
  static async findByGroupAndUserId(groupId, userId) {
    try {
      const query = `
        SELECT 
          gm.*,
          u.full_name,
          u.email,
          u.username,
          u.wallet_address
        FROM group_members gm
        LEFT JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = $1 AND gm.user_id = $2 AND gm.is_active = true
      `;
      
      const result = await db.query(query, [groupId, userId]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Erro ao buscar membro por ID:', error);
      throw error;
    }
  }
  
  
  static async updateRole(groupId, walletAddress, newRole) {
    try {
      const query = `
        UPDATE group_members 
        SET role = $1, updated_at = CURRENT_TIMESTAMP
        WHERE group_id = $2 AND wallet_address = $3 AND is_active = true
        RETURNING *
      `;
      
      const result = await db.query(query, [newRole, groupId, walletAddress.toLowerCase()]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Erro ao atualizar papel do membro:', error);
      throw error;
    }
  }

  
  static async updateRoleByUserId(groupId, userId, newRole) {
    try {
      const query = `
        UPDATE group_members 
        SET role = $1, updated_at = CURRENT_TIMESTAMP
        WHERE group_id = $2 AND user_id = $3 AND is_active = true
        RETURNING *
      `;
      
      const result = await db.query(query, [newRole, groupId, userId]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Erro ao atualizar papel do membro por ID:', error);
      throw error;
    }
  }
  
  
  static async removeMember(groupId, walletAddress) {
    try {
      
      const member = await this.findByGroupAndWallet(groupId, walletAddress);
      if (member && member.role === 'Scrum Master') {
        throw new Error('Não é possível remover o Scrum Master do grupo');
      }
      
      const query = `
        UPDATE group_members 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE group_id = $1 AND wallet_address = $2
        RETURNING *
      `;
      
      const result = await db.query(query, [groupId, walletAddress.toLowerCase()]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Erro ao remover membro:', error);
      throw error;
    }
  }

  
  static async removeMemberByUserId(groupId, userId) {
    try {
      
      const memberQuery = `
        SELECT role FROM group_members 
        WHERE group_id = $1 AND user_id = $2 AND is_active = true
      `;
      const memberResult = await db.query(memberQuery, [groupId, userId]);
      
      if (memberResult.rows.length > 0 && memberResult.rows[0].role === 'Scrum Master') {
        throw new Error('Não é possível remover o Scrum Master do grupo');
      }
      
      const query = `
        UPDATE group_members 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE group_id = $1 AND user_id = $2
        RETURNING *
      `;
      
      const result = await db.query(query, [groupId, userId]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Erro ao remover membro por ID:', error);
      throw error;
    }
  }
  
  
  static async removeAllMembers(groupId) {
    try {
      const query = `
        UPDATE group_members 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE group_id = $1
        RETURNING *
      `;
      
      const result = await db.query(query, [groupId]);
      return result.rows;
    } catch (error) {
      console.error('❌ Erro ao remover todos os membros:', error);
      throw error;
    }
  }
  
  
  static async countActiveMembers(groupId) {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM group_members
        WHERE group_id = $1 AND is_active = true
      `;
      
      const result = await db.query(query, [groupId]);
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('❌ Erro ao contar membros:', error);
      throw error;
    }
  }
  
  
  static async isMember(groupId, walletAddress) {
    try {
      const query = `
        SELECT id FROM group_members 
        WHERE group_id = $1 AND wallet_address = $2 AND is_active = true
      `;
      
      const result = await db.query(query, [groupId, walletAddress.toLowerCase()]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('❌ Erro ao verificar membro:', error);
      throw error;
    }
  }
  
  
  static async isScrumMaster(groupId, walletAddress) {
    try {
      const query = `
        SELECT id FROM group_members 
        WHERE group_id = $1 AND wallet_address = $2 AND role = 'Scrum Master' AND is_active = true
      `;
      
      const result = await db.query(query, [groupId, walletAddress.toLowerCase()]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('❌ Erro ao verificar Scrum Master:', error);
      throw error;
    }
  }

  
  static async isScrumMasterByUserId(groupId, userId) {
    try {
      const query = `
        SELECT id FROM group_members 
        WHERE group_id = $1 AND user_id = $2 AND role = 'Scrum Master' AND is_active = true
      `;
      
      const result = await db.query(query, [groupId, userId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('❌ Erro ao verificar Scrum Master por ID:', error);
      throw error;
    }
  }

  
  static async updateMemberRole(groupId, walletAddress, newRole) {
    try {
      console.log(`🔄 Atualizando papel do membro ${walletAddress} para ${newRole} no grupo ${groupId}`);
      
      const query = `
        UPDATE group_members 
        SET role = $1, updated_at = CURRENT_TIMESTAMP
        WHERE group_id = $2 AND wallet_address = $3 AND is_active = true
        RETURNING *
      `;
      
      const result = await db.query(query, [newRole, groupId, walletAddress.toLowerCase()]);
      
      if (result.rows.length === 0) {
        throw new Error('Membro não encontrado ou inativo');
      }
      
      console.log(`✅ Papel atualizado com sucesso:`, result.rows[0]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Erro ao atualizar papel do membro:', error);
      throw error;
    }
  }

  
  static async removeMemberByAddress(walletAddress) {
    try {
      console.log(`🗑️ Removendo membro por endereço: ${walletAddress}`);
      
      const query = `
        UPDATE group_members 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE wallet_address = $1 AND is_active = true
        RETURNING *
      `;
      
      const result = await db.query(query, [walletAddress.toLowerCase()]);
      console.log(`✅ Membro removido por endereço:`, result.rows);
      return result.rows;
    } catch (error) {
      console.error('❌ Erro ao remover membro por endereço:', error);
      throw error;
    }
  }

  
  static async deleteByTeamId(groupId) {
    try {
      console.log(`🗑️ Excluindo PERMANENTEMENTE todos os membros do grupo ${groupId}`);
      
      const query = `
        DELETE FROM group_members 
        WHERE group_id = $1
        RETURNING *
      `;
      
      const result = await db.query(query, [groupId]);
      console.log(`✅ ${result.rows.length} membros excluídos permanentemente`);
      return result.rows;
    } catch (error) {
      console.error('❌ Erro ao excluir membros permanentemente:', error);
      throw error;
    }
  }
  
  static async isProductOwner(groupId, walletAddress) {
    try {
      const member = await this.findByGroupAndWallet(groupId, walletAddress);
      return member && member.is_active && member.role === 'Product Owner';
    } catch (error) {
      console.error('❌ Erro ao verificar Product Owner:', error);
      return false;
    }
  }
  
  
  static async isCreator(groupId, walletAddress) {
    try {
      const query = `
        SELECT creator_address 
        FROM groups 
        WHERE id = $1 AND creator_address = $2
      `;
      
      const result = await db.query(query, [groupId, walletAddress.toLowerCase()]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('❌ Erro ao verificar criador:', error);
      return false;
    }
  }
  
  
  static async canManageBacklog(groupId, walletAddress) {
    try {
      const member = await this.findByGroupAndWallet(groupId, walletAddress);
      return member && member.is_active && 
             (member.role === 'Product Owner' || member.role === 'Scrum Master');
    } catch (error) {
      console.error('❌ Erro ao verificar permissões de backlog:', error);
      return false;
    }
  }
  
  
  static async isMember(groupId, walletAddress) {
    try {
      const member = await this.findByGroupAndWallet(groupId, walletAddress);
      return member && member.is_active;
    } catch (error) {
      console.error('❌ Erro ao verificar membro:', error);
      return false;
    }
  }
  
  
  static async isUserMemberOfGroup(userId, groupId) {
    try {
      const query = `
        SELECT id FROM group_members 
        WHERE group_id = $1 AND user_id = $2 AND is_active = true
      `;
      
      const result = await db.query(query, [groupId, userId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('❌ Erro ao verificar membro por ID:', error);
      return false;
    }
  }

  
  static async getMemberRole(userId, groupId) {
    try {
      const query = `
        SELECT gm.role, gm.is_active
        FROM group_members gm
        WHERE gm.group_id = $1 AND gm.user_id = $2 AND gm.is_active = true
      `;
      
      const result = await db.query(query, [groupId, userId]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('❌ Erro ao obter papel do membro:', error);
      return null;
    }
  }

  
  static async findActiveGroupsByUserId(userId) {
    try {
      const query = `
        SELECT 
          g.*,
          gm.role as member_role,
          gm.created_at as joined_at,
          (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND is_active = true) as member_count
        FROM groups g
        INNER JOIN group_members gm ON g.id = gm.group_id
        WHERE gm.user_id = $1 AND gm.is_active = true AND g.is_active = true
        ORDER BY gm.created_at DESC
      `;
      
      const result = await db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('❌ Erro ao buscar grupos ativos do usuário:', error);
      throw error;
    }
  }

  
  static async isMemberByUserId(groupId, userId) {
    try {
      const query = `
        SELECT id FROM group_members 
        WHERE group_id = $1 AND user_id = $2 AND is_active = true
      `;
      
      const result = await db.query(query, [groupId, userId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('❌ Erro ao verificar se usuário é membro:', error);
      throw error;
    }
  }

  
  static async isUserMember(userId, groupId) {
    return this.isUserMemberOfGroup(userId, groupId);
  }
}

module.exports = GroupMemberService;
