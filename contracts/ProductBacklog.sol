// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ScrumTeam.sol";

/**
 * @title ProductBacklog
 * @dev Contrato para registro de backlog items na blockchain
 * @notice Espelha a tabela 'backlog_items' do PostgreSQL
 */
contract ProductBacklog {
    
    // Enums (iguais ao sistema atual)
    enum Priority { Low, Medium, High, Critical }
    enum Status { Todo, InProgress, Done, Cancelled }
    
    // Struct para registro de backlog item na blockchain
    struct BacklogItemRecord {
        uint256 itemId;           // ID que corresponde ao PostgreSQL
        uint256 teamId;           // ID da equipe
        address createdBy;        // Criador do item
        Priority priority;        // Prioridade
        Status status;            // Status atual
        uint256 createdAt;        // Timestamp de criação
        uint256 updatedAt;        // Timestamp da última atualização
        bytes32 dataHash;         // Hash dos dados no PostgreSQL
    }
    
    // State Variables
    mapping(uint256 => BacklogItemRecord) public backlogItems;    // itemId => BacklogItemRecord
    mapping(uint256 => uint256[]) public teamBacklog;             // teamId => itemIds
    mapping(uint256 => mapping(Status => uint256)) public statusCount; // teamId => status => count
    
    uint256 public nextItemId;
    
    ScrumTeam public scrumTeamContract;
    
    // Events (espelham as operações do PostgreSQL)
    event BacklogItemRegistered(
        uint256 indexed itemId,
        uint256 indexed teamId,
        address indexed createdBy,
        Priority priority,
        bytes32 dataHash,
        uint256 timestamp
    );
    
    event BacklogItemStatusChanged(
        uint256 indexed itemId,
        Status oldStatus,
        Status newStatus,
        address changedBy,
        uint256 timestamp
    );
    
    event BacklogItemDataUpdated(
        uint256 indexed itemId,
        bytes32 oldHash,
        bytes32 newHash,
        uint256 timestamp
    );
    
    event BacklogItemRemoved(
        uint256 indexed itemId,
        uint256 timestamp
    );
    
    // Modifiers
    modifier itemExists(uint256 _itemId) {
        require(_itemId > 0 && _itemId < nextItemId, "Backlog item does not exist");
        require(backlogItems[_itemId].status != Status.Cancelled, "Backlog item is cancelled");
        _;
    }
    
    modifier onlyTeamMember(uint256 _teamId) {
        require(
            scrumTeamContract.isMember(_teamId, msg.sender),
            "Only team members can perform this action"
        );
        _;
    }
    
    modifier onlyItemCreatorOrTeamLeader(uint256 _itemId) {
        BacklogItemRecord memory item = backlogItems[_itemId];
        require(
            item.createdBy == msg.sender || 
            scrumTeamContract.getUserTeam(msg.sender) == item.teamId,
            "Only item creator or team member can perform this action"
        );
        _;
    }

    modifier onlyProductOwnerOrScrumMaster(uint256 _teamId) {
        // Verifica se é membro da equipe
        require(
            scrumTeamContract.isMember(_teamId, msg.sender),
            "Only team members can perform this action"
        );
        
        // Obtém o papel do membro
        (ScrumTeam.Role role,,,) = scrumTeamContract.getMemberInfo(_teamId, msg.sender);
        
        // Permite apenas Product Owner (para tudo) ou Scrum Master (apenas para status)
        require(
            role == ScrumTeam.Role.ProductOwner || role == ScrumTeam.Role.ScrumMaster,
            "Only Product Owner or Scrum Master can perform this action"
        );
        _;
    }

    modifier onlyProductOwner(uint256 _teamId) {
        // Verifica se é membro da equipe
        require(
            scrumTeamContract.isMember(_teamId, msg.sender),
            "Only team members can perform this action"
        );
        
        // Obtém o papel do membro
        (ScrumTeam.Role role,,,) = scrumTeamContract.getMemberInfo(_teamId, msg.sender);
        
        // Permite apenas Product Owner
        require(
            role == ScrumTeam.Role.ProductOwner,
            "Only Product Owner can perform this action"
        );
        _;
    }
    
    // Constructor
    constructor(address _scrumTeamContract) {
        scrumTeamContract = ScrumTeam(_scrumTeamContract);
        nextItemId = 1;
    }
    
    /**
     * @dev Registra um novo item de backlog na blockchain
     * @param _teamId ID da equipe
     * @param _priority Prioridade do item
     * @param _dataHash Hash dos dados do item no PostgreSQL
     * @return itemId ID do item registrado
     */
    function registerBacklogItem(
        uint256 _teamId,
        Priority _priority,
        bytes32 _dataHash
    )
        external
        onlyProductOwner(_teamId)
        returns (uint256)
    {
        require(_dataHash != bytes32(0), "Data hash cannot be empty");
        require(scrumTeamContract.isTeamActive(_teamId), "Team is not active");
        
        uint256 itemId = nextItemId;
        
        backlogItems[itemId] = BacklogItemRecord({
            itemId: itemId,
            teamId: _teamId,
            createdBy: msg.sender,
            priority: _priority,
            status: Status.Todo,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            dataHash: _dataHash
        });
        
        // Adicionar à lista da equipe
        teamBacklog[_teamId].push(itemId);
        
        // Atualizar contadores
        statusCount[_teamId][Status.Todo]++;
        
        nextItemId++;
        
        emit BacklogItemRegistered(itemId, _teamId, msg.sender, _priority, _dataHash, block.timestamp);
        
        return itemId;
    }
    
    /**
     * @dev Atualiza o status de um item de backlog
     * @param _itemId ID do item
     * @param _newStatus Novo status
     */
    function updateItemStatus(
        uint256 _itemId,
        Status _newStatus
    )
        external
        itemExists(_itemId)
    {
        BacklogItemRecord storage item = backlogItems[_itemId];
        
        // Verificar permissões específicas para status
        uint256 teamId = item.teamId;
        require(
            scrumTeamContract.isMember(teamId, msg.sender),
            "Only team members can perform this action"
        );
        
        (ScrumTeam.Role role,,,) = scrumTeamContract.getMemberInfo(teamId, msg.sender);
        require(
            role == ScrumTeam.Role.ProductOwner || role == ScrumTeam.Role.ScrumMaster,
            "Only Product Owner or Scrum Master can change status"
        );
        
        Status oldStatus = item.status;
        
        require(oldStatus != _newStatus, "Status is already set to this value");
        
        // Atualizar contadores
        statusCount[item.teamId][oldStatus]--;
        statusCount[item.teamId][_newStatus]++;
        
        item.status = _newStatus;
        item.updatedAt = block.timestamp;
        
        emit BacklogItemStatusChanged(_itemId, oldStatus, _newStatus, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Atualiza o hash dos dados de um item
     * @param _itemId ID do item
     * @param _newDataHash Novo hash dos dados
     */
    function updateItemDataHash(
        uint256 _itemId,
        bytes32 _newDataHash
    )
        external
        itemExists(_itemId)
    {
        require(_newDataHash != bytes32(0), "Data hash cannot be empty");
        
        BacklogItemRecord storage item = backlogItems[_itemId];
        
        // Verificar se é Product Owner
        uint256 teamId = item.teamId;
        require(
            scrumTeamContract.isMember(teamId, msg.sender),
            "Only team members can perform this action"
        );
        
        (ScrumTeam.Role role,,,) = scrumTeamContract.getMemberInfo(teamId, msg.sender);
        require(
            role == ScrumTeam.Role.ProductOwner,
            "Only Product Owner can update item data"
        );
        
        bytes32 oldHash = item.dataHash;
        
        item.dataHash = _newDataHash;
        item.updatedAt = block.timestamp;
        
        emit BacklogItemDataUpdated(_itemId, oldHash, _newDataHash, block.timestamp);
    }
    
    /**
     * @dev Remove (cancela) um item de backlog
     * @param _itemId ID do item
     */
    function removeBacklogItem(uint256 _itemId)
        external
        itemExists(_itemId)
    {
        BacklogItemRecord storage item = backlogItems[_itemId];
        
        // Verificar se é Product Owner
        uint256 teamId = item.teamId;
        require(
            scrumTeamContract.isMember(teamId, msg.sender),
            "Only team members can perform this action"
        );
        
        (ScrumTeam.Role role,,,) = scrumTeamContract.getMemberInfo(teamId, msg.sender);
        require(
            role == ScrumTeam.Role.ProductOwner,
            "Only Product Owner can remove items"
        );
        
        Status oldStatus = item.status;
        
        // Atualizar contadores
        statusCount[item.teamId][oldStatus]--;
        
        item.status = Status.Cancelled;
        item.updatedAt = block.timestamp;
        
        emit BacklogItemRemoved(_itemId, block.timestamp);
    }
    
    // View Functions
    
    /**
     * @dev Retorna informações de um item de backlog
     * @param _itemId ID do item
     */
    function getBacklogItemInfo(uint256 _itemId)
        external
        view
        returns (
            uint256 teamId,
            address createdBy,
            Priority priority,
            Status status,
            uint256 createdAt,
            uint256 updatedAt,
            bytes32 dataHash
        )
    {
        require(_itemId > 0 && _itemId < nextItemId, "Backlog item does not exist");
        
        BacklogItemRecord memory item = backlogItems[_itemId];
        return (
            item.teamId,
            item.createdBy,
            item.priority,
            item.status,
            item.createdAt,
            item.updatedAt,
            item.dataHash
        );
    }
    
    /**
     * @dev Retorna todos os itens de backlog de uma equipe
     * @param _teamId ID da equipe
     */
    function getTeamBacklogItems(uint256 _teamId)
        external
        view
        returns (uint256[] memory)
    {
        return teamBacklog[_teamId];
    }
    
    /**
     * @dev Retorna contadores de status para uma equipe
     * @param _teamId ID da equipe
     */
    function getTeamStatusCounts(uint256 _teamId)
        external
        view
        returns (
            uint256 todoCount,
            uint256 inProgressCount,
            uint256 doneCount,
            uint256 cancelledCount
        )
    {
        return (
            statusCount[_teamId][Status.Todo],
            statusCount[_teamId][Status.InProgress],
            statusCount[_teamId][Status.Done],
            statusCount[_teamId][Status.Cancelled]
        );
    }
    
    /**
     * @dev Retorna itens de backlog por status
     * @param _teamId ID da equipe
     * @param _status Status desejado
     */
    function getItemsByStatus(uint256 _teamId, Status _status)
        external
        view
        returns (uint256[] memory)
    {
        uint256[] memory allItems = teamBacklog[_teamId];
        uint256[] memory filteredItems = new uint256[](statusCount[_teamId][_status]);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allItems.length; i++) {
            if (backlogItems[allItems[i]].status == _status) {
                filteredItems[index] = allItems[i];
                index++;
            }
        }
        
        return filteredItems;
    }
    
    /**
     * @dev Verifica se um item existe e está ativo
     * @param _itemId ID do item
     */
    function isItemActive(uint256 _itemId)
        external
        view
        returns (bool)
    {
        return _itemId > 0 && _itemId < nextItemId && backlogItems[_itemId].status != Status.Cancelled;
    }
    
    /**
     * @dev Retorna o número total de itens de uma equipe
     * @param _teamId ID da equipe
     */
    function getTeamItemCount(uint256 _teamId)
        external
        view
        returns (uint256)
    {
        return teamBacklog[_teamId].length;
    }
}
