
import { getApiUrl } from '../config/api';

const API_BASE_URL = `${getApiUrl()}/api`;

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

const handleResponse = async (response) => {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Erro na requisição');
  }
  return data;
};

export const TransactionService = null;

export const TeamMemberService = null;


export const TeamMembershipService = {
  async getMembers(teamId) {
    const response = await fetch(`${API_BASE_URL}/groups/${teamId}/members`, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  async getUserActiveTeam(userEmail) {
    const response = await fetch(`${API_BASE_URL}/groups/user-team`, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(response);
  }
};


export const TeamService = {
  async getMyGroups() {
    const response = await fetch(`${API_BASE_URL}/groups/my`, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  async getMemberGroups() {
    const response = await fetch(`${API_BASE_URL}/groups/member`, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  async create(teamData) {
    const response = await fetch(`${API_BASE_URL}/groups`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(teamData)
    });
    return handleResponse(response);
  }
};


export const testConnection = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/verify`, {
      method: 'GET',
      headers: getHeaders()
    });
    return { success: response.ok, message: response.ok ? 'Conexão bem-sucedida!' : 'Falha na conexão' };
  } catch (error) {
    console.error('Erro ao testar conexão:', error);
    return { success: false, message: 'Erro de conexão: ' + error.message };
  }
};


export const resetEntireDatabase = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/reset-database`, {
      method: 'POST',
      headers: getHeaders()
    });

    if (response.ok) {
      return { success: true, message: 'Banco de dados resetado com sucesso!' };
    } else {
      const errorData = await response.json();
      return { success: false, message: errorData.message || 'Erro ao resetar banco de dados' };
    }
  } catch (error) {
    console.error('Erro ao resetar banco:', error);
    return { success: false, message: 'Erro de conexão: ' + error.message };
  }
};


const db = {
  TransactionService,
  TeamMemberService,
  TeamMembershipService,
  TeamService,
  testConnection,
  resetEntireDatabase
};

export default db;
