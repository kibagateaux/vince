// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.13;

import {IERC20x} from "../src/Interfaces.sol";
import {AiETHCoreTests} from "./AiETHCore.t.sol";
import {AiETHBaseTest} from "./AiETHBaseTest.t.sol";
import {AiETHSepoliaTest} from "./sepolia/AiETHSepoliaTest.t.sol";
import {AiETHAaveIntegrationTests} from "./AiETHAave.integration.t.sol";
import {nnEthInvariantsTests} from "./WETH.invariant.t.sol";
import {WETHSymTestBase} from "./WETH.symbolic.t.sol";
import {Handler} from "./AiETHPlaybook.t.sol";

/// @notice Tests with DAI as reserve token and WBTC as debt (reverse of default Sepolia config)
/// These tests verify the protocol works with different asset configurations.

contract NNUSDCAaveIntegration is AiETHAaveIntegrationTests, AiETHSepoliaTest {
    function setUp() public override(AiETHAaveIntegrationTests, AiETHSepoliaTest) {
        // Use DAI as reserve, WBTC debt on Sepolia - set before calling parent setUp
        reserveToken = DAI_SEPOLIA;
        debtToken = debtWBTC_SEPOLIA;
        borrowToken = address(WBTC_SEPOLIA);
        aave = aaveSepolia;

        AiETHSepoliaTest.setUp();

        handler = new Handler(aiETH, address(reserveToken));

        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = Handler.deposit.selector;
        selectors[1] = Handler.withdraw.selector;
        selectors[2] = Handler.approve.selector;
        selectors[3] = Handler.transfer.selector;
        selectors[4] = Handler.transferFrom.selector;

        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }

    function test_initialize_configSetup() public virtual {
        assertEq(address(reserveToken), address(DAI_SEPOLIA));
        assertEq(address(debtToken), address(debtWBTC_SEPOLIA));
        assertEq(address(borrowToken), address(WBTC_SEPOLIA));
    }
}

contract NNUSDCCore is AiETHCoreTests, AiETHSepoliaTest {
    function setUp() public override(AiETHSepoliaTest, AiETHBaseTest) {
        // Use DAI as reserve, WBTC debt on Sepolia - set before calling parent setUp
        reserveToken = DAI_SEPOLIA;
        debtToken = debtWBTC_SEPOLIA;
        borrowToken = address(WBTC_SEPOLIA);
        aave = aaveSepolia;

        AiETHSepoliaTest.setUp();
    }

    function test_initialize_configSetup() public override {
        assertEq(address(reserveToken), address(DAI_SEPOLIA));
        assertEq(address(debtToken), address(debtWBTC_SEPOLIA));
        assertEq(address(borrowToken), address(WBTC_SEPOLIA));
    }

    function test_initialize_setsProperDepositToken() public view override {
        // Sepolia DAI aToken
        assertEq(address(aiETH.aToken()), address(0x29598b72eb5CeBd806C5dCD549490FdA35B13cD8));
    }
}

contract NNUSDCInvariants is nnEthInvariantsTests, AiETHSepoliaTest {
    function setUp() public override(nnEthInvariantsTests, AiETHSepoliaTest) {
        // Use DAI as reserve, WBTC debt on Sepolia - set before calling parent setUp
        reserveToken = DAI_SEPOLIA;
        debtToken = debtWBTC_SEPOLIA;
        borrowToken = address(WBTC_SEPOLIA);
        aave = aaveSepolia;

        AiETHSepoliaTest.setUp();

        handler = new Handler(aiETH, address(reserveToken));

        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = Handler.deposit.selector;
        selectors[1] = Handler.withdraw.selector;
        selectors[2] = Handler.approve.selector;
        selectors[3] = Handler.transfer.selector;
        selectors[4] = Handler.transferFrom.selector;

        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }

    function test_initialize_configSetup() public virtual {
        assertEq(address(reserveToken), address(DAI_SEPOLIA));
        assertEq(address(debtToken), address(debtWBTC_SEPOLIA));
        assertEq(address(borrowToken), address(WBTC_SEPOLIA));
    }
}

contract NNUSDCSymTest is WETHSymTestBase, AiETHSepoliaTest {
    function setUp() public override(AiETHSepoliaTest, AiETHBaseTest) {
        // Use DAI as reserve, WBTC debt on Sepolia - set before calling parent setUp
        reserveToken = DAI_SEPOLIA;
        debtToken = debtWBTC_SEPOLIA;
        borrowToken = address(WBTC_SEPOLIA);
        aave = aaveSepolia;

        AiETHSepoliaTest.setUp();
    }

    function test_initialize_configSetup() public virtual {
        assertEq(address(reserveToken), address(DAI_SEPOLIA));
        assertEq(address(debtToken), address(debtWBTC_SEPOLIA));
        assertEq(address(borrowToken), address(WBTC_SEPOLIA));
    }
}
