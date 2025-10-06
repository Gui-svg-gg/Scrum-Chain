const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Configurar dotenv para diferentes ambientes
if (process.env.NODE_ENV === 'production') {
  // Em produção (Railway), as variáveis já estão no ambiente
  console.log('🌍 Ambiente: Produção - usando variáveis do Railway');
} else {
  // Em desenvolvimento, carregar do arquivo .env
  require('dotenv').config({ path: './Env.env' });
  console.log('🛠️ Ambiente: Desenvolvimento - carregando Env.env');
}

const { testConnection } = require('./config/database');
const { runCompleteMigrations } = require('./migrations/complete-migrations');
const authRoutes = require('./routes/auth');
const backlogRoutes = require('./routes/backlog');
const groupRoutes = require('./routes/groups');
const sprintRoutes = require('./routes/sprints');
const taskRoutes = require('./routes/tasks');
const userStoryRoutes = require('./routes/userStories');
const auditRoutes = require('./routes/audit');
const blockchainRoutes = require('./routes/blockchain');
const adminRoutes = require('./routes/admin'); // Rotas administrativas

const app = express();
const PORT = process.env.PORT || 3001;

// Configurar trust proxy para Railway
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust first proxy
} else {
  app.set('trust proxy', false);
}

// Configuração de segurança
app.use(helmet());

// Rate limiting desabilitado para desenvolvimento
// const generalLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 1000,
//   message: {
//     success: false,
//     message: 'Muitas solicitações. Tente novamente em 15 minutos.'
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
//   skip: (req) => {
//     const origin = req.headers.origin;
//     return origin === 'http://localhost:3000' || origin === 'http://127.0.0.1:3000';
//   }
// });

// app.use(generalLimiter); // Comentado para desenvolvimento

// Configuração de CORS mais robusta
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requisições sem origin (ex: aplicações mobile, Postman)
    if (!origin) return callback(null, true);
    
    // Lista de origens permitidas
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://scrumchain.vercel.app',
      process.env.FRONTEND_URL,
      process.env.CORS_ORIGIN
    ].filter(Boolean);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`Origin bloqueada: ${origin}`);
      // Em produção, bloquear origens não permitidas
      if (process.env.NODE_ENV === 'production') {
        callback(new Error('Not allowed by CORS'));
      } else {
        callback(null, true); // Permitir em desenvolvimento
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma'
  ],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Middleware adicional para garantir CORS em todas as respostas
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000', 
    'http://127.0.0.1:3000',
    'https://scrumchain.vercel.app'
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', 'https://scrumchain.vercel.app');
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control,Pragma,X-CSRF-Token');
  res.header('Access-Control-Max-Age', '86400'); // Cache preflight por 24h
  
  // Log para debug
  console.log(`🔧 CORS Request: ${req.method} ${req.path} - Origin: ${origin || 'N/A'}`);
  
  // Responder a requisições OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    console.log(`✅ OPTIONS preflight para: ${req.path}`);
    res.status(200).end();
    return;
  }
  
  next();
});

// Middleware para parsing de JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de logging mais detalhado
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.path} - IP: ${req.ip} - Origin: ${req.headers.origin || 'N/A'}`);
  
  // Log específico para requisições CORS
  if (req.method === 'OPTIONS') {
    console.log(`🔧 CORS Preflight: ${req.path}`);
  }
  
  next();
});

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/backlog', backlogRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/groups', sprintRoutes);
app.use('/api/sprints', sprintRoutes); // Adicionando rota direta para sprints
app.use('/api/groups', taskRoutes);
app.use('/api', taskRoutes); // Adicionando rota direta para tasks (para /api/tasks/:taskId/start e /api/tasks/:taskId/complete)
app.use('/api/userstories', userStoryRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/admin', adminRoutes); // Rotas administrativas (SEM AUTENTICAÇÃO)

// Health check endpoints
app.get('/health', (req, res) => {
  console.log('🏥 Health check acessado');
  res.status(200).json({
    success: true,
    message: 'Backend funcionando corretamente',
    timestamp: new Date().toISOString(),
    status: 'ok',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Rota de health check com prefixo api
app.get('/api/health', (req, res) => {
  console.log('🏥 API Health check acessado');
  res.status(200).json({
    success: true,
    message: 'ScrumChain Backend está funcionando!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Bem-vindo ao ScrumChain Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      docs: 'Em desenvolvimento'
    }
  });
});

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint não encontrado',
    path: req.originalUrl
  });
});

// Middleware global de tratamento de erros
app.use((error, req, res, next) => {
  console.error('Erro não tratado:', error);
  
  res.status(error.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' 
      ? error.message 
      : 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Função para inicializar o servidor
const startServer = async () => {
  try {
    console.log('🚀 Iniciando ScrumChain Backend...');
    console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`� Porta: ${PORT}`);
    
    // Iniciar servidor PRIMEIRO (para passar no healthcheck)
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Servidor rodando na porta ${PORT}`);
      console.log(`🌐 Ambiente: ${process.env.NODE_ENV}`);
      console.log(`📡 CORS configurado para: ${process.env.FRONTEND_URL || 'desenvolvimento'}`);
      console.log(`🔗 Acesse: http://localhost:${PORT}`);
      console.log(`❤️  Health check: http://localhost:${PORT}/health`);
    });

    // Depois tentar conectar ao banco (em background)
    setTimeout(async () => {
      try {
        console.log('🔗 Tentando conectar ao banco de dados...');
        const isConnected = await testConnection();
        
        if (isConnected) {
          console.log('✅ Conexão com banco estabelecida!');
          
          console.log('🔄 Executando migrações automáticas...');
          await runCompleteMigrations();
          console.log('✅ Migrações executadas com sucesso!');
          console.log('🎉 Sistema totalmente operacional!');
        } else {
          throw new Error('Falha na conexão com banco de dados');
        }
        
      } catch (dbError) {
        console.error('⚠️ Erro com banco de dados (servidor continua rodando):', dbError.message);
        console.log('🔧 Servidor funcionando sem banco - algumas funcionalidades podem estar limitadas');
        
        // Log específico para Railway
        if (dbError.message.includes('ENOTFOUND')) {
          console.error('');
          console.error('🚨 === PROBLEMAS DE CONECTIVIDADE RAILWAY ===');
          console.error('💡 Possíveis soluções:');
          console.error('   1. Verificar se o PostgreSQL Railway está ativo');
          console.error('   2. Verificar variáveis de ambiente DATABASE_URL');
          console.error('   3. Verificar se há problemas temporários na Railway');
          console.error('   4. Executar: npm run debug-env para diagnóstico');
          console.error('================================================');
          console.error('');
        }
      }
    }, 2000); // Aguardar 2 segundos

    return server;
    
  } catch (error) {
    console.error('❌ Erro crítico ao iniciar servidor:', error);
    process.exit(1);
  }
};

// Tratamento de shutdown graceful
process.on('SIGINT', () => {
  console.log('\n🛑 Recebido SIGINT, fazendo shutdown graceful...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Recebido SIGTERM, fazendo shutdown graceful...');
  process.exit(0);
});

// Inicializar servidor
if (require.main === module) {
  startServer();
}

module.exports = app;
