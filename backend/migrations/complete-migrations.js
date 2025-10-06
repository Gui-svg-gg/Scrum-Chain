const { pool } = require('../config/database');

const runCompleteMigrations = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verificando e criando todas as tabelas necessárias...');
    
    
    const existingTables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    
    const tableNames = existingTables.rows.map(row => row.table_name);
    console.log('📋 Tabelas existentes:', tableNames);
    
    
    if (!tableNames.includes('users')) {
      console.log('📝 Criando tabela: users');
      await client.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          full_name VARCHAR(100) NOT NULL,
          wallet_address VARCHAR(42) UNIQUE,
          scrum_role VARCHAR(20) CHECK (scrum_role IN ('Product Owner', 'Scrum Master', 'Developer', 'Stakeholder')),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Tabela users criada');
    } else {
      console.log('⏭️ Tabela users já existe');
    }
    
    
    if (!tableNames.includes('user_sessions')) {
      console.log('📝 Criando tabela: user_sessions');
      await client.query(`
        CREATE TABLE user_sessions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          token_hash VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Tabela user_sessions criada');
    } else {
      console.log('⏭️ Tabela user_sessions já existe');
    }
    
    
    if (!tableNames.includes('blockchain_transactions')) {
      console.log('📝 Criando tabela: blockchain_transactions');
      await client.query(`
        CREATE TABLE blockchain_transactions (
          id SERIAL PRIMARY KEY,
          transaction_hash VARCHAR(66) UNIQUE NOT NULL,
          transaction_type VARCHAR(50) NOT NULL,
          contract_name VARCHAR(50),
          method_name VARCHAR(50),
          description TEXT,
          user_address VARCHAR(42),
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          team_id INTEGER,
          item_id INTEGER,
          gas_used BIGINT,
          gas_price BIGINT,
          block_number BIGINT,
          network VARCHAR(20) DEFAULT 'localhost',
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          confirmed_at TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      
      await client.query(`
        CREATE INDEX idx_blockchain_transactions_hash ON blockchain_transactions(transaction_hash);
        CREATE INDEX idx_blockchain_transactions_user ON blockchain_transactions(user_address);
        CREATE INDEX idx_blockchain_transactions_type ON blockchain_transactions(transaction_type);
        CREATE INDEX idx_blockchain_transactions_status ON blockchain_transactions(status);
        CREATE INDEX idx_blockchain_transactions_created ON blockchain_transactions(created_at);
      `);
      
      console.log('✅ Tabela blockchain_transactions criada com índices');
    } else {
      console.log('⏭️ Tabela blockchain_transactions já existe');
      
      
      try {
        await client.query('ALTER TABLE blockchain_transactions ADD COLUMN IF NOT EXISTS contract_name VARCHAR(50)');
        await client.query('ALTER TABLE blockchain_transactions ADD COLUMN IF NOT EXISTS method_name VARCHAR(50)');
        await client.query('ALTER TABLE blockchain_transactions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL');
        await client.query('ALTER TABLE blockchain_transactions ADD COLUMN IF NOT EXISTS team_id INTEGER');
        await client.query('ALTER TABLE blockchain_transactions ADD COLUMN IF NOT EXISTS item_id INTEGER');
        await client.query('ALTER TABLE blockchain_transactions ADD COLUMN IF NOT EXISTS network VARCHAR(20) DEFAULT \'localhost\'');
        await client.query('ALTER TABLE blockchain_transactions ADD COLUMN IF NOT EXISTS error_message TEXT');
        await client.query('ALTER TABLE blockchain_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
        console.log('✅ Colunas adicionais verificadas/adicionadas');
      } catch (e) {
        console.log('ℹ️ Algumas colunas já existem:', e.message);
      }
    }
    
    
    if (!tableNames.includes('groups')) {
      console.log('📝 Criando tabela: groups');
      await client.query(`
        CREATE TABLE groups (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          creator_address VARCHAR(42),
          creator_user_id INTEGER REFERENCES users(id),
          blockchain_id VARCHAR(50),
          transaction_hash VARCHAR(66),
          block_number BIGINT,
          synced_at TIMESTAMP,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Tabela groups criada');
    } else {
      console.log('⏭️ Tabela groups já existe');
    }
    
    
    if (!tableNames.includes('group_members')) {
      console.log('📝 Criando tabela: group_members');
      await client.query(`
        CREATE TABLE group_members (
          id SERIAL PRIMARY KEY,
          group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id),
          wallet_address VARCHAR(42),
          role VARCHAR(20) NOT NULL CHECK (role IN ('Product Owner', 'Scrum Master', 'Developer', 'Stakeholder')),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(group_id, user_id)
        );
      `);
      console.log('✅ Tabela group_members criada');
    } else {
      console.log('⏭️ Tabela group_members já existe');
    }
    
    
    if (!tableNames.includes('sprints')) {
      console.log('📝 Criando tabela: sprints');
      await client.query(`
        CREATE TABLE sprints (
          id SERIAL PRIMARY KEY,
          group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          status VARCHAR(20) DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'cancelled')),
          blockchain_address VARCHAR(42),
          created_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Tabela sprints criada');
    } else {
      console.log('⏭️ Tabela sprints já existe');
    }
    
    
    if (!tableNames.includes('backlog_items')) {
      console.log('📝 Criando tabela: backlog_items');
      await client.query(`
        CREATE TABLE backlog_items (
          id SERIAL PRIMARY KEY,
          group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
          sprint_id INTEGER REFERENCES sprints(id),
          title VARCHAR(200) NOT NULL,
          description TEXT,
          story_points INTEGER,
          priority INTEGER DEFAULT 0,
          status VARCHAR(20) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
          assigned_to INTEGER REFERENCES users(id),
          blockchain_address VARCHAR(42),
          created_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Tabela backlog_items criada');
    } else {
      console.log('🔍 Verificando estrutura da tabela backlog_items...');
      
      
      const columns = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'backlog_items'
      `);
      
      const existingColumns = columns.rows.map(row => row.column_name);
      const requiredColumns = [
        'id', 'group_id', 'sprint_id', 'title', 'description', 
        'story_points', 'priority', 'status', 'assigned_to', 
        'blockchain_address', 'created_by', 'created_at', 'updated_at'
      ];
      
      const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
      
      if (missingColumns.length > 0) {
        console.log('⚠️ Tabela backlog_items tem estrutura incorreta. Recriando...');
        console.log('❌ Colunas faltando:', missingColumns);
        
        
        let backupData = [];
        try {
          const backup = await client.query('SELECT * FROM backlog_items');
          backupData = backup.rows;
          console.log(`📋 Backup de ${backupData.length} registros`);
        } catch (e) {
          console.log('⚠️ Erro no backup, continuando...');
        }
        
        
        await client.query('DROP TABLE IF EXISTS backlog_items CASCADE');
        await client.query(`
          CREATE TABLE backlog_items (
            id SERIAL PRIMARY KEY,
            group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
            sprint_id INTEGER REFERENCES sprints(id),
            title VARCHAR(200) NOT NULL,
            description TEXT,
            story_points INTEGER,
            priority INTEGER DEFAULT 0,
            status VARCHAR(20) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
            assigned_to INTEGER REFERENCES users(id),
            blockchain_address VARCHAR(42),
            created_by INTEGER REFERENCES users(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
        
        console.log('✅ Tabela backlog_items recriada com estrutura correta');
        
        
        if (backupData.length > 0) {
          console.log('🔄 Tentando restaurar dados compatíveis...');
          for (const item of backupData) {
            try {
              const insertColumns = [];
              const insertValues = [];
              const insertParams = [];
              let paramIndex = 1;
              
              
              if (item.title) {
                insertColumns.push('title');
                insertValues.push(`$${paramIndex++}`);
                insertParams.push(item.title);
              }
              if (item.description) {
                insertColumns.push('description');
                insertValues.push(`$${paramIndex++}`);
                insertParams.push(item.description);
              }
              if (item.group_id) {
                insertColumns.push('group_id');
                insertValues.push(`$${paramIndex++}`);
                insertParams.push(item.group_id);
              }
              if (item.priority !== undefined) {
                insertColumns.push('priority');
                insertValues.push(`$${paramIndex++}`);
                insertParams.push(item.priority);
              }
              if (item.story_points !== undefined) {
                insertColumns.push('story_points');
                insertValues.push(`$${paramIndex++}`);
                insertParams.push(item.story_points);
              }
              if (item.status) {
                insertColumns.push('status');
                insertValues.push(`$${paramIndex++}`);
                insertParams.push(item.status);
              }
              
              if (insertColumns.length > 0) {
                const restoreQuery = `
                  INSERT INTO backlog_items (${insertColumns.join(', ')})
                  VALUES (${insertValues.join(', ')})
                `;
                await client.query(restoreQuery, insertParams);
              }
            } catch (restoreError) {
              console.log('⚠️ Erro ao restaurar item:', restoreError.message);
            }
          }
          console.log('✅ Dados compatíveis restaurados');
        }
      } else {
        console.log('✅ Tabela backlog_items tem estrutura correta');
      }
    }
    
    
    if (!tableNames.includes('sprint_tasks')) {
      console.log('📝 Criando tabela: sprint_tasks');
      await client.query(`
        CREATE TABLE sprint_tasks (
          id SERIAL PRIMARY KEY,
          sprint_id INTEGER REFERENCES sprints(id) ON DELETE CASCADE,
          group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
          backlog_item_id INTEGER REFERENCES backlog_items(id),
          title VARCHAR(200) NOT NULL,
          description TEXT,
          status VARCHAR(20) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'removed')),
          assigned_to INTEGER REFERENCES users(id),
          estimated_hours INTEGER DEFAULT 0,
          blockchain_address VARCHAR(42),
          created_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Tabela sprint_tasks criada');
    } else {
      console.log('⏭️ Tabela sprint_tasks já existe');
    }
    
    
    if (!tableNames.includes('user_stories')) {
      console.log('📝 Criando tabela: user_stories');
      await client.query(`
        CREATE TABLE user_stories (
          id SERIAL PRIMARY KEY,
          group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
          sprint_id INTEGER REFERENCES sprints(id),
          title VARCHAR(200) NOT NULL,
          description TEXT,
          acceptance_criteria TEXT,
          priority INTEGER DEFAULT 0,
          story_points INTEGER DEFAULT 0,
          status VARCHAR(20) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'cancelled')),
          blockchain_address VARCHAR(42),
          created_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Tabela user_stories criada');
    } else {
      console.log('⏭️ Tabela user_stories já existe');
    }
    
    
    if (!tableNames.includes('removed_members')) {
      console.log('📝 Criando tabela: removed_members');
      await client.query(`
        CREATE TABLE removed_members (
          id SERIAL PRIMARY KEY,
          group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id),
          wallet_address VARCHAR(42) NOT NULL,
          previous_role VARCHAR(20),
          reason TEXT,
          removed_by INTEGER REFERENCES users(id),
          removed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Tabela removed_members criada');
    } else {
      console.log('⏭️ Tabela removed_members já existe');
    }
    
    
    if (!tableNames.includes('system_audit_log')) {
      console.log('📝 Criando tabela: system_audit_log');
      await client.query(`
        CREATE TABLE system_audit_log (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          action_type VARCHAR(50) NOT NULL,
          entity_type VARCHAR(50) NOT NULL,
          entity_id INTEGER,
          details JSONB,
          ip_address INET,
          user_agent TEXT,
          group_id INTEGER REFERENCES groups(id),
          sprint_id INTEGER REFERENCES sprints(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Tabela system_audit_log criada');
    } else {
      console.log('⏭️ Tabela system_audit_log já existe');
    }
    
    
    if (!tableNames.includes('backlog_changes')) {
      console.log('📝 Criando tabela: backlog_changes');
      await client.query(`
        CREATE TABLE backlog_changes (
          id SERIAL PRIMARY KEY,
          item_id INTEGER NOT NULL REFERENCES backlog_items(id) ON DELETE CASCADE,
          field_changed VARCHAR(100) NOT NULL,
          old_value TEXT,
          new_value TEXT,
          changed_by INTEGER NOT NULL REFERENCES users(id),
          changed_at TIMESTAMP DEFAULT NOW()
        );
      `);
      console.log('✅ Tabela backlog_changes criada');
    } else {
      console.log('⏭️ Tabela backlog_changes já existe');
    }
    
    
    console.log('🔍 Criando índices para performance...');
    
    const indexes = [
      
      'CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address)',
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      
      
      'CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at)',
      
      
      'CREATE INDEX IF NOT EXISTS idx_transactions_hash ON blockchain_transactions(transaction_hash)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_user ON blockchain_transactions(user_address)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_type ON blockchain_transactions(transaction_type)',
      
      
      'CREATE INDEX IF NOT EXISTS idx_groups_creator ON groups(creator_address)',
      'CREATE INDEX IF NOT EXISTS idx_groups_active ON groups(is_active)',
      
      
      'CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id)',
      'CREATE INDEX IF NOT EXISTS idx_group_members_wallet ON group_members(wallet_address)',
      'CREATE INDEX IF NOT EXISTS idx_group_members_active ON group_members(group_id, is_active)',
      'CREATE INDEX IF NOT EXISTS idx_group_members_role ON group_members(role)',
      
      
      'CREATE INDEX IF NOT EXISTS idx_sprints_group ON sprints(group_id)',
      'CREATE INDEX IF NOT EXISTS idx_sprints_status ON sprints(status)',
      'CREATE INDEX IF NOT EXISTS idx_sprints_dates ON sprints(start_date, end_date)',
      
      
      'CREATE INDEX IF NOT EXISTS idx_backlog_group ON backlog_items(group_id)',
      'CREATE INDEX IF NOT EXISTS idx_backlog_sprint ON backlog_items(sprint_id)',
      'CREATE INDEX IF NOT EXISTS idx_backlog_user_story ON backlog_items(user_story_id)',
      'CREATE INDEX IF NOT EXISTS idx_backlog_status ON backlog_items(status)',
      'CREATE INDEX IF NOT EXISTS idx_backlog_assigned ON backlog_items(assigned_to)',
      'CREATE INDEX IF NOT EXISTS idx_backlog_priority ON backlog_items(priority)',
      
      
      'CREATE INDEX IF NOT EXISTS idx_user_stories_group ON user_stories(group_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_stories_sprint ON user_stories(sprint_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_stories_status ON user_stories(status)',
      'CREATE INDEX IF NOT EXISTS idx_user_stories_priority ON user_stories(priority)',
      
      
      'CREATE INDEX IF NOT EXISTS idx_tasks_sprint ON sprint_tasks(sprint_id)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_group ON sprint_tasks(group_id)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_status ON sprint_tasks(status)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON sprint_tasks(assigned_to)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_backlog ON sprint_tasks(backlog_item_id)',
      
      
      'CREATE INDEX IF NOT EXISTS idx_removed_group ON removed_members(group_id)',
      'CREATE INDEX IF NOT EXISTS idx_removed_wallet ON removed_members(wallet_address)',
      
      
      'CREATE INDEX IF NOT EXISTS idx_audit_user_id ON system_audit_log(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_action_type ON system_audit_log(action_type)',
      'CREATE INDEX IF NOT EXISTS idx_audit_entity ON system_audit_log(entity_type, entity_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_group_id ON system_audit_log(group_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_created_at ON system_audit_log(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_audit_sprint_id ON system_audit_log(sprint_id)',
      
      
      'CREATE INDEX IF NOT EXISTS idx_backlog_changes_item_id ON backlog_changes(item_id)',
      'CREATE INDEX IF NOT EXISTS idx_backlog_changes_changed_at ON backlog_changes(changed_at)',
      'CREATE INDEX IF NOT EXISTS idx_backlog_changes_changed_by ON backlog_changes(changed_by)'
    ];
    
    for (const indexQuery of indexes) {
      try {
        await client.query(indexQuery);
      } catch (error) {
        console.warn('⚠️ Erro ao criar índice:', error.message);
      }
    }
    
    console.log('✅ Índices criados/verificados');
    
    
    console.log('⚡ Criando triggers para updated_at...');
    
    
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    
    
    const tables = ['users', 'groups', 'group_members', 'sprints', 'backlog_items'];
    
    for (const table of tables) {
      try {
        await client.query(`
          DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
          CREATE TRIGGER update_${table}_updated_at 
            BEFORE UPDATE ON ${table} 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        `);
      } catch (error) {
        console.warn(`⚠️ Erro ao criar trigger para ${table}:`, error.message);
      }
    }
    
    console.log('✅ Triggers criados/verificados');
    
    
    console.log('🔗 Verificando e adicionando relações entre tabelas...');
    
    
    const backlogColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'backlog_items' AND column_name = 'user_story_id'
    `);
    
    if (backlogColumns.rows.length === 0) {
      console.log('📝 Adicionando coluna user_story_id à tabela backlog_items...');
      await client.query(`
        ALTER TABLE backlog_items 
        ADD COLUMN user_story_id INTEGER REFERENCES user_stories(id)
      `);
      console.log('✅ Coluna user_story_id adicionada com sucesso');
    } else {
      console.log('⏭️ Coluna user_story_id já existe na tabela backlog_items');
    }
    
    console.log('✅ Relações entre tabelas verificadas/criadas');
    
    
    console.log('🔧 Aplicando correções automáticas para funcionamento sem wallet...');
    
    try {
      
      const groupsCreatorAddress = await client.query(`
        SELECT is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'groups' AND column_name = 'creator_address'
      `);
      
      if (groupsCreatorAddress.rows.length > 0 && groupsCreatorAddress.rows[0].is_nullable === 'NO') {
        console.log('🔧 Corrigindo groups.creator_address para aceitar NULL...');
        await client.query(`ALTER TABLE groups ALTER COLUMN creator_address DROP NOT NULL`);
        console.log('✅ groups.creator_address agora aceita valores nulos');
      }
      
      
      const groupMembersWallet = await client.query(`
        SELECT is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'group_members' AND column_name = 'wallet_address'
      `);
      
      if (groupMembersWallet.rows.length > 0 && groupMembersWallet.rows[0].is_nullable === 'NO') {
        console.log('🔧 Corrigindo group_members.wallet_address para aceitar NULL...');
        await client.query(`ALTER TABLE group_members ALTER COLUMN wallet_address DROP NOT NULL`);
        console.log('✅ group_members.wallet_address agora aceita valores nulos');
      }
      
      
      const otherWalletTables = [
        { table: 'teams', column: 'creator_address' },
        { table: 'team_members', column: 'address' }
      ];
      
      for (const tableInfo of otherWalletTables) {
        if (finalTableNames.includes(tableInfo.table)) {
          const columnInfo = await client.query(`
            SELECT is_nullable 
            FROM information_schema.columns 
            WHERE table_name = $1 AND column_name = $2
          `, [tableInfo.table, tableInfo.column]);
          
          if (columnInfo.rows.length > 0 && columnInfo.rows[0].is_nullable === 'NO') {
            try {
              await client.query(`ALTER TABLE ${tableInfo.table} ALTER COLUMN ${tableInfo.column} DROP NOT NULL`);
              console.log(`✅ ${tableInfo.table}.${tableInfo.column} agora aceita valores nulos`);
            } catch (e) {
              if (e.message.includes('chave primária')) {
                console.log(`⚠️ ${tableInfo.table}.${tableInfo.column} é chave primária, mantendo NOT NULL`);
              } else {
                console.log(`⚠️ Erro ao alterar ${tableInfo.table}.${tableInfo.column}: ${e.message}`);
              }
            }
          }
        }
      }
      
      console.log('✅ Correções automáticas para wallet aplicadas com sucesso');
      
    } catch (error) {
      console.warn('⚠️ Erro durante correções de wallet (não crítico):', error.message);
    }
    
    
    const finalTables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    
    const finalTableNames = finalTables.rows.map(row => row.table_name);
    
    console.log('🎉 SISTEMA COMPLETO CRIADO!');
    console.log('📊 Todas as tabelas disponíveis:');
    finalTableNames.forEach(name => console.log(`   - ${name}`));
    
    const expectedTables = [
      'users', 'user_sessions', 'blockchain_transactions', 
      'groups', 'group_members', 'sprints', 'backlog_items', 
      'sprint_tasks', 'user_stories', 'removed_members',
      'system_audit_log', 'backlog_changes'
    ];
    
    const missingTables = expectedTables.filter(table => !finalTableNames.includes(table));
    if (missingTables.length === 0) {
      console.log('✅ Todas as tabelas necessárias foram criadas com sucesso!');
    } else {
      console.warn('⚠️ Tabelas faltando:', missingTables);
    }
    
    
    console.log('🔧 Aplicando correções automáticas de estrutura...');
    
    
    const sprintsColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sprints'
    `);
    
    const sprintsColumnNames = sprintsColumns.rows.map(row => row.column_name);
    
    if (!sprintsColumnNames.includes('group_id')) {
      console.log('🔧 Adicionando coluna group_id na tabela sprints...');
      await client.query(`
        ALTER TABLE sprints 
        ADD COLUMN group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE
      `);
      console.log('✅ Coluna group_id adicionada na tabela sprints');
    }
    
    
    if (!sprintsColumnNames.includes('blockchain_address')) {
      console.log('🔧 Adicionando coluna blockchain_address na tabela sprints...');
      await client.query(`
        ALTER TABLE sprints 
        ADD COLUMN blockchain_address VARCHAR(42)
      `);
      console.log('✅ Coluna blockchain_address adicionada na tabela sprints');
    }
    
    
    const createdByColumn = await client.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sprints' AND column_name = 'created_by'
    `);
    
    if (createdByColumn.rows[0]?.data_type === 'character varying') {
      console.log('🔧 Corrigindo tipo da coluna created_by na tabela sprints...');
      
      
      await client.query(`
        UPDATE sprints 
        SET created_by = NULL 
        WHERE created_by !~ '^[0-9]+$' OR created_by = ''
      `);
      
      
      await client.query(`
        ALTER TABLE sprints 
        ALTER COLUMN created_by TYPE INTEGER USING created_by::INTEGER
      `);
      
      console.log('✅ Tipo da coluna created_by corrigido para INTEGER');
    }
    
    console.log('✅ Correções automáticas aplicadas com sucesso!');
    
    
    console.log('🔧 Verificando coluna backlog_id na tabela sprints...');
    
    const backlogColumnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sprints' AND column_name = 'backlog_id'
    `);
    
    if (backlogColumnCheck.rows.length === 0) {
      console.log('➕ Adicionando coluna backlog_id à tabela sprints...');
      await client.query(`
        ALTER TABLE sprints 
        ADD COLUMN backlog_id INTEGER REFERENCES backlog_items(id) ON DELETE SET NULL
      `);
      console.log('✅ Coluna backlog_id adicionada à tabela sprints');
    } else {
      console.log('⏭️ Coluna backlog_id já existe na tabela sprints');
    }
    
    
    console.log('🌱 Inserindo dados iniciais de auditoria...');
    
    try {
      
      const auditCount = await client.query('SELECT COUNT(*) as count FROM system_audit_log');
      
      if (parseInt(auditCount.rows[0].count) === 0) {
        
        await client.query(`
          INSERT INTO system_audit_log 
          (user_id, action_type, entity_type, entity_id, details, ip_address, user_agent, group_id, sprint_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          null,
          'SYSTEM_START',
          'SYSTEM',
          null,
          JSON.stringify({
            message: 'Sistema de auditoria inicializado',
            version: '1.0.0',
            timestamp: new Date().toISOString()
          }),
          '127.0.0.1',
          'Migration System',
          null,
          null
        ]);
        
        console.log('✅ Log inicial de auditoria inserido');
      } else {
        console.log('⏭️ Dados de auditoria já existem');
      }
    } catch (auditError) {
      console.warn('⚠️ Erro ao inserir dados iniciais de auditoria (não crítico):', auditError.message);
    }

    
    console.log('🔗 Verificando colunas de blockchain na tabela groups...');
    try {
      
      const columnsResult = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'groups' 
          AND column_name IN ('blockchain_id', 'transaction_hash', 'block_number', 'synced_at')
      `);
      
      const existingColumns = columnsResult.rows.map(row => row.column_name);
      const requiredColumns = ['blockchain_id', 'transaction_hash', 'block_number', 'synced_at'];
      
      for (const column of requiredColumns) {
        if (!existingColumns.includes(column)) {
          let columnDefinition = '';
          
          switch (column) {
            case 'blockchain_id':
              columnDefinition = 'VARCHAR(50)';
              break;
            case 'transaction_hash':
              columnDefinition = 'VARCHAR(66)';
              break;
            case 'block_number':
              columnDefinition = 'BIGINT';
              break;
            case 'synced_at':
              columnDefinition = 'TIMESTAMP';
              break;
          }
          
          await client.query(`
            ALTER TABLE groups 
            ADD COLUMN ${column} ${columnDefinition}
          `);
          console.log(`✅ Coluna ${column} adicionada à tabela groups`);
        } else {
          console.log(`⏭️ Coluna ${column} já existe na tabela groups`);
        }
      }
      
    } catch (blockchainColumnsError) {
      console.warn('⚠️ Erro ao verificar/adicionar colunas de blockchain:', blockchainColumnsError.message);
    }
    
  } catch (error) {
    console.error('❌ Erro durante as migrações completas:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { runCompleteMigrations };
