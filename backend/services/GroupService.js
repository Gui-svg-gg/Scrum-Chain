const db = require('../config/database');

class GroupService {
  
  
  static async create(data) {
    try {
      const { name, description, creatorUserId } = data;
      
      console.log('📝 Criando novo grupo:', { name, description, creatorUserId });
      
      const query = `
        INSERT INTO groups (name, description, creator_user_id)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      
      const result = await db.query(query, [name, description, creatorUserId]);
      const newGroup = result.rows[0];
      
      console.log('✅ Grupo criado com sucesso');
      return newGroup;
      
    } catch (error) {
      console.error('❌ Erro ao criar grupo:', error);
      throw error;
    }
  }
  
  
  static async findById(id) {
    try {
      const query = `
        SELECT 
          g.*,
          u.full_name as creator_name,
          u.email as creator_email,
          (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.is_active = true) as member_count
        FROM groups g
        LEFT JOIN users u ON g.creator_user_id = u.id
        WHERE g.id = $1
      `;
      
      const result = await db.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Erro ao buscar grupo por ID:', error);
      throw error;
    }
  }
  
  
  static async findByCreator(creatorAddress) {
    try {
      const query = `
        SELECT 
          g.*,
          u.full_name as creator_name,
          u.email as creator_email,
          (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.is_active = true) as member_count
        FROM groups g
        LEFT JOIN users u ON g.creator_user_id = u.id
        WHERE g.creator_address = $1
        ORDER BY g.created_at DESC
      `;
      
      const result = await db.query(query, [creatorAddress.toLowerCase()]);
      return result.rows;
    } catch (error) {
      console.error('❌ Erro ao buscar grupos do criador:', error);
      throw error;
    }
  }
  
  
  static async findByCreatorUserId(creatorUserId) {
    try {
      const query = `
        SELECT 
          g.*,
          u.full_name as creator_name,
          u.email as creator_email,
          (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.is_active = true) as member_count
        FROM groups g
        LEFT JOIN users u ON g.creator_user_id = u.id
        WHERE g.creator_user_id = $1 AND g.is_active = true
        ORDER BY g.created_at DESC
      `;
      
      const result = await db.query(query, [creatorUserId]);
      return result.rows;
    } catch (error) {
      console.error('❌ Erro ao buscar grupos do criador por ID:', error);
      throw error;
    }
  }
  
  
  static async findByMember(walletAddress) {
    try {
      const query = `
        SELECT 
          g.*,
          u.full_name as creator_name,
          gm.role as member_role,
          (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.is_active = true) as member_count
        FROM groups g
        INNER JOIN group_members gm ON g.id = gm.group_id
        LEFT JOIN users u ON g.creator_user_id = u.id
        WHERE gm.wallet_address = $1 AND gm.is_active = true
        ORDER BY g.created_at DESC
      `;
      
      const result = await db.query(query, [walletAddress.toLowerCase()]);
      return result.rows;
    } catch (error) {
      console.error('❌ Erro ao buscar grupos do membro:', error);
      throw error;
    }
  }
  
  
  static async update(id, data) {
    try {
      const { name, description } = data;
      
      const query = `
        UPDATE groups 
        SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;
      
      const result = await db.query(query, [name, description, id]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Erro ao atualizar grupo:', error);
      throw error;
    }
  }
  
  
  static async delete(id, creatorAddress = null) {
    try {
      console.log(`🗑️ Tentando excluir grupo ID: ${id} por ${creatorAddress || 'sistema'}`);
      
      
      if (creatorAddress) {
        const group = await this.findById(id);
        if (!group || group.creator_address.toLowerCase() !== creatorAddress.toLowerCase()) {
          throw new Error('Apenas o criador pode excluir o grupo');
        }
      }
      
      
      const GroupMemberService = require('./GroupMemberService');
      await GroupMemberService.deleteByTeamId(id);
      
      
      const query = `DELETE FROM groups WHERE id = $1 RETURNING *`;
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        throw new Error('Grupo não encontrado ou já foi excluído');
      }
      
      console.log('✅ Grupo excluído com sucesso:', result.rows[0]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Erro ao excluir grupo:', error);
      throw error;
    }
  }

  
  static async deleteByUserId(id, creatorUserId) {
    try {
      console.log(`🗑️ Tentando excluir grupo ID: ${id} por usuário ID: ${creatorUserId}`);
      
      
      const isCreator = await this.isCreatorByUserId(id, creatorUserId);
      if (!isCreator) {
        throw new Error('Apenas o criador pode excluir o grupo');
      }
      
      
      const GroupMemberService = require('./GroupMemberService');
      await GroupMemberService.deleteByTeamId(id);
      
      
      const query = `DELETE FROM groups WHERE id = $1 RETURNING *`;
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        throw new Error('Grupo não encontrado ou já foi excluído');
      }
      
      console.log('✅ Grupo excluído com sucesso:', result.rows[0]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Erro ao excluir grupo:', error);
      throw error;
    }
  }
  
  
  static async isCreator(groupId, walletAddress) {
    try {
      const query = `
        SELECT id FROM groups 
        WHERE id = $1 AND creator_address = $2
      `;
      
      const result = await db.query(query, [groupId, walletAddress.toLowerCase()]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('❌ Erro ao verificar criador:', error);
      throw error;
    }
  }

  
  static async isCreatorByUserId(groupId, userId) {
    try {
      const query = `
        SELECT id FROM groups 
        WHERE id = $1 AND creator_user_id = $2
      `;
      
      const result = await db.query(query, [groupId, userId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('❌ Erro ao verificar criador por ID:', error);
      throw error;
    }
  }

  
  static async findAvailableGroups(userId) {
    try {
      const query = `
        SELECT 
          g.*,
          u.full_name as creator_name,
          u.email as creator_email,
          (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.is_active = true) as member_count
        FROM groups g
        LEFT JOIN users u ON g.creator_user_id = u.id
        WHERE g.is_active = true 
          AND g.id NOT IN (
            SELECT gm.group_id 
            FROM group_members gm 
            WHERE gm.user_id = $1 AND gm.is_active = true
          )
        ORDER BY g.created_at DESC
        LIMIT 20
      `;
      
      const result = await db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('❌ Erro ao buscar grupos disponíveis:', error);
      throw error;
    }
  }

  
  static async updateBlockchainId(id, data) {
    try {
      const { blockchain_id, transaction_hash, block_number, synced_at } = data;
      
      console.log('🔗 Atualizando blockchain_id do grupo:', { id, blockchain_id, transaction_hash });
      
      const query = `
        UPDATE groups 
        SET blockchain_id = $1, 
            transaction_hash = $2, 
            block_number = $3, 
            synced_at = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *
      `;
      
      const result = await db.query(query, [
        blockchain_id, 
        transaction_hash, 
        block_number, 
        synced_at,
        id
      ]);
      
      if (result.rows.length === 0) {
        throw new Error('Grupo não encontrado');
      }
      
      console.log('✅ Blockchain_id atualizado com sucesso');
      return result.rows[0];
      
    } catch (error) {
      console.error('❌ Erro ao atualizar blockchain_id:', error);
      throw error;
    }
  }
}

module.exports = GroupService;
