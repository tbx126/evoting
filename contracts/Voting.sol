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
 * @title IVoteVerifier - ZKP 投票证明验证器接口
 */
interface IVoteVerifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[4] calldata _pubSignals
    ) external view returns (bool);
}

/**
 * @title ITallyVerifier - ZKP 计票证明验证器接口
 */
interface ITallyVerifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[15] calldata _pubSignals
    ) external view returns (bool);
}

/**
 * @title Voting - ZKP 零知识证明投票合约
 * @notice 管理单场选举：投票提交（含 ZKP 证明）和结果统计（含计票证明）
 * @dev 使用 ElGamal on BabyJubJub 同态加密 + Groth16 零知识证明
 *      - ZKP1+ZKP2: 选票合法性 + 承诺-密文一致性（投票时验证）
 *      - ZKP3: 解密正确性（计票时验证）
 *      选举由管理员手动开启和关闭，无时间限制
 */
contract Voting {
    // ============ 状态变量 ============

    /// @notice 合约管理员
    address public admin;

    /// @notice 选民注册合约地址
    address public voterRegistry;

    /// @notice ZKP 投票验证器合约
    address public voteVerifier;

    /// @notice ZKP 计票验证器合约
    address public tallyVerifier;

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

    /// @notice ElGamal 公钥 (BabyJubJub 点)
    uint256[2] public elgamalPK;

    /// @notice 候选人结构体
    struct Candidate {
        uint256 id;         // 候选人ID
        string name;        // 候选人名称
        uint256 voteCount;  // 得票数
    }

    /// @notice 投票记录结构体
    struct VoteRecord {
        bytes32 commitment;       // Poseidon(candidateId, salt) 承诺
        bytes32 ciphertextHash;   // Poseidon(所有密文分量) 绑定哈希
        uint256 timestamp;        // 投票时间
        bool counted;             // 是否已计入结果
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
    event VoteCast(address indexed voter, bytes32 commitment, bytes32 ciphertextHash);
    event EncryptedVoteCast(address indexed voter, bytes32 commitment, uint256[] encryptedVote);
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
     * @param _voteVerifier ZKP 投票验证器合约地址
     * @param _tallyVerifier ZKP 计票验证器合约地址
     * @param _elgamalPK ElGamal 公钥 [pkX, pkY] (BabyJubJub 点)
     */
    constructor(
        address _voterRegistry,
        string memory _title,
        string memory _description,
        address _voteVerifier,
        address _tallyVerifier,
        uint256[2] memory _elgamalPK
    ) {
        require(_voterRegistry != address(0), "Voting: invalid registry");
        require(_voteVerifier != address(0), "Voting: invalid vote verifier");
        require(_tallyVerifier != address(0), "Voting: invalid tally verifier");

        admin = msg.sender;
        voterRegistry = _voterRegistry;
        voteVerifier = _voteVerifier;
        tallyVerifier = _tallyVerifier;
        elgamalPK = _elgamalPK;
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
     * @notice 提交投票（含 ZKP 证明）
     * @param _commitment Poseidon(candidateId, salt) 承诺哈希
     * @param _ciphertextHash Poseidon(所有密文分量) 绑定哈希
     * @param _pA Groth16 proof point A
     * @param _pB Groth16 proof point B
     * @param _pC Groth16 proof point C
     * @param _encryptedVote 加密投票数据 (emit 到事件日志, 用于链下同态计票)
     */
    function castVote(
        bytes32 _commitment,
        bytes32 _ciphertextHash,
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint256[] calldata _encryptedVote
    ) external electionActive {
        // 1. 检查选民资格
        IVoterRegistry registry = IVoterRegistry(voterRegistry);
        require(registry.isRegistered(msg.sender), "Voting: not registered");
        require(!registry.hasVoted(msg.sender), "Voting: already voted");

        require(_commitment != bytes32(0), "Voting: invalid commitment");
        require(voteRecords[msg.sender].commitment == bytes32(0), "Voting: duplicate vote");

        // 2. 验证 ZKP 证明 (ZKP1 + ZKP2)
        uint[4] memory pubSignals;
        pubSignals[0] = uint256(_commitment);
        pubSignals[1] = uint256(_ciphertextHash);
        pubSignals[2] = elgamalPK[0];
        pubSignals[3] = elgamalPK[1];

        require(
            IVoteVerifier(voteVerifier).verifyProof(_pA, _pB, _pC, pubSignals),
            "Voting: invalid ZKP proof"
        );

        // 3. 标记已投票
        registry.markAsVoted(msg.sender);

        // 4. 记录投票
        voteRecords[msg.sender] = VoteRecord({
            commitment: _commitment,
            ciphertextHash: _ciphertextHash,
            timestamp: block.timestamp,
            counted: false
        });

        commitments.push(_commitment);
        totalVotes++;

        // 5. 发出事件 (密文数据存储在事件日志中，不在存储中)
        emit VoteCast(msg.sender, _commitment, _ciphertextHash);
        emit EncryptedVoteCast(msg.sender, _commitment, _encryptedVote);
    }

    /**
     * @notice 更新计票结果（管理员调用，含 ZKP3 计票正确性证明）
     * @param _results 每个候选人的得票数数组
     * @param _merkleRoot 投票的 Merkle 根哈希
     * @param _pA Groth16 proof point A (ZKP3)
     * @param _pB Groth16 proof point B (ZKP3)
     * @param _pC Groth16 proof point C (ZKP3)
     * @param _tallyPubSignals ZKP3 公开输入 (15 个 uint256)
     */
    function updateTallyResults(
        uint256[] calldata _results,
        bytes32 _merkleRoot,
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[15] calldata _tallyPubSignals
    ) external onlyAdmin inStatus(ElectionStatus.Ended) {
        require(_results.length == candidateCount, "Voting: invalid results length");

        // 1. 验证公开输入中的 PK 与合约存储的一致 (先于证明验证, 节省 gas)
        require(_tallyPubSignals[0] == elgamalPK[0], "Voting: PK mismatch X");
        require(_tallyPubSignals[1] == elgamalPK[1], "Voting: PK mismatch Y");

        // 2. 验证总票数 (公开输入最后一个是 totalVotes)
        require(_tallyPubSignals[14] == totalVotes, "Voting: total votes mismatch");

        // 3. 验证 ZKP3 证明 (解密正确性)
        require(
            ITallyVerifier(tallyVerifier).verifyProof(_pA, _pB, _pC, _tallyPubSignals),
            "Voting: invalid tally ZKP proof"
        );

        // 4. 更新候选人得票数
        uint256 totalVotesSum = 0;
        for (uint256 i = 0; i < candidateCount; i++) {
            candidates[i].voteCount = _results[i];
            totalVotesSum += _results[i];
        }

        require(totalVotesSum == totalVotes, "Voting: vote count mismatch");

        // 5. 更新状态
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
     * @notice 获取 ElGamal 公钥
     */
    function getElgamalPK() external view returns (uint256[2] memory) {
        return elgamalPK;
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
        bytes32 ciphertextHash,
        uint256 timestamp,
        bool counted
    ) {
        VoteRecord storage r = voteRecords[_voter];
        return (r.commitment, r.ciphertextHash, r.timestamp, r.counted);
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
