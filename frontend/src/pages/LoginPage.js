import React, { useState } from 'react';
import {
  Container,
  Paper,
  Box,
  TextField,
  Button,
  Typography,
  Tab,
  Tabs,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Person as PersonIcon,
  Email as EmailIcon,
  Lock as LockIcon
} from '@mui/icons-material';
import BlockchainService from '../services/BlockchainService';

import { getApiUrl } from '../config/api';

const API_BASE_URL = `${getApiUrl()}/api`;

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`auth-tabpanel-${index}`}
      aria-labelledby={`auth-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const LoginPage = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);


  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });


  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    wallet_address: ''
  });

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setError('');
  };

  const handleLoginChange = (field, value) => {
    setLoginData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleRegisterChange = (field, value) => {
    setRegisterData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailOrUsername: loginData.email,
          password: loginData.password
        }),
      });

      const data = await response.json();

      if (data.success) {

        localStorage.setItem('token', data.data.token);
        localStorage.setItem('scrumchain_user', JSON.stringify(data.data.user));


        console.log('🔄 Resetando rede Hardhat após login...');
        try {
          await BlockchainService.resetHardhatNetwork();
          console.log('✅ Reset da Hardhat completado após login');
        } catch (resetError) {
          console.warn('⚠️ Falha no reset da Hardhat, mas continuando:', resetError);
        }


        onLogin(data.data.user, data.data.token);
      } else {
        setError(data.message || 'Erro ao fazer login');
      }
    } catch (error) {
      console.error('Erro no login:', error);
      setError('Erro de conexão. Verifique se o servidor está rodando.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');


    if (registerData.password !== registerData.confirmPassword) {
      setError('Senhas não coincidem');
      setLoading(false);
      return;
    }

    if (registerData.password.length < 6) {
      setError('Senha deve ter pelo menos 6 caracteres');
      setLoading(false);
      return;
    }

    try {
      const { confirmPassword, ...dataToSend } = registerData;


      const emailPrefix = registerData.email.split('@')[0];
      const timestamp = Date.now().toString().slice(-4);
      dataToSend.username = `${emailPrefix}${timestamp}`.toLowerCase().replace(/[^a-z0-9_]/g, '');

      console.log('Dados enviados para registro:', dataToSend);

      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      const data = await response.json();

      if (data.success) {

        localStorage.setItem('token', data.data.token);
        localStorage.setItem('scrumchain_user', JSON.stringify(data.data.user));


        console.log('🔄 Resetando rede Hardhat após registro...');
        try {
          await BlockchainService.resetHardhatNetwork();
          console.log('✅ Reset da Hardhat completado após registro');
        } catch (resetError) {
          console.warn('⚠️ Falha no reset da Hardhat, mas continuando:', resetError);
        }


        onLogin(data.data.user, data.data.token);
      } else {
        console.error('Erro detalhado do servidor:', data);
        if (data.errors && Array.isArray(data.errors)) {

          const errorMessages = data.errors.map(err => err.msg).join(', ');
          setError(`Erro de validação: ${errorMessages}`);
        } else {
          setError(data.message || 'Erro ao criar conta');
        }
      }
    } catch (error) {
      console.error('Erro no registro:', error);
      setError('Erro de conexão. Verifique se o servidor está rodando.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4
        }}
      >
        <Paper elevation={8} sx={{ width: '100%', borderRadius: 2 }}>
          <Box sx={{ p: 2 }}>
            <Typography
              variant="h4"
              component="h1"
              textAlign="center"
              gutterBottom
              color="primary"
              fontWeight="bold"
            >
              ScrumChain
            </Typography>
            <Typography
              variant="subtitle1"
              textAlign="center"
              color="text.secondary"
              sx={{ mb: 3 }}
            >
              Gestão Scrum na Blockchain
            </Typography>

            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant="fullWidth"
              sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
            >
              <Tab label="Entrar" />
              <Tab label="Criar Conta" />
            </Tabs>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {}
            <TabPanel value={activeTab} index={0}>
              <form onSubmit={handleLogin}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  variant="outlined"
                  margin="normal"
                  required
                  value={loginData.email || ''}
                  onChange={(e) => handleLoginChange('email', e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  fullWidth
                  label="Senha"
                  type={showPassword ? 'text' : 'password'}
                  variant="outlined"
                  margin="normal"
                  required
                  value={loginData.password || ''}
                  onChange={(e) => handleLoginChange('password', e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{ mt: 3, mb: 2, py: 1.5 }}
                >
                  {loading ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </form>
            </TabPanel>

            {}
            <TabPanel value={activeTab} index={1}>
              <form onSubmit={handleRegister}>
                <TextField
                  fullWidth
                  label="Nome completo"
                  variant="outlined"
                  margin="normal"
                  required
                  value={registerData.full_name || ''}
                  onChange={(e) => handleRegisterChange('full_name', e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  variant="outlined"
                  margin="normal"
                  required
                  value={registerData.email || ''}
                  onChange={(e) => handleRegisterChange('email', e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  fullWidth
                  label="Senha"
                  type={showPassword ? 'text' : 'password'}
                  variant="outlined"
                  margin="normal"
                  required
                  value={registerData.password || ''}
                  onChange={(e) => handleRegisterChange('password', e.target.value)}
                  helperText="Mínimo 6 caracteres, incluindo maiúscula, minúscula e número"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  fullWidth
                  label="Confirmar senha"
                  type={showConfirmPassword ? 'text' : 'password'}
                  variant="outlined"
                  margin="normal"
                  required
                  value={registerData.confirmPassword || ''}
                  onChange={(e) => handleRegisterChange('confirmPassword', e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          edge="end"
                        >
                          {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{ mt: 3, mb: 2, py: 1.5 }}
                >
                  {loading ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    'Criar Conta'
                  )}
                </Button>
              </form>
            </TabPanel>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginPage;
