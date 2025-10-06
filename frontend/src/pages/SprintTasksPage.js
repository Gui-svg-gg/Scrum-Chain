import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Paper, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, IconButton, Tooltip, Grid, Card, CardContent, Chip,
  FormControl, InputLabel, Select, MenuItem, Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Assignment as TaskIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import BlockchainService from '../services/BlockchainService';
import { useWallet } from '../context/WalletContext';
import { TimeUtils } from '../utils/TimeUtils';

function SprintTasksPage() {
  const { sprintId } = useParams();
  const navigate = useNavigate();
  const { account, connectWallet } = useWallet();
  
  const [currentTeam, setCurrentTeam] = useState(null);
  const [currentSprint, setCurrentSprint] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [successType, setSuccessType] = useState('success'); 
  const [openDialog, setOpenDialog] = useState(false);
  const [editTask, setEditTask] = useState(null);
  
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignedTo: '',
    estimatedHours: '02:00' 
  });
  
  
  const timeToMinutes = TimeUtils.timeToMinutes;
  const minutesToTime = TimeUtils.minutesToTime;
  const formatTimeDisplay = TimeUtils.formatTimeDisplay;

  
  const statusOptions = [
    { value: 'todo', label: 'A Fazer', color: 'default' },
    { value: 'in_progress', label: 'Em Progresso', color: 'primary' },
    { value: 'review', label: 'Em Revisão', color: 'warning' },
    { value: 'done', label: 'Concluído', color: 'success' },
    { value: 'removed', label: 'Removido', color: 'error' }
  ];

  
  const getAddressForUserId = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiUrl()}/api/users/${userId}/wallet-address`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        return result.data?.wallet_address || null;
      }
    } catch (error) {
      console.warn('⚠️ Erro ao obter endereço do usuário:', error);
    }
    return null;
  };

  
  const setSuccessWithType = (message, type = 'success') => {
    setSuccess(message);
    setSuccessType(type);
  };

  
  const originalSetSuccess = setSuccess;
  const customSetSuccess = (message, type = 'success') => {
    if (typeof message === 'string' && type) {
      setSuccessWithType(message, type);
    } else {
      originalSetSuccess(message);
      setSuccessType('success');
    }
  };

  
  const checkUserTeam = async () => {
    try {
      console.log('🔍 TASKS: Verificando equipe do usuário...');
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.log('❌ TASKS: Token não encontrado');
        setCurrentTeam(null);
        setLoading(false);
        return;
      }

      const response = await fetch(`${getApiUrl()}/api/groups/user-team`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ TASKS: Resposta da verificação de equipe:', result);
        
        if (result.success && result.data) {
          setCurrentTeam(result.data);
          console.log('✅ TASKS: Equipe encontrada:', result.data.name);
        } else {
          console.log('⚠️ TASKS: Usuário não possui equipe ativa');
          setCurrentTeam(null);
        }
      }
    } catch (error) {
      console.error('❌ TASKS: Erro na verificação:', error);
      setError('Erro de conexão com o servidor');
      setCurrentTeam(null);
    }
  };

  
  const loadSprint = async () => {
    if (!currentTeam?.id || !sprintId) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiUrl()}/api/groups/${currentTeam.id}/sprints/${sprintId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setCurrentSprint({
            ...result.data,
            startDate: new Date(result.data.start_date),
            endDate: new Date(result.data.end_date)
          });
        }
      }
    } catch (error) {
      console.error('❌ Erro ao carregar sprint:', error);
    }
  };

  
  const loadTeamMembers = async () => {
    if (!currentTeam?.id) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiUrl()}/api/groups/${currentTeam.id}/members`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setTeamMembers(result.data);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao carregar membros:', error);
    }
  };

  
  const loadTasks = async () => {
    if (!currentTeam?.id || !sprintId) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiUrl()}/api/groups/${currentTeam.id}/sprints/${sprintId}/tasks`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const processedTasks = result.data.map(task => ({
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status || 'todo',
            assignedTo: task.assigned_to,
            assignedToName: task.assigned_to_name,
            estimatedMinutes: task.estimated_minutes,
            createdAt: new Date(task.created_at),
            updatedAt: new Date(task.updated_at)
          }));
          setTasks(processedTasks);
        } else {
          setTasks([]);
        }
      } else {
        setError('Erro ao carregar tarefas');
        setTasks([]);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar tarefas:', error);
      setError('Erro de conexão ao carregar tarefas');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  
  const handleSave = async () => {
    if (!formData.title.trim()) {
      setError('Título da tarefa é obrigatório');
      return;
    }

    if (!currentTeam?.id) {
      setError('Nenhuma equipe ativa encontrada');
      return;
    }

    
    try {
      console.log('🔍 TASKS: Verificando sincronização da equipe na blockchain...');
      
      
      const token = localStorage.getItem('token');
      const teamCheckResponse = await fetch(`${getApiUrl()}/api/groups/current`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (teamCheckResponse.ok) {
        const teamData = await teamCheckResponse.json();
        console.log('🔍 TASKS: Dados da equipe:', teamData.data);
        
        
        console.log('✅ TASKS: Sistema agnóstico ativado - funciona com qualquer conta MetaMask');
        if (!teamData.data?.blockchain_id) {
          console.log('⚠️ TASKS: Equipe sem blockchain_id - usando sistema agnóstico');
          
        } else {
          console.log('✅ TASKS: Equipe com blockchain_id encontrado:', teamData.data.blockchain_id);
        }
        
        console.log('✅ TASKS: Equipe sincronizada, prosseguindo...');
      }
    } catch (blockchainError) {
      console.error('❌ TASKS: Erro ao verificar blockchain:', blockchainError);
      setError('❌ ERRO NA BLOCKCHAIN: Por favor, vá para a página "Gerenciamento de Equipe" e sincronize sua equipe com a blockchain primeiro.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      console.log('📋 SALVANDO/EDITANDO TAREFA:');
      console.log('📊 Modo:', editTask ? 'EDIÇÃO' : 'CRIAÇÃO');
      console.log('📊 Sprint ID:', sprintId);
      console.log('📊 Team ID:', currentTeam?.id);
      
      if (editTask) {
        console.log('📊 Tarefa atual:', {
          id: editTask.id,
          titulo: editTask.title,
          status: editTask.status,
          assignedTo: editTask.assignedTo
        });
      }
      
      console.log('📊 Novos dados:', formData);

      const token = localStorage.getItem('token');
      const taskData = {
        title: formData.title,
        description: formData.description,
        assignedTo: formData.assignedTo ? parseInt(formData.assignedTo) : undefined,
        estimatedHours: TimeUtils.toBackend(formData.estimatedHours) 
      };

      const url = editTask 
        ? `${getApiUrl()}/api/groups/${currentTeam.id}/tasks/${editTask.id}`
        : `${getApiUrl()}/api/groups/${currentTeam.id}/sprints/${sprintId}/tasks`;
      
      const method = editTask ? 'PUT' : 'POST';

      console.log('🌐 Request:', { method, url, body: taskData });

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData)
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('✅ Resposta da API:', responseData);
        
        
        let blockchainResult = null;
        let blockchainSuccess = false;
        
        try {
          
          console.log('🔄 TASKS: Tentando operação blockchain (agnóstica)...');
          
          
          if (!account) {
            console.log('⚠️ TASKS: Wallet não conectada, tentando conectar...');
            try {
              await connectWallet();
            } catch (walletError) {
              console.log('⚠️ TASKS: Não foi possível conectar wallet, continuando sem blockchain');
              throw new Error('Wallet não conectada');
            }
          }

          if (editTask) {
            
            console.log('🔗 EDITANDO TAREFA NA BLOCKCHAIN (sistema agnóstico)...');
            blockchainResult = await BlockchainService.updateTaskData(
              editTask.blockchainId || editTask.id,
              {
                title: formData.title,
                description: formData.description,
                estimatedHours: TimeUtils.toBackend(formData.estimatedHours)
              }
            );
            console.log('✅ Tarefa editada na blockchain:', blockchainResult);
            blockchainSuccess = true;
          } else {
            
            console.log('🔗 CRIANDO TAREFA NA BLOCKCHAIN (sistema agnóstico)...');
            const assignedUserAddress = formData.assignedTo ? 
              (await getAddressForUserId(formData.assignedTo)) : null;
              
            blockchainResult = await BlockchainService.registerTask(
              currentSprint.blockchainId || sprintId,
              {
                title: formData.title,
                description: formData.description,
                estimatedHours: TimeUtils.toBackend(formData.estimatedHours)
              },
              assignedUserAddress
            );
            console.log('✅ Tarefa criada na blockchain:', blockchainResult);
            blockchainSuccess = true;
          }
        } catch (blockchainError) {
          console.warn('⚠️ TASKS: Erro na blockchain (sistema continuará funcionando apenas com banco):', blockchainError.message);
          console.log('✅ TASKS: Sistema agnóstico - operação salva com sucesso no banco, blockchain opcional');
          blockchainSuccess = false;
          blockchainResult = null;
        }
        
        
        if (blockchainSuccess && blockchainResult) {
          try {
            console.log('💾 SALVANDO TRANSAÇÃO TAREFA NO BANCO...');
            const transactionPayload = {
              transactionHash: blockchainResult.transactionHash,
              contractName: 'TaskManagement',
              methodName: editTask ? 'updateTaskDataHash' : 'registerTask',
              taskId: responseData.data.id || editTask?.id,
              taskTitle: formData.title,
              sprintId: sprintId,
              teamId: currentTeam.id
            };
            
            console.log('📤 Payload da transação tarefa:', transactionPayload);
            
            
            const transactionResponse = await fetch(`${getApiUrl()}/api/groups/${currentTeam.id}/tasks/blockchain-transaction`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(transactionPayload)
            });
            
            if (transactionResponse.ok) {
              console.log('✅ Transação tarefa salva no banco de dados');
            } else {
              console.warn('⚠️ Erro ao salvar transação tarefa no banco:', await transactionResponse.text());
            }
          } catch (dbError) {
            console.warn('⚠️ Erro ao salvar transação tarefa no banco:', dbError);
          }
        }
        
        
        if (blockchainResult?.transactionHash) {
          customSetSuccess(
            editTask 
              ? `✅ Sucesso! Tarefa atualizada. Hash: ${blockchainResult.transactionHash}`
              : `✅ Sucesso! Tarefa criada. Hash: ${blockchainResult.transactionHash}`,
            'success'
          );
        } else {
          customSetSuccess(
            editTask 
              ? `⚠️ Parcialmente concluído! Tarefa atualizada no banco de dados, mas falha na blockchain. Verifique a conexão com a rede.`
              : `⚠️ Parcialmente concluído! Tarefa criada no banco de dados, mas falha na blockchain. Verifique a conexão com a rede.`,
            'warning'
          );
        }
        
        setOpenDialog(false);
        resetForm();
        await loadTasks();
      } else {
        const errorData = await response.json();
        console.error('❌ Erro na API:', errorData);
        setError(errorData.message || 'Erro ao salvar tarefa');
      }
    } catch (error) {
      console.error('❌ Erro ao salvar tarefa:', error);
      setError('Erro de conexão ao salvar tarefa');
    } finally {
      setLoading(false);
    }
  };

  
  const handleDelete = async (task) => {
    if (!window.confirm(`Tem certeza que deseja deletar a tarefa "${task.title}"?`)) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      
      if (!account) {
        try {
          console.log('⚠️ TASKS: Wallet não conectada, tentando conectar...');
          await connectWallet();
        } catch (walletError) {
          console.warn('⚠️ TASKS: Erro ao conectar wallet, continuando apenas com banco:', walletError);
        }
      }

      
      let blockchainResult = null;
      let blockchainSuccess = false;
      
      try {
        if (account) {
          console.log('🔗 DELETANDO TAREFA DA BLOCKCHAIN...');
          blockchainResult = await BlockchainService.deleteTask(task.blockchainId || task.id);
          console.log('✅ Tarefa deletada da blockchain:', blockchainResult);
          blockchainSuccess = true;
        }
      } catch (blockchainError) {
        console.warn('⚠️ TASKS: Erro na blockchain (continuando apenas com banco):', blockchainError);
        blockchainSuccess = false;
        blockchainResult = null;
      }

      
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiUrl()}/api/groups/${currentTeam.id}/tasks/${task.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        
        if (blockchainSuccess && blockchainResult) {
          try {
            console.log('💾 SALVANDO HASH DE DELEÇÃO DA TAREFA NO BANCO...');
            const transactionPayload = {
              transactionHash: blockchainResult.transactionHash,
              contractName: 'TaskManagement',
              methodName: 'removeTask',
              taskId: task.id,
              taskTitle: task.title,
              sprintId: sprintId,
              teamId: currentTeam.id
            };
            
            console.log('📤 Payload da transação de deleção:', transactionPayload);
            
            
            const transactionResponse = await fetch(`${getApiUrl()}/api/groups/${currentTeam.id}/tasks/blockchain-transaction`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(transactionPayload)
            });
            
            if (transactionResponse.ok) {
              console.log('✅ Hash de deleção da tarefa salvo no banco de dados');
            } else {
              console.warn('⚠️ Erro ao salvar hash de deleção da tarefa no banco:', await transactionResponse.text());
            }
          } catch (dbError) {
            console.warn('⚠️ Erro ao salvar hash de deleção da tarefa no banco:', dbError);
          }
        }

        
        if (blockchainResult?.transactionHash) {
          customSetSuccess(`✅ Sucesso! Tarefa deletada. Hash: ${blockchainResult.transactionHash}`, 'success');
        } else {
          customSetSuccess(`⚠️ Parcialmente concluído! Tarefa deletada do banco de dados, mas falha na blockchain. Verifique a conexão com a rede.`, 'warning');
        }
        
        await loadTasks();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Erro ao deletar tarefa');
      }
    } catch (error) {
      console.error('❌ Erro ao deletar tarefa:', error);
      setError('Erro de conexão ao deletar tarefa');
    } finally {
      setLoading(false);
    }
  };

  
  const handleStatusChange = async (task, newStatus) => {
    
    try {
      console.log('🔍 TASKS: Verificando sincronização da equipe na blockchain...');
      
      const token = localStorage.getItem('token');
      const teamCheckResponse = await fetch(`${getApiUrl()}/api/groups/current`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (teamCheckResponse.ok) {
        const teamData = await teamCheckResponse.json();
        console.log('🔍 TASKS: Dados da equipe para status change:', teamData.data);
        
        
        console.log('✅ TASKS: Sistema agnóstico para status change - funciona com qualquer conta');
        if (!teamData.data?.blockchain_id) {
          console.log('⚠️ TASKS: Equipe sem blockchain_id - usando sistema agnóstico para status');
          
        } else {
          console.log('✅ TASKS: Equipe com blockchain_id encontrado para status:', teamData.data.blockchain_id);
        }
        
        console.log('✅ TASKS: Equipe sincronizada, prosseguindo com mudança de status...');
      }
    } catch (blockchainError) {
      console.error('❌ TASKS: Erro ao verificar blockchain:', blockchainError);
      setError('❌ ERRO NA BLOCKCHAIN: Por favor, vá para a página "Gerenciamento de Equipe" e sincronize sua equipe com a blockchain primeiro.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      console.log('🔄 ALTERANDO STATUS DA TAREFA:');
      console.log('📊 Tarefa:', {
        id: task.id,
        titulo: task.title,
        statusAtual: task.status,
        novoStatus: newStatus,
        assignedTo: task.assignedTo,
        sprintId: task.sprintId
      });

      
      let blockchainUpdateSuccess = false;
      let blockchainResult = null;
      
      try {
        
        if (!account) {
          console.log('⚠️ TASKS: Wallet não conectada, tentando conectar...');
          try {
            await connectWallet();
          } catch (walletError) {
            console.log('⚠️ TASKS: Não foi possível conectar wallet, continuando sem blockchain');
            throw new Error('Wallet não conectada');
          }
        }
        
        if (account) {
          console.log('🔗 ATUALIZANDO STATUS DA TAREFA NA BLOCKCHAIN...');
          blockchainResult = await BlockchainService.updateTaskStatus(
            task.blockchainId || task.id,
            newStatus
          );
          console.log('✅ Status da tarefa atualizado na blockchain:', blockchainResult);
          blockchainUpdateSuccess = true;
        }
      } catch (blockchainError) {
        console.warn('⚠️ TASKS: Erro na blockchain (continuando apenas com banco):', blockchainError);
        blockchainUpdateSuccess = false;
        blockchainResult = null;
      }

      
      const token = localStorage.getItem('token');
      
      
      const updateData = { 
        status: newStatus,
        transactionHash: blockchainUpdateSuccess && blockchainResult ? blockchainResult.transactionHash : null
      };
      
      const response = await fetch(`${getApiUrl()}/api/groups/${currentTeam.id}/tasks/${task.id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('✅ Status da tarefa atualizado:', responseData);
        
        
        if (blockchainUpdateSuccess && blockchainResult) {
          try {
            console.log('💾 SALVANDO TRANSAÇÃO DE STATUS TAREFA NO BANCO...');
            const transactionPayload = {
              transactionHash: blockchainResult.transactionHash,
              contractName: 'TaskManagement',
              methodName: 'updateTaskStatus',
              taskId: task.id,
              taskTitle: task.title,
              sprintId: task.sprintId,
              teamId: currentTeam.id,
              additionalData: {
                oldStatus: task.status,
                newStatus: newStatus
              }
            };
            
            console.log('📤 Payload da transação de status tarefa:', transactionPayload);
            
            
            const transactionResponse = await fetch(`${getApiUrl()}/api/groups/${currentTeam.id}/tasks/blockchain-transaction`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(transactionPayload)
            });
            
            if (transactionResponse.ok) {
              console.log('✅ Transação de status tarefa salva no banco de dados');
            } else {
              console.warn('⚠️ Erro ao salvar transação de status tarefa:', await transactionResponse.text());
            }
          } catch (dbError) {
            console.warn('⚠️ Erro ao salvar transação de status tarefa:', dbError);
          }
        }
        
        
        if (blockchainResult?.transactionHash) {
          customSetSuccess(`✅ Sucesso! Status alterado. Hash: ${blockchainResult.transactionHash}`, 'success');
        } else {
          customSetSuccess(`⚠️ Parcialmente concluído! Status atualizado no banco de dados, mas falha na blockchain. Verifique a conexão com a rede.`, 'warning');
        }
        
        await loadTasks();
      } else {
        const errorData = await response.json();
        console.error('❌ Erro ao alterar status:', errorData);
        setError(errorData.message || 'Erro ao alterar status da tarefa');
      }
    } catch (error) {
      console.error('❌ Erro ao alterar status:', error);
      setError('Erro de conexão ao alterar status');
    } finally {
      setLoading(false);
    }
  };

  
  const resetForm = () => {
    const defaultFormData = {
      title: '',
      description: '',
      assignedTo: '',
      estimatedHours: '02:00'
    };
    setFormData(defaultFormData);
    setEditTask(null);
  };

  
  const handleEdit = (task) => {
    setEditTask(task);
    setFormData({
      title: task.title,
      description: task.description,
      assignedTo: task.assignedTo || '',
      estimatedHours: task.estimated_minutes ? TimeUtils.fromBackend(task.estimated_minutes) : '02:00' 
    });
    setOpenDialog(true);
  };

  
  useEffect(() => {
    checkUserTeam();
  }, []);

  
  useEffect(() => {
    if (currentTeam?.id) {
      loadSprint();
      loadTeamMembers();
      loadTasks();
    }
  }, [currentTeam?.id, sprintId]);

  
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  
  const getStats = () => {
    return {
      total: tasks.length,
      todo: tasks.filter(t => t.status === 'todo').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      review: tasks.filter(t => t.status === 'review').length,
      done: tasks.filter(t => t.status === 'done').length
    };
  };

  const stats = getStats();

  if (loading && !currentTeam) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" py={4}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!currentTeam || !currentSprint) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          Sprint não encontrado ou você não tem acesso a ele.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton
          onClick={() => navigate('/sprints')}
          sx={{ mr: 2 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            <TaskIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
            Tarefas - {currentSprint.name}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {currentSprint.startDate.toLocaleDateString('pt-BR')} - {currentSprint.endDate.toLocaleDateString('pt-BR')}
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity={successType} sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      {}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total de Tarefas
              </Typography>
              <Typography variant="h4">
                {stats.total}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                A Fazer
              </Typography>
              <Typography variant="h4" color="text.secondary">
                {stats.todo}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Em Progresso
              </Typography>
              <Typography variant="h4" color="primary.main">
                {stats.inProgress}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Em Revisão
              </Typography>
              <Typography variant="h4" color="warning.main">
                {stats.review}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Concluídas
              </Typography>
              <Typography variant="h4" color="success.main">
                {stats.done}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {}
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            resetForm();
            setOpenDialog(true);
          }}
          disabled={loading}
        >
          Criar Tarefa
        </Button>
      </Box>

      {}
      <Paper elevation={3}>
        {loading && tasks.length === 0 ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
          </Box>
        ) : tasks.length === 0 ? (
          <Box textAlign="center" py={4}>
            <Typography variant="h6" color="textSecondary">
              Nenhuma tarefa criada
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Crie a primeira tarefa para começar!
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Título</TableCell>
                  <TableCell>Descrição</TableCell>
                  <TableCell>Atribuído</TableCell>
                  <TableCell>Estimativa</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {task.title}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 200 }}>
                        {task.description || 'Sem descrição'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {task.assignedToName ? (
                        <Box display="flex" alignItems="center">
                          <PersonIcon sx={{ mr: 1, fontSize: 16 }} />
                          <Typography variant="body2">
                            {task.assignedToName}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          Não atribuído
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {task.estimated_minutes ? (
                        <Box display="flex" alignItems="center">
                          <ScheduleIcon sx={{ mr: 1, fontSize: 16 }} />
                          <Typography variant="body2">
                            {TimeUtils.formatTimeDisplay(task.estimated_minutes)}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          Não estimado
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <Select
                          value={task.status}
                          onChange={(e) => handleStatusChange(task, e.target.value)}
                          disabled={loading}
                        >
                          {statusOptions.map(option => (
                            <MenuItem key={option.value} value={option.value}>
                              <Chip
                                label={option.label}
                                color={option.color}
                                size="small"
                                sx={{ minWidth: 100 }}
                              />
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Editar Tarefa">
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(task)}
                          disabled={loading}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title="Deletar Tarefa">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(task)}
                          disabled={loading}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {}
      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editTask ? 'Editar Tarefa' : 'Criar Tarefa'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Título da Tarefa"
            fullWidth
            variant="outlined"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            label="Descrição"
            fullWidth
            variant="outlined"
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            sx={{ mb: 2 }}
          />
          
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>Atribuído a</InputLabel>
                <Select
                  value={formData.assignedTo}
                  onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                  label="Atribuído a"
                >
                  <MenuItem value="">
                    <em>Não atribuído</em>
                  </MenuItem>
                  {teamMembers.map(member => (
                    <MenuItem key={member.user_id} value={member.user_id}>
                      {member.full_name || member.name || member.username || 'Nome não informado'} ({member.role})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={6}>
              <TextField
                label="Estimativa (HH:MM)"
                type="time"
                fullWidth
                variant="outlined"
                value={formData.estimatedHours || '02:00'}
                onChange={(e) => setFormData(prev => ({ ...prev, estimatedHours: e.target.value }))}
                helperText={(() => {
                  const timeValue = formData.estimatedHours || '02:00';
                  const minutes = TimeUtils.toBackend(timeValue);
                  const formatted = TimeUtils.formatTimeDisplay(minutes);
                  return `Estimativa: ${formatted}`;
                })()}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : (editTask ? 'Atualizar' : 'Criar')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default SprintTasksPage;