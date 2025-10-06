const { Pool } = require('pg');

const pool = new Pool({
  user: 'scrumchain_user',
  host: 'localhost',
  database: 'scrumchain',
  password: 'scrumchain2024',
  port: 5432,
});

async function addBacklogColumnToSprints() {
  const client = await pool.connect();
  try {
    console.log('🔧 Adicionando coluna backlog_id à tabela sprints...');
    
    
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sprints' 
        AND column_name = 'backlog_id'
    `);
    
    if (checkColumn.rows.length === 0) {
      
      await client.query(`
        ALTER TABLE sprints 
        ADD COLUMN backlog_id INTEGER REFERENCES backlog_items(id) ON DELETE SET NULL
      `);
      console.log('✅ Coluna backlog_id adicionada à tabela sprints');
    } else {
      console.log('⏭️ Coluna backlog_id já existe na tabela sprints');
    }
    
    
    const tableStructure = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'sprints' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Estrutura atual da tabela sprints:');
    tableStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao adicionar coluna backlog_id:', error);
    throw error;
  } finally {
    client.release();
  }
}


addBacklogColumnToSprints()
  .then(() => {
    console.log('🎉 Migração concluída com sucesso!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Erro na migração:', error);
    process.exit(1);
  });