const NETWORK_CONFIG = {
  development: {
    chainId: 31337,
    name: "Hardhat Local",
    rpcUrl: "http://127.0.0.1:8545",
    blockExplorer: "http://localhost:8545",
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18
    }
  },
  mumbai: {
    chainId: 80001,
    name: "Polygon Mumbai Testnet",
    rpcUrl: "https://rpc-mumbai.maticvigil.com",
    blockExplorer: "https://mumbai.polygonscan.com",
    nativeCurrency: {
      name: "MATIC",
      symbol: "MATIC", 
      decimals: 18
    }
  }
};

const environment = process.env.NODE_ENV === 'production' ? 'mumbai' : 'development';

export const currentNetwork = NETWORK_CONFIG[environment];

export const CONTRACT_ADDRESSES = {
  development: {
    ProductBacklog: "",
    ScrumTeam: "",
    SprintManagement: "", 
    TaskManagement: ""
  },
  mumbai: {
    ProductBacklog: "",
    ScrumTeam: "",
    SprintManagement: "",
    TaskManagement: ""
  }
};

export const getContractAddress = (contractName) => {
  return CONTRACT_ADDRESSES[environment][contractName];
};

export const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://scrum-chain-production.up.railway.app'
    : '${getApiUrl()}');

export default {
  network: currentNetwork,
  contracts: CONTRACT_ADDRESSES[environment],
  apiUrl: API_BASE_URL
};