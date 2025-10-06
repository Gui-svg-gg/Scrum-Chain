
const { Client } = require('pg');
require('dotenv').config({ path: './Env.env' });

async function migrateTimeSystem() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'scrum_chain'
  });

  try {
    await client.connect();
    console.log('🔗 Conectado ao banco de dados');

    
    const columnCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sprint_tasks' 
      AND column_name IN ('estimated_hours', 'estimated_minutes')
    `);

    const columns = columnCheck.rows.map(row => row.column_name);
    
    if (columns.includes('estimated_minutes')) {
      console.log('✅ Sistema de tempo já está migrado');
      return;
    }

    if (columns.includes('estimated_hours')) {
      console.log('🔄 Migrando sistema de horas para sistema padronizado...');
      
      
      const dataCheck = await client.query(`
        SELECT COUNT(*) as count, 
               MIN(estimated_hours) as min_hours, 
               MAX(estimated_hours) as max_hours
        FROM sprint_tasks 
        WHERE estimated_hours IS NOT NULL AND estimated_hours > 0
      `);
      
      const { count, min_hours, max_hours } = dataCheck.rows[0];
      
      console.log(`📊 Dados existentes: ${count} tasks com horas estimadas`);
      if (count > 0) {
        console.log(`📊 Faixa de horas: ${min_hours} - ${max_hours}`);
        
        
        const avgHours = await client.query(`
          SELECT AVG(estimated_hours) as avg_hours
          FROM sprint_tasks 
          WHERE estimated_hours IS NOT NULL AND estimated_hours > 0
        `);
        
        const average = parseFloat(avgHours.rows[0].avg_hours);
        
        if (average > 24) {
          console.log('📝 Dados parecem já estar em minutos. Apenas renomeando coluna...');
          
          
          await client.query(`
            ALTER TABLE sprint_tasks 
            RENAME COLUMN estimated_hours TO estimated_minutes
          `);
          
        } else {
          console.log('📝 Dados parecem estar em horas. Convertendo para minutos...');
          
          
          await client.query(`
            ALTER TABLE sprint_tasks 
            ADD COLUMN estimated_minutes INTEGER DEFAULT 0
          `);
          
          
          await client.query(`
            UPDATE sprint_tasks 
            SET estimated_minutes = ROUND(estimated_hours * 60)
            WHERE estimated_hours IS NOT NULL
          `);
          
          
          await client.query(`
            ALTER TABLE sprint_tasks 
            DROP COLUMN estimated_hours
          `);
        }
      } else {
        console.log('📝 Não há dados para converter. Apenas renomeando coluna...');
        
        
        await client.query(`
          ALTER TABLE sprint_tasks 
          RENAME COLUMN estimated_hours TO estimated_minutes
        `);
      }
    }

    
    await client.query(`
      COMMENT ON COLUMN sprint_tasks.estimated_minutes 
      IS 'Tempo estimado em minutos (ex: 90 = 1h30min). Permite precisão total sem decimais.'
    `);

    console.log('✅ Migração do sistema de tempo concluída com sucesso!');
    
    
    const finalCheck = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'sprint_tasks' 
      AND column_name = 'estimated_minutes'
    `);
    
    console.log('📋 Coluna final:', finalCheck.rows[0]);

  } catch (error) {
    console.error('❌ Erro na migração:', error);
    throw error;
  } finally {
    await client.end();
  }
}


if (require.main === module) {
  migrateTimeSystem()
    .then(() => {
      console.log('🎉 Migração concluída!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Falha na migração:', error);
      process.exit(1);
    });
}

module.exports = migrateTimeSystem;