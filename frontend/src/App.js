import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { 
  Container, 
  Box, 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  CssBaseline, 
  Divider,
  Alert, 
  Menu, 
  MenuItem
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { 
  Dashboard as DashboardIcon, 
  People as TeamIcon,
  FormatListBulleted as BacklogIcon,
  BarChart as SprintIcon,
  Logout as LogoutIcon,
  AccountCircle as AccountCircleIcon,
  ExpandMore as ExpandMoreIcon,
  AccountBox as AccountBoxIcon,
  History as HistoryIcon
} from '@mui/icons-material';

import { AppProvider, useApp } from './context/AppContext';
import { WalletProvider } from './context/WalletContext';
import { getApiUrl } from './config/api';
import WalletButton from './components/WalletButton';
import TeamManagement from './pages/TeamManagement';
import ProductBacklogPage from './pages/ProductBacklogPage';
import SprintManagementPage from './pages/SprintManagementPage';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import ContaPage from './pages/ContaPage';
import HistoryPage from './pages/HistoryPage';
import AdminPage from './pages/AdminPage';
import theme from './theme';
import './App.css';

function Layout({ children, user, onLogout }) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const navigate = useNavigate();

  const handleUserMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleUserMenuClose();
    onLogout();
  };

  const handleMenuItemClick = (path) => {
    handleUserMenuClose();
    navigate(path);
  };

  const menuItems = [
    { name: 'Dashboard', icon: <DashboardIcon />, path: '/', requiredRole: null },
    { name: 'Equipe Scrum', icon: <TeamIcon />, path: '/team', requiredRole: null },
    { name: 'Product Backlog', icon: <BacklogIcon />, path: '/backlog', requiredRole: null },
    { name: 'Sprints', icon: <SprintIcon />, path: '/sprints', requiredRole: null },
    { name: 'Histórico', icon: <HistoryIcon />, path: '/history', requiredRole: null },
    { name: 'Conta', icon: <AccountBoxIcon />, path: '/conta', requiredRole: null }
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: '100%'
        }}
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Scrum Chain
          </Typography>
          
          {/* Dropdown do usuário */}
          <Box display="flex" alignItems="center" gap={2}>
            <WalletButton />
            
            <Button
              color="inherit"
              onClick={handleUserMenuOpen}
              startIcon={<AccountCircleIcon />}
              endIcon={<ExpandMoreIcon />}
              sx={{ textTransform: 'none' }}
            >
              {user?.full_name || user?.email || 'Usuário'}
            </Button>
            
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleUserMenuClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              PaperProps={{
                sx: {
                  mt: 1,
                  minWidth: 200,
                  '& .MuiMenuItem-root': {
                    px: 2,
                    py: 1,
                  }
                }
              }}
            >
              {/* Itens do menu */}
              {menuItems.map((item) => (
                <MenuItem 
                  key={item.name} 
                  onClick={() => handleMenuItemClick(item.path)}
                  sx={{ gap: 2 }}
                >
                  {item.icon}
                  {item.name}
                </MenuItem>
              ))}
              
              <Divider />
              
              {/* Item de logout */}
              <MenuItem onClick={handleLogout} sx={{ gap: 2, color: 'error.main' }}>
                <LogoutIcon />
                Sair
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{ 
          flexGrow: 1, 
          p: 3,
          width: '100%',
          mt: 8 
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function AuthenticatedApp({ user, onLogout }) {
  const { logoutComplete } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => {
    console.log("🚪 Iniciando logout do usuário...");
    // Usar logout completo que limpa tudo
    logoutComplete();
    onLogout();
    // Garantir redirecionamento para home
    navigate('/', { replace: true });
  };

  return (
    <Layout user={user} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/team" element={<TeamManagement />} />
        <Route path="/backlog" element={<ProductBacklogPage />} />
        <Route path="/sprints" element={<SprintManagementPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/conta" element={<ContaPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function AppContent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const checkAuthStatus = async (silent = false) => {
    if (isCheckingAuth) {
      if (!silent) {
        console.log("⚠️ Verificação de autenticação já em andamento, ignorando...");
      }
      return;
    }

    try {
      setIsCheckingAuth(true);
      
      if (!silent) {
        console.log("🔍 Verificando status de autenticação...");
      }
      const token = localStorage.getItem('token');
      
      if (!token) {
        if (!silent) {
          console.log("❌ Nenhum token encontrado");
        }
        setUser(null);
        setLoading(false);
        return;
      }

      const response = await fetch(`${getApiUrl()}/api/auth/verify`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.user) {
          setUser(result.user);
          setError(null);
          localStorage.setItem('scrumchain_user', JSON.stringify(result.user));
          if (!silent) {
            console.log("✅ Usuário autenticado com sucesso:", result.user.email);
          }
        } else {
          console.log("❌ Resposta inválida do servidor");
          localStorage.removeItem('token');
          localStorage.removeItem('scrumchain_user');
          setUser(null);
        }
      } else {
        const errorData = await response.json();
        console.log("❌ Token inválido:", errorData.message);
        localStorage.removeItem('token');
        localStorage.removeItem('scrumchain_user');
        setUser(null);
        setError(null);
      }
    } catch (error) {
      console.error("❌ Erro ao verificar token:", error);
      localStorage.removeItem('token');
      localStorage.removeItem('scrumchain_user');
      setUser(null);
      setError('Erro de conexão com o servidor');
    } finally {
      setLoading(false);
      setIsCheckingAuth(false);
    }
  };

  useEffect(() => {
    // Se estivermos na rota admin, pular verificação de autenticação
    if (location.pathname === '/admin') {
      setLoading(false);
      return;
    }

    // Verificação inicial: usar dados locais se disponíveis
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('scrumchain_user');
    
    if (token && savedUser) {
      try {
        // Verificar se o token não expirou
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Date.now() / 1000;
        
        if (payload.exp && payload.exp > currentTime) {
          console.log("🔒 Usando dados salvos localmente");
          const userData = JSON.parse(savedUser);
          setUser(userData);
          setLoading(false);
          return;
        } else {
          console.log("❌ Token expirado, limpando dados");
          localStorage.removeItem('token');
          localStorage.removeItem('scrumchain_user');
        }
      } catch (error) {
        console.log("❌ Dados locais inválidos, limpando");
        localStorage.removeItem('token');
        localStorage.removeItem('scrumchain_user');
      }
    }
    
    // Se não há dados locais válidos, verificar com servidor apenas uma vez
    if (token) {
      checkAuthStatus(true); // Verificação silenciosa
    } else {
      setLoading(false);
    }
  }, [location.pathname]); // Reexecutar quando a rota mudar

  const handleLogin = (userData) => {
    console.log("✅ Login realizado:", userData.email);
    setUser(userData);
    setError(null);
    localStorage.setItem('scrumchain_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    console.log("🚪 Logout realizado - redirecionando para login");
    localStorage.removeItem('token');
    localStorage.removeItem('scrumchain_user');
    setUser(null);
    setError(null);
    navigate('/', { replace: true });
  };

  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Typography>Carregando...</Typography>
      </Container>
    );
  }

  return (
    <>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {/* Permitir acesso à página admin sem autenticação */}
      {location.pathname === '/admin' ? (
        <AdminPage />
      ) : user ? (
        <AuthenticatedApp user={user} onLogout={handleLogout} />
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}
    </>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AdminRoute />
      </Router>
    </ThemeProvider>
  );
}

function AdminRoute() {
  const location = useLocation();
  
  // Se for rota admin, renderizar apenas a página admin sem contextos
  if (location.pathname === '/admin') {
    return <AdminPage />;
  }
  
  // Para todas as outras rotas, usar os contextos normalmente
  return (
    <AppProvider>
      <WalletProvider>
        <AppContent />
      </WalletProvider>
    </AppProvider>
  );
}

export default App;