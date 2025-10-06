import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '../config/api';

const WalletContext = createContext();

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet deve ser usado dentro de WalletProvider');
  }
  return context;
};


const HARDHAT_NETWORK = {
  chainId: '0x7A69',
  chainName: 'Hardhat Local',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['http://127.0.0.1:8545'],
  blockExplorerUrls: [],
};


const ACCEPTED_CHAIN_IDS = ['0x7A69', '0x7a69', 31337, '31337'];

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [chainId, setChainId] = useState(null);
  const [error, setError] = useState(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [userWalletAddress, setUserWalletAddress] = useState(null);
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);


  const isMetaMaskInstalled = useCallback(() => {
    return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
  }, []);


  const checkNetwork = useCallback(async () => {
    if (!window.ethereum) return false;

    try {
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
      setChainId(currentChainId);


      const isCorrect = ACCEPTED_CHAIN_IDS.includes(currentChainId) ||
        ACCEPTED_CHAIN_IDS.includes(parseInt(currentChainId, 16)) ||
        ACCEPTED_CHAIN_IDS.includes(currentChainId.toLowerCase());

      setIsCorrectNetwork(isCorrect);
      console.log('🔗 Rede atual:', currentChainId, '| Hardhat:', isCorrect);
      return isCorrect;
    } catch (error) {
      console.error('Erro ao verificar rede:', error);
      return false;
    }
  }, []);


  const addHardhatNetwork = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error('MetaMask não encontrado');
    }

    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [HARDHAT_NETWORK],
      });
      return true;
    } catch (error) {
      console.error('Erro ao adicionar rede Hardhat:', error);
      throw error;
    }
  }, []);


  const switchToHardhatNetwork = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error('MetaMask não encontrado');
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: HARDHAT_NETWORK.chainId }],
      });
      return true;
    } catch (error) {
      if (error.code === 4902) {

        return await addHardhatNetwork();
      }
      console.error('Erro ao trocar rede:', error);
      throw error;
    }
  }, [addHardhatNetwork]);


  const connectWallet = useCallback(async () => {
    if (!isMetaMaskInstalled()) {
      setError('MetaMask não está instalado. Por favor, instale o MetaMask para continuar.');
      return false;
    }

    setIsConnecting(true);
    setError(null);

    try {

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setIsConnected(true);


        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('walletConnected', 'true');
        }


        const networkCorrect = await checkNetwork();
        if (!networkCorrect) {
          try {
            await switchToHardhatNetwork();
            await checkNetwork();
          } catch (networkError) {
            console.warn('Não foi possível trocar para rede Hardhat automaticamente:', networkError);
            setError('Por favor, conecte à rede Hardhat manualmente no MetaMask');
          }
        }

        console.log('✅ Carteira conectada:', accounts[0]);
        return true;
      }
    } catch (error) {
      console.error('Erro ao conectar carteira:', error);
      setError('Erro ao conectar com MetaMask');
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [isMetaMaskInstalled, checkNetwork, switchToHardhatNetwork]);


  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setIsConnected(false);
    setChainId(null);
    setIsCorrectNetwork(false);
    setError(null);


    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('walletConnected');
    }

    console.log('🚪 Carteira desconectada manualmente');
  }, []);


  const autoConnectUserWallet = useCallback(async () => {
    console.log('🔇 Auto-connect desabilitado para melhor experiência do usuário');

    return;
  }, []);


  const checkConnection = useCallback(async () => {
    if (!isMetaMaskInstalled()) return;

    try {

      const wasConnected = typeof window !== 'undefined' &&
        window.localStorage &&
        window.localStorage.getItem('walletConnected') === 'true';

      if (wasConnected) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setIsConnected(true);
          await checkNetwork();
          console.log('🔄 Reconectado automaticamente:', accounts[0]);
        } else {

          window.localStorage.removeItem('walletConnected');
        }
      }
    } catch (error) {
      console.error('Erro ao verificar conexão:', error);
    }
  }, [isMetaMaskInstalled, checkNetwork]);


  useEffect(() => {
    if (!isMetaMaskInstalled()) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else if (accounts[0] !== account) {
        setAccount(accounts[0]);
        console.log('👤 Conta alterada:', accounts[0]);
      }
    };

    const handleChainChanged = (chainId) => {
      setChainId(chainId);
      const isCorrect = ACCEPTED_CHAIN_IDS.includes(chainId) ||
        ACCEPTED_CHAIN_IDS.includes(parseInt(chainId, 16)) ||
        ACCEPTED_CHAIN_IDS.includes(chainId.toLowerCase());
      setIsCorrectNetwork(isCorrect);
      console.log('🔗 Rede alterada:', chainId, '| Hardhat:', isCorrect);
    };

    const handleConnect = (connectInfo) => {
      console.log('🔗 MetaMask conectado:', connectInfo);
      checkConnection();
    };

    const handleDisconnect = () => {
      console.log('🚪 MetaMask desconectado');
      disconnectWallet();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('connect', handleConnect);
    window.ethereum.on('disconnect', handleDisconnect);


    checkConnection();


    console.log('🔇 Auto-connect desabilitado - usuário deve conectar manualmente');

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
        window.ethereum.removeListener('connect', handleConnect);
        window.ethereum.removeListener('disconnect', handleDisconnect);
      }
    };
  }, [isMetaMaskInstalled, checkConnection, disconnectWallet, autoConnectUserWallet]);


  const linkWalletToUser = useCallback(async () => {
    if (!account) {
      throw new Error('Nenhuma carteira conectada');
    }

    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Usuário não autenticado');
    }

    try {
      const response = await fetch(`${getApiUrl()}/api/auth/link-wallet`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: account
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao vincular carteira');
      }

      console.log('✅ Carteira vinculada com sucesso:', account);
      return data;
    } catch (error) {
      console.error('❌ Erro ao vincular carteira:', error);
      throw error;
    }
  }, [account]);


  const unlinkWalletFromUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Usuário não autenticado');
    }

    try {
      const response = await fetch(`${getApiUrl()}/api/auth/unlink-wallet`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao desvincular carteira');
      }

      console.log('✅ Carteira desvinculada com sucesso');
      return data;
    } catch (error) {
      console.error('❌ Erro ao desvincular carteira:', error);
      throw error;
    }
  }, []);


  const getWalletStatus = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Usuário não autenticado');
    }

    try {
      const response = await fetch(`${getApiUrl()}/api/auth/wallet-status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao verificar status da carteira');
      }

      return data.data;
    } catch (error) {
      console.error('❌ Erro ao verificar status da carteira:', error);
      throw error;
    }
  }, []);

  const value = {
    account,
    isConnected,
    isConnecting,
    chainId,
    isCorrectNetwork,
    error,
    userWalletAddress,
    autoConnectAttempted,
    isMetaMaskInstalled: isMetaMaskInstalled(),
    connectWallet,
    disconnectWallet,
    autoConnectUserWallet,
    switchToHardhatNetwork,
    checkNetwork,
    linkWalletToUser,
    unlinkWalletFromUser,
    getWalletStatus,
    HARDHAT_NETWORK
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}
