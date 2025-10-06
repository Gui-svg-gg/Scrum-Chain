// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ScrumTeam
 * @dev Contrato para registro de equipes Scrum na blockchain
 * @notice Espelha as tabelas 'groups' e 'group_members' do PostgreSQL
 */
contract ScrumTeam {
    
    // Enums para roles (iguais ao sistema atual)
    enum Role { Developer, ScrumMaster, ProductOwner, Stakeholder }
    
    // Struct para registro de equipe na blockchain
    struct TeamRecord {
        uint256 teamId;           // ID que corresponde ao PostgreSQL
        address creator;          // Criador da equipe
        uint256 createdAt;        // Timestamp de criação
        bool isActive;            // Status ativo/inativo
        bytes32 dataHash;         // Hash dos dados no PostgreSQL
    }
    
    // Struct para registro de membro na blockchain
    struct MemberRecord {
        uint256 teamId;           // ID da equipe
        address memberAddress;    // Endereço do membro
        Role role;                // Papel do membro
        uint256 joinedAt;         // Timestamp de entrada
        bool isActive;            // Status do membro
        bytes32 dataHash;         // Hash dos dados no PostgreSQL
    }
    
    // State Variables
    mapping(uint256 => TeamRecord) public teams;              // teamId => TeamRecord
    mapping(uint256 => address[]) public teamMembers;         // teamId => addresses
    mapping(address => uint256) public userTeam;              // address => teamId
    mapping(uint256 => mapping(address => MemberRecord)) public memberRecords; // teamId => address => MemberRecord
    
    uint256 public nextTeamId;
    
    // Events (espelham as operações do PostgreSQL)
    event TeamRegistered(
        uint256 indexed teamId,
        address indexed creator,
        bytes32 dataHash,
        uint256 timestamp
    );
    
    event MemberAdded(
        uint256 indexed teamId,
        address indexed member,
        Role role,
        bytes32 dataHash,
        uint256 timestamp
    );
    
    event MemberRemoved(
        uint256 indexed teamId,
        address indexed member,
        uint256 timestamp
    );
    
    event TeamDeactivated(
        uint256 indexed teamId,
        uint256 timestamp
    );
    
    event DataHashUpdated(
        uint256 indexed teamId,
        bytes32 oldHash,
        bytes32 newHash,
        uint256 timestamp
    );
    
    event MemberRoleUpdated(
        uint256 indexed teamId,
        address indexed member,
        Role oldRole,
        Role newRole,
        uint256 timestamp
    );
    
    // Modifiers
    modifier teamExists(uint256 _teamId) {
        require(_teamId > 0 && _teamId < nextTeamId, "Team does not exist");
        require(teams[_teamId].isActive, "Team is not active");
        _;
    }
    

    modifier onlyScrumMasterOrCreator(uint256 _teamId) {
        address creator = teams[_teamId].creator;
        MemberRecord storage member = memberRecords[_teamId][msg.sender];
        bool isScrumMaster = member.role == Role.ScrumMaster && member.isActive;
        require(msg.sender == creator || isScrumMaster, "Only team creator or Scrum Master can perform this action");
        _;
    }
    
    modifier onlyTeamMember(uint256 _teamId) {
        require(isMember(_teamId, msg.sender), "Only team members can perform this action");
        _;
    }
    
    // Constructor
    constructor() {
        nextTeamId = 1;
    }
    
    /**
     * @dev Registra uma nova equipe na blockchain
     * @param _dataHash Hash dos dados da equipe no PostgreSQL
     * @return teamId ID da equipe registrada
     */
    function registerTeam(bytes32 _dataHash) 
        external 
        returns (uint256) 
    {
        require(_dataHash != bytes32(0), "Data hash cannot be empty");
        require(userTeam[msg.sender] == 0, "User already belongs to a team");
        
        uint256 teamId = nextTeamId;
        
        teams[teamId] = TeamRecord({
            teamId: teamId,
            creator: msg.sender,
            createdAt: block.timestamp,
            isActive: true,
            dataHash: _dataHash
        });
        
        // Adicionar criador como Product Owner
        memberRecords[teamId][msg.sender] = MemberRecord({
            teamId: teamId,
            memberAddress: msg.sender,
            role: Role.ProductOwner,
            joinedAt: block.timestamp,
            isActive: true,
            dataHash: _dataHash
        });
        
        teamMembers[teamId].push(msg.sender);
        userTeam[msg.sender] = teamId;
        
        nextTeamId++;
        
        emit TeamRegistered(teamId, msg.sender, _dataHash, block.timestamp);
        emit MemberAdded(teamId, msg.sender, Role.ProductOwner, _dataHash, block.timestamp);
        
        return teamId;
    }
    
    /**
     * @dev Adiciona um membro à equipe
     * @param _teamId ID da equipe
     * @param _member Endereço do novo membro
     * @param _role Papel do membro
     * @param _dataHash Hash dos dados do membro no PostgreSQL
     */
    function addMember(
        uint256 _teamId,
        address _member,
        Role _role,
        bytes32 _dataHash
    )
        external
        teamExists(_teamId)
    onlyScrumMasterOrCreator(_teamId)
    {
        require(_member != address(0), "Invalid member address");
        require(_dataHash != bytes32(0), "Data hash cannot be empty");
        require(userTeam[_member] == 0, "User already belongs to a team");
        require(!isMember(_teamId, _member), "User is already a team member");
        
        memberRecords[_teamId][_member] = MemberRecord({
            teamId: _teamId,
            memberAddress: _member,
            role: _role,
            joinedAt: block.timestamp,
            isActive: true,
            dataHash: _dataHash
        });
        
        teamMembers[_teamId].push(_member);
        userTeam[_member] = _teamId;
        
        emit MemberAdded(_teamId, _member, _role, _dataHash, block.timestamp);
    }
    
    /**
     * @dev Remove um membro da equipe
     * @param _teamId ID da equipe
     * @param _member Endereço do membro a ser removido
     */
    function removeMember(
        uint256 _teamId,
        address _member
    )
        external
        teamExists(_teamId)
    onlyScrumMasterOrCreator(_teamId)
    {
        require(_member != teams[_teamId].creator, "Cannot remove team creator");
        require(isMember(_teamId, _member), "User is not a team member");
        
        // Desativar registro do membro
        memberRecords[_teamId][_member].isActive = false;
        
        // Remover da lista de membros
        address[] storage members = teamMembers[_teamId];
        for (uint i = 0; i < members.length; i++) {
            if (members[i] == _member) {
                members[i] = members[members.length - 1];
                members.pop();
                break;
            }
        }
        
        userTeam[_member] = 0;
        
        emit MemberRemoved(_teamId, _member, block.timestamp);
    }
    
    /**
     * @dev Atualiza o papel de um membro da equipe
     * @param _teamId ID da equipe
     * @param _member Endereço do membro
     * @param _newRole Novo papel do membro
     */
    function updateMemberRole(
        uint256 _teamId,
        address _member,
        Role _newRole
    )
        external
        teamExists(_teamId)
        onlyScrumMasterOrCreator(_teamId)
    {
        require(_member != address(0), "Invalid member address");
        require(isMember(_teamId, _member), "User is not a team member");
        require(_member != teams[_teamId].creator || _newRole == Role.ProductOwner, 
                "Team creator must remain as Product Owner");

        Role oldRole = memberRecords[_teamId][_member].role;
        require(oldRole != _newRole, "Member already has this role");

        // Atualizar o papel do membro
        memberRecords[_teamId][_member].role = _newRole;

        emit MemberRoleUpdated(_teamId, _member, oldRole, _newRole, block.timestamp);
    }
    
    /**
     * @dev Atualiza o hash dos dados de uma equipe
     * @param _teamId ID da equipe
     * @param _newDataHash Novo hash dos dados
     */
    function updateTeamDataHash(
        uint256 _teamId,
        bytes32 _newDataHash
    )
        external
        teamExists(_teamId)
    onlyScrumMasterOrCreator(_teamId)
    {
        require(_newDataHash != bytes32(0), "Data hash cannot be empty");
        
        bytes32 oldHash = teams[_teamId].dataHash;
        teams[_teamId].dataHash = _newDataHash;
        
        emit DataHashUpdated(_teamId, oldHash, _newDataHash, block.timestamp);
    }
    
    /**
     * @dev Desativa uma equipe
     * @param _teamId ID da equipe
     */
    function deactivateTeam(uint256 _teamId)
        external
        teamExists(_teamId)
    onlyScrumMasterOrCreator(_teamId)
    {
        teams[_teamId].isActive = false;
        
        // Desativar todos os membros
        address[] memory members = teamMembers[_teamId];
        for (uint i = 0; i < members.length; i++) {
            memberRecords[_teamId][members[i]].isActive = false;
            userTeam[members[i]] = 0;
        }
        
        emit TeamDeactivated(_teamId, block.timestamp);
    }
    
    // View Functions
    
    /**
     * @dev Verifica se um endereço é membro da equipe
     * @param _teamId ID da equipe
     * @param _member Endereço do membro
     */
    function isMember(uint256 _teamId, address _member) 
        public 
        view 
        returns (bool) 
    {
        return memberRecords[_teamId][_member].isActive;
    }
    
    /**
     * @dev Retorna informações básicas de uma equipe
     * @param _teamId ID da equipe
     */
    function getTeamInfo(uint256 _teamId)
        external
        view
        teamExists(_teamId)
        returns (
            address creator,
            uint256 createdAt,
            bool isActive,
            bytes32 dataHash,
            uint256 memberCount
        )
    {
        TeamRecord memory team = teams[_teamId];
        return (
            team.creator,
            team.createdAt,
            team.isActive,
            team.dataHash,
            teamMembers[_teamId].length
        );
    }
    
    /**
     * @dev Retorna a lista de membros de uma equipe
     * @param _teamId ID da equipe
     */
    function getTeamMembers(uint256 _teamId)
        external
        view
        teamExists(_teamId)
        returns (address[] memory)
    {
        return teamMembers[_teamId];
    }
    
    /**
     * @dev Retorna informações de um membro
     * @param _teamId ID da equipe
     * @param _member Endereço do membro
     */
    function getMemberInfo(uint256 _teamId, address _member)
        external
        view
        teamExists(_teamId)
        returns (
            Role role,
            uint256 joinedAt,
            bool isActive,
            bytes32 dataHash
        )
    {
        MemberRecord memory member = memberRecords[_teamId][_member];
        require(member.memberAddress != address(0), "Member not found");
        
        return (
            member.role,
            member.joinedAt,
            member.isActive,
            member.dataHash
        );
    }
    
    /**
     * @dev Retorna a equipe de um usuário
     * @param _user Endereço do usuário
     */
    function getUserTeam(address _user)
        external
        view
        returns (uint256)
    {
        return userTeam[_user];
    }
    
    /**
     * @dev Verifica se uma equipe existe e está ativa
     * @param _teamId ID da equipe
     */
    function isTeamActive(uint256 _teamId)
        external
        view
        returns (bool)
    {
        return _teamId > 0 && _teamId < nextTeamId && teams[_teamId].isActive;
    }
}
