const db = require('../config/database');

class TransactionService {
  
  static async create(transaction) {
    try {
      const query = `
        INSERT INTO blockchain_transactions (
          hash, description, status, from_address, to_address, 
          value, gas_used, gas_price, block_number, transaction_index
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      
      const values = [
        transaction.hash,
        transaction.description || null,
        transaction.status || 'pending',
        transaction.from_address || null,
        transaction.to_address || null,
        transaction.value || null,
        transaction.gas_used || null,
        transaction.gas_price || null,
        transaction.block_number || null,
        transaction.transaction_index || null
      ];
      
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Erro ao criar transação:', error);
      throw error;
    }
  }

  
  static async findAll(options = {}) {
    try {
      let query = 'SELECT * FROM blockchain_transactions';
      let orderBy = ' ORDER BY created_at';
      
      if (options.order === 'desc') {
        orderBy = ' ORDER BY created_at DESC';
      }
      
      if (options.limit) {
        orderBy += ` LIMIT ${parseInt(options.limit)}`;
      }
      
      const result = await db.query(query + orderBy);
      return result.rows;
    } catch (error) {
      console.error('Erro ao buscar transações:', error);
      throw error;
    }
  }

  
  static async findByHash(hash) {
    try {
      const query = 'SELECT * FROM blockchain_transactions WHERE hash = $1';
      const result = await db.query(query, [hash]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Erro ao buscar transação por hash:', error);
      throw error;
    }
  }

  
  static async updateStatus(hash, status, errorMessage = null) {
    try {
      let query = 'UPDATE blockchain_transactions SET status = $1';
      let values = [status, hash];
      
      if (errorMessage) {
        query += ', description = COALESCE(description, \'\') || \' - Erro: \' || $3';
        values = [status, hash, errorMessage];
      }
      
      query += ' WHERE hash = $2 RETURNING *';
      
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Erro ao atualizar status da transação:', error);
      throw error;
    }
  }

  
  static async clearAll() {
    try {
      await db.query('DELETE FROM blockchain_transactions');
      return true;
    } catch (error) {
      console.error('Erro ao limpar transações:', error);
      throw error;
    }
  }

  
  static async findByAddress(address) {
    try {
      const query = `
        SELECT * FROM blockchain_transactions 
        WHERE from_address = $1 OR to_address = $1 
        ORDER BY created_at DESC
      `;
      const result = await db.query(query, [address]);
      return result.rows;
    } catch (error) {
      console.error('Erro ao buscar transações por endereço:', error);
      throw error;
    }
  }
}

module.exports = TransactionService;
