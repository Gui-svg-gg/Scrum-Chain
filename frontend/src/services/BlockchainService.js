import { ethers, BrowserProvider } from 'ethers';
import { TimeUtils } from '../utils/TimeUtils';
import { getApiUrl } from '../config/api';

import SprintManagementABI from '../contracts/SprintManagement.json';
import TaskManagementABI from '../contracts/TaskManagement.json';
import ScrumTeamABI from '../contracts/ScrumTeam.json';

import contractAddresses from '../contracts/contract-addresses.json';

class BlockchainService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.sprintContract = null;
    this.taskContract = null;
    this.teamContract = null;
    this.isInitialized = false;
  }

  async saveTransactionToBackend({
    transactionHash,
    transactionType,
    contractName,
    methodName,
    description,
    userAddress,
    teamId,
    itemId,
    gasUsed,
    gasPrice,
    blockNumber,
    network = 'localhost',
    status = 'confirmed'
  }) {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return { success: false, message: 'Token de autenticação não encontrado' };
      }
      const response = await fetch(`${getApiUrl()}/api/blockchain/transactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transactionHash,
          transactionType,
          contractName,
          methodName,
          description,
          userAddress,
          teamId,
          itemId,
          gasUsed,
          gasPrice,
          blockNumber,
          network,
          status
        })
      });
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('❌ Erro ao registrar transação no backend:', error);
      return { success: false, message: 'Erro ao registrar transação no backend' };
    }
  }

  async initialize() {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask não encontrado. Por favor, instale o MetaMask.');
      }

      try {
        const response = await fetch('http://127.0.0.1:8545', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'net_version',
            params: [],
            id: 1
          })
        });
        
        if (!response.ok) {
          throw new Error('Hardhat node não está respondendo');
        }
      } catch (networkError) {
        console.warn('⚠️ Hardhat node não está disponível:', networkError.message);
        return false; 
      }

      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length === 0) {
          console.log('ℹ️ Nenhuma conta MetaMask conectada. Blockchain service não inicializado.');
          return false;
        }
      } catch (accountError) {
        console.warn('⚠️ Erro ao verificar contas MetaMask:', accountError);
        return false; 
      }

      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();

      this.sprintContract = new ethers.Contract(
        contractAddresses.SprintManagement,
        SprintManagementABI.abi,
        this.signer
      );

      this.taskContract = new ethers.Contract(
        contractAddresses.TaskManagement,
        TaskManagementABI.abi,
        this.signer
      );

      this.teamContract = new ethers.Contract(
        contractAddresses.ScrumTeam,
        ScrumTeamABI.abi,
        this.signer
      );

      this.isInitialized = true;
      console.log('✅ Blockchain service initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Error initializing blockchain service:', error);
      this.isInitialized = false;
      return false; 
    }
  }

  async checkConnection() {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Blockchain service não pode ser inicializado. Verifique se MetaMask está conectado.');
      }
    }
    return this.isInitialized;
  }

  async resetHardhatNetwork() {
    try {
      console.log('🔄 Resetando rede Hardhat local...');
      
      const resetResponse = await fetch('http://127.0.0.1:8545', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'hardhat_reset',
          params: [],
          id: 1
        })
      });

      if (!resetResponse.ok) {
        throw new Error('Falha ao resetar a rede Hardhat');
      }

      console.log('✅ Estado da blockchain Hardhat resetado');

      this.provider = null;
      this.signer = null;
      this.sprintContract = null;
      this.taskContract = null;
      this.teamContract = null;
      this.isInitialized = false;

      console.log('🧹 Cache local limpo completamente');

      this.clearContractCache();

      if (window.ethereum) {
        console.log('ℹ️ MetaMask detectado - mantendo conexões existentes');
      }

      await new Promise(resolve => setTimeout(resolve, 5000));

      const isHealthy = await this.checkNetworkHealth();
      if (!isHealthy) {
        console.warn('⚠️ Rede ainda não está saudável após reset');
        return false;
      }

      console.log('🔄 Reset da rede Hardhat concluído - reconexão manual necessária');
      return true;
    } catch (error) {
      console.error('❌ Erro ao resetar rede Hardhat:', error);
      return false;
    }
  }
  async checkNetworkHealth() {
    try {
      const response = await fetch('http://127.0.0.1:8545', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1
        })
      });

      const data = await response.json();
      return !data.error && response.ok;
    } catch (error) {
      console.warn('⚠️ Problema de saúde da rede:', error);
      return false;
    }
  }

  async getCurrentAddress() {
    if (!this.signer) {
      await this.initialize();
    }
    return await this.signer.getAddress();
  }

  getContracts() {
    return {
      sprintContract: this.sprintContract,
      taskContract: this.taskContract,
      scrumContract: this.teamContract
    };
  }

  generateDataHash(data) {
    const dataString = JSON.stringify(data, Object.keys(data).sort());
    return ethers.keccak256(ethers.toUtf8Bytes(dataString));
  }

  async registerSprint(teamId, sprintData) {
    try {
      await this.checkConnection();

      const startDate = Math.floor(new Date(sprintData.startDate).getTime() / 1000);
      const endDate = Math.floor(new Date(sprintData.endDate).getTime() / 1000);
      const dataHash = this.generateDataHash(sprintData);

      console.log('📝 Registering sprint on blockchain...', {
        teamId,
        startDate,
        endDate,
        dataHash
      });

      const tx = await this.sprintContract.registerSprint(
        teamId,
        startDate,
        endDate,
        dataHash
      );

      console.log('⏳ Transaction sent:', tx.hash);
      const receipt = await tx.wait();
      console.log('✅ Sprint registered on blockchain:', receipt);

      const event = receipt.logs.find(log => {
        try {
          const parsed = this.sprintContract.interface.parseLog(log);
          return parsed.name === 'SprintRegistered';
        } catch (e) {
          return false;
        }
      });

      if (event) {
        const parsed = this.sprintContract.interface.parseLog(event);
        return {
          success: true,
          sprintId: parsed.args.sprintId.toString(),
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber
        };
      }

      throw new Error('Sprint registered but event not found');
    } catch (error) {
      console.error('❌ Error registering sprint on blockchain:', error);
      throw error;
    }
  }

  async updateSprintStatus(sprintId, status) {
    try {
      await this.checkConnection();

      const statusMap = {
        'planning': 0,
        'active': 1,
        'completed': 2,
        'cancelled': 3
      };

      const statusEnum = statusMap[status];
      if (statusEnum === undefined) {
        throw new Error(`Invalid status: ${status}`);
      }

      console.log('📝 Updating sprint status on blockchain...', { sprintId, status });

      const tx = await this.sprintContract.updateSprintStatus(sprintId, statusEnum);
      console.log('⏳ Transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('✅ Sprint status updated on blockchain:', receipt);

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error('❌ Error updating sprint status on blockchain:', error);
      throw error;
    }
  }

  async updateSprintData(sprintId, sprintData) {
    try {
      await this.checkConnection();

      const dataHash = this.generateDataHash(sprintData);
      console.log('📝 Updating sprint data on blockchain...', { sprintId, dataHash });

      const tx = await this.sprintContract.updateSprintDataHash(sprintId, dataHash);
      console.log('⏳ Transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('✅ Sprint data updated on blockchain:', receipt);

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error('❌ Error updating sprint data on blockchain:', error);
      throw error;
    }
  }

  async deleteSprint(sprintId) {
    try {
      await this.checkConnection();

      console.log('📝 Deleting sprint on blockchain...', { sprintId });

      const tx = await this.sprintContract.removeSprint(sprintId);
      console.log('⏳ Transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('✅ Sprint deleted on blockchain:', receipt);

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error('❌ Error deleting sprint on blockchain:', error);
      throw error;
    }
  }

  async registerTask(sprintId, taskData, assignedToAddress = null) {
    try {
      await this.checkConnection();

      const estimatedMinutes = taskData.estimatedHours || 0;
      const assignedTo = assignedToAddress || ethers.ZeroAddress;
      const dataHash = this.generateDataHash(taskData);

      console.log('📝 Registering task on blockchain...', {
        sprintId,
        assignedTo,
        estimatedMinutes,
        dataHash
      });

      const tx = await this.taskContract.registerTask(
        sprintId,
        assignedTo,
        estimatedMinutes,
        dataHash
      );

      console.log('⏳ Transaction sent:', tx.hash);
      const receipt = await tx.wait();
      console.log('✅ Task registered on blockchain:', receipt);

      const event = receipt.logs.find(log => {
        try {
          const parsed = this.taskContract.interface.parseLog(log);
          return parsed.name === 'TaskRegistered';
        } catch (e) {
          return false;
        }
      });

      if (event) {
        const parsed = this.taskContract.interface.parseLog(event);
        return {
          success: true,
          taskId: parsed.args.taskId.toString(),
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          gasPrice: receipt.gasPrice ? receipt.gasPrice.toString() : '0'
        };
      }

      throw new Error('Task registered but event not found');
    } catch (error) {
      console.error('❌ Error registering task on blockchain:', error);
      throw error;
    }
  }

  async updateTaskStatus(taskId, status) {
    try {
      await this.checkConnection();

      const statusMap = {
        'todo': 0,
        'in_progress': 1,
        'review': 2,
        'done': 3,
        'removed': 4
      };

      const statusEnum = statusMap[status];
      if (statusEnum === undefined) {
        throw new Error(`Invalid status: ${status}`);
      }

      console.log('📝 Updating task status on blockchain...', { taskId, status });

      try {
        await this.taskContract.getTask(taskId);
      } catch (error) {
        if (error.message.includes('Task does not exist')) {
          console.warn('⚠️ Task does not exist on blockchain, skipping blockchain update');
          throw new Error('Task not registered on blockchain - cannot update status');
        }
        throw error;
      }

      const tx = await this.taskContract.updateTaskStatus(taskId, statusEnum);
      console.log('⏳ Transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('✅ Task status updated on blockchain:', receipt);

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: receipt.gasPrice ? receipt.gasPrice.toString() : '0'
      };
    } catch (error) {
      console.error('❌ Error updating task status on blockchain:', error);
      throw error;
    }
  }

  async updateTaskData(taskId, taskData) {
    try {
      await this.checkConnection();

      const dataHash = this.generateDataHash(taskData);
      console.log('📝 Updating task data on blockchain...', { taskId, dataHash });

      try {
        await this.taskContract.getTask(taskId);
      } catch (error) {
        if (error.message.includes('Task does not exist')) {
          console.warn('⚠️ Task does not exist on blockchain, skipping blockchain update');
          throw new Error('Task not registered on blockchain - cannot update data');
        }
        throw error;
      }

      const tx = await this.taskContract.updateTaskDataHash(taskId, dataHash);
      console.log('⏳ Transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('✅ Task data updated on blockchain:', receipt);

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: receipt.gasPrice ? receipt.gasPrice.toString() : '0'
      };
    } catch (error) {
      console.error('❌ Error updating task data on blockchain:', error);
      throw error;
    }
  }

  async deleteTask(taskId) {
    try {
      await this.checkConnection();

      console.log('📝 Deleting task on blockchain...', { taskId });

      try {
        await this.taskContract.getTask(taskId);
      } catch (error) {
        if (error.message.includes('Task does not exist')) {
          console.warn('⚠️ Task does not exist on blockchain, skipping blockchain deletion');
          throw new Error('Task not registered on blockchain - cannot delete');
        }
        throw error;
      }

      const tx = await this.taskContract.removeTask(taskId);
      console.log('⏳ Transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('✅ Task deleted on blockchain:', receipt);

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: receipt.gasPrice ? receipt.gasPrice.toString() : '0'
      };
    } catch (error) {
      console.error('❌ Error deleting task on blockchain:', error);
      throw error;
    }
  }

  async assignTask(taskId, assignedToAddress) {
    try {
      await this.checkConnection();

      const assignedTo = assignedToAddress || ethers.ZeroAddress;
      console.log('📝 Assigning task on blockchain...', { taskId, assignedTo });

      const tx = await this.taskContract.assignTask(taskId, assignedTo);
      console.log('⏳ Transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('✅ Task assigned on blockchain:', receipt);

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error('❌ Error assigning task on blockchain:', error);
      throw error;
    }
  }

  async isTeamMember(teamId, userAddress) {
    try {
      await this.checkConnection();
      return await this.teamContract.isMember(teamId, userAddress);
    } catch (error) {
      console.error('❌ Error checking team membership:', error);
      return false;
    }
  }

  async getSprintInfo(sprintId) {
    try {
      await this.checkConnection();
      return await this.sprintContract.getSprintInfo(sprintId);
    } catch (error) {
      console.error('❌ Error getting sprint info:', error);
      throw error;
    }
  }

  async getTaskInfo(taskId) {
    try {
      await this.checkConnection();
      return await this.taskContract.getTaskInfo(taskId);
    } catch (error) {
      console.error('❌ Error getting task info:', error);
      throw error;
    }
  }

  formatAddress(address) {
    if (!address || address === ethers.ZeroAddress) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  handleTransactionError(error) {
    if (error.code === 4001) {
      return 'Transação cancelada pelo usuário';
    }
    if (error.code === -32603) {
      return 'Erro interno da blockchain';
    }
    if (error.message?.includes('insufficient funds')) {
      return 'Saldo insuficiente para taxas de transação';
    }
    if (error.message?.includes('user rejected')) {
      return 'Transação rejeitada pelo usuário';
    }
    return error.message || 'Erro desconhecido na transação';
  }

  async getStats() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return { success: false, message: 'Token de autenticação não encontrado' };
      }

      const response = await fetch(`${getApiUrl()}/api/blockchain/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return {
          success: true,
          data: result.data
        };
      } else {
        return { success: false, message: result.message || 'Erro ao obter estatísticas' };
      }
    } catch (error) {
      console.error('❌ Error getting blockchain stats:', error);
      return { success: false, message: 'Erro ao obter estatísticas blockchain' };
    }
  }

  async getUserTransactions(filters = {}) {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return { success: false, message: 'Token de autenticação não encontrado' };
      }

      const queryParams = new URLSearchParams();
      if (filters.page) queryParams.append('page', filters.page);
      if (filters.limit) queryParams.append('limit', filters.limit);
      if (filters.transactionType) queryParams.append('transactionType', filters.transactionType);
      if (filters.contractName) queryParams.append('contractName', filters.contractName);
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);

      const response = await fetch(`${getApiUrl()}/api/blockchain/transactions?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return {
          success: true,
          data: result.data,
          pagination: result.pagination
        };
      } else {
        return { success: false, message: result.message || 'Erro ao obter transações blockchain' };
      }
    } catch (error) {
      console.error('❌ Error getting blockchain transactions:', error);
      return { success: false, message: 'Erro ao obter transações blockchain' };
    }
  }

  async deleteAllTransactions() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return { success: false, message: 'Token de autenticação não encontrado' };
      }

      const response = await fetch(`${getApiUrl()}/api/blockchain/transactions`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return {
          success: true,
          message: result.message || 'Todas as transações blockchain foram removidas'
        };
      } else {
        return { success: false, message: result.message || 'Erro ao limpar transações blockchain' };
      }
    } catch (error) {
      console.error('❌ Error deleting all blockchain transactions:', error);
      return { success: false, message: 'Erro ao deletar transações blockchain' };
    }
  }

  async deleteTransaction(transactionId) {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return { success: false, message: 'Token de autenticação não encontrado' };
      }

      const response = await fetch(`${getApiUrl()}/api/blockchain/transactions/${transactionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return {
          success: true,
          message: result.message || 'Transação blockchain deletada com sucesso'
        };
      } else {
        return { success: false, message: result.message || 'Erro ao deletar transação blockchain' };
      }
    } catch (error) {
      console.error('❌ Error deleting blockchain transaction:', error);
      return { success: false, message: 'Erro ao deletar transação blockchain' };
    }
  }

  getTransactionTypeLabel(type) {
    const typeLabels = {
      'team_create': 'Criação de Equipe',
      'team_edit': 'Edição de Equipe', 
      'team_delete': 'Exclusão de Equipe',
      'team_member_add': 'Membro Adicionado',
      'team_member_remove': 'Membro Removido',
      'team_member_edit': 'Membro Editado',
      
      'backlog_create': 'Item Criado',
      'backlog_edit': 'Item Editado',
      'backlog_status_update': 'Status Alterado',
      'backlog_delete': 'Item Excluído',
      
      'sprint_create': 'Sprint Criada',
      'sprint_edit': 'Sprint Editada',
      'sprint_status_update': 'Status da Sprint',
      'sprint_delete': 'Sprint Excluída',

      'task_create': 'Tarefa Criada',
      'task_edit': 'Tarefa Editada',
      'task_status_update': 'Status da Tarefa',
      'task_assign': 'Tarefa Atribuída',
      'task_delete': 'Tarefa Excluída',

      'BACKLOG_STATUS_UPDATE': 'Status do Backlog Alterado',
      'BACKLOG_ITEM_CREATION': 'Item do Backlog Criado',
      'BACKLOG_ITEM_UPDATE': 'Item do Backlog Editado',
      'BACKLOG_ITEM_DELETION': 'Item do Backlog Excluído',
      'SPRINT_CREATE': 'Sprint Criada',
      'SPRINT_UPDATE': 'Sprint Editada',
      'SPRINT_STATUS_CHANGE': 'Status da Sprint Alterado',
      'SPRINT_DELETION': 'Sprint Excluída',
      'TASK_CREATE': 'Tarefa Criada',
      'TASK_UPDATE': 'Tarefa Editada',
      'TASK_STATUS_CHANGE': 'Status da Tarefa Alterado', 
      'TASK_ASSIGNMENT': 'Tarefa Atribuída',
      'TASK_DELETION': 'Tarefa Excluída',
      'TEAM_CREATE': 'Equipe Criada',
      'TEAM_UPDATE': 'Equipe Editada',
      'TEAM_DELETION': 'Equipe Excluída',
      'MEMBER_ADD': 'Membro Adicionado',
      'MEMBER_REMOVE': 'Membro Removido',
      'MEMBER_UPDATE': 'Membro Editado',
      
      'updateTaskStatus': 'Status da Tarefa Atualizado',
      'sprint_creation': 'Sprint Criada',
      'registerTeam': 'Equipe Registrada',
      
      'USER_LOGIN': 'Login do Usuário',
      'USER_LOGOUT': 'Logout do Usuário',
      'USER_REGISTER': 'Registro de Usuário',
      
      'CREATE': 'Criar',
      'READ': 'Ler',
      'UPDATE': 'Atualizar',
      'DELETE': 'Deletar',
      
      'GROUP_CREATE': 'Criar Grupo',
      'GROUP_UPDATE': 'Atualizar Grupo',
      'GROUP_DELETE': 'Deletar Grupo',
      'GROUP_JOIN': 'Entrar no Grupo',
      'GROUP_LEAVE': 'Sair do Grupo',
      'MEMBER_ROLE_CHANGE': 'Alterar Papel do Membro',
      
      'SPRINT_START': 'Iniciar Sprint',
      'SPRINT_COMPLETE': 'Finalizar Sprint',
      
      'BACKLOG_CREATE': 'Criar Item do Backlog',
      'BACKLOG_UPDATE': 'Atualizar Item do Backlog',
      'BACKLOG_DELETE': 'Deletar Item do Backlog',
      'BACKLOG_PRIORITIZE': 'Priorizar Backlog',
      
      'sprint_update': 'Atualizar Sprint',
      'sprint_status': 'Alterar Status Sprint',
      'task_update': 'Atualizar Tarefa',
      'task_status': 'Alterar Status Tarefa'
    };
    return typeLabels[type] || type;
  }

  getContractLabel(contractName) {
    const contractLabels = {
      'USER': 'Usuário',
      'GROUP': 'Grupo',
      'SPRINT': 'Sprint',
      'TASK': 'Tarefa',
      'BACKLOG_ITEM': 'Item do Backlog',
      'USER_STORY': 'História do Usuário',
      'SYSTEM': 'Sistema',
      
      'SprintManagement': 'Gerenciamento de Sprints',
      'TaskManagement': 'Gerenciamento de Tarefas',
      'ScrumTeam': 'Equipe Scrum',
      'ProductBacklog': 'Product Backlog'
    };
    return contractLabels[contractName] || contractName;
  }

  formatTransactionHash(hash) {
    if (!hash) return '';
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  }

  async getTeamId(databaseTeamId) {
    try {
      await this.checkConnection();
      
      return databaseTeamId;
    } catch (error) {
      console.error('❌ Error getting team ID:', error);
      throw error;
    }
  }

  async isMemberOfTeam(teamId, userAddress) {
    try {
      await this.checkConnection();
      
      return await this.teamContract.isMember(teamId, userAddress);
    } catch (error) {
      console.error('❌ Error checking team membership:', error);
      return false;
    }
  }

  clearContractCache() {
    console.log('🧽 Limpando cache de contratos...');
    
    this.teamContract = null;
    this.sprintContract = null;
    this.taskContract = null;
    this.backlogContract = null;
    
    if (typeof window !== 'undefined') {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('contract') || key.includes('blockchain'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
    
    console.log('✅ Cache de contratos limpo');
  }
}

export default new BlockchainService();
