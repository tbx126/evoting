// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VoterRegistry - 选民注册合约
 * @notice 管理选民注册、身份验证和投票资格
 * @dev 只有管理员可以添加选民，选民地址存储在白名单中
 */
contract VoterRegistry {
    // ============ 状态变量 ============

    /// @notice 合约管理员地址
    address public admin;

    /// @notice 授权的投票合约地址
    address public votingContract;

    /// @notice 选民信息结构体
    struct Voter {
        bool isRegistered;      // 是否已注册
        bool hasVoted;          // 是否已投票
        uint256 registeredAt;   // 注册时间戳
    }

    /// @notice 选民地址 => 选民信息
    mapping(address => Voter) public voters;

    /// @notice 已注册选民总数
    uint256 public totalVoters;

    // ============ 事件 ============

    /// @notice 选民注册事件
    event VoterRegistered(address indexed voter, uint256 timestamp);

    /// @notice 选民投票状态更新事件
    event VoterStatusUpdated(address indexed voter, bool hasVoted);

    /// @notice 管理员变更事件
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);

    /// @notice 投票合约地址变更事件
    event VotingContractChanged(address indexed oldContract, address indexed newContract);

    // ============ 修饰符 ============

    /// @notice 仅管理员可调用
    modifier onlyAdmin() {
        require(msg.sender == admin, "VoterRegistry: caller is not admin");
        _;
    }

    /// @notice 仅已注册选民可调用
    modifier onlyRegistered() {
        require(voters[msg.sender].isRegistered, "VoterRegistry: not registered");
        _;
    }

    /// @notice 仅授权的投票合约可调用
    modifier onlyVotingContract() {
        require(msg.sender == votingContract, "VoterRegistry: caller is not voting contract");
        _;
    }

    // ============ 构造函数 ============

    constructor() {
        admin = msg.sender;
    }

    // ============ 管理员函数 ============

    /**
     * @notice 注册单个选民
     * @param _voter 选民钱包地址
     */
    function registerVoter(address _voter) external onlyAdmin {
        require(_voter != address(0), "VoterRegistry: invalid address");
        require(!voters[_voter].isRegistered, "VoterRegistry: already registered");

        voters[_voter] = Voter({
            isRegistered: true,
            hasVoted: false,
            registeredAt: block.timestamp
        });

        totalVoters++;
        emit VoterRegistered(_voter, block.timestamp);
    }

    /**
     * @notice 批量注册选民
     * @param _voters 选民地址数组
     */
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

    /**
     * @notice 标记选民已投票（仅投票合约可调用）
     * @param _voter 选民地址
     */
    function markAsVoted(address _voter) external onlyVotingContract {
        require(voters[_voter].isRegistered, "VoterRegistry: not registered");
        require(!voters[_voter].hasVoted, "VoterRegistry: already voted");

        voters[_voter].hasVoted = true;
        emit VoterStatusUpdated(_voter, true);
    }

    /**
     * @notice 设置授权的投票合约地址
     * @param _votingContract 投票合约地址
     */
    function setVotingContract(address _votingContract) external onlyAdmin {
        require(_votingContract != address(0), "VoterRegistry: invalid address");
        emit VotingContractChanged(votingContract, _votingContract);
        votingContract = _votingContract;
    }

    /**
     * @notice 转移管理员权限
     * @param _newAdmin 新管理员地址
     */
    function transferAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "VoterRegistry: invalid address");
        emit AdminChanged(admin, _newAdmin);
        admin = _newAdmin;
    }

    // ============ 查询函数 ============

    /**
     * @notice 检查地址是否为已注册选民
     * @param _voter 待检查地址
     * @return 是否已注册
     */
    function isRegistered(address _voter) external view returns (bool) {
        return voters[_voter].isRegistered;
    }

    /**
     * @notice 检查选民是否已投票
     * @param _voter 选民地址
     * @return 是否已投票
     */
    function hasVoted(address _voter) external view returns (bool) {
        return voters[_voter].hasVoted;
    }

    /**
     * @notice 获取选民完整信息
     * @param _voter 选民地址
     * @return isReg 是否注册
     * @return voted 是否已投票
     * @return regTime 注册时间
     */
    function getVoterInfo(address _voter) external view returns (
        bool isReg,
        bool voted,
        uint256 regTime
    ) {
        Voter memory v = voters[_voter];
        return (v.isRegistered, v.hasVoted, v.registeredAt);
    }
}
