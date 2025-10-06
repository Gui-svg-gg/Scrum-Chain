const { Pool } = require('pg');


const createPool = () => {
  console.log('🔍 === CONFIGURAÇÃO DATABASE ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  
  
  if (process.env.NODE_ENV === 'production') {
    
    delete process.env.DATABASE_URL;
    delete process.env.PGHOST;
    delete process.env.PGPORT;
    delete process.env.PGDATABASE;
    delete process.env.PGUSER;
    delete process.env.PGPASSWORD;
    
    console.log('🔗 FORÇANDO Supabase Session Pooler (IPv4) - Railway compatible');
    
    return new Pool({
      
      host: 'aws-1-us-east-1.pooler.supabase.com',
      port: 5432, 
      database: 'postgres',
      user: 'postgres.dnoiejrvgvmfnpuzwfiu',
      password: 'scrum-chain123',
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000,
      acquireTimeoutMillis: 20000,
      application_name: 'scrum-chain-backend'
    });
  }
  
  
  if (process.env.DATABASE_URL && 
      !process.env.DATABASE_URL.includes('${{') && 
      process.env.DATABASE_URL.startsWith('postgres')) {
    console.log('🔗 Usando DATABASE_URL personalizada');
    
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000, 
      acquireTimeoutMillis: 30000,
      application_name: 'scrum-chain-backend'
    });
  }
  
  
  if (process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER && process.env.PGPASSWORD) {
    console.log('🔗 Usando variáveis Railway Postgres individuais');
    console.log('PGHOST:', process.env.PGHOST);
    console.log('PGDATABASE:', process.env.PGDATABASE);
    console.log('PGUSER:', process.env.PGUSER);
    console.log('PGPORT:', process.env.PGPORT || 5432);
    
    return new Pool({
      host: process.env.PGHOST,
      port: parseInt(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
      acquireTimeoutMillis: 30000,
      application_name: 'scrum-chain-backend'
    });
  }
  
  
  if (process.env.NODE_ENV === 'production') {
    console.log('🔗 Tentando Railway com variáveis padrão');
    
    
    if (process.env.POSTGRES_HOST || process.env.RAILWAY_POSTGRES_HOST) {
      const host = process.env.POSTGRES_HOST || process.env.RAILWAY_POSTGRES_HOST;
      const port = process.env.POSTGRES_PORT || process.env.RAILWAY_POSTGRES_PORT || 5432;
      const database = process.env.POSTGRES_DB || process.env.RAILWAY_POSTGRES_DB || 'railway';
      const user = process.env.POSTGRES_USER || process.env.RAILWAY_POSTGRES_USER || 'postgres';
      const password = process.env.POSTGRES_PASSWORD || process.env.RAILWAY_POSTGRES_PASSWORD;
      
      console.log('🔧 Construindo conexão manual:', { host, port, database, user });
      
      return new Pool({
        host,
        port: parseInt(port),
        database,
        user,
        password,
        ssl: { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 30000,
        acquireTimeoutMillis: 30000,
        application_name: 'scrum-chain-backend'
      });
    }
  }
  
  
  console.log('🔗 Usando configuração local de desenvolvimento');
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'scrumchain',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
    application_name: 'scrum-chain-backend'
  });
};

const pool = createPool();


pool.on('connect', (client) => {
  console.log('✅ Nova conexão PostgreSQL estabelecida');
});

pool.on('error', (err, client) => {
  console.error('❌ Erro inesperado no cliente PostgreSQL:', err.message);
  console.error('🔍 Código:', err.code);
  
  
  switch(err.code) {
    case 'ENOTFOUND':
      console.error('💡 Host do banco não encontrado - verifique PGHOST');
      break;
    case 'ECONNREFUSED':
      console.error('💡 Conexão recusada - verifique se o banco está rodando');
      break;
    case '28P01':
      console.error('💡 Erro de autenticação - verifique usuário e senha');
      break;
    case 'ECONNRESET':
      console.error('💡 Conexão resetada - problema de rede ou timeout');
      break;
    default:
      console.error('💡 Erro desconhecido - verifique todas as configurações');
  }
});


const testConnection = async () => {
  let client;
  try {
    console.log('🧪 Testando conexão com PostgreSQL...');
    
    
    const connectionPromise = pool.connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout after 15 seconds')), 15000)
    );
    
    client = await Promise.race([connectionPromise, timeoutPromise]);
    console.log('✅ Conexão estabelecida com sucesso!');
    
    
    const queryPromise = client.query('SELECT NOW() as timestamp, version() as version');
    const queryTimeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Query timeout after 10 seconds')), 10000)
    );
    
    const result = await Promise.race([queryPromise, queryTimeoutPromise]);
    const data = result.rows[0];
    
    console.log('📊 Informações do banco:');
    console.log('  ⏰ Timestamp:', data.timestamp);
    console.log('  🗄️ Versão:', data.version.substring(0, 60) + '...');
    
    
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('📋 Tabelas encontradas:', tablesResult.rows.map(r => r.table_name).join(', '));
    
    return true;
    
  } catch (error) {
    console.error('❌ Falha no teste de conexão:', error.message);
    
    
    if (error.message.includes('ENOTFOUND')) {
      console.error('🔍 Erro DNS: O hostname do banco não pôde ser resolvido');
      console.error('💡 Soluções possíveis:');
      console.error('   1. Verificar se o serviço PostgreSQL está ativo no Railway');
      console.error('   2. Verificar se as variáveis de ambiente estão corretas');
      console.error('   3. Verificar se há problemas de conectividade de rede');
      
      
      console.error('🔍 Configurações atuais:');
      console.error('   DATABASE_URL:', process.env.DATABASE_URL ? '[PRESENT]' : '[MISSING]');
      console.error('   PGHOST:', process.env.PGHOST || '[MISSING]');
      console.error('   NODE_ENV:', process.env.NODE_ENV);
    }
    
    if (error.message.includes('timeout')) {
      console.error('🔍 Erro de Timeout: A conexão demorou muito para ser estabelecida');
      console.error('💡 Isso pode indicar problemas de conectividade ou sobrecarga do servidor');
    }
    
    console.error('🔍 Stack:', error.stack);
    return false;
  } finally {
    if (client) {
      client.release();
    }
  }
};


const query = async (text, params) => {
  try {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      console.warn(`⚠️ Query lenta (${duration}ms):`, text.substring(0, 100) + '...');
    }
    
    return result;
  } catch (error) {
    console.error('❌ Erro na query SQL:', error.message);
    console.error('🔍 Query:', text.substring(0, 200) + '...');
    console.error('🔍 Parâmetros:', params);
    throw error;
  }
};

module.exports = {
  query,
  pool,
  testConnection
};