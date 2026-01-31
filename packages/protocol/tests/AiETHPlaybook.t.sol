// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.13;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {AddressSet, LibAddressSet} from "./helpers/AddressSet.sol";
import {IERC20x} from "../src/Interfaces.sol";
import {AiETH} from "../src/aiETH.sol";

uint256 constant ETH_SUPPLY = 120_500_000 ether;

contract ForcePush {
    constructor(address dst) payable {
        selfdestruct(payable(dst));
    }
}

/// @notice Handler contract for invariant testing. Takes AiETH and reserveToken
/// directly as constructor arguments rather than inheriting network-specific setup.
contract Handler is Test {
    using LibAddressSet for AddressSet;

    AiETH public aiETH;
    IERC20x public reserveToken;

    uint256 public ghost_depositSum;
    uint256 public ghost_withdrawSum;
    uint256 public ghost_forcePushSum;

    uint256 public ghost_zeroWithdrawals;
    uint256 public ghost_zeroTransfers;
    uint256 public ghost_zeroTransferFroms;

    mapping(bytes32 => uint256) public calls;

    AddressSet internal _actors;
    address internal currentActor;
    address internal token;

    modifier createActor() {
        currentActor = msg.sender;
        _actors.add(msg.sender);
        _;
    }

    modifier useActor(uint256 actorIndexSeed) {
        currentActor = _actors.rand(actorIndexSeed);
        _;
    }

    modifier countCall(bytes32 key) {
        calls[key]++;
        _;
    }

    constructor(AiETH _weth, address _reserveToken) {
        aiETH = _weth;
        token = _reserveToken;
        reserveToken = IERC20x(_reserveToken);
        // Give handler enough tokens to distribute
        deal(_reserveToken, address(this), ETH_SUPPLY);
    }

    function deposit(uint256 amount) public createActor countCall("deposit") {
        uint256 handlerBalance = IERC20x(token).balanceOf(address(this));
        amount = bound(amount, aiETH.MIN_DEPOSIT(), handlerBalance > aiETH.MIN_DEPOSIT() ? handlerBalance : aiETH.MIN_DEPOSIT());

        // Transfer tokens to actor
        IERC20x(token).transfer(currentActor, amount);

        vm.startPrank(currentActor);
        IERC20x(token).approve(address(aiETH), amount);
        aiETH.deposit(amount);
        vm.stopPrank();

        ghost_depositSum += amount;
    }

    function withdraw(uint256 actorSeed, uint256 amount) public useActor(actorSeed) countCall("withdraw") {
        amount = bound(amount, 0, aiETH.balanceOf(currentActor));
        if (amount == 0) ghost_zeroWithdrawals++;

        vm.startPrank(currentActor);
        aiETH.withdraw(amount);
        // After withdrawal, tokens go directly to the actor from Aave
        // Transfer back to handler for future deposits
        IERC20x(token).transfer(address(this), IERC20x(token).balanceOf(currentActor));
        vm.stopPrank();

        ghost_withdrawSum += amount;
    }

    function approve(uint256 actorSeed, uint256 spenderSeed, uint256 amount)
        public
        useActor(actorSeed)
        countCall("approve")
    {
        address spender = _actors.rand(spenderSeed);

        vm.prank(currentActor);
        aiETH.approve(spender, amount);
    }

    function transfer(uint256 actorSeed, uint256 toSeed, uint256 amount)
        public
        useActor(actorSeed)
        countCall("transfer")
    {
        address to = _actors.rand(toSeed);

        amount = bound(amount, 0, aiETH.balanceOf(currentActor));
        if (amount == 0) ghost_zeroTransfers++;

        vm.prank(currentActor);
        aiETH.transfer(to, amount);
    }

    function transferFrom(uint256 actorSeed, uint256 fromSeed, uint256 toSeed, bool _approve, uint256 amount)
        public
        useActor(actorSeed)
        countCall("transferFrom")
    {
        address from = _actors.rand(fromSeed);
        address to = _actors.rand(toSeed);

        amount = bound(amount, 0, aiETH.balanceOf(from));

        if (_approve) {
            vm.prank(from);
            aiETH.approve(currentActor, amount);
        } else {
            amount = bound(amount, 0, aiETH.allowance(from, currentActor));
        }
        if (amount == 0) ghost_zeroTransferFroms++;

        vm.prank(currentActor);
        aiETH.transferFrom(from, to, amount);
    }

    // sendFallback is only applicable for native ETH deposits (WETH)
    // For ERC20 tokens like WBTC, this is a no-op
    function sendFallback(uint256) public createActor countCall("sendFallback") {
        // No-op for ERC20 tokens
    }

    // TODO test functionality on aiETH + nnUSDC
    // function forcePush(uint256 amount) public countCall("forcePush") {
    //     amount = bound(amount, 0, address(this).balance);
    //     new ForcePush{ value: amount }(address(aiETH));
    //     ghost_forcePushSum += amount;
    // }

    function forEachActor(function(address) external func) public {
        return _actors.forEach(func);
    }

    function reduceActors(uint256 acc, function(uint256,address) external returns (uint256) func)
        public
        returns (uint256)
    {
        return _actors.reduce(acc, func);
    }

    function actors() external view returns (address[] memory) {
        return _actors.addrs;
    }

    function netDeposits() external view returns (uint256) {
        return ghost_depositSum + ghost_forcePushSum - ghost_withdrawSum;
    }

    function callSummary() external view {
        console.log("Call summary:");
        console.log("-------------------");
        console.log("deposit", calls["deposit"]);
        console.log("withdraw", calls["withdraw"]);
        console.log("sendFallback", calls["sendFallback"]);
        console.log("approve", calls["approve"]);
        console.log("transfer", calls["transfer"]);
        console.log("transferFrom", calls["transferFrom"]);
        // console.log("forcePush", calls["forcePush"]);
        console.log("-------------------");

        console.log("Zero withdrawals:", ghost_zeroWithdrawals);
        console.log("Zero transferFroms:", ghost_zeroTransferFroms);
        console.log("Zero transfers:", ghost_zeroTransfers);
    }

    function _pay(address to, uint256 amount) internal {
        if (token == address(0)) {
            (bool s,) = to.call{value: amount}("");
            require(s, "pay() failed");
        } else {
            deal(token, to, amount);
        }
    }

    receive() external payable {}
}
