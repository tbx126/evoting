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
 * @title Voting - 单一选举投票合约（同态加密版本）
 * @notice 管理单场选举的投票提交和结果统计
 * @dev 支持 Paillier 同态加密投票，链下计票后上传结果
 *      选举由管理员手动开启和关闭，无时间限制
 *      移除了 revealVote 机制，改用 updateTallyResults 上传计票结果
 */
contract Voting {
    // ============ 状态变量 ============

    /// @notice 合约管理员
    address public admin;

    /// @notice 选民注册合约地址
    address public voterRegistry;

    /// @notice 选举状态枚举
    enum ElectionStatus {
        Created,    // 已创建，可添加候选人
        Active,     // 进行中，可投票
        Ended,      // 已结束，等待计票
        Tallied     // 已计票
    }

    /// @notice 当前选举状态
    ElectionStatus public status;

    /// @notice 选举标题
    string public title;

    /// @notice 选举描述
    string public description;

    /// @notice 候选人数量
    uint256 public candidateCount;

    /// @notice 总投票数
    uint256 public totalVotes;

    /// @notice Merkle 根哈希
    bytes32 public merkleRoot;

    /// @notice 候选人结构体
    struct Candidate {
        uint256 id;         // 候选人ID
        string name;        // 候选人名称
        uint256 voteCount;  // 得票数
    }

    /// @notice 投票记录结构体
    struct VoteRecord {
        bytes32 commitment;     // 加密投票的承诺哈希
        uint256 timestamp;      // 投票时间
        bool counted;           // 是否已计入结果
    }

    // ============ 映射 ============

    /// @notice 候选人ID => 候选人信息
    mapping(uint256 => Candidate) public candidates;

    /// @notice 选民地址 => 投票记录
    mapping(address => VoteRecord) public voteRecords;

    /// @notice 所有投票承诺数组
    bytes32[] public commitments;

    // ============ 事件 ============

    event ElectionInitialized(string title);
    event CandidateAdded(uint256 indexed candidateId, string name);
    event VoteCast(address indexed voter, bytes32 commitment);
    event TallyCompleted(uint256[] results, bytes32 merkleRoot);
    event ElectionStatusChanged(ElectionStatus newStatus);
    event MerkleRootUpdated(bytes32 root);

    // ============ 修饰符 ============

    modifier onlyAdmin() {
        require(msg.sender == admin, "Voting: not admin");
        _;
    }

    modifier inStatus(ElectionStatus _status) {
        require(status == _status, "Voting: invalid status");
        _;
    }

    modifier electionActive() {
        require(status == ElectionStatus.Active, "Voting: not active");
        _;
    }

    // ============ 构造函数 ============

    /**
     * @notice 部署并初始化选举
     * @param _voterRegistry 选民注册合约地址
     * @param _title 选举标题
     * @param _description 选举描述
     */
    constructor(
        address _voterRegistry,
        string memory _title,
        string memory _description
    ) {
        require(_voterRegistry != address(0), "Voting: invalid registry");

        admin = msg.sender;
        voterRegistry = _voterRegistry;
        title = _title;
        description = _description;
        status = ElectionStatus.Created;

        emit ElectionInitialized(_title);
    }

    // ============ 选举管理函数 ============

    /**
     * @notice 添加候选人
     * @param _name 候选人名称
     */
    function addCandidate(string calldata _name) external onlyAdmin inStatus(ElectionStatus.Created) {
        uint256 candidateId = candidateCount++;
        candidates[candidateId] = Candidate({
            id: candidateId,
            name: _name,
            voteCount: 0
        });

        emit CandidateAdded(candidateId, _name);
    }

    /**
     * @notice 启动选举（管理员手动开启）
     */
    function startElection() external onlyAdmin inStatus(ElectionStatus.Created) {
        require(candidateCount >= 2, "Voting: need at least 2 candidates");

        status = ElectionStatus.Active;
        emit ElectionStatusChanged(ElectionStatus.Active);
    }

    /**
     * @notice 结束选举（管理员手动关闭）
     */
    function endElection() external onlyAdmin inStatus(ElectionStatus.Active) {
        status = ElectionStatus.Ended;
        emit ElectionStatusChanged(ElectionStatus.Ended);
    }

    // ============ 投票函数 ============

    /**
     * @notice 提交投票承诺
     * @param _commitment 加密投票的承诺哈希 = SHA256(encrypted_vote)
     */
    function castVote(bytes32 _commitment) external electionActive {
        // 检查选民资格
        IVoterRegistry registry = IVoterRegistry(voterRegistry);
        require(registry.isRegistered(msg.sender), "Voting: not registered");
        require(!registry.hasVoted(msg.sender), "Voting: already voted");

        require(_commitment != bytes32(0), "Voting: invalid commitment");
        require(voteRecords[msg.sender].commitment == bytes32(0), "Voting: duplicate vote");

        // 标记已投票
        registry.markAsVoted(msg.sender);

        // 记录投票
        voteRecords[msg.sender] = VoteRecord({
            commitment: _commitment,
            timestamp: block.timestamp,
            counted: false
        });

        commitments.push(_commitment);
        totalVotes++;

        emit VoteCast(msg.sender, _commitment);
    }

    /**
     * @notice 更新计票结果（管理员调用，链下同态计票后上传）
     * @param _results 每个候选人的得票数数组
     * @param _merkleRoot 投票的 Merkle 根哈希
     */
    function updateTallyResults(
        uint256[] calldata _results,
        bytes32 _merkleRoot
    ) external onlyAdmin inStatus(ElectionStatus.Ended) {
        require(_results.length == candidateCount, "Voting: invalid results length");

        uint256 totalVotesSum = 0;
        for (uint256 i = 0; i < candidateCount; i++) {
            candidates[i].voteCount = _results[i];
            totalVotesSum += _results[i];
        }

        require(totalVotesSum == totalVotes, "Voting: vote count mismatch");

        merkleRoot = _merkleRoot;
        status = ElectionStatus.Tallied;

        emit TallyCompleted(_results, _merkleRoot);
        emit ElectionStatusChanged(ElectionStatus.Tallied);
    }

    /**
     * @notice 更新 Merkle 根
     * @param _root Merkle 根哈希
     */
    function updateMerkleRoot(bytes32 _root) external onlyAdmin {
        merkleRoot = _root;
        emit MerkleRootUpdated(_root);
    }

    // ============ 查询函数 ============

    /**
     * @notice 获取选举信息
     */
    function getElectionInfo() external view returns (
        string memory _title,
        string memory _description,
        ElectionStatus _status,
        uint256 _candidateCount,
        uint256 _totalVotes
    ) {
        return (title, description, status, candidateCount, totalVotes);
    }

    /**
     * @notice 获取候选人信息
     * @param _candidateId 候选人ID
     */
    function getCandidate(uint256 _candidateId) external view returns (
        string memory name,
        uint256 voteCount
    ) {
        require(_candidateId < candidateCount, "Voting: invalid candidate");
        Candidate storage c = candidates[_candidateId];
        return (c.name, c.voteCount);
    }

    /**
     * @notice 获取选民投票记录
     * @param _voter 选民地址
     */
    function getVoteRecord(address _voter) external view returns (
        bytes32 commitment,
        uint256 timestamp,
        bool counted
    ) {
        VoteRecord storage r = voteRecords[_voter];
        return (r.commitment, r.timestamp, r.counted);
    }

    /**
     * @notice 获取投票承诺数量
     */
    function getCommitmentsCount() external view returns (uint256) {
        return commitments.length;
    }

    /**
     * @notice 获取所有候选人信息
     */
    function getAllCandidates() external view returns (Candidate[] memory) {
        Candidate[] memory result = new Candidate[](candidateCount);
        for (uint256 i = 0; i < candidateCount; i++) {
            result[i] = candidates[i];
        }
        return result;
    }
}
