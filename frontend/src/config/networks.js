export const NETWORK_CONFIG = {
  31337: {
    name: 'Hardhat Local',
    displayName: '🛠️ Desenvolvimento',
    rpcUrl: 'http://127.0.0.1:8545',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    blockExplorer: null,
    faucets: [],
    isTestnet: true,
    setupInstructions: 'Execute: npm run local:start'
  },

  80001: {
    name: 'Polygon Mumbai',
    displayName: '🎓 Rede de Teste (Alunos)',
    rpcUrl: 'https://rpc-mumbai.maticvigil.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    },
    blockExplorer: 'https://mumbai.polygonscan.com',
    faucets: [
      'https://mumbaifaucet.com',
      'https://faucet.polygon.technology',
      'https://faucet.quicknode.com/polygon/mumbai'
    ],
    isTestnet: true,
    setupInstructions: 'Adicione a rede Mumbai no MetaMask e obtenha MATIC gratuito nos faucets'
  },

  137: {
    name: 'Polygon',
    displayName: '🚀 Produção',
    rpcUrl: 'https://polygon-rpc.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    },
    blockExplorer: 'https://polygonscan.com',
    faucets: [],
    isTestnet: false,
    setupInstructions: 'Rede principal - requer MATIC real'
  }
};

export const CONTRACT_ADDRESSES = {
  31337: {
    ScrumTeam: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    ProductBacklog: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    SprintManagement: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    TaskManagement: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'
  },

  80001: {
    ScrumTeam: '0x0000000000000000000000000000000000000000', 
    ProductBacklog: '0x0000000000000000000000000000000000000000', 
    SprintManagement: '0x0000000000000000000000000000000000000000', 
    TaskManagement: '0x0000000000000000000000000000000000000000' 
  },

  137: {
    ScrumTeam: '0x0000000000000000000000000000000000000000',
    ProductBacklog: '0x0000000000000000000000000000000000000000',
    SprintManagement: '0x0000000000000000000000000000000000000000',
    TaskManagement: '0x0000000000000000000000000000000000000000'
  }
};

export const getCurrentNetworkConfig = (chainId) => {
  const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 16) : chainId;
  return NETWORK_CONFIG[numericChainId] || null;
};

export const getContractAddresses = (chainId) => {
  const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 16) : chainId;
  return CONTRACT_ADDRESSES[numericChainId] || null;
};

export const isSupportedNetwork = (chainId) => {
  const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 16) : chainId;
  return !!NETWORK_CONFIG[numericChainId];
};

export const getNetworkInstructions = (chainId) => {
  const config = getCurrentNetworkConfig(chainId);
  return config ? config.setupInstructions : 'Rede não suportada';
};

export const METAMASK_NETWORKS = {
  80001: {
    chainId: '0x13881', 
    chainName: 'Polygon Mumbai',
    rpcUrls: ['https://rpc-mumbai.maticvigil.com'],
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    },
    blockExplorerUrls: ['https://mumbai.polygonscan.com']
  },

  137: {
    chainId: '0x89', 
    chainName: 'Polygon',
    rpcUrls: ['https://polygon-rpc.com'],
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    },
    blockExplorerUrls: ['https://polygonscan.com']
  }
};

export const addNetworkToMetaMask = async (chainId) => {
  const networkConfig = METAMASK_NETWORKS[chainId];
  
  if (!networkConfig) {
    throw new Error('Rede não configurada para adição automática');
  }

  try {
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [networkConfig]
    });
    return true;
  } catch (error) {
    console.error('Erro ao adicionar rede:', error);
    return false;
  }
};

export default {
  NETWORK_CONFIG,
  CONTRACT_ADDRESSES,
  getCurrentNetworkConfig,
  getContractAddresses,
  isSupportedNetwork,
  getNetworkInstructions,
  addNetworkToMetaMask
};