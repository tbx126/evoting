// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVoteVerifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[4] calldata _pubSignals
    ) external view returns (bool);
}

interface ITallyVerifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[15] calldata _pubSignals
    ) external view returns (bool);
}

contract Voting {
    // ============ 状态变量 ============

    address public admin;

    address public voteVerifier;

    address public tallyVerifier;

    enum ElectionStatus {
        Created,
        Active,
        Ended,
        Tallied
    }

    ElectionStatus public status;

    string public title;

    string public description;

    uint256 public candidateCount;

    uint256 public totalVotes;
    uint256 public constant CIRCUIT_CANDIDATE_COUNT = 2;
    uint256 public constant ENCRYPTED_SLOT_WIDTH = 4;

    uint256 public totalVoters;

    bytes32 public merkleRoot;

    uint256[2] public elgamalPK;

    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
    }

    struct Voter {
        bool isRegistered;
        bool hasVoted;
        uint256 registeredAt;
    }

    struct VoteRecord {
        bytes32 commitment;
        bytes32 ciphertextHash;
        uint256 timestamp;
        bool counted;
    }

    // ============ 映射 ============

    mapping(uint256 => Candidate) public candidates;

    mapping(address => Voter) public voters;

    mapping(address => VoteRecord) public voteRecords;

    bytes32[] public commitments;
    uint256[2] public tallyResultPointX;
    uint256[2] public tallyResultPointY;

    // ============ 事件 ============

    event ElectionInitialized(string title);
    event CandidateAdded(uint256 indexed candidateId, string name);
    event VoterRegistered(address indexed voter, uint256 timestamp);
    event VoteCast(address indexed voter, bytes32 commitment, bytes32 ciphertextHash);
    event EncryptedVoteCast(address indexed voter, bytes32 commitment, uint256[] encryptedVote);
    event TallyCompleted(uint256[] results, bytes32 merkleRoot);
    event TallyResultPoints(uint256[2] resultPointX, uint256[2] resultPointY);
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

    constructor(
        string memory _title,
        string memory _description,
        address _voteVerifier,
        address _tallyVerifier,
        uint256[2] memory _elgamalPK
    ) {
        require(_voteVerifier != address(0), "Voting: invalid vote verifier");
        require(_tallyVerifier != address(0), "Voting: invalid tally verifier");

        admin = msg.sender;
        voteVerifier = _voteVerifier;
        tallyVerifier = _tallyVerifier;
        elgamalPK = _elgamalPK;
        title = _title;
        description = _description;
        status = ElectionStatus.Created;

        emit ElectionInitialized(_title);
    }

    // ============ 选民注册函数 ============

    function registerVoter(address _voter) external onlyAdmin {
        require(_voter != address(0), "Voting: invalid address");
        require(!voters[_voter].isRegistered, "Voting: already registered");

        voters[_voter] = Voter({
            isRegistered: true,
            hasVoted: false,
            registeredAt: block.timestamp
        });
        totalVoters++;
        emit VoterRegistered(_voter, block.timestamp);
    }

    function registerVotersBatch(address[] calldata _voters) external onlyAdmin {
        for (uint256 i = 0; i < _voters.length; i++) {
            address voter = _voters[i];
            if (voter != address(0) && !voters[voter].isRegistered) {
                voters[voter] = Voter({
                    isRegistered: true,
                    hasVoted: false,
                    registeredAt: block.timestamp
                });
                totalVoters++;
                emit VoterRegistered(voter, block.timestamp);
            }
        }
    }

    // ============ 选举管理函数 ============

    function addCandidate(string calldata _name) external onlyAdmin inStatus(ElectionStatus.Created) {
        require(candidateCount < CIRCUIT_CANDIDATE_COUNT, "Voting: circuit supports 2 candidates");
        uint256 candidateId = candidateCount++;
        candidates[candidateId] = Candidate({
            id: candidateId,
            name: _name,
            voteCount: 0
        });
        emit CandidateAdded(candidateId, _name);
    }

    function addCandidates(string calldata _name0, string calldata _name1) external onlyAdmin inStatus(ElectionStatus.Created) {
        require(candidateCount == 0, "Voting: candidates already added");
        candidates[0] = Candidate({ id: 0, name: _name0, voteCount: 0 });
        candidates[1] = Candidate({ id: 1, name: _name1, voteCount: 0 });
        candidateCount = 2;
        emit CandidateAdded(0, _name0);
        emit CandidateAdded(1, _name1);
    }

    function startElection() external onlyAdmin inStatus(ElectionStatus.Created) {
        require(candidateCount == CIRCUIT_CANDIDATE_COUNT, "Voting: candidate-circuit mismatch");
        status = ElectionStatus.Active;
        emit ElectionStatusChanged(ElectionStatus.Active);
    }

    function endElection() external onlyAdmin inStatus(ElectionStatus.Active) {
        status = ElectionStatus.Ended;
        emit ElectionStatusChanged(ElectionStatus.Ended);
    }

    // ============ 投票函数 ============

    function castVote(
        bytes32 _commitment,
        bytes32 _ciphertextHash,
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint256[] calldata _encryptedVote
    ) external electionActive {
        require(candidateCount == CIRCUIT_CANDIDATE_COUNT, "Voting: candidate-circuit mismatch");
        require(voters[msg.sender].isRegistered, "Voting: not registered");
        require(!voters[msg.sender].hasVoted, "Voting: already voted");
        require(_commitment != bytes32(0), "Voting: invalid commitment");
        require(_ciphertextHash != bytes32(0), "Voting: invalid ciphertext hash");
        require(voteRecords[msg.sender].commitment == bytes32(0), "Voting: duplicate vote");
        require(
            _encryptedVote.length == CIRCUIT_CANDIDATE_COUNT * ENCRYPTED_SLOT_WIDTH,
            "Voting: invalid encrypted vote length"
        );

        uint[4] memory pubSignals;
        pubSignals[0] = uint256(_commitment);
        pubSignals[1] = uint256(_ciphertextHash);
        pubSignals[2] = elgamalPK[0];
        pubSignals[3] = elgamalPK[1];

        require(
            IVoteVerifier(voteVerifier).verifyProof(_pA, _pB, _pC, pubSignals),
            "Voting: invalid ZKP proof"
        );

        voters[msg.sender].hasVoted = true;

        voteRecords[msg.sender] = VoteRecord({
            commitment: _commitment,
            ciphertextHash: _ciphertextHash,
            timestamp: block.timestamp,
            counted: false
        });

        commitments.push(_commitment);
        totalVotes++;

        emit VoteCast(msg.sender, _commitment, _ciphertextHash);
        emit EncryptedVoteCast(msg.sender, _commitment, _encryptedVote);
    }

    function updateTallyResults(
        uint256[] calldata _results,
        bytes32 _merkleRoot,
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[15] calldata _tallyPubSignals
    ) external onlyAdmin inStatus(ElectionStatus.Ended) {
        require(candidateCount == CIRCUIT_CANDIDATE_COUNT, "Voting: candidate-circuit mismatch");
        require(_results.length == candidateCount, "Voting: invalid results length");

        require(_tallyPubSignals[0] == elgamalPK[0], "Voting: PK mismatch X");
        require(_tallyPubSignals[1] == elgamalPK[1], "Voting: PK mismatch Y");

        require(_tallyPubSignals[14] == totalVotes, "Voting: total votes mismatch");

        require(
            ITallyVerifier(tallyVerifier).verifyProof(_pA, _pB, _pC, _tallyPubSignals),
            "Voting: invalid tally ZKP proof"
        );

        uint256 totalVotesSum = 0;
        for (uint256 i = 0; i < candidateCount; i++) {
            require(_results[i] <= totalVotes, "Voting: invalid per-candidate result");
            candidates[i].voteCount = _results[i];
            totalVotesSum += _results[i];
        }

        require(totalVotesSum == totalVotes, "Voting: vote count mismatch");

        merkleRoot = _merkleRoot;
        status = ElectionStatus.Tallied;
        tallyResultPointX[0] = _tallyPubSignals[10];
        tallyResultPointX[1] = _tallyPubSignals[11];
        tallyResultPointY[0] = _tallyPubSignals[12];
        tallyResultPointY[1] = _tallyPubSignals[13];

        emit TallyCompleted(_results, _merkleRoot);
        emit TallyResultPoints(tallyResultPointX, tallyResultPointY);
        emit ElectionStatusChanged(ElectionStatus.Tallied);
    }

    function updateMerkleRoot(bytes32 _root) external onlyAdmin {
        require(status != ElectionStatus.Tallied, "Voting: merkle root finalized");
        merkleRoot = _root;
        emit MerkleRootUpdated(_root);
    }

    // ============ 查询函数 ============

    function isRegistered(address _voter) external view returns (bool) {
        return voters[_voter].isRegistered;
    }

    function hasVoted(address _voter) external view returns (bool) {
        return voters[_voter].hasVoted;
    }

    function getVoterInfo(address _voter) external view returns (
        bool isReg,
        bool voted,
        uint256 regTime
    ) {
        Voter memory v = voters[_voter];
        return (v.isRegistered, v.hasVoted, v.registeredAt);
    }

    function getElectionInfo() external view returns (
        string memory _title,
        string memory _description,
        ElectionStatus _status,
        uint256 _candidateCount,
        uint256 _totalVotes
    ) {
        return (title, description, status, candidateCount, totalVotes);
    }

    function getElgamalPK() external view returns (uint256[2] memory) {
        return elgamalPK;
    }

    function getCandidate(uint256 _candidateId) external view returns (
        string memory name,
        uint256 voteCount
    ) {
        require(_candidateId < candidateCount, "Voting: invalid candidate");
        Candidate storage c = candidates[_candidateId];
        return (c.name, c.voteCount);
    }

    function getVoteRecord(address _voter) external view returns (
        bytes32 commitment,
        bytes32 ciphertextHash,
        uint256 timestamp,
        bool counted
    ) {
        VoteRecord storage r = voteRecords[_voter];
        return (r.commitment, r.ciphertextHash, r.timestamp, r.counted);
    }

    function getCommitmentsCount() external view returns (uint256) {
        return commitments.length;
    }

    function getAllCandidates() external view returns (Candidate[] memory) {
        Candidate[] memory result = new Candidate[](candidateCount);
        for (uint256 i = 0; i < candidateCount; i++) {
            result[i] = candidates[i];
        }
        return result;
    }
}
