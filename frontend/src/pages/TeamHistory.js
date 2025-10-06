import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Grid,
  Alert,
  CircularProgress,
  Tooltip,
  Link,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Divider,
  Avatar
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  FilterList as FilterIcon,
  Timeline as TimelineIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
  Group as GroupIcon,
  PlayArrow as PlayArrowIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  AccessTime as AccessTimeIcon
} from '@mui/icons-material';
import { useApp } from '../context/AppContext';
import axios from 'axios';

const TeamHistory = () => {
  const { user } = useApp();
  const [currentTeam, setCurrentTeam] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    transactionType: '',
    status: '',
    limit: 50,
    offset: 0
  });
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0
  });
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const transactionTypes = [
    { 
      value: 'MEMBER_ROLE_UPDATE', 
      label: '👤 Alteração de Cargo', 
      icon: <PersonIcon />,
      description: 'Mudança de função de um membro da equipe'
    },
    { 
      value: 'TEAM_CREATION', 
      label: '🏗️ Criação da Equipe', 
      icon: <GroupIcon />,
      description: 'Nova equipe foi registrada na blockchain'
    },
    { 
      value: 'MEMBER_ADDITION', 
      label: '➕ Novo Membro', 
      icon: <AddIcon />,
      description: 'Adição de novo integrante à equipe'
    },
    { 
      value: 'MEMBER_REMOVAL', 
      label: '➖ Remoção de Membro', 
      icon: <DeleteIcon />,
      description: 'Remoção de integrante da equipe'
    },
    { 
      value: 'TASK_CREATION', 
      label: '📝 Nova Tarefa', 
      icon: <AssignmentIcon />,
      description: 'Criação de nova tarefa no projeto'
    },
    { 
      value: 'TASK_UPDATE', 
      label: '✏️ Atualização de Tarefa', 
      icon: <EditIcon />,
      description: 'Modificação nos dados de uma tarefa'
    },
    { 
      value: 'SPRINT_CREATION', 
      label: '🚀 Novo Sprint', 
      icon: <PlayArrowIcon />,
      description: 'Criação de novo ciclo de desenvolvimento'
    },
    { 
      value: 'SPRINT_UPDATE', 
      label: '🔄 Atualização de Sprint', 
      icon: <EditIcon />,
      description: 'Modificação nos dados do sprint'
    }
  ];

  const statusOptions = [
    { 
      value: 'pending', 
      label: '⏳ Processando', 
      color: 'warning',
      description: 'Transação sendo processada na blockchain'
    },
    { 
      value: 'confirmed', 
      label: '✅ Confirmada', 
      color: 'success',
      description: 'Transação confirmada com sucesso'
    },
    { 
      value: 'failed', 
      label: '❌ Falhou', 
      color: 'error',
      description: 'Erro no processamento da transação'
    }
  ];

  useEffect(() => {
    fetchCurrentTeam();
  }, []);

  useEffect(() => {
    if (currentTeam) {
      fetchTransactionHistory();
    }
  }, [currentTeam, filters]);

  const fetchCurrentTeam = async () => {
    try {
      console.log('🔍 BUSCANDO EQUIPE ATUAL...');
      setLoadingTeam(true);
      setError(null);

      const token = localStorage.getItem('token');
      console.log('🔑 Token encontrado:', !!token);
      
      const response = await axios.get(`${getApiUrl()}/api/groups/current`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('📥 Resposta da API /groups/current:', response.data);

      if (response.data.success && response.data.data) {
        console.log('✅ Equipe encontrada:', response.data.data);
        setCurrentTeam(response.data.data);
      } else {
        console.log('⚠️ Nenhuma equipe encontrada');
        setCurrentTeam(null);
      }
    } catch (err) {
      console.error('❌ ERRO AO BUSCAR EQUIPE ATUAL:');
      console.error('📄 Response data:', err.response?.data);
      console.error('📝 Status:', err.response?.status);
      console.error('🔍 Message:', err.message);
      setError('Erro ao carregar equipe atual');
      setCurrentTeam(null);
    } finally {
      setLoadingTeam(false);
    }
  };

  const fetchTransactionHistory = async () => {
    try {
      console.log('📊 BUSCANDO HISTÓRICO DE TRANSAÇÕES...');
      console.log('🏢 Equipe atual:', currentTeam);
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      
      if (filters.transactionType) {
        params.append('transactionType', filters.transactionType);
        console.log('🔍 Filtro de tipo aplicado:', filters.transactionType);
      }
      if (filters.status) {
        params.append('status', filters.status);
        console.log('🔍 Filtro de status aplicado:', filters.status);
      }
      params.append('limit', filters.limit.toString());
      params.append('offset', filters.offset.toString());

      const url = `${getApiUrl()}/api/groups/${currentTeam.id}/history?${params}`;
      console.log('🔗 URL da requisição:', url);
      console.log('🔧 Parâmetros:', Object.fromEntries(params));

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('📥 Resposta da API /history:', response.data);

      if (response.data.success) {
        console.log('📊 Transações recebidas:', response.data.data.transactions?.length || 0);
        console.log('📈 Estatísticas recebidas:', response.data.data.stats);
        
        setTransactions(response.data.data.transactions);
        setStats(response.data.data.stats);
        setPagination({
          page: Math.floor(filters.offset / filters.limit) + 1,
          totalPages: Math.ceil(response.data.data.pagination.total / filters.limit),
          total: response.data.data.pagination.total
        });
      } else {
        console.log('❌ API retornou erro:', response.data.message);
      }
    } catch (err) {
      console.error('❌ ERRO AO BUSCAR HISTÓRICO:');
      console.error('📄 Response data:', err.response?.data);
      console.error('📝 Status:', err.response?.status);
      console.error('🔍 Message:', err.message);
      setError(err.response?.data?.message || 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
      offset: 0 
    }));
  };

  const handlePageChange = (event, page) => {
    setFilters(prev => ({
      ...prev,
      offset: (page - 1) * prev.limit
    }));
  };

  const getStatusChip = (status) => {
    const statusConfig = statusOptions.find(opt => opt.value === status) || 
                        { label: status, color: 'default' };
    return (
      <Chip 
        label={statusConfig.label} 
        color={statusConfig.color}
        size="small" 
      />
    );
  };

  const getTransactionTypeLabel = (type) => {
    const typeConfig = transactionTypes.find(t => t.value === type);
    return typeConfig ? typeConfig.label : `📄 ${type.replace(/_/g, ' ')}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatHash = (hash) => {
    if (!hash) return '-';
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  const openTransactionOnBlockExplorer = (hash) => {
    const url = `https://localhost:8545/tx/${hash}`; 
    window.open(url, '_blank');
  };

  const handleViewDetails = (transaction) => {
    setSelectedTransaction(transaction);
    setDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    setSelectedTransaction(null);
  };

  const getTransactionIcon = (type) => {
    const typeConfig = transactionTypes.find(t => t.value === type);
    return typeConfig ? typeConfig.icon : <AssignmentIcon />;
  };

  const getTransactionDescription = (transaction) => {
    if (transaction.description && transaction.description !== '-') {
      return transaction.description;
    }
    
    const typeConfig = transactionTypes.find(t => t.value === transaction.transaction_type);

    if (typeConfig) {
      let description = typeConfig.description;
      
      if (transaction.additional_data) {
        try {
          const data = typeof transaction.additional_data === 'string' 
            ? JSON.parse(transaction.additional_data) 
            : transaction.additional_data;
          
          if (data.taskTitle) {
            description = `Tarefa "${data.taskTitle}" foi ${transaction.transaction_type.includes('create') ? 'criada' : 'atualizada'}`;
          }
          if (data.sprintName) {
            description = `Sprint "${data.sprintName}" foi ${transaction.transaction_type.includes('create') ? 'criado' : 'atualizado'}`;
          }
          if (data.memberName || data.memberEmail) {
            const memberInfo = data.memberName || data.memberEmail;
            if (transaction.transaction_type === 'MEMBER_ADD') {
              description = `Membro "${memberInfo}" foi adicionado à equipe`;
            } else if (transaction.transaction_type === 'MEMBER_REMOVE') {
              description = `Membro "${memberInfo}" foi removido da equipe`;
            }
          }
          if (data.role) {
            description += ` como ${data.role}`;
          }
          if (data.oldStatus && data.newStatus) {
            description = `Status alterado de "${data.oldStatus}" para "${data.newStatus}"`;
          }
        } catch (e) {
          console.log('Erro ao processar additional_data:', e);
        }
      }
      
      return description;
    }
    
    return `Operação "${transaction.transaction_type.replace(/_/g, ' ')}" foi executada no sistema`;
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'confirmed':
        return <CheckCircleIcon color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'pending':
      default:
        return <AccessTimeIcon color="warning" />;
    }
  };

  if (loadingTeam) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Carregando equipe...</Typography>
        </Box>
      </Box>
    );
  }

  if (!currentTeam) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Você precisa estar em uma equipe para ver o histórico de transações.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <TimelineIcon sx={{ mr: 2, fontSize: 32 }} />
        <Typography variant="h4" component="h1">
          Histórico da Equipe
        </Typography>
        <Box sx={{ ml: 'auto' }}>
          <IconButton onClick={fetchTransactionHistory} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
        {currentTeam.name}
      </Typography>

      {}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={2}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total
                </Typography>
                <Typography variant="h5">
                  {stats.total}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Confirmadas
                </Typography>
                <Typography variant="h5" color="success.main">
                  {stats.confirmed}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Pendentes
                </Typography>
                <Typography variant="h5" color="warning.main">
                  {stats.pending}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Falhas
                </Typography>
                <Typography variant="h5" color="error.main">
                  {stats.failed}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <FilterIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Filtros</Typography>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Tipo de Transação</InputLabel>
                <Select
                  value={filters.transactionType}
                  onChange={(e) => handleFilterChange('transactionType', e.target.value)}
                  label="Tipo de Transação"
                >
                  <MenuItem value="">Todos</MenuItem>
                  {transactionTypes.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">Todos</MenuItem>
                  {statusOptions.map(status => (
                    <MenuItem key={status.value} value={status.value}>
                      {status.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Itens por página</InputLabel>
                <Select
                  value={filters.limit}
                  onChange={(e) => handleFilterChange('limit', e.target.value)}
                  label="Itens por página"
                >
                  <MenuItem value={25}>25</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                  <MenuItem value={100}>100</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {}
      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : transactions.length === 0 ? (
            <Alert severity="info">
              Nenhuma transação encontrada com os filtros aplicados.
            </Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>� <strong>Quando</strong></TableCell>
                    <TableCell>🔗 <strong>Código</strong></TableCell>
                    <TableCell>📋 <strong>Tipo de Operação</strong></TableCell>
                    <TableCell>📝 <strong>O que Foi Feito</strong></TableCell>
                    <TableCell>👤 <strong>Quem Fez</strong></TableCell>
                    <TableCell>✅ <strong>Status</strong></TableCell>
                    <TableCell>👁️ <strong>Ver Mais</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id} hover>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(transaction.created_at)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={transaction.transaction_hash}>
                          <Typography 
                            variant="body2" 
                            fontFamily="monospace"
                            sx={{ cursor: 'pointer' }}
                            onClick={() => navigator.clipboard.writeText(transaction.transaction_hash)}
                          >
                            {formatHash(transaction.transaction_hash)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getTransactionIcon(transaction.transaction_type)}
                          <Chip 
                            label={getTransactionTypeLabel(transaction.transaction_type)}
                            variant="outlined"
                            size="small"
                            sx={{ fontWeight: 'bold' }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 200 }}>
                          {getTransactionDescription(transaction)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
                            {(transaction.full_name || transaction.username || 'S').charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography variant="body2" fontWeight="medium">
                            {transaction.full_name || transaction.username || '🤖 Sistema'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getStatusIcon(transaction.status)}
                          {getStatusChip(transaction.status)}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Ver informações completas">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleViewDetails(transaction)}
                            sx={{ 
                              backgroundColor: 'primary.main',
                              color: 'white',
                              '&:hover': {
                                backgroundColor: 'primary.dark'
                              }
                            }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {}
          {pagination.totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={pagination.totalPages}
                page={pagination.page}
                onChange={handlePageChange}
                color="primary"
                showFirstButton
                showLastButton
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {}
      <Dialog 
        open={detailsOpen} 
        onClose={handleCloseDetails}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {selectedTransaction && getTransactionIcon(selectedTransaction.transaction_type)}
            <Box>
              <Typography variant="h6" component="div">
                🔍 Detalhes da Transação
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedTransaction && getTransactionTypeLabel(selectedTransaction.transaction_type)}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        
        <DialogContent dividers>
          {selectedTransaction && (
            <List>
              <ListItem>
                <ListItemText
                  primary="📅 Data e Hora"
                  secondary={
                    <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 'medium' }}>
                      {formatDate(selectedTransaction.created_at)}
                    </Typography>
                  }
                />
              </ListItem>
              
              <Divider />
              
              <ListItem>
                <ListItemText
                  primary="🔄 Status da Transação"
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      {getStatusIcon(selectedTransaction.status)}
                      <Chip 
                        label={statusOptions.find(s => s.value === selectedTransaction.status)?.label || selectedTransaction.status}
                        color={statusOptions.find(s => s.value === selectedTransaction.status)?.color || 'default'}
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                        {statusOptions.find(s => s.value === selectedTransaction.status)?.description}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
              
              <Divider />
              
              <ListItem>
                <ListItemText
                  primary="📝 O que Aconteceu"
                  secondary={
                    <Typography variant="body1" sx={{ mt: 0.5 }}>
                      {getTransactionDescription(selectedTransaction)}
                    </Typography>
                  }
                />
              </ListItem>
              
              <Divider />
              
              <ListItem>
                <ListItemText
                  primary="👤 Responsável pela Ação"
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <Avatar sx={{ width: 32, height: 32 }}>
                        {(selectedTransaction.full_name || selectedTransaction.username || 'S').charAt(0).toUpperCase()}
                      </Avatar>
                      <Typography variant="body1" fontWeight="medium">
                        {selectedTransaction.full_name || selectedTransaction.username || '🤖 Sistema Automatizado'}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
              
              <Divider />
              
              <ListItem>
                <ListItemText
                  primary="🔗 Identificador na Blockchain"
                  secondary={
                    <Box sx={{ mt: 0.5 }}>
                      <Typography 
                        variant="body2" 
                        fontFamily="monospace"
                        sx={{ 
                          backgroundColor: 'grey.100',
                          p: 1,
                          borderRadius: 1,
                          wordBreak: 'break-all',
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: 'grey.200'
                          }
                        }}
                        onClick={() => navigator.clipboard.writeText(selectedTransaction.transaction_hash)}
                        title="Clique para copiar"
                      >
                        {selectedTransaction.transaction_hash || 'Não disponível'}
                      </Typography>
                      {selectedTransaction.transaction_hash && (
                        <Button
                          size="small"
                          startIcon={<VisibilityIcon />}
                          onClick={() => openTransactionOnBlockExplorer(selectedTransaction.transaction_hash)}
                          sx={{ mt: 1 }}
                        >
                          Ver no Explorador da Blockchain
                        </Button>
                      )}
                    </Box>
                  }
                />
              </ListItem>
              
              {selectedTransaction.additional_data && (
                <>
                  <Divider />
                  <ListItem>
                    <ListItemText
                      primary="📊 Informações Adicionais"
                      secondary={
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          <pre style={{ 
                            fontFamily: 'monospace', 
                            fontSize: '0.8rem',
                            backgroundColor: '#f5f5f5',
                            padding: '8px',
                            borderRadius: '4px',
                            overflow: 'auto'
                          }}>
                            {JSON.stringify(selectedTransaction.additional_data, null, 2)}
                          </pre>
                        </Typography>
                      }
                    />
                  </ListItem>
                </>
              )}
            </List>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleCloseDetails} variant="contained">
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TeamHistory;