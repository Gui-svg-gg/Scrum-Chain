const express = require('express');
const router = express.Router();
const GroupService = require('../services/GroupService');
const GroupMemberService = require('../services/GroupMemberService');
const { authenticateToken } = require('../middleware/auth');
const { auditMiddleware, logAuditAction, ACTION_TYPES, ENTITY_TYPES } = require('../middleware/auditMiddleware');




router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, role } = req.body;
    const userId = req.user.id;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Nome do grupo é obrigatório'
      });
    }
    
    
    
    const userRole = 'Scrum Master';
    
    console.log(`👑 Criador da equipe "${name}" será definido como Scrum Master automaticamente`);
    
    
    const group = await GroupService.create({
      name,
      description,
      creatorUserId: userId
    });

    
    await GroupMemberService.addMember({
      groupId: group.id,
      userId: userId,
      role: userRole
    });

    
    const BlockchainTransactionService = require('../services/BlockchainTransactionService');
    
    console.log('🔗 Transação blockchain da criação da equipe será registrada quando a transação for executada no frontend');

    
    const completeGroup = await GroupService.findById(group.id);

    res.status(201).json({
      success: true,
      message: 'Grupo criado com sucesso',
      data: completeGroup
    });
    
  } catch (error) {
    console.error('Erro ao criar grupo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});


router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    
    const groups = await GroupService.findByCreatorUserId(userId);
    
    res.json({
      success: true,
      data: groups
    });
    
  } catch (error) {
    console.error('Erro ao buscar grupos do usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});


router.get('/current', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    
    const groups = await GroupMemberService.findActiveGroupsByUserId(userId);
    
    if (!groups || groups.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não pertence a nenhuma equipe ativa',
        data: null
      });
    }

    
    const currentTeam = groups[0];
    
    res.json({
      success: true,
      data: currentTeam,
      message: 'Equipe atual encontrada com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao buscar equipe atual do usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});


router.get('/member', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    
    const groups = await GroupMemberService.findActiveGroupsByUserId(userId);
    
    res.json({
      success: true,
      data: groups
    });
    
  } catch (error) {
    console.error('Erro ao buscar grupos do membro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});


router.get('/user-team', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('🔍 Buscando equipe ativa para usuário:', userId);
    
    
    const userGroups = await GroupMemberService.findActiveGroupsByUserId(userId);
    
    if (!userGroups || userGroups.length === 0) {
      console.log('⚠️ Usuário não possui equipe ativa');
      return res.json({
        success: true,
        data: null,
        message: 'Usuário não possui equipe ativa'
      });
    }
    
    
    const activeTeam = userGroups[0];
    console.log('✅ Equipe ativa encontrada:', activeTeam.name);
    
    res.json({
      success: true,
      data: activeTeam
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar equipe do usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});


router.get('/available', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('🔍 Buscando equipes disponíveis para usuário:', userId);
    
    
    const availableGroups = await GroupService.findAvailableGroups(userId);
    
    console.log('✅ Equipes disponíveis encontradas:', availableGroups.length);
    
    res.json({
      success: true,
      data: availableGroups
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar equipes disponíveis:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});


router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const group = await GroupService.findById(id);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Grupo não encontrado'
      });
    }
    
    res.json({
      success: true,
      data: group
    });
    
  } catch (error) {
    console.error('Erro ao buscar grupo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});


router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const userId = req.user.id;
    
    
    const isCreator = await GroupService.isCreatorByUserId(id, userId);
    if (!isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Apenas o criador pode atualizar o grupo'
      });
    }
    
    const updatedGroup = await GroupService.update(id, { name, description });

    
    const BlockchainTransactionService = require('../services/BlockchainTransactionService');
    
    console.log('🔗 Transação blockchain da edição da equipe será registrada quando a transação for executada no frontend');

    res.json({
      success: true,
      message: 'Grupo atualizado com sucesso',
      data: updatedGroup
    });
    
  } catch (error) {
    console.error('Erro ao atualizar grupo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});


router.put('/:id/blockchain', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { blockchain_id, transaction_hash, block_number } = req.body;
    const userId = req.user.id;
    
    if (!blockchain_id) {
      return res.status(400).json({
        success: false,
        message: 'blockchain_id é obrigatório'
      });
    }
    
    
    const isMember = await GroupMemberService.isUserMemberOfGroup(userId, id);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Apenas membros da equipe podem sincronizar com blockchain'
      });
    }
    
    
    const updatedGroup = await GroupService.updateBlockchainId(id, {
      blockchain_id,
      transaction_hash: transaction_hash || null,
      block_number: block_number || null,
      synced_at: new Date()
    });

    
    if (transaction_hash && transaction_hash !== 'existing') {
      try {
        const BlockchainTransactionService = require('../services/BlockchainTransactionService');
        await BlockchainTransactionService.logTransaction(
          transaction_hash,
          'ScrumTeam',
          'registerTeam',
          {
            groupId: id,
            blockchain_id,
            block_number
          }
        );
        console.log('✅ Transação blockchain registrada:', transaction_hash);
      } catch (transactionError) {
        console.warn('⚠️ Erro ao registrar transação blockchain:', transactionError);
      }
    }

    res.json({
      success: true,
      message: 'Grupo sincronizado com blockchain com sucesso',
      data: updatedGroup
    });
    
  } catch (error) {
    console.error('Erro ao sincronizar grupo com blockchain:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});


router.post('/:id/blockchain-transaction', authenticateToken, async (req, res) => {
  try {
    console.log('🔗 NOVA TRANSAÇÃO BLOCKCHAIN GRUPO:');
    console.log('👤 Usuário ID:', req.user.id);
    console.log('📊 Dados da transação:', req.body);

    const { id: groupId } = req.params;
    const {
      transactionHash,
      contractName,
      methodName,
      teamId,
      teamName,
      additionalData
    } = req.body;

    if (!transactionHash) {
      return res.status(400).json({
        success: false,
        message: 'Hash da transação é obrigatório'
      });
    }

    
    const isMember = await GroupMemberService.isUserMemberOfGroup(req.user.id, groupId);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Apenas membros da equipe podem registrar transações'
      });
    }

    
    let transactionType = methodName;
    let entityType = 'group';
    let description = '';

    switch (methodName) {
      case 'registerTeam':
        description = `Equipe criada: ${teamName || 'N/A'}`;
        break;
      case 'updateTeamDataHash':
        description = `Equipe atualizada: ${teamName || 'N/A'}`;
        break;
      case 'addMember':
        description = `Membro adicionado à equipe: ${teamName || 'N/A'}`;
        break;
      case 'removeMember':
        description = `Membro removido da equipe: ${teamName || 'N/A'}`;
        break;
      case 'updateMemberRole':
        description = `Papel de membro atualizado na equipe: ${teamName || 'N/A'}`;
        break;
      default:
        description = `Operação na equipe: ${methodName}`;
    }

    
    const userQuery = await require('../config/database').query(
      'SELECT wallet_address FROM users WHERE id = $1',
      [req.user.id]
    );
    
    const userAddress = userQuery.rows[0]?.wallet_address;

    
    const BlockchainTransactionService = require('../services/BlockchainTransactionService');
    
    const transactionData = {
      transactionHash,
      transactionType,
      contractName: contractName || 'ScrumTeam',
      methodName: methodName || 'registerTeam',
      description,
      userAddress,
      userId: req.user.id,
      teamId: teamId || groupId,
      itemId: parseInt(groupId), 
      gasUsed: additionalData?.gasUsed ? parseInt(additionalData.gasUsed) : null,
      gasPrice: additionalData?.gasPrice ? parseInt(additionalData.gasPrice) : null,
      blockNumber: additionalData?.blockNumber ? parseInt(additionalData.blockNumber) : null,
      network: additionalData?.network || 'localhost',
      status: 'confirmed'
    };

    console.log('💾 Salvando transação grupo:', transactionData);
    
    const savedTransaction = await BlockchainTransactionService.create(transactionData);
    
    console.log('✅ Transação grupo salva:', savedTransaction.id);

    res.json({
      success: true,
      message: 'Transação blockchain salva com sucesso',
      data: savedTransaction
    });

  } catch (error) {
    console.error('❌ Erro ao salvar transação blockchain grupo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});


router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const deletedGroup = await GroupService.deleteByUserId(id, userId);

    
    const BlockchainTransactionService = require('../services/BlockchainTransactionService');
    
    console.log('🔗 Transação blockchain da exclusão da equipe será registrada quando a transação for executada no frontend');

    
    const activeMembers = await GroupMemberService.findByGroupId(id);
    
    const TeamBlockchainService = require('../services/TeamBlockchainService');
    for (const member of activeMembers) {
      try {
        await TeamBlockchainService.removeMemberFromTeam(id, member.wallet_address);
      } catch (err) {
        console.error(`Erro ao remover membro ${member.wallet_address} da equipe na blockchain:`, err);
      }
    }

    res.json({
      success: true,
      message: 'Grupo excluído com sucesso',
      data: deletedGroup
    });
    
  } catch (error) {
    console.error('Erro ao excluir grupo:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});




router.get('/:id/members', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const members = await GroupMemberService.findByGroupId(id);
    
    res.json({
      success: true,
      data: members
    });
    
  } catch (error) {
    console.error('Erro ao buscar membros do grupo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});


router.post('/:id/members', authenticateToken, async (req, res) => {
  try {
    console.log('🔵 INICIANDO ADIÇÃO DE MEMBRO:');
    console.log('👥 Grupo ID:', req.params.id);
    console.log('📧 Dados recebidos:', req.body);
    console.log('👤 Usuário solicitante ID:', req.user.id);
    
    const { id } = req.params;
    const { userEmail, walletAddress, role } = req.body;
    const requestorUserId = req.user.id;
    
    
    console.log('🔍 Verificando se usuário é Scrum Master...');
    const isScrumMaster = await GroupMemberService.isScrumMasterByUserId(id, requestorUserId);
    console.log('👑 É Scrum Master?', isScrumMaster);
    
    if (!isScrumMaster) {
      console.log('❌ Acesso negado - usuário não é Scrum Master');
      return res.status(403).json({
        success: false,
        message: 'Apenas o Scrum Master pode adicionar membros'
      });
    }
    
    
    console.log('🔍 Procurando usuário pelo email:', userEmail);
    let userId = null;
    let existingUser = null;
    try {
      const userQuery = await require('../config/database').query(
        'SELECT id, wallet_address FROM users WHERE email = $1',
        [userEmail.toLowerCase()]
      );
      
      console.log('📊 Resultado da busca de usuário:', userQuery.rows.length, 'resultado(s)');
      
      if (userQuery.rows.length > 0) {
        userId = userQuery.rows[0].id;
        existingUser = userQuery.rows[0];
        console.log('✅ Usuário encontrado - ID:', userId, 'Wallet:', existingUser.wallet_address);
        
        
        
        if (walletAddress && walletAddress !== existingUser.wallet_address) {
          console.log('🔄 Atualizando endereço da carteira...');
          await require('../config/database').query(
            'UPDATE users SET wallet_address = $1 WHERE id = $2',
            [walletAddress.toLowerCase(), userId]
          );
          console.log(`✅ Endereço da carteira atualizado para o usuário ${userEmail}`);
        }
      } else {
        console.log('❌ Usuário não encontrado com email:', userEmail);
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }
    } catch (error) {
      console.error('❌ Erro na busca de usuário:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar usuário'
      });
    }
    
    console.log('➕ Adicionando membro ao grupo...');
    const member = await GroupMemberService.addMember({
      groupId: id,
      userId,
      role
    });
    console.log('✅ Membro adicionado com sucesso:', member);

    
    console.log('🔴 AVISO: A transação blockchain da adição de membro deve ser registrada pelo frontend!');
    console.log('🔗 O frontend deve chamar POST /api/groups/:groupId/members/:userId/blockchain-transaction');
    
    
    const BlockchainTransactionService = require('../services/BlockchainTransactionService');
    
    console.log('🔗 Transação blockchain da adição de membro será registrada quando a transação for executada no frontend');

    res.status(201).json({
      success: true,
      message: 'Membro adicionado com sucesso',
      data: member
    });
    
  } catch (error) {
    console.error('Erro ao adicionar membro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});


router.put('/:groupId/members/:userId', authenticateToken, async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const { role } = req.body;
    const requestorUserId = req.user.id;
    
    
    const isScrumMaster = await GroupMemberService.isScrumMasterByUserId(groupId, requestorUserId);
    if (!isScrumMaster) {
      return res.status(403).json({
        success: false,
        message: 'Apenas o Scrum Master pode editar membros'
      });
    }
    
    
    const memberBefore = await GroupMemberService.findByGroupAndUserId(groupId, userId);
    const previousRole = memberBefore?.role || 'unknown';
    
    const updatedMember = await GroupMemberService.updateRoleByUserId(groupId, userId, role);
    
    
    await logAuditAction(req, ACTION_TYPES.MEMBER_ROLE_CHANGE, ENTITY_TYPES.GROUP, groupId, {
      memberUserId: userId,
      newRole: role,
      previousRole: previousRole,
      actionPerformedBy: requestorUserId
    });

    res.json({
      success: true,
      message: 'Papel do membro atualizado com sucesso',
      data: updatedMember
    });
    
  } catch (error) {
    console.error('Erro ao atualizar membro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});


router.post('/:groupId/members/:userId/blockchain-transaction', authenticateToken, async (req, res) => {
  try {
    console.log('🔗 RECEBENDO TRANSAÇÃO BLOCKCHAIN:');
    console.log('📊 Params:', { groupId: req.params.groupId, userId: req.params.userId });
    console.log('📦 Body:', req.body);
    
    const { groupId, userId } = req.params;
    const { 
      transactionHash,
      contractName,
      methodName,
      gasUsed,
      gasPrice,
      blockNumber,
      network,
      newRole,
      previousRole
    } = req.body;
    const requestorUserId = req.user.id;
    
    console.log('👤 Usuário solicitante:', requestorUserId);
    
    
    const isScrumMaster = await GroupMemberService.isScrumMasterByUserId(groupId, requestorUserId);
    console.log('👑 É Scrum Master?', isScrumMaster);
    
    if (!isScrumMaster) {
      console.log('❌ Acesso negado - não é Scrum Master');
      return res.status(403).json({
        success: false,
        message: 'Apenas o Scrum Master pode registrar transações'
      });
    }

    
    console.log('🔍 Buscando endereço da carteira do solicitante...');
    const requestorQuery = await require('../config/database').query(
      'SELECT wallet_address FROM users WHERE id = $1',
      [requestorUserId]
    );
    
    const requestorAddress = requestorQuery.rows[0]?.wallet_address;
    console.log('🏠 Endereço da carteira:', requestorAddress);

    
    console.log('🔍 Buscando informações do membro afetado...');
    const memberQuery = await require('../config/database').query(
      'SELECT u.username, u.full_name FROM users u WHERE u.id = $1',
      [userId]
    );
    
    const memberInfo = memberQuery.rows[0];
    console.log('👤 Informações do membro:', memberInfo);

    const BlockchainTransactionService = require('../services/BlockchainTransactionService');
    
    const transactionData = {
      transactionHash,
      transactionType: 'MEMBER_ROLE_UPDATE',
      contractName: contractName || 'ScrumTeam',
      methodName: methodName || 'updateMemberRole',
      description: `Papel alterado de "${previousRole}" para "${newRole}" para ${memberInfo?.full_name || memberInfo?.username || 'membro'}`,
      userAddress: requestorAddress,
      userId: requestorUserId,
      teamId: parseInt(groupId),
      itemId: parseInt(userId),
      gasUsed: gasUsed ? parseInt(gasUsed) : null,
      gasPrice: gasPrice ? parseInt(gasPrice) : null,
      blockNumber: blockNumber ? parseInt(blockNumber) : null,
      network: network || 'localhost',
      status: 'confirmed'
    };
    
    console.log('💾 Dados da transação para salvar:', transactionData);
    
    
    const transaction = await BlockchainTransactionService.create(transactionData);
    console.log('✅ Transação salva no banco:', transaction);

    res.json({
      success: true,
      message: 'Transação blockchain registrada com sucesso',
      data: transaction
    });
    
  } catch (error) {
    console.error('❌ ERRO AO REGISTRAR TRANSAÇÃO BLOCKCHAIN:');
    console.error('📄 Stack:', error.stack);
    console.error('📝 Message:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});


router.delete('/:groupId/members/:userId', authenticateToken, async (req, res) => {
  try {
    console.log('🔴 INICIANDO REMOÇÃO DE MEMBRO:');
    console.log('👥 Grupo ID:', req.params.groupId);
    console.log('👤 Usuário a ser removido ID:', req.params.userId);
    console.log('👤 Usuário solicitante ID:', req.user.id);
    
    const { groupId, userId } = req.params;
    const requestorUserId = req.user.id;
    
    
    console.log('🔍 Verificando se usuário é Scrum Master...');
    const isScrumMaster = await GroupMemberService.isScrumMasterByUserId(groupId, requestorUserId);
    console.log('👑 É Scrum Master?', isScrumMaster);
    
    if (!isScrumMaster) {
      console.log('❌ Acesso negado - usuário não é Scrum Master');
      return res.status(403).json({
        success: false,
        message: 'Apenas o Scrum Master pode remover membros'
      });
    }
    
    console.log('🗑️ Removendo membro do grupo...');
    const removedMember = await GroupMemberService.removeMemberByUserId(groupId, userId);
    console.log('✅ Membro removido com sucesso:', removedMember);

    
    console.log('🔴 AVISO: A transação blockchain da remoção de membro deve ser registrada pelo frontend!');
    console.log('🔗 O frontend deve chamar uma rota específica para registrar a transação blockchain');

    
    const BlockchainTransactionService = require('../services/BlockchainTransactionService');
    
    console.log('🔗 Transação blockchain da remoção do membro será registrada quando a transação for executada no frontend');

    res.json({
      success: true,
      message: 'Membro removido com sucesso',
      data: removedMember
    });
    
  } catch (error) {
    console.error('❌ Erro ao remover membro:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});


router.post('/:groupId/members/:userId/remove/blockchain-transaction', authenticateToken, async (req, res) => {
  try {
    console.log('🔗 REGISTRANDO TRANSAÇÃO BLOCKCHAIN DE REMOÇÃO DE MEMBRO:');
    console.log('👥 Grupo ID:', req.params.groupId);
    console.log('👤 Usuário removido ID:', req.params.userId);
    console.log('📊 Dados da transação:', req.body);
    
    const { groupId, userId } = req.params;
    const { 
      transactionHash,
      contractName,
      methodName,
      gasUsed,
      gasPrice,
      blockNumber,
      network,
      memberName,
      memberRole
    } = req.body;
    const requestorUserId = req.user.id;
    
    console.log('👤 Usuário solicitante:', requestorUserId);
    
    
    const isScrumMaster = await GroupMemberService.isScrumMasterByUserId(groupId, requestorUserId);
    console.log('👑 É Scrum Master?', isScrumMaster);
    
    if (!isScrumMaster) {
      console.log('❌ Acesso negado - não é Scrum Master');
      return res.status(403).json({
        success: false,
        message: 'Apenas o Scrum Master pode registrar transações'
      });
    }

    if (!transactionHash) {
      console.log('❌ Hash da transação não fornecido');
      return res.status(400).json({
        success: false,
        message: 'Hash da transação é obrigatório'
      });
    }

    
    console.log('🔍 Buscando endereço da carteira do solicitante...');
    const requestorQuery = await require('../config/database').query(
      'SELECT wallet_address FROM users WHERE id = $1',
      [requestorUserId]
    );
    
    const requestorAddress = requestorQuery.rows[0]?.wallet_address;
    console.log('🏠 Endereço da carteira:', requestorAddress);

    
    let removedMemberInfo = memberName || 'membro';
    if (!memberName) {
      console.log('🔍 Buscando informações do membro removido...');
      const memberQuery = await require('../config/database').query(
        'SELECT u.username, u.full_name FROM users u WHERE u.id = $1',
        [userId]
      );
      
      if (memberQuery.rows.length > 0) {
        const memberData = memberQuery.rows[0];
        removedMemberInfo = memberData.full_name || memberData.username || 'membro';
      }
    }

    console.log('👤 Informações do membro removido:', removedMemberInfo);

    const BlockchainTransactionService = require('../services/BlockchainTransactionService');
    
    const transactionData = {
      transactionHash,
      transactionType: 'MEMBER_REMOVE',
      contractName: contractName || 'ScrumTeam',
      methodName: methodName || 'removeMember',
      description: `Membro "${removedMemberInfo}" (${memberRole || 'papel não especificado'}) removido da equipe`,
      userAddress: requestorAddress,
      userId: requestorUserId,
      teamId: parseInt(groupId),
      itemId: parseInt(userId),
      gasUsed: gasUsed ? parseInt(gasUsed) : null,
      gasPrice: gasPrice ? parseInt(gasPrice) : null,
      blockNumber: blockNumber ? parseInt(blockNumber) : null,
      network: network || 'localhost',
      status: 'confirmed'
    };
    
    console.log('💾 Dados da transação para salvar:', transactionData);
    
    
    const transaction = await BlockchainTransactionService.create(transactionData);
    console.log('✅ Transação de remoção salva no banco:', transaction);

    res.json({
      success: true,
      message: 'Transação blockchain de remoção registrada com sucesso',
      data: transaction
    });
    
  } catch (error) {
    console.error('❌ ERRO AO REGISTRAR TRANSAÇÃO BLOCKCHAIN DE REMOÇÃO:');
    console.error('📄 Stack:', error.stack);
    console.error('📝 Message:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});


router.post('/:groupId/members/:userId/add/blockchain-transaction', authenticateToken, async (req, res) => {
  try {
    console.log('🔗 REGISTRANDO TRANSAÇÃO BLOCKCHAIN DE ADIÇÃO DE MEMBRO:');
    console.log('👥 Grupo ID:', req.params.groupId);
    console.log('👤 Usuário adicionado ID:', req.params.userId);
    console.log('📊 Dados da transação:', req.body);
    
    const { groupId, userId } = req.params;
    const { 
      transactionHash,
      contractName,
      methodName,
      gasUsed,
      gasPrice,
      blockNumber,
      network,
      memberName,
      memberRole,
      memberEmail
    } = req.body;
    const requestorUserId = req.user.id;
    
    console.log('👤 Usuário solicitante:', requestorUserId);
    
    
    const isScrumMaster = await GroupMemberService.isScrumMasterByUserId(groupId, requestorUserId);
    console.log('👑 É Scrum Master?', isScrumMaster);
    
    if (!isScrumMaster) {
      console.log('❌ Acesso negado - não é Scrum Master');
      return res.status(403).json({
        success: false,
        message: 'Apenas o Scrum Master pode registrar transações'
      });
    }

    if (!transactionHash) {
      console.log('❌ Hash da transação não fornecido');
      return res.status(400).json({
        success: false,
        message: 'Hash da transação é obrigatório'
      });
    }

    
    console.log('🔍 Buscando endereço da carteira do solicitante...');
    const requestorQuery = await require('../config/database').query(
      'SELECT wallet_address FROM users WHERE id = $1',
      [requestorUserId]
    );
    
    const requestorAddress = requestorQuery.rows[0]?.wallet_address;
    console.log('🏠 Endereço da carteira:', requestorAddress);

    
    let addedMemberInfo = memberName || memberEmail || 'membro';
    if (!memberName && !memberEmail) {
      console.log('🔍 Buscando informações do membro adicionado...');
      const memberQuery = await require('../config/database').query(
        'SELECT u.username, u.full_name, u.email FROM users u WHERE u.id = $1',
        [userId]
      );
      
      if (memberQuery.rows.length > 0) {
        const memberData = memberQuery.rows[0];
        addedMemberInfo = memberData.full_name || memberData.username || memberData.email || 'membro';
      }
    }

    console.log('👤 Informações do membro adicionado:', addedMemberInfo);

    const BlockchainTransactionService = require('../services/BlockchainTransactionService');
    
    const transactionData = {
      transactionHash,
      transactionType: 'MEMBER_ADD',
      contractName: contractName || 'ScrumTeam',
      methodName: methodName || 'addMember',
      description: `Membro "${addedMemberInfo}" adicionado à equipe como ${memberRole || 'Developer'}`,
      userAddress: requestorAddress,
      userId: requestorUserId,
      teamId: parseInt(groupId),
      itemId: parseInt(userId),
      gasUsed: gasUsed ? parseInt(gasUsed) : null,
      gasPrice: gasPrice ? parseInt(gasPrice) : null,
      blockNumber: blockNumber ? parseInt(blockNumber) : null,
      network: network || 'localhost',
      status: 'confirmed'
    };
    
    console.log('💾 Dados da transação para salvar:', transactionData);
    
    
    const transaction = await BlockchainTransactionService.create(transactionData);
    console.log('✅ Transação de adição salva no banco:', transaction);

    res.json({
      success: true,
      message: 'Transação blockchain de adição registrada com sucesso',
      data: transaction
    });
    
  } catch (error) {
    console.error('❌ ERRO AO REGISTRAR TRANSAÇÃO BLOCKCHAIN DE ADIÇÃO:');
    console.error('📄 Stack:', error.stack);
    console.error('📝 Message:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});


router.post('/:id/join-request', authenticateToken, async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const userId = req.user.id;
    
    console.log(`🤝 Usuário ${userId} solicitando entrada na equipe ${groupId}`);
    
    
    const group = await GroupService.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Equipe não encontrada'
      });
    }
    
    
    const isAlreadyMember = await GroupMemberService.isMemberByUserId(groupId, userId);
    if (isAlreadyMember) {
      return res.status(400).json({
        success: false,
        message: 'Você já é membro desta equipe'
      });
    }
    
    
    
    const newMember = await GroupMemberService.addMember({
      groupId: parseInt(groupId),
      userId: userId,
      role: 'Developer'  
    });
    
    console.log('✅ Usuário adicionado à equipe com sucesso');
    
    res.json({
      success: true,
      message: 'Você foi adicionado à equipe com sucesso!',
      data: newMember
    });
    
  } catch (error) {
    console.error('❌ Erro ao processar solicitação de entrada:', error);
    
    
    if (error.message && error.message.includes('já é membro')) {
      return res.status(400).json({
        success: false,
        message: 'Você já é membro desta equipe'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});


router.get('/:groupId/history', authenticateToken, async (req, res) => {
  try {
    console.log('📊 BUSCANDO HISTÓRICO DA EQUIPE:');
    const { groupId } = req.params;
    const { limit = 100, offset = 0, transactionType, status } = req.query;
    const userId = req.user.id;
    
    console.log('📈 Parâmetros:', { groupId, limit, offset, transactionType, status, userId });
    
    
    console.log('🔍 Verificando se usuário é membro da equipe...');
    const isMember = await GroupMemberService.isMemberByUserId(groupId, userId);
    console.log('👤 É membro?', isMember);
    
    if (!isMember) {
      console.log('❌ Acesso negado - não é membro da equipe');
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para ver o histórico desta equipe'
      });
    }
    
    const BlockchainTransactionService = require('../services/BlockchainTransactionService');
    
    
    const filters = {
      limit: parseInt(limit),
      offset: parseInt(offset)
    };
    
    if (transactionType) {
      filters.transactionType = transactionType;
    }
    
    if (status) {
      filters.status = status;
    }
    
    console.log('🔧 Filtros aplicados:', filters);
    
    
    console.log('🔍 Buscando transações...');
    const transactions = await BlockchainTransactionService.findByTeam(groupId, filters);
    console.log('📊 Transações encontradas:', transactions.length);
    console.log('📝 Transações:', transactions);
    
    
    console.log('📈 Buscando estatísticas...');
    const stats = await BlockchainTransactionService.getStats({ teamId: groupId });
    console.log('📊 Estatísticas:', stats);
    
    res.json({
      success: true,
      data: {
        transactions,
        stats,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: parseInt(stats.total)
        }
      },
      message: 'Histórico de transações obtido com sucesso'
    });
  } catch (error) {
    console.error('Erro ao buscar histórico global da equipe:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});

module.exports = router;

