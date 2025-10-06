import React, { useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '../config/api';
import {
  Container, Typography, Box, Paper, Grid, Button, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Select, FormControl, InputLabel, CircularProgress, Alert,
  Card, CardContent
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Group as GroupIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { ethers } from 'ethers';
import axios from 'axios';
import BlockchainService from '../services/BlockchainService';
import contractAddresses from '../contracts/contract-addresses.json';
import ScrumTeamABI from '../contracts/ScrumTeam.json';

function TeamManagement() {
  const navigate = useNavigate();
  const { account, isConnected, isCorrectNetwork } = useWallet();


  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [successType, setSuccessType] = useState('success');
  const [loadingAction, setLoadingAction] = useState(false);
  const [blockchainTxHash, setBlockchainTxHash] = useState(null);
  const [showLeaveTeamOption, setShowLeaveTeamOption] = useState(false);


  const [scrumContract, setScrumContract] = useState(null);


  const [isInTeam, setIsInTeam] = useState(false);
  const [isTeamLeader, setIsTeamLeader] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamInfo, setTeamInfo] = useState(null);


  const [blockchainStatus, setBlockchainStatus] = useState({
    isVerified: false,
    isChecking: false,
    lastCheckTime: null,
    hasCircuitBreakerError: false
  });


  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showDeleteTeamModal, setShowDeleteTeamModal] = useState(false);
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);


  const [createTeamForm, setCreateTeamForm] = useState({
    teamName: '',
    description: ''
  });

  const [editTeamForm, setEditTeamForm] = useState({
    teamName: '',
    description: ''
  });

  const [addMemberForm, setAddMemberForm] = useState({
    email: '',
    walletAddress: '',
    role: 'Developer'
  });

  const [editingMember, setEditingMember] = useState(null);
  const [memberToDelete, setMemberToDelete] = useState(null);


  const roleColors = {
    'Product Owner': 'error',
    'Scrum Master': 'primary',
    'Developer': 'success',
    'Stakeholder': 'warning'
  };


  const SCRUM_CONTRACT_ADDRESS = contractAddresses.ScrumTeam;
  const SCRUM_CONTRACT_ABI = ScrumTeamABI.abi;


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


  useEffect(() => {
    const initContract = async () => {
      if (isConnected && account && window.ethereum) {
        try {
          console.log('🔐 Inicializando contrato com conta:', account);
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const signerAddress = await signer.getAddress();
          console.log('✅ Signer address:', signerAddress);

          const contract = new ethers.Contract(SCRUM_CONTRACT_ADDRESS, SCRUM_CONTRACT_ABI, signer);
          setScrumContract(contract);
          console.log('✅ Contrato ScrumTeam inicializado - pronto para transações');

        } catch (error) {
          console.error('❌ Erro ao inicializar contrato:', error);
        }
      } else {
        setScrumContract(null);
      }
    };

    initContract();
  }, [isConnected, account]);


  const generateDataHash = (data) => {
    const dataString = JSON.stringify(data);
    return ethers.keccak256(ethers.toUtf8Bytes(dataString));
  };


  const verifyBlockchainStatus = async (teamData) => {
    if (!teamData?.blockchain_id || !scrumContract) {
      setBlockchainStatus({
        isVerified: false,
        isChecking: false,
        lastCheckTime: Date.now(),
        hasCircuitBreakerError: false
      });
      return false;
    }

    setBlockchainStatus(prev => ({ ...prev, isChecking: true, hasCircuitBreakerError: false }));

    try {

      const hasBlockchainData = teamData.blockchain_id &&
        teamData.blockchain_id > 0 &&
        teamData.transaction_hash;

      if (hasBlockchainData) {
        console.log('✅ Equipe sincronizada - dados encontrados:', {
          blockchain_id: teamData.blockchain_id,
          transaction_hash: teamData.transaction_hash,
          block_number: teamData.block_number
        });

        setBlockchainStatus({
          isVerified: true,
          isChecking: false,
          lastCheckTime: Date.now(),
          hasCircuitBreakerError: false
        });
        return true;
      } else {
        console.log('⚠️ Equipe não sincronizada - faltam dados blockchain');
        setBlockchainStatus({
          isVerified: false,
          isChecking: false,
          lastCheckTime: Date.now(),
          hasCircuitBreakerError: false
        });
        return false;
      }
    } catch (error) {
      console.error('❌ Erro ao verificar status:', error);

      setBlockchainStatus({
        isVerified: false,
        isChecking: false,
        lastCheckTime: Date.now(),
        hasCircuitBreakerError: false
      });

      return false;
    }
  };


  const isTeamSyncedLocally = () => {
    return teamInfo && teamInfo.blockchain_id && teamInfo.blockchain_id > 0 && teamInfo.transaction_hash;
  };


  const loadTeamData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Token não encontrado');
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

        if (result.success && result.data) {

          setIsInTeam(true);
          setTeamInfo(result.data);


          const userRole = result.data.member_role;
          setIsTeamLeader(userRole === 'Product Owner' || userRole === 'Scrum Master');


          await loadTeamMembers(result.data.id);


          if (scrumContract && result.data.blockchain_id) {
            setTimeout(() => {
              verifyBlockchainStatus(result.data);
            }, 1000);
          }
        } else {

          setIsInTeam(false);
          setTeamInfo(null);
          setTeamMembers([]);
          setIsTeamLeader(false);
        }
      } else {
        console.error('Erro ao verificar equipe do usuário');
        setError('Erro ao verificar dados da equipe');
      }
    } catch (error) {
      console.error('Erro ao carregar dados da equipe:', error);
      setError('Erro ao carregar dados da equipe');
    } finally {
      setLoading(false);
    }
  }, []);


  const loadTeamMembers = useCallback(async (teamId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiUrl()}/api/groups/${teamId}/members`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const membersResponse = await response.json();
        if (membersResponse.success && membersResponse.data) {
          const formattedMembers = membersResponse.data.map(member => ({
            id: member.id,
            user_id: member.user_id,
            name: member.full_name || member.name || 'Nome não informado',
            email: member.email || 'Email não informado',
            wallet_address: member.wallet_address,
            role: member.role || 'Developer',
            is_active: member.is_active,
            created_at: member.created_at
          }));
          setTeamMembers(formattedMembers);
        }
      } else {
        console.error('Erro ao carregar membros');
        setTeamMembers([]);
      }
    } catch (error) {
      console.error('Erro ao carregar membros:', error);
      setTeamMembers([]);
    }
  }, []);


  const handleCreateTeam = async () => {
    if (!createTeamForm.teamName.trim()) {
      setError('Nome da equipe é obrigatório');
      return;
    }

    if (!isConnected) {
      setError('Conecte sua conta MetaMask para criar uma equipe');
      return;
    }

    if (!isCorrectNetwork) {
      setError('Troque para a rede Hardhat no MetaMask');
      return;
    }

    try {
      setLoadingAction(true);
      setError(null);
      setBlockchainTxHash(null);


      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiUrl()}/api/groups`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: createTeamForm.teamName,
          description: createTeamForm.description
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao criar equipe');
      }

      const result = await response.json();
      const teamId = result.data.id;


      if (scrumContract) {
        const teamData = {
          id: teamId,
          name: createTeamForm.teamName,
          description: createTeamForm.description,
          creator: account
        };

        const dataHash = generateDataHash(teamData);


        const tx = await scrumContract.registerTeam(dataHash);
        setBlockchainTxHash(tx.hash);


        const receipt = await tx.wait();
        console.log('✅ Transação confirmada:', receipt);



        let blockchainTeamId = teamId;
        console.log('🆔 Team ID definitivo (ID do banco):', blockchainTeamId);


        if (receipt.logs && receipt.logs.length > 0) {
          try {
            for (const log of receipt.logs) {
              try {
                const decodedLog = scrumContract.interface.parseLog(log);
                if (decodedLog && decodedLog.name === 'TeamRegistered') {
                  console.log('✅ Evento TeamRegistered encontrado:', decodedLog.args);
                  break;
                }
              } catch (parseError) {

              }
            }
          } catch (logError) {
            console.log('⚠️ Não foi possível processar eventos (não é crítico):', logError.message);
          }
        }


        if (blockchainTeamId) {
          console.log('💾 Atualizando banco de dados com blockchain_id...');

          const updateResponse = await axios.put(
            `${getApiUrl()}/api/groups/${teamId}/blockchain`,
            {
              blockchain_id: blockchainTeamId.toString(),
              transaction_hash: tx.hash,
              block_number: receipt.blockNumber
            },
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          );

          if (updateResponse.data.success) {
            console.log('✅ Banco de dados atualizado com blockchain_id');


            try {
              const transactionPayload = {
                transactionHash: tx.hash,
                contractName: 'ScrumTeam',
                methodName: 'registerTeam',
                teamId: blockchainTeamId.toString(),
                teamName: createTeamForm.teamName,
                additionalData: {
                  description: createTeamForm.description,
                  blockNumber: receipt.blockNumber
                }
              };

              await axios.post(
                `${getApiUrl()}/api/groups/${teamId}/blockchain-transaction`,
                transactionPayload,
                {
                  headers: { Authorization: `Bearer ${token}` }
                }
              );

              console.log('✅ Transação blockchain salva no histórico');
            } catch (historyError) {
              console.warn('⚠️ Erro ao salvar transação no histórico:', historyError);
            }

            customSetSuccess(`✅ Sucesso! Equipe criada. Hash: ${tx.hash}`, 'success');
          } else {
            customSetSuccess(`✅ Sucesso! Equipe criada. Hash: ${tx.hash}`, 'success');
          }
        } else {
          customSetSuccess(`✅ Sucesso! Equipe criada. Hash: ${tx.hash}`, 'success');
        }
      } else {
        customSetSuccess('✅ Sucesso! Equipe criada.', 'success');
      }

      setShowCreateTeamModal(false);
      setCreateTeamForm({ teamName: '', description: '' });


      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (error) {
      console.error('Erro ao criar equipe:', error);

      if (error.code === 4001) {
        setError('Transação cancelada pelo usuário');
      } else if (error.code === -32603) {
        setError('Erro na rede blockchain. Verifique se a rede Hardhat está rodando');
      } else {
        setError(error.message || 'Erro ao criar equipe');
      }
    } finally {
      setLoadingAction(false);
    }
  };


  const handleEditTeam = async () => {
    if (!editTeamForm.teamName.trim()) {
      setError('Nome da equipe é obrigatório');
      return;
    }

    if (!isConnected) {
      setError('Conecte sua conta MetaMask para editar a equipe');
      return;
    }

    if (!isCorrectNetwork) {
      setError('Troque para a rede Hardhat no MetaMask');
      return;
    }

    try {
      setLoadingAction(true);
      setError(null);
      setBlockchainTxHash(null);




      console.log('📝 1. Atualizando equipe no PostgreSQL...');
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiUrl()}/api/groups/${teamInfo.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editTeamForm.teamName,
          description: editTeamForm.description
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao atualizar equipe');
      }

      const result = await response.json();
      console.log('✅ 1. Equipe atualizada no PostgreSQL - ID:', teamInfo.id);


      if (scrumContract) {
        console.log('🔗 2. Atualizando equipe na blockchain...');


        if (!isTeamSyncedLocally()) {
          throw new Error('Equipe não está sincronizada com blockchain. Sincronize a equipe primeiro.');
        }

        const userTeamId = teamInfo.blockchain_id;

        const teamData = {
          id: teamInfo.id,
          name: editTeamForm.teamName,
          description: editTeamForm.description,
          editor: account
        };

        const dataHash = generateDataHash(teamData);


        const tx = await scrumContract.updateTeamDataHash(userTeamId, dataHash);
        setBlockchainTxHash(tx.hash);


        const receipt = await tx.wait();
        console.log('✅ 2. Equipe atualizada na blockchain - Hash:', tx.hash);


        console.log('💾 3. Atualizando banco de dados com novo hash...');
        const updateResponse = await axios.put(
          `${getApiUrl()}/api/groups/${teamInfo.id}/blockchain`,
          {
            blockchain_id: userTeamId,
            transaction_hash: tx.hash,
            block_number: receipt.blockNumber
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        if (updateResponse.data.success) {
          console.log('✅ 3. Banco de dados atualizado com novo hash');


          console.log('💾 4. Salvando transação na blockchain_transactions...');
          try {
            const transactionPayload = {
              transactionHash: tx.hash,
              contractName: 'ScrumTeam',
              methodName: 'updateTeamDataHash',
              teamId: userTeamId.toString(),
              teamName: editTeamForm.teamName,
              additionalData: {
                description: editTeamForm.description,
                blockNumber: receipt.blockNumber
              }
            };

            await axios.post(
              `${getApiUrl()}/api/groups/${teamInfo.id}/blockchain-transaction`,
              transactionPayload,
              {
                headers: { Authorization: `Bearer ${token}` }
              }
            );

            console.log('✅ 4. Transação salva na blockchain_transactions');
          } catch (historyError) {
            console.warn('⚠️ Erro ao salvar transação no histórico:', historyError);
          }

          customSetSuccess(`✅ Sucesso! Equipe atualizada. Hash: ${tx.hash}`, 'success');
        } else {
          customSetSuccess(`✅ Sucesso! Equipe atualizada. Hash: ${tx.hash}`, 'success');
        }
      } else {
        customSetSuccess('✅ Sucesso! Equipe atualizada.', 'success');
      }

      setShowEditTeamModal(false);
      setEditTeamForm({ teamName: '', description: '' });


      await loadTeamData();

    } catch (error) {
      console.error('❌ Erro ao editar equipe:', error);

      if (error.code === 4001) {
        setError('Transação cancelada pelo usuário');
      } else if (error.code === -32603) {
        setError('Erro na rede blockchain. Verifique se a rede Hardhat está rodando');
      } else {
        setError(error.message || 'Erro ao editar equipe');
      }
    } finally {
      setLoadingAction(false);
    }
  };


  const handleAddMember = async () => {

    if (!addMemberForm.email.trim()) {
      setError('Email é obrigatório');
      return;
    }

    if (!addMemberForm.walletAddress.trim()) {
      setError('Endereço da conta é obrigatório');
      return;
    }


    if (!addMemberForm.walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Formato de endereço da conta inválido. Deve começar com 0x seguido de 40 caracteres hexadecimais');
      return;
    }

    if (!isConnected) {
      setError('Conecte sua conta MetaMask para adicionar membros');
      return;
    }

    if (!isCorrectNetwork) {
      setError('Troque para a rede Hardhat no MetaMask');
      return;
    }

    try {
      setLoadingAction(true);
      setError(null);
      setBlockchainTxHash(null);




      console.log('📝 1. Adicionando membro no PostgreSQL...');
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiUrl()}/api/groups/${teamInfo.id}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail: addMemberForm.email,
          walletAddress: addMemberForm.walletAddress,
          role: addMemberForm.role
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao adicionar membro');
      }

      const result = await response.json();
      const memberId = result.data.user_id;
      console.log('✅ 1. Membro adicionado no PostgreSQL - ID:', memberId);


      if (scrumContract) {
        console.log('🔗 2. Registrando membro na blockchain...');

        if (!isTeamSyncedLocally()) {
          throw new Error('Equipe não está sincronizada com blockchain. Sincronize a equipe primeiro.');
        }

        const userTeamId = teamInfo.blockchain_id;
        const memberAddress = addMemberForm.walletAddress;


        const roleMapping = { 'Developer': 0, 'Scrum Master': 1, 'Product Owner': 2, 'Stakeholder': 3 };
        const roleId = roleMapping[addMemberForm.role] || 0;

        const memberData = {
          teamId: userTeamId.toString(),
          memberAddress,
          role: addMemberForm.role,
          email: addMemberForm.email
        };

        const dataHash = generateDataHash(memberData);


        const tx = await scrumContract.addMember(userTeamId, memberAddress, roleId, dataHash);
        setBlockchainTxHash(tx.hash);


        const receipt = await tx.wait();
        console.log('✅ 2. Membro registrado na blockchain - Hash:', tx.hash);





        console.log('💾 4. Salvando transação na blockchain_transactions...');
        try {
          await fetch(`${getApiUrl()}/api/groups/${teamInfo.id}/members/${memberId}/add/blockchain-transaction`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              transactionHash: tx.hash,
              contractName: 'ScrumTeam',
              methodName: 'addMember',
              gasUsed: receipt.gasUsed?.toString(),
              gasPrice: receipt.gasPrice?.toString(),
              blockNumber: receipt.blockNumber,
              network: 'localhost',
              memberName: addMemberForm.email,
              memberRole: addMemberForm.role,
              memberEmail: addMemberForm.email
            })
          });
          console.log('✅ 4. Transação salva na blockchain_transactions');
        } catch (transactionError) {
          console.warn('⚠️ Erro ao salvar transação (não crítico):', transactionError);
        }

        customSetSuccess(`✅ Sucesso! Membro adicionado. Hash: ${tx.hash}`, 'success');
      } else {
        customSetSuccess('✅ Sucesso! Membro adicionado.', 'success');
      }

      setShowAddMemberModal(false);
      setAddMemberForm({ email: '', walletAddress: '', role: 'Developer' });
      await loadTeamMembers(teamInfo.id);

    } catch (error) {
      console.error('❌ Erro ao adicionar membro:', error);

      if (error.code === 4001) {
        setError('Transação cancelada pelo usuário');
      } else if (error.code === -32603) {
        setError('Erro na rede blockchain. Verifique se a rede Hardhat está rodando');
      } else {
        setError(error.message || 'Erro ao adicionar membro');
      }
    } finally {
      setLoadingAction(false);
    }
  };



  const handleRemoveMember = async () => {
    if (!memberToDelete) return;

    if (!isConnected) {
      setError('Conecte sua conta MetaMask para remover membros');
      return;
    }

    if (!isCorrectNetwork) {
      setError('Troque para a rede Hardhat no MetaMask');
      return;
    }

    try {
      setLoadingAction(true);
      setError(null);
      setBlockchainTxHash(null);




      console.log('📝 1. Removendo membro do PostgreSQL...');
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiUrl()}/api/groups/${teamInfo.id}/members/${memberToDelete.user_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao remover membro');
      }

      console.log('✅ 1. Membro removido do PostgreSQL - ID:', memberToDelete.user_id);


      if (scrumContract && memberToDelete.wallet_address) {
        console.log('🔗 2. Removendo membro da blockchain...');
        setSuccess('Membro removido! Aguarde confirmação da MetaMask...');


        if (!isTeamSyncedLocally()) {
          throw new Error('Equipe não está sincronizada com blockchain. Sincronize a equipe primeiro.');
        }

        const userTeamId = teamInfo.blockchain_id;


        const tx = await scrumContract.removeMember(userTeamId, memberToDelete.wallet_address);
        setBlockchainTxHash(tx.hash);


        const receipt = await tx.wait();
        console.log('✅ 2. Membro removido da blockchain - Hash:', tx.hash);





        console.log('💾 4. Salvando transação na blockchain_transactions...');
        try {
          await fetch(`${getApiUrl()}/api/groups/${teamInfo.id}/members/${memberToDelete.user_id}/remove/blockchain-transaction`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              transactionHash: tx.hash,
              contractName: 'ScrumTeam',
              methodName: 'removeMember',
              gasUsed: receipt.gasUsed?.toString(),
              gasPrice: receipt.gasPrice?.toString(),
              blockNumber: receipt.blockNumber,
              network: 'localhost',
              memberName: memberToDelete.full_name || memberToDelete.email || 'Membro',
              memberRole: memberToDelete.role
            })
          });

          console.log('✅ 4. Transação salva na blockchain_transactions');
        } catch (transactionError) {
          console.warn('⚠️ Erro ao salvar transação (não crítico):', transactionError);
        }

        customSetSuccess(`✅ Sucesso! Membro removido. Hash: ${tx.hash}`, 'success');
      } else {
        customSetSuccess('✅ Sucesso! Membro removido.', 'success');
      }

      setShowDeleteConfirmModal(false);
      setMemberToDelete(null);
      await loadTeamMembers(teamInfo.id);

    } catch (error) {
      console.error('❌ Erro ao remover membro:', error);

      if (error.code === 4001) {
        setError('Transação cancelada pelo usuário');
      } else if (error.code === -32603) {
        setError('Erro na rede blockchain. Verifique se a rede Hardhat está rodando');
      } else {
        setError(error.message || 'Erro ao remover membro');
      }
    } finally {
      setLoadingAction(false);
    }
  };


  const handleDeleteTeam = async () => {
    if (!teamInfo) return;

    if (!isConnected) {
      setError('Conecte sua conta MetaMask para excluir a equipe');
      return;
    }

    if (!isCorrectNetwork) {
      setError('Troque para a rede Hardhat no MetaMask');
      return;
    }

    try {
      setLoadingAction(true);
      setError(null);
      setBlockchainTxHash(null);




      console.log('📝 1. Excluindo equipe do PostgreSQL...');
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiUrl()}/api/groups/${teamInfo.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao excluir equipe');
      }

      console.log('✅ 1. Equipe excluída do PostgreSQL - ID:', teamInfo.id);


      if (scrumContract) {
        console.log('🔗 2. Desativando equipe na blockchain...');
        setSuccess('Equipe excluída! Aguarde confirmação da MetaMask...');


        if (!isTeamSyncedLocally()) {
          throw new Error('Equipe não está sincronizada com blockchain. Sincronize a equipe primeiro.');
        }

        const userTeamId = teamInfo.blockchain_id;


        const tx = await scrumContract.deactivateTeam(userTeamId);
        setBlockchainTxHash(tx.hash);


        const receipt = await tx.wait();
        console.log('✅ 2. Equipe desativada na blockchain - Hash:', tx.hash);





        console.log('💾 4. Salvando transação na blockchain_transactions...');
        try {
          await fetch(`${getApiUrl()}/api/groups/${teamInfo.id}/blockchain-transaction`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              transactionHash: tx.hash,
              contractName: 'ScrumTeam',
              methodName: 'deactivateTeam',
              gasUsed: receipt.gasUsed?.toString(),
              gasPrice: receipt.gasPrice?.toString(),
              blockNumber: receipt.blockNumber,
              network: 'localhost',
              teamId: teamInfo.id,
              teamName: teamInfo.name,
              description: `Equipe "${teamInfo.name}" desativada/excluída`
            })
          });

          console.log('✅ 4. Transação salva na blockchain_transactions');
        } catch (transactionError) {
          console.warn('⚠️ Erro ao salvar transação (não crítico):', transactionError);
        }

        customSetSuccess(`✅ Sucesso! Equipe excluída. Hash: ${tx.hash}`, 'success');
      } else {
        customSetSuccess('✅ Sucesso! Equipe excluída.', 'success');
      }

      setShowDeleteTeamModal(false);


      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (error) {
      console.error('❌ Erro ao excluir equipe:', error);

      if (error.code === 4001) {
        setError('Transação cancelada pelo usuário');
      } else if (error.code === -32603) {
        setError('Erro na rede blockchain. Verifique se a rede Hardhat está rodando');
      } else {
        setError(error.message || 'Erro ao excluir equipe');
      }
    } finally {
      setLoadingAction(false);
    }
  };


  const handleLeaveCurrentTeam = async () => {
    if (!isConnected) {
      setError('Conecte sua conta MetaMask para sair da equipe atual');
      return;
    }

    if (!isCorrectNetwork) {
      setError('Troque para a rede Hardhat no MetaMask');
      return;
    }

    if (!scrumContract) {
      setError('Contrato não carregado. Verifique sua conexão com MetaMask.');
      return;
    }

    try {
      setLoadingAction(true);
      setError(null);
      setSuccess(null);
      setBlockchainTxHash(null);

      console.log('🔄 Tentando sair da equipe atual...');


      const userCurrentTeamId = await scrumContract.getUserTeam(account);
      if (!userCurrentTeamId || userCurrentTeamId.toString() === '0') {
        setError('Você não pertence a nenhuma equipe na blockchain');
        return;
      }

      console.log('👥 Saindo da equipe ID:', userCurrentTeamId.toString());

      setSuccess('Saindo da equipe atual... Aguarde confirmação da MetaMask');


      const tx = await scrumContract.removeMember(userCurrentTeamId, account);
      console.log('📤 Transação enviada:', tx.hash);
      setBlockchainTxHash(tx.hash);


      const receipt = await tx.wait();
      console.log('✅ Transação confirmada:', receipt);


      console.log('💾 Registrando transação blockchain de saída da equipe...');
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      try {
        const token = localStorage.getItem('token');
        const blockchainResponse = await fetch(`${getApiUrl()}/api/groups/${userCurrentTeamId}/members/${currentUser.id}/remove/blockchain-transaction`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transactionHash: tx.hash,
            contractName: 'ScrumTeam',
            methodName: 'removeMember',
            gasUsed: receipt.gasUsed?.toString(),
            gasPrice: receipt.gasPrice?.toString(),
            blockNumber: receipt.blockNumber,
            network: 'localhost',
            memberName: currentUser.full_name || currentUser.email || 'Usuário',
            memberRole: 'Saída voluntária'
          })
        });

        if (blockchainResponse.ok) {
          console.log('✅ Hash da transação de saída registrada com sucesso!');
        } else {
          console.warn('⚠️ Falha ao registrar hash da transação de saída:', await blockchainResponse.text());
        }
      } catch (hashError) {
        console.warn('⚠️ Erro ao registrar hash da transação de saída:', hashError);

      }

      setSuccess(`✅ Sucesso! Você saiu da equipe. Hash: ${tx.hash}`);

    } catch (error) {
      console.error('❌ Erro ao sair da equipe atual:', error);

      if (error.code === 4001) {
        setError('Operação cancelada pelo usuário');
      } else if (error.code === -32603) {
        setError('Erro na rede blockchain. Verifique se a rede Hardhat está rodando');
      } else if (error.message?.includes('Cannot remove team creator')) {
        setError('❌ Você é o criador da equipe atual e não pode se remover. Transfira a liderança para outro membro ou desative a equipe primeiro.');
      } else if (error.message?.includes('Only team creator or Scrum Master can perform this action')) {
        setError('❌ Apenas o criador da equipe ou Scrum Master podem remover membros. Entre em contato com eles para ser removido da equipe atual.');
      } else {
        setError(error.message || 'Erro ao sair da equipe atual');
      }
    } finally {
      setLoadingAction(false);
    }
  };


  const handleSyncTeam = async () => {
    if (!isConnected) {
      setError('Conecte sua conta MetaMask para sincronizar a equipe');
      return;
    }

    if (!isCorrectNetwork) {
      setError('Troque para a rede Hardhat no MetaMask');
      return;
    }

    if (!scrumContract) {
      setError('Contrato não carregado. Verifique sua conexão com MetaMask.');
      return;
    }

    if (!teamInfo) {
      setError('Informações da equipe não encontradas');
      return;
    }

    try {
      setLoadingAction(true);
      setError(null);
      setSuccess(null);
      setBlockchainTxHash(null);
      setShowLeaveTeamOption(false);

      console.log('🔄 INICIANDO SINCRONIZAÇÃO DA EQUIPE:');
      console.log('👥 Equipe:', teamInfo.name);
      console.log('🆔 ID da equipe:', teamInfo.id);
      console.log('🔗 Blockchain ID atual:', teamInfo.blockchain_id);


      if (teamInfo.blockchain_id && teamInfo.blockchain_id > 0) {
        console.log('✅ Equipe já sincronizada!');
        setSuccess('✅ Sucesso! Equipe já sincronizada.');
        return;
      }


      console.log('🆕 Registrando nova equipe na blockchain...');


      const teamData = {
        id: teamInfo.id,
        name: teamInfo.name,
        description: teamInfo.description || '',
        creator: account,
        timestamp: Date.now()
      };


      const dataString = JSON.stringify(teamData);
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes(dataString));

      console.log('📝 Dados da equipe para blockchain:', teamData);
      console.log('🏷️ Hash dos dados:', dataHash);

      setSuccess('Sincronizando equipe... Aguarde confirmação da MetaMask');


      const tx = await scrumContract.registerTeam(dataHash);
      console.log('📤 Transação enviada:', tx.hash);
      setBlockchainTxHash(tx.hash);


      const receipt = await tx.wait();
      console.log('✅ Transação confirmada:', receipt);


      if (receipt.logs && receipt.logs.length > 0) {
        try {
          for (const log of receipt.logs) {
            try {
              const decodedLog = scrumContract.interface.parseLog(log);
              if (decodedLog && decodedLog.name === 'TeamRegistered') {
                console.log('✅ Evento TeamRegistered encontrado:', decodedLog.args);
                break;
              }
            } catch (parseError) {

            }
          }
        } catch (logError) {
          console.log('⚠️ Não foi possível processar eventos (não é crítico):', logError.message);
        }
      }



      const blockchainTeamId = teamInfo.id;
      console.log('🆔 Team ID definitivo (ID do banco):', blockchainTeamId);


      console.log('💾 Atualizando banco de dados com blockchain_id...');

      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${getApiUrl()}/api/groups/${teamInfo.id}/blockchain`,
        {
          blockchain_id: blockchainTeamId.toString(),
          transaction_hash: tx.hash,
          block_number: receipt.blockNumber
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        console.log('✅ Banco de dados atualizado');


        try {
          const transactionPayload = {
            transactionHash: tx.hash,
            contractName: 'ScrumTeam',
            methodName: 'registerTeam',
            teamId: blockchainTeamId.toString(),
            teamName: teamInfo.name
          };

          await axios.post(
            `${getApiUrl()}/api/groups/${teamInfo.id}/blockchain-transaction`,
            transactionPayload,
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          );

          console.log('✅ Transação salva no histórico');
        } catch (historyError) {
          console.warn('⚠️ Erro ao salvar no histórico:', historyError);
        }

        setSuccess(`✅ Sucesso! Equipe sincronizada. Hash: ${tx.hash}`);


        setTimeout(async () => {
          await loadTeamData();
        }, 1000);
      } else {
        setError('❌ Erro ao atualizar banco de dados. Verifique a conexão.');
      }

    } catch (error) {
      console.error('❌ Erro ao sincronizar equipe:', error);

      if (error.code === 4001) {
        setError('Sincronização cancelada pelo usuário');
      } else if (error.code === -32603 || error.message?.includes('circuit breaker is open') || error.message?.includes('Internal JSON-RPC error')) {
        setError('🔒 Rede blockchain com problemas técnicos. Pode ser Circuit Breaker do MetaMask ou erro interno da rede Hardhat. Clique no botão "🔄 Reset Hardhat" abaixo ou aguarde alguns minutos.');


        setBlockchainStatus(prev => ({
          ...prev,
          hasCircuitBreakerError: true
        }));
      } else if (error.message?.includes('User already belongs to a team')) {
        setError('⚠️ Você já pertence a uma equipe diferente na blockchain. Isso pode acontecer se você criou uma equipe em outra sessão. Recarregue a página ou use uma conta diferente.');
        setShowLeaveTeamOption(true);
      } else if (error.message?.includes('execution reverted')) {
        const revertReason = error.reason || error.message;
        setError(`Erro no contrato blockchain: ${revertReason}`);
      } else {
        setError(error.message || 'Erro ao sincronizar equipe com blockchain');
      }
    } finally {
      setLoadingAction(false);
    }
  };


  const handleResetHardhat = async () => {
    try {
      setLoadingAction(true);
      setError(null);
      setSuccess(null);

      console.log('🔄 Iniciando reset manual da rede Hardhat...');

      const resetSuccess = await BlockchainService.resetHardhatNetwork();

      if (resetSuccess) {
        setSuccess('✅ Rede Hardhat resetada com sucesso! Problemas de circuit breaker foram resolvidos.');


        if (teamInfo && teamInfo.blockchain_id) {
          setTimeout(() => {
            verifyBlockchainStatus(teamInfo);
          }, 3000);
        }
      } else {
        setError('❌ Falha ao resetar a rede Hardhat. Verifique se o servidor Hardhat está rodando.');
      }
    } catch (error) {
      console.error('❌ Erro ao resetar Hardhat:', error);
      setError(`Erro ao resetar rede Hardhat: ${error.message}`);
    } finally {
      setLoadingAction(false);
    }
  };



  const handleEditMember = async () => {
    if (!editingMember) return;


    const originalRole = teamMembers.find(m => m.user_id === editingMember.user_id)?.role;
    const newRole = editingMember.role;

    console.log('📝 INICIANDO EDIÇÃO DE MEMBRO:');
    console.log('👤 Membro:', editingMember.name);
    console.log('🏷️ Papel original:', originalRole);
    console.log('🏷️ Papel novo:', newRole);

    if (!isConnected) {
      setError('Conecte sua conta MetaMask para editar membro');
      return;
    }

    if (!isCorrectNetwork) {
      setError('Troque para a rede Hardhat no MetaMask');
      return;
    }

    if (!scrumContract) {
      setError('Contrato não carregado. Verifique sua conexão com MetaMask.');
      return;
    }

    try {
      setLoadingAction(true);
      setError(null);
      setBlockchainTxHash(null);




      console.log('📝 1. Atualizando membro no PostgreSQL...');
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiUrl()}/api/groups/${teamInfo.id}/members/${editingMember.user_id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: editingMember.role
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.message || 'Erro ao editar membro');
        return;
      }

      console.log('✅ 1. Membro atualizado no PostgreSQL');


      console.log('� 2. Atualizando papel do membro na blockchain...');


      const roleMapping = { 'Developer': 0, 'Scrum Master': 1, 'Product Owner': 2, 'Stakeholder': 3 };
      const roleNumber = roleMapping[editingMember.role];

      if (roleNumber === undefined) {
        setError('Papel inválido selecionado');
        return;
      }


      const memberAddress = editingMember.wallet_address;

      if (!memberAddress || !ethers.isAddress(memberAddress)) {
        setError('Endereço da conta do membro não encontrado ou inválido');
        return;
      }


      if (!isTeamSyncedLocally()) {
        throw new Error('Equipe não está sincronizada com blockchain. Sincronize a equipe primeiro.');
      }

      const userTeamId = teamInfo.blockchain_id;


      const tx = await scrumContract.updateMemberRole(
        userTeamId,
        memberAddress,
        roleNumber
      );

      setBlockchainTxHash(tx.hash);


      const receipt = await tx.wait();
      console.log('✅ 2. Papel atualizado na blockchain - Hash:', tx.hash);





      console.log('💾 4. Salvando transação na blockchain_transactions...');
      try {
        const transactionPayload = {
          transactionHash: tx.hash,
          contractName: 'ScrumTeam',
          methodName: 'updateMemberRole',
          gasUsed: receipt.gasUsed?.toString(),
          gasPrice: tx.gasPrice?.toString(),
          blockNumber: receipt.blockNumber,
          network: 'localhost',
          newRole: newRole,
          previousRole: originalRole
        };

        await axios.post(
          `${getApiUrl()}/api/groups/${teamInfo.id}/members/${editingMember.user_id}/blockchain-transaction`,
          transactionPayload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        console.log('✅ 4. Transação salva na blockchain_transactions');
      } catch (transactionError) {
        console.warn('⚠️ Erro ao salvar transação (não crítico):', transactionError);
      }

      setSuccess(`✅ Sucesso! Papel do membro atualizado. Hash: ${tx.hash}`);
      setShowEditMemberModal(false);
      setEditingMember(null);
      await loadTeamMembers(teamInfo.id);

    } catch (error) {
      console.error('❌ Erro ao editar membro:', error);

      if (error.code === 'ACTION_REJECTED') {
        setError('Transação rejeitada pelo usuário no MetaMask');
      } else if (error.message?.includes('Team creator must remain as Product Owner')) {
        setError('O criador da equipe deve permanecer como Product Owner');
      } else if (error.message?.includes('Member already has this role')) {
        setError('O membro já possui este papel');
      } else if (error.message?.includes('User is not a team member')) {
        setError('Usuário não é membro da equipe');
      } else {
        setError(`Erro ao editar membro: ${error.message || error}`);
      }
    } finally {
      setLoadingAction(false);
    }
  };


  useEffect(() => {
    console.log('🎯 TEAM MANAGEMENT: Componente montado - carregando dados');
    loadTeamData();
  }, [loadTeamData]);


  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);


  useEffect(() => {
    if (scrumContract && teamInfo && teamInfo.blockchain_id) {
      verifyBlockchainStatus(teamInfo);
    }
  }, [scrumContract, teamInfo?.blockchain_id]);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
        <GroupIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
        Gerenciamento de Equipe
      </Typography>

      {}
      {!isConnected && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          🔗 Conecte sua conta MetaMask para usar funcionalidades blockchain
        </Alert>
      )}

      {isConnected && !isCorrectNetwork && (
        <Alert severity="error" sx={{ mb: 3 }}>
          ⚠️ Rede incorreta! Troque para a rede Hardhat no MetaMask
        </Alert>
      )}

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

      {!isInTeam ? (

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <GroupIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h5" gutterBottom>
                  Você não está em nenhuma equipe Scrum
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                  Crie uma nova equipe para começar a gerenciar seus projetos Scrum.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setShowCreateTeamModal(true)}
                  size="large"
                >
                  Criar Nova Equipe
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : (

        <Grid container spacing={3}>
          {}
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box>
                  <Typography variant="h5" gutterBottom>
                    {teamInfo?.name}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {teamInfo?.description || 'Sem descrição'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Seu papel: <strong>{teamInfo?.member_role || 'Membro'}</strong>
                  </Typography>
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Status Blockchain:
                    </Typography>
                    {blockchainStatus.isChecking ? (
                      <Chip
                        label="Verificando..."
                        color="info"
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                    ) : blockchainStatus.hasCircuitBreakerError ? (
                      <Chip
                        label="Problemas na Rede ⚠️"
                        color="error"
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                    ) : teamInfo?.blockchain_id && blockchainStatus.isVerified ? (
                      <Chip
                        label="Sincronizada ✓"
                        color="success"
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                    ) : teamInfo?.blockchain_id && !blockchainStatus.isVerified ? (
                      <Chip
                        label="Desincronizada ⚠️"
                        color="warning"
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                    ) : (
                      <Chip
                        label="Não Sincronizada"
                        color="default"
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                    )}
                  </Box>
                </Box>
                <Box>
                  {teamInfo?.member_role === 'Scrum Master' ? (
                    <Box
                      display="flex"
                      flexDirection={{ xs: 'column', sm: 'row' }}
                      gap={2}
                      alignItems={{ xs: 'stretch', sm: 'center' }}
                      justifyContent="flex-end"
                    >
                      {}
                      <Box display="flex" gap={1} flexWrap="wrap">
                        <Button
                          variant="contained"
                          color="secondary"
                          startIcon={<EditIcon />}
                          onClick={() => {
                            setEditTeamForm({
                              teamName: teamInfo?.name || '',
                              description: teamInfo?.description || ''
                            });
                            setShowEditTeamModal(true);
                          }}
                          disabled={loadingAction}
                          size="small"
                        >
                          Editar Equipe
                        </Button>
                        <Button
                          variant="contained"
                          color="primary"
                          startIcon={<GroupIcon />}
                          onClick={handleSyncTeam}
                          disabled={loadingAction}
                          size="small"
                        >
                          {loadingAction ? <CircularProgress size={16} /> : 'Sincronizar'}
                        </Button>
                        <Button
                          variant="contained"
                          color="success"
                          startIcon={<AddIcon />}
                          onClick={() => setShowAddMemberModal(true)}
                          disabled={loadingAction}
                          size="small"
                        >
                          Adicionar Membro
                        </Button>
                      </Box>

                      {}
                      <Box display="flex" gap={1}>
                        {showLeaveTeamOption && (
                          <Button
                            variant="outlined"
                            color="warning"
                            onClick={() => {
                              handleLeaveCurrentTeam();
                              setShowLeaveTeamOption(false);
                            }}
                            disabled={loadingAction}
                            size="small"
                          >
                            Sair da Equipe
                          </Button>
                        )}
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => setShowDeleteTeamModal(true)}
                          disabled={loadingAction}
                          size="small"
                        >
                          Excluir
                        </Button>
                      </Box>
                    </Box>
                  ) : (

                    <Box display="flex" justifyContent="center" alignItems="center">
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          p: 2,
                          backgroundColor: 'grey.100',
                          borderRadius: 1,
                          textAlign: 'center',
                          fontStyle: 'italic'
                        }}
                      >
                        🔒 Apenas seu Scrum Master pode gerenciar a equipe
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Paper>
          </Grid>

          {}
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Membros da Equipe ({teamMembers.length})
              </Typography>

              {teamMembers.length > 0 ? (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Nome</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Papel</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Endereço da Conta</TableCell>
                        {teamInfo?.member_role === 'Scrum Master' && <TableCell>Ações</TableCell>}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {teamMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={1}>
                              <PersonIcon color="primary" />
                              <Typography variant="body1">
                                {member.name}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>{member.email}</TableCell>
                          <TableCell>
                            <Chip
                              label={member.role}
                              color={roleColors[member.role] || 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={member.is_active ? 'Ativo' : 'Inativo'}
                              color={member.is_active ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                              {member.wallet_address ?
                                `${member.wallet_address.substring(0, 6)}...${member.wallet_address.substring(member.wallet_address.length - 4)}`
                                : 'Não informado'
                              }
                            </Typography>
                          </TableCell>
                          {teamInfo?.member_role === 'Scrum Master' && (
                            <TableCell>
                              <IconButton
                                color="primary"
                                onClick={() => {
                                  setEditingMember({ ...member });
                                  setShowEditMemberModal(true);
                                }}
                                size="small"
                                sx={{ mr: 1 }}
                              >
                                <EditIcon />
                              </IconButton>
                              <IconButton
                                color="error"
                                onClick={() => {
                                  setMemberToDelete(member);
                                  setShowDeleteConfirmModal(true);
                                }}
                                size="small"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Nenhum membro encontrado na equipe.
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {}
      <Dialog
        open={showCreateTeamModal}
        onClose={() => setShowCreateTeamModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Criar Nova Equipe</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nome da Equipe"
            fullWidth
            variant="outlined"
            value={createTeamForm.teamName}
            onChange={(e) => setCreateTeamForm(prev => ({ ...prev, teamName: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Descrição (opcional)"
            fullWidth
            variant="outlined"
            multiline
            rows={3}
            value={createTeamForm.description}
            onChange={(e) => setCreateTeamForm(prev => ({ ...prev, description: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateTeamModal(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreateTeam}
            variant="contained"
            disabled={loadingAction}
          >
            {loadingAction ? <CircularProgress size={20} /> : 'Criar Equipe'}
          </Button>
        </DialogActions>
      </Dialog>

      {}
      <Dialog
        open={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Adicionar Membro à Equipe</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Email do Usuário"
            type="email"
            fullWidth
            variant="outlined"
            value={addMemberForm.email}
            onChange={(e) => setAddMemberForm(prev => ({ ...prev, email: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Endereço da conta"
            type="text"
            fullWidth
            variant="outlined"
            value={addMemberForm.walletAddress}
            onChange={(e) => setAddMemberForm(prev => ({ ...prev, walletAddress: e.target.value }))}
            placeholder="0x..."
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth variant="outlined">
            <InputLabel>Papel</InputLabel>
            <Select
              value={addMemberForm.role}
              onChange={(e) => setAddMemberForm(prev => ({ ...prev, role: e.target.value }))}
              label="Papel"
            >
              <MenuItem value="Product Owner">Product Owner</MenuItem>
              <MenuItem value="Scrum Master">Scrum Master</MenuItem>
              <MenuItem value="Developer">Developer</MenuItem>
              <MenuItem value="Stakeholder">Stakeholder</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddMemberModal(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleAddMember}
            variant="contained"
            disabled={loadingAction}
          >
            {loadingAction ? <CircularProgress size={20} /> : 'Adicionar'}
          </Button>
        </DialogActions>
      </Dialog>

      {}
      <Dialog
        open={showEditMemberModal}
        onClose={() => setShowEditMemberModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Editar Papel do Membro</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom sx={{ mb: 2 }}>
            Editando: <strong>{editingMember?.name}</strong>
          </Typography>
          <FormControl fullWidth variant="outlined">
            <InputLabel>Papel</InputLabel>
            <Select
              value={editingMember?.role || ''}
              onChange={(e) => setEditingMember(prev => ({ ...prev, role: e.target.value }))}
              label="Papel"
            >
              <MenuItem value="Product Owner">Product Owner</MenuItem>
              <MenuItem value="Scrum Master">Scrum Master</MenuItem>
              <MenuItem value="Developer">Developer</MenuItem>
              <MenuItem value="Stakeholder">Stakeholder</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditMemberModal(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleEditMember}
            variant="contained"
            disabled={loadingAction}
          >
            {loadingAction ? <CircularProgress size={20} /> : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      {}
      <Dialog
        open={showDeleteConfirmModal}
        onClose={() => setShowDeleteConfirmModal(false)}
      >
        <DialogTitle>Confirmar Remoção</DialogTitle>
        <DialogContent>
          <Typography>
            Tem certeza que deseja remover <strong>{memberToDelete?.name}</strong> da equipe?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteConfirmModal(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleRemoveMember}
            color="error"
            variant="contained"
            disabled={loadingAction}
          >
            {loadingAction ? <CircularProgress size={20} /> : 'Remover'}
          </Button>
        </DialogActions>
      </Dialog>

      {}
      <Dialog
        open={showEditTeamModal}
        onClose={() => setShowEditTeamModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <EditIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Editar Equipe
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              autoFocus
              margin="normal"
              label="Nome da Equipe"
              fullWidth
              variant="outlined"
              value={editTeamForm.teamName}
              onChange={(e) => setEditTeamForm(prev => ({
                ...prev,
                teamName: e.target.value
              }))}
              disabled={loadingAction}
              helperText="Nome da equipe (obrigatório)"
            />
            <TextField
              margin="normal"
              label="Descrição"
              fullWidth
              variant="outlined"
              multiline
              rows={3}
              value={editTeamForm.description}
              onChange={(e) => setEditTeamForm(prev => ({
                ...prev,
                description: e.target.value
              }))}
              disabled={loadingAction}
              helperText="Descrição da equipe (opcional)"
            />
            {!isConnected && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Conecte sua carteira MetaMask para sincronizar com a blockchain
              </Alert>
            )}
            {isConnected && !isCorrectNetwork && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Troque para a rede Hardhat no MetaMask para sincronizar com a blockchain
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowEditTeamModal(false)}
            disabled={loadingAction}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleEditTeam}
            variant="contained"
            disabled={loadingAction || !editTeamForm.teamName.trim()}
            startIcon={loadingAction ? <CircularProgress size={16} /> : <EditIcon />}
          >
            {loadingAction ? 'Atualizando...' : 'Atualizar Equipe'}
          </Button>
        </DialogActions>
      </Dialog>

      {}
      <Dialog
        open={showDeleteTeamModal}
        onClose={() => setShowDeleteTeamModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Excluir Equipe
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Esta ação não pode ser desfeita!
          </Alert>
          <Typography variant="body1" gutterBottom>
            Tem certeza que deseja excluir permanentemente a equipe <strong>"{teamInfo?.name}"</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Todos os membros serão removidos e todos os dados relacionados à equipe serão perdidos.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteTeamModal(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleDeleteTeam}
            color="error"
            variant="contained"
            disabled={loadingAction}
            startIcon={loadingAction ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {loadingAction ? 'Excluindo...' : 'Excluir Equipe'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default TeamManagement;
