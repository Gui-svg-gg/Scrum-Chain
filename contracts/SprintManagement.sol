// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ScrumTeam.sol";

/**
 * @title SprintManagement
 * @dev Contrato para registro de sprints na blockchain
 * @notice Espelha a tabela 'sprints' do PostgreSQL
 */
contract SprintManagement {
    
    // Enums (iguais ao sistema atual)
    enum Status { Planning, Active, Completed, Cancelled }
    
    // Struct para registro de sprint na blockchain
    struct SprintRecord {
        uint256 sprintId;         // ID que corresponde ao PostgreSQL
        uint256 teamId;           // ID da equipe
        address createdBy;        // Criador do sprint
        Status status;            // Status atual
        uint256 startDate;        // Data de início (timestamp)
        uint256 endDate;          // Data de fim (timestamp)
        uint256 createdAt;        // Timestamp de criação
        uint256 updatedAt;        // Timestamp da última atualização
        bytes32 dataHash;         // Hash dos dados no PostgreSQL
    }
    
    // State Variables
    mapping(uint256 => SprintRecord) public sprints;             // sprintId => SprintRecord
    mapping(uint256 => uint256[]) public teamSprints;            // teamId => sprintIds
    mapping(uint256 => mapping(Status => uint256)) public statusCount; // teamId => status => count
    
    uint256 public nextSprintId;
    
    ScrumTeam public scrumTeamContract;
    
    // Events (espelham as operações do PostgreSQL)
    event SprintRegistered(
        uint256 indexed sprintId,
        uint256 indexed teamId,
        address indexed createdBy,
        uint256 startDate,
        uint256 endDate,
        bytes32 dataHash,
        uint256 timestamp
    );
    
    event SprintStatusChanged(
        uint256 indexed sprintId,
        Status oldStatus,
        Status newStatus,
        address changedBy,
        uint256 timestamp
    );
    
    event SprintDataUpdated(
        uint256 indexed sprintId,
        bytes32 oldHash,
        bytes32 newHash,
        uint256 timestamp
    );
    
    event SprintRemoved(
        uint256 indexed sprintId,
        uint256 timestamp
    );
    
    // Modifiers
    modifier sprintExists(uint256 _sprintId) {
        require(_sprintId > 0 && _sprintId < nextSprintId, "Sprint does not exist");
        require(sprints[_sprintId].status != Status.Cancelled, "Sprint is cancelled");
        _;
    }
    
    modifier onlyTeamMember(uint256 _teamId) {
        require(
            scrumTeamContract.isMember(_teamId, msg.sender),
            "Only team members can perform this action"
        );
        _;
    }
    
    modifier onlySprintCreatorOrTeamLeader(uint256 _sprintId) {
        SprintRecord memory sprint = sprints[_sprintId];
        require(
            sprint.createdBy == msg.sender || 
            scrumTeamContract.isMember(sprint.teamId, msg.sender),
            "Only sprint creator or team member can perform this action"
        );
        _;
    }

    modifier onlyScrumMasterOrProductOwner(uint256 _teamId) {
        // Verifica se é membro da equipe
        require(
            scrumTeamContract.isMember(_teamId, msg.sender),
            "Only team members can perform this action"
        );
        
        // Obtém o papel do membro
        (ScrumTeam.Role role,,,) = scrumTeamContract.getMemberInfo(_teamId, msg.sender);
        
        // Permite apenas Scrum Master ou Product Owner
        require(
            role == ScrumTeam.Role.ScrumMaster || role == ScrumTeam.Role.ProductOwner,
            "Only Scrum Master or Product Owner can perform this action"
        );
        _;
    }
    
    // Constructor
    constructor(address _scrumTeamContract) {
        scrumTeamContract = ScrumTeam(_scrumTeamContract);
        nextSprintId = 1;
    }
    
    /**
     * @dev Registra um novo sprint na blockchain
     * @param _teamId ID da equipe
     * @param _startDate Data de início do sprint
     * @param _endDate Data de fim do sprint
     * @param _dataHash Hash dos dados do sprint no PostgreSQL
     * @return sprintId ID do sprint registrado
     */
    function registerSprint(
        uint256 _teamId,
        uint256 _startDate,
        uint256 _endDate,
        bytes32 _dataHash
    )
        external
        onlyTeamMember(_teamId)
        returns (uint256)
    {
        require(_dataHash != bytes32(0), "Data hash cannot be empty");
        require(scrumTeamContract.isTeamActive(_teamId), "Team is not active");
        require(_startDate < _endDate, "Start date must be before end date");
        // Removida a validação de data no passado para permitir mais flexibilidade
        
        uint256 sprintId = nextSprintId;
        
        sprints[sprintId] = SprintRecord({
            sprintId: sprintId,
            teamId: _teamId,
            createdBy: msg.sender,
            status: Status.Planning,
            startDate: _startDate,
            endDate: _endDate,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            dataHash: _dataHash
        });
        
        // Adicionar à lista da equipe
        teamSprints[_teamId].push(sprintId);
        
        // Atualizar contadores
        statusCount[_teamId][Status.Planning]++;
        
        nextSprintId++;
        
        emit SprintRegistered(sprintId, _teamId, msg.sender, _startDate, _endDate, _dataHash, block.timestamp);
        
        return sprintId;
    }
    
    /**
     * @dev Atualiza o status de um sprint
     * @param _sprintId ID do sprint
     * @param _newStatus Novo status
     */
    function updateSprintStatus(
        uint256 _sprintId,
        Status _newStatus
    )
        external
        sprintExists(_sprintId)
    {
        SprintRecord storage sprint = sprints[_sprintId];
        
        // Verificar se é membro da equipe - qualquer membro pode alterar status
        uint256 teamId = sprint.teamId;
        require(
            scrumTeamContract.isMember(teamId, msg.sender),
            "Only team members can perform this action"
        );
        
        Status oldStatus = sprint.status;
        
        require(oldStatus != _newStatus, "Status is already set to this value");
        
        // Validações básicas de transição - removidas restrições rígidas
        // Permite qualquer transição exceto para sprints cancelados
        require(_newStatus != Status.Cancelled || oldStatus == Status.Planning, 
               "Can only cancel sprints in planning phase");
        
        // Atualizar contadores
        statusCount[sprint.teamId][oldStatus]--;
        statusCount[sprint.teamId][_newStatus]++;
        
        sprint.status = _newStatus;
        sprint.updatedAt = block.timestamp;
        
        emit SprintStatusChanged(_sprintId, oldStatus, _newStatus, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Atualiza o hash dos dados de um sprint
     * @param _sprintId ID do sprint
     * @param _newDataHash Novo hash dos dados
     */
    function updateSprintDataHash(
        uint256 _sprintId,
        bytes32 _newDataHash
    )
        external
        sprintExists(_sprintId)
    {
        require(_newDataHash != bytes32(0), "Data hash cannot be empty");
        
        SprintRecord storage sprint = sprints[_sprintId];
        
        // Verificar se é membro da equipe - qualquer membro pode atualizar
        uint256 teamId = sprint.teamId;
        require(
            scrumTeamContract.isMember(teamId, msg.sender),
            "Only team members can perform this action"
        );
        
        bytes32 oldHash = sprint.dataHash;
        
        sprint.dataHash = _newDataHash;
        sprint.updatedAt = block.timestamp;
        
        emit SprintDataUpdated(_sprintId, oldHash, _newDataHash, block.timestamp);
    }
    
    /**
     * @dev Remove (cancela) um sprint
     * @param _sprintId ID do sprint
     */
    function removeSprint(uint256 _sprintId)
        external
        sprintExists(_sprintId)
    {
        SprintRecord storage sprint = sprints[_sprintId];
        
        // Verificar se é membro da equipe - qualquer membro pode deletar
        uint256 teamId = sprint.teamId;
        require(
            scrumTeamContract.isMember(teamId, msg.sender),
            "Only team members can perform this action"
        );
        
        // Não permite deletar sprints ativos
        require(
            sprint.status != Status.Active,
            "Cannot delete active sprints"
        );
        
        Status oldStatus = sprint.status;
        
        // Atualizar contadores
        statusCount[sprint.teamId][oldStatus]--;
        
        sprint.status = Status.Cancelled;
        sprint.updatedAt = block.timestamp;
        
        emit SprintRemoved(_sprintId, block.timestamp);
    }
    
    // View Functions
    
    /**
     * @dev Retorna informações de um sprint
     * @param _sprintId ID do sprint
     */
    function getSprintInfo(uint256 _sprintId)
        external
        view
        returns (
            uint256 teamId,
            address createdBy,
            Status status,
            uint256 startDate,
            uint256 endDate,
            uint256 createdAt,
            uint256 updatedAt,
            bytes32 dataHash
        )
    {
        require(_sprintId > 0 && _sprintId < nextSprintId, "Sprint does not exist");
        
        SprintRecord memory sprint = sprints[_sprintId];
        return (
            sprint.teamId,
            sprint.createdBy,
            sprint.status,
            sprint.startDate,
            sprint.endDate,
            sprint.createdAt,
            sprint.updatedAt,
            sprint.dataHash
        );
    }
    
    /**
     * @dev Retorna todos os sprints de uma equipe
     * @param _teamId ID da equipe
     */
    function getTeamSprints(uint256 _teamId)
        external
        view
        returns (uint256[] memory)
    {
        return teamSprints[_teamId];
    }
    
    /**
     * @dev Retorna contadores de status para uma equipe
     * @param _teamId ID da equipe
     */
    function getTeamStatusCounts(uint256 _teamId)
        external
        view
        returns (
            uint256 planningCount,
            uint256 activeCount,
            uint256 completedCount,
            uint256 cancelledCount
        )
    {
        return (
            statusCount[_teamId][Status.Planning],
            statusCount[_teamId][Status.Active],
            statusCount[_teamId][Status.Completed],
            statusCount[_teamId][Status.Cancelled]
        );
    }
    
    /**
     * @dev Retorna sprints por status
     * @param _teamId ID da equipe
     * @param _status Status desejado
     */
    function getSprintsByStatus(uint256 _teamId, Status _status)
        external
        view
        returns (uint256[] memory)
    {
        uint256[] memory allSprints = teamSprints[_teamId];
        uint256[] memory filteredSprints = new uint256[](statusCount[_teamId][_status]);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allSprints.length; i++) {
            if (sprints[allSprints[i]].status == _status) {
                filteredSprints[index] = allSprints[i];
                index++;
            }
        }
        
        return filteredSprints;
    }
    
    /**
     * @dev Verifica se um sprint existe e está ativo
     * @param _sprintId ID do sprint
     */
    function isSprintActive(uint256 _sprintId)
        external
        view
        returns (bool)
    {
        return _sprintId > 0 && _sprintId < nextSprintId && sprints[_sprintId].status != Status.Cancelled;
    }
    
    /**
     * @dev Retorna o número total de sprints de uma equipe
     * @param _teamId ID da equipe
     */
    function getTeamSprintCount(uint256 _teamId)
        external
        view
        returns (uint256)
    {
        return teamSprints[_teamId].length;
    }
    
    /**
     * @dev Retorna o sprint ativo atual de uma equipe (se houver)
     * @param _teamId ID da equipe
     */
    function getCurrentActiveSprint(uint256 _teamId)
        external
        view
        returns (uint256)
    {
        uint256[] memory allSprints = teamSprints[_teamId];
        
        for (uint256 i = 0; i < allSprints.length; i++) {
            if (sprints[allSprints[i]].status == Status.Active) {
                return allSprints[i];
            }
        }
        
        return 0; // Nenhum sprint ativo encontrado
    }
}
