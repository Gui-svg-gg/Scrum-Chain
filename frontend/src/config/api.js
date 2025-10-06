const getApiBaseUrl = () => {
  return process.env.REACT_APP_API_URL || 
    (process.env.NODE_ENV === 'production' 
      ? 'https://scrum-chain-production.up.railway.app'
      : 'http://localhost:3001');
};

const API_CONFIG = {
  
  BASE_URL: getApiBaseUrl(),
      
  
  ENDPOINTS: {
    
    AUTH: '/api/auth',
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    PROFILE: '/api/auth/profile',
    UPDATE_PROFILE: '/api/auth/update-profile',
    CHANGE_PASSWORD: '/api/auth/change-password',
    LINK_WALLET: '/api/auth/link-wallet',
    UNLINK_WALLET: '/api/auth/unlink-wallet',
    
    
    GROUPS: '/api/groups',
    USER_TEAM: '/api/groups/user-team',
    CURRENT_TEAM: '/api/groups/current',
    
    
    BACKLOG: '/api/backlog',
    
    
    SPRINTS: '/api/sprints',
    
    
    TASKS: '/api/tasks',
    
    
    ADMIN: '/api/admin',
    ADMIN_TABLES: '/api/admin/tables',
    ADMIN_STATS: '/api/admin/stats',
    
    
    BLOCKCHAIN: '/api/blockchain',
    BLOCKCHAIN_TRANSACTIONS: '/api/blockchain/transactions',
    BLOCKCHAIN_STATS: '/api/blockchain/stats',
    
    
    AUDIT: '/api/audit',
    AUDIT_HISTORY: '/api/audit/history',
    
    
    HEALTH: '/api/health'
  }
};


export const buildApiUrl = (endpoint) => {
  return `${getApiBaseUrl()}${endpoint}`;
};


export const buildApiUrlWithParams = (endpoint, params = {}) => {
  const url = buildApiUrl(endpoint);
  const searchParams = new URLSearchParams(params);
  return searchParams.toString() ? `${url}?${searchParams.toString()}` : url;
};


export const getApiUrl = () => getApiBaseUrl();


export const API_BASE_URL = getApiBaseUrl();
export const API_ENDPOINTS = API_CONFIG.ENDPOINTS;

export default API_CONFIG;