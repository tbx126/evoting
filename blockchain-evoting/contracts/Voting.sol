// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IVoterRegistry - 选民注册合约接口
 */
interface IVoterRegistry {
    function isRegistered(address _voter) external view returns (bool);
    function hasVoted(address _voter) external view returns (bool);
    function markAsVoted(address _voter) external;
}

/**
 * @title Voting - 主投票合约
 * @notice 管理选举创建、投票提交和结果统计
 * @dev 支持加密投票承诺，与 VoterRegistry 配合使用
 */
contract Voting {
    // ============ 状态变量 ============

    /// @notice 合约管理员
    address public admin;

    /// @notice 选民注册合约地址
    address public voterRegistry;

    /// @notice 选举计数器
    uint256 public electionCount;

    /// @notice 选举状态枚举
    enum ElectionStatus {
        Created,    // 已创建
        Active,     // 进行中
        Ended,      // 已结束
        Tallied     // 已计票
    }

    /// @notice 候选人结构体
    struct Candidate {
        uint256 id;         // 候选人ID
        string name;        // 候选人名称
        uint256 voteCount;  // 得票数
    }

    /// @notice 选举结构体
    struct Election {
        uint256 id;                 // 选举ID
        string title;               // 选举标题
        string description;         // 选举描述
        uint256 startTime;          // 开始时间
        uint256 endTime;            // 结束时间
        ElectionStatus status;      // 当前状态
        uint256 candidateCount;     // 候选人数量
        uint256 totalVotes;         // 总投票数
        bytes32 merkleRoot;         // Merkle根哈希
    }

    /// @notice 投票记录结构体
    struct VoteRecord {
        bytes32 commitment;     // 投票承诺哈希
        uint256 timestamp;      // 投票时间
        bool revealed;          // 是否已揭示
    }

    // ============ 映射 ============

    /// @notice 选举ID => 选举信息
    mapping(uint256 => Election) public elections;

    /// @notice 选举ID => 候选人ID => 候选人信息
    mapping(uint256 => mapping(uint256 => Candidate)) public candidates;

    /// @notice 选举ID => 选民地址 => 投票记录
    mapping(uint256 => mapping(address => VoteRecord)) public voteRecords;

    /// @notice 选举ID => 所有投票承诺数组
    mapping(uint256 => bytes32[]) public commitments;

    // ============ 事件 ============

    event ElectionCreated(uint256 indexed id, string title);
    event CandidateAdded(uint256 indexed electionId, uint256 candidateId);
    event VoteCast(uint256 indexed electionId, address indexed voter);
    event VoteRevealed(uint256 indexed electionId, address indexed voter);
    event ElectionStatusChanged(uint256 indexed id, ElectionStatus status);
    event MerkleRootUpdated(uint256 indexed electionId, bytes32 root);

    // ============ 修饰符 ============

    modifier onlyAdmin() {
        require(msg.sender == admin, "Voting: not admin");
        _;
    }

    modifier electionExists(uint256 _electionId) {
        require(_electionId < electionCount, "Voting: election not found");
        _;
    }

    modifier electionActive(uint256 _electionId) {
        Election storage e = elections[_electionId];
        require(e.status == ElectionStatus.Active, "Voting: not active");
        require(block.timestamp >= e.startTime, "Voting: not started");
        require(block.timestamp <= e.endTime, "Voting: ended");
        _;
    }

    // ============ 构造函数 ============

    constructor(address _voterRegistry) {
        admin = msg.sender;
        voterRegistry = _voterRegistry;
    }

    // ============ 选举管理函数 ============

    /**
     * @notice 创建新选举
     * @param _title 选举标题
     * @param _description 选举描述
     * @param _startTime 开始时间戳
     * @param _endTime 结束时间戳
     */
    function createElection(
        string calldata _title,
        string calldata _description,
        uint256 _startTime,
        uint256 _endTime
    ) external onlyAdmin returns (uint256) {
        require(_startTime < _endTime, "Voting: invalid time range");

        uint256 id = electionCount++;
        elections[id] = Election({
            id: id,
            title: _title,
            description: _description,
            startTime: _startTime,
            endTime: _endTime,
            status: ElectionStatus.Created,
            candidateCount: 0,
            totalVotes: 0,
            merkleRoot: bytes32(0)
        });

        emit ElectionCreated(id, _title);
        return id;
    }

    /**
     * @notice 添加候选人
     * @param _electionId 选举ID
     * @param _name 候选人名称
     */
    function addCandidate(
        uint256 _electionId,
        string calldata _name
    ) external onlyAdmin electionExists(_electionId) {
        Election storage e = elections[_electionId];
        require(e.status == ElectionStatus.Created, "Voting: cannot add");

        uint256 candidateId = e.candidateCount++;
        candidates[_electionId][candidateId] = Candidate({
            id: candidateId,
            name: _name,
            voteCount: 0
        });

        emit CandidateAdded(_electionId, candidateId);
    }

    /**
     * @notice 启动选举
     * @param _electionId 选举ID
     */
    function startElection(uint256 _electionId) external onlyAdmin electionExists(_electionId) {
        Election storage e = elections[_electionId];
        require(e.status == ElectionStatus.Created, "Voting: invalid status");
        require(e.candidateCount >= 2, "Voting: need candidates");

        e.status = ElectionStatus.Active;
        emit ElectionStatusChanged(_electionId, ElectionStatus.Active);
    }

    /**
     * @notice 结束选举
     * @param _electionId 选举ID
     */
    function endElection(uint256 _electionId) external onlyAdmin electionExists(_electionId) {
        Election storage e = elections[_electionId];
        require(e.status == ElectionStatus.Active, "Voting: not active");

        e.status = ElectionStatus.Ended;
        emit ElectionStatusChanged(_electionId, ElectionStatus.Ended);
    }

    // ============ 投票函数 ============

    /**
     * @notice 提交投票承诺
     * @param _electionId 选举ID
     * @param _commitment 投票承诺哈希
     */
    function castVote(
        uint256 _electionId,
        bytes32 _commitment
    ) external electionExists(_electionId) electionActive(_electionId) {
        // 检查选民资格
        IVoterRegistry registry = IVoterRegistry(voterRegistry);
        require(registry.isRegistered(msg.sender), "Voting: not registered voter");
        require(!registry.hasVoted(msg.sender), "Voting: already voted in registry");

        require(_commitment != bytes32(0), "Voting: invalid commitment");
        require(
            voteRecords[_electionId][msg.sender].commitment == bytes32(0),
            "Voting: already voted"
        );

        // 在 VoterRegistry 中标记已投票
        registry.markAsVoted(msg.sender);

        voteRecords[_electionId][msg.sender] = VoteRecord({
            commitment: _commitment,
            timestamp: block.timestamp,
            revealed: false
        });

        commitments[_electionId].push(_commitment);
        elections[_electionId].totalVotes++;

        emit VoteCast(_electionId, msg.sender);
    }

    /**
     * @notice 揭示投票（选举结束后）
     * @param _electionId 选举ID
     * @param _candidateId 候选人ID
     * @param _salt 盐值
     */
    function revealVote(
        uint256 _electionId,
        uint256 _candidateId,
        bytes32 _salt
    ) external electionExists(_electionId) {
        Election storage e = elections[_electionId];
        require(e.status == ElectionStatus.Ended, "Voting: not ended");

        VoteRecord storage record = voteRecords[_electionId][msg.sender];
        require(record.commitment != bytes32(0), "Voting: no vote");
        require(!record.revealed, "Voting: already revealed");
        require(_candidateId < e.candidateCount, "Voting: invalid candidate");

        // 验证承诺
        bytes32 computed = keccak256(abi.encodePacked(_candidateId, _salt));
        require(computed == record.commitment, "Voting: invalid reveal");

        record.revealed = true;
        candidates[_electionId][_candidateId].voteCount++;

        emit VoteRevealed(_electionId, msg.sender);
    }

    /**
     * @notice 更新 Merkle 根（由后端服务调用）
     * @param _electionId 选举ID
     * @param _root Merkle 根哈希
     */
    function updateMerkleRoot(
        uint256 _electionId,
        bytes32 _root
    ) external onlyAdmin electionExists(_electionId) {
        elections[_electionId].merkleRoot = _root;
        emit MerkleRootUpdated(_electionId, _root);
    }

    // ============ 查询函数 ============

    /**
     * @notice 获取选举信息
     */
    function getElection(uint256 _electionId) external view returns (
        string memory title,
        string memory description,
        uint256 startTime,
        uint256 endTime,
        ElectionStatus status,
        uint256 candidateCount,
        uint256 totalVotes
    ) {
        Election storage e = elections[_electionId];
        return (
            e.title,
            e.description,
            e.startTime,
            e.endTime,
            e.status,
            e.candidateCount,
            e.totalVotes
        );
    }

    /**
     * @notice 获取候选人信息
     */
    function getCandidate(
        uint256 _electionId,
        uint256 _candidateId
    ) external view returns (string memory name, uint256 voteCount) {
        Candidate storage c = candidates[_electionId][_candidateId];
        return (c.name, c.voteCount);
    }

    /**
     * @notice 获取选民投票记录
     */
    function getVoteRecord(
        uint256 _electionId,
        address _voter
    ) external view returns (bytes32 commitment, uint256 timestamp, bool revealed) {
        VoteRecord storage r = voteRecords[_electionId][_voter];
        return (r.commitment, r.timestamp, r.revealed);
    }

    /**
     * @notice 获取投票承诺数量
     */
    function getCommitmentsCount(uint256 _electionId) external view returns (uint256) {
        return commitments[_electionId].length;
    }
}
