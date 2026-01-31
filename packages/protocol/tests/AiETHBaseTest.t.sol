pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";

import {AiETH} from "../src/aiETH.sol";
import {IERC20x, IAaveMarket, IAiETH} from "../src/Interfaces.sol";

/// @notice Abstract base test contract with chain-agnostic variables and helper methods.
/// Child contracts must set network-specific addresses before calling setUp().
abstract contract AiETHBaseTest is Test {
    AiETH public aiETH;

    // Chain agnostic test variables - must be set by child contracts
    IERC20x public reserveToken;
    IERC20x public debtToken;
    address public borrowToken;
    IAaveMarket public aave;

    // Deposit limits - can be overridden by child contracts
    uint256 public MAX_AAVE_DEPOSIT = 1000 ether;
    uint256 public MAX_AAVE_DEPOSIT_USDC = 2000 gwei;

    uint256 internal testFork;

    /// @notice Returns the RPC URL key for the network (e.g., "base", "sepolia")
    function _getRpcUrlKey() internal view virtual returns (string memory);

    /// @notice Optional: Returns the block number to fork at. Override to pin to a specific block.
    function _getForkBlock() internal view virtual returns (uint256) {
        return 0; // 0 means latest block
    }

    function setUp() public virtual {
        // Fork the network
        uint256 forkBlock = _getForkBlock();
        if (forkBlock > 0) {
            testFork = vm.createSelectFork(vm.rpcUrl(_getRpcUrlKey()), forkBlock);
        } else {
            testFork = vm.createSelectFork(vm.rpcUrl(_getRpcUrlKey()));
        }

        // Validate that required addresses are set
        require(address(reserveToken) != address(0), "reserveToken not set");
        require(address(debtToken) != address(0), "debtToken not set");
        require(borrowToken != address(0), "borrowToken not set");
        require(address(aave) != address(0), "aave not set");

        aiETH = new AiETH();

        (, bytes memory data) = address(reserveToken).call(abi.encodeWithSignature("symbol()"));
        emit log_named_string("reserve asset symbol", abi.decode(data, (string)));
        (, bytes memory data2) = address(borrowToken).call(abi.encodeWithSignature("symbol()"));
        emit log_named_string("debt asset symbol", abi.decode(data2, (string)));

        aiETH.initialize(address(reserveToken), address(aave), address(debtToken), address(this), "funCity Ethereum", "aiETH");
    }

    modifier assumeValidAddress(address target) {
        // Addresses that will throw errors or miscalculations during testing
        vm.assume(address(0) != target);
        vm.assume(address(reserveToken) != target);
        vm.assume(address(borrowToken) != target);
        // Aave protocol throws on transferring to their addresses
        vm.assume(target != address(aave));
        vm.assume(address(aiETH.aToken()) != target);
        vm.assume(address(debtToken) != target);
        // Permit2 contract throws on ERC20.approve() from solady
        vm.assume(address(0x000000000022D473030F116dDEE9F6B43aC78BA3) != target);
        _;
    }

    function _boundDepositAmount(uint256 initial, bool borrowable) internal view returns (uint256) {
        uint256 min;
        uint8 decimals = reserveToken.decimals();
        // Give enough deposit that collateral value lets us borrow at least 1 unit of debt token
        if (borrowable) min = decimals == 18 ? 10 ether : 1e8;
        else min = aiETH.MIN_DEPOSIT();
        uint256 max = decimals == 18 ? MAX_AAVE_DEPOSIT : MAX_AAVE_DEPOSIT_USDC;
        return bound(
            initial,
            min, // prevent decimal rounding errors on aave protocol
            max // prevent max supply reverts on Aave
        );
    }

    function _depositnnEth(address user, uint256 amount) internal returns (uint256 deposited) {
        deposited = _boundDepositAmount(amount, false);

        vm.startPrank(user);
        aiETH.reserveToken().approve(address(aiETH), deposited);
        aiETH.deposit(deposited);
        vm.stopPrank();
    }

    /// @notice Ensure enough collateral so we have credit > 0 so borrow() calls don't fail on 0.
    function _depositForBorrowing(address user, uint256 amount) internal returns (uint256 deposited) {
        vm.assume(user != address(0));
        deposited = _boundDepositAmount(amount, true);

        deal(address(aiETH.reserveToken()), user, deposited);

        vm.startPrank(user);
        aiETH.reserveToken().approve(address(aiETH), deposited);
        aiETH.deposit(deposited);
        vm.stopPrank();
    }

    function _depositnnEth(address user, uint256 amount, bool mint) internal returns (uint256 deposited) {
        vm.assume(user != address(0));
        deposited = _boundDepositAmount(amount, false);
        if (mint) deal(address(aiETH.reserveToken()), user, deposited);
        return _depositnnEth(user, deposited);
    }

    function _allocate(address city, uint256 amount) internal {
        vm.assume(city != address(0)); // prevent aave error sending to 0x0

        // When we deposit -> withdraw immediately we have 1 wei less balance than we deposit
        // probs attack prevention method on aave protocol so move 1 block ahead to increase balance from interest
        vm.warp(block.timestamp + 1 weeks);

        vm.prank(aiETH.FUN_OPS());
        aiETH.allocate(city, amount);
    }

    function _withdrawnnEth(address user, uint256 amount) internal {
        // When we deposit -> withdraw immediately we have 1 wei less balance than we deposit
        // probs attack prevention method on aave protocol so move 1 block ahead to increase balance from interest

        vm.warp(block.timestamp + 1 days);
        vm.prank(user);
        aiETH.withdraw(amount);
    }

    /**
     * @dev denominated in Aave protocol base asset decimals (8 decimals from Chainlink feed)
     *     NOT debtToken decimals so must convert for calculations on allocate/borrow
     */
    function _borrowable(uint256 nnethSupply) internal returns (uint256 aaveTotalCredit, uint256 nnEthCreditLimit) {
        (,,,, uint256 ltvConfig,) = aave.getUserAccountData(address(aiETH));

        uint256 reservePrice =
            IAaveMarket(aave.ADDRESSES_PROVIDER()).getPriceOracle().getAssetPrice(address(reserveToken));
        uint256 debtPrice =
            IAaveMarket(aave.ADDRESSES_PROVIDER()).getPriceOracle().getAssetPrice(debtToken.UNDERLYING_ASSET_ADDRESS());

        emit log_named_uint("reserveToken reservePrice (8 dec)", reservePrice);
        emit log_named_uint("debtToken reservePrice (8 dec)", debtPrice);

        // 1e4 ltv bps offset + 1e8 reservePrice decimals
        aaveTotalCredit =
            aiETH.convertToDecimal(nnethSupply * ltvConfig * reservePrice, reserveToken.decimals() + 12, 8);

        emit log_named_uint("total cred init (8 dec)", aaveTotalCredit);

        nnEthCreditLimit = (
            aiETH.convertToDecimal(
                aaveTotalCredit,
                0, // upscale from final decimal amount (8 dec prices cancel out) to get more precise answer
                debtToken.decimals()
            ) / debtPrice / aiETH.MIN_RESERVE_FACTOR()
        ) - 1;

        emit log_named_uint("total cred init (token dec)", nnEthCreditLimit);
    }
}
