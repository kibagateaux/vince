// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.13;

import {IERC20x} from "../../src/Interfaces.sol";
import {AiEthCore} from "./AiEthCore.t.sol";
import {AiEthBaseTest} from "./AiEthBaseTest.t.sol";
import {AiEthAaveIntegration} from "./AiEthAave.integration.t.sol";
import {nnEthInvariants} from "./WETH.invariant.t.sol";
import {WETHSymTest} from "./WETH.symbolic.t.sol";

contract NNUSDCAaveIntegration is AiEthAaveIntegration {
    function setUp() public virtual override(AiEthAaveIntegration) {
        reserveToken = USDC;
        debtToken = debtWETH;
        borrowToken = address(WETH);
        super.setUp();
    }

    function test_initialize_configSetup() public virtual {
        assertEq(address(reserveToken), address(USDC));
        assertEq(address(debtToken), address(debtWETH));
        assertEq(address(borrowToken), address(WETH));
    }
}

contract NNUSDCCore is AiEthCore {
    function setUp() public virtual override(AiEthBaseTest) {
        reserveToken = USDC;
        debtToken = debtWETH;
        borrowToken = address(WETH);
        super.setUp();
    }

    function test_initialize_configSetup() public virtual override {
        assertEq(address(reserveToken), address(USDC));
        assertEq(address(debtToken), address(debtWETH));
        assertEq(address(borrowToken), address(WETH));
    }
}

contract NNUSDCInvariants is nnEthInvariants {
    function setUp() public virtual override(nnEthInvariants) {
        reserveToken = USDC;
        debtToken = debtWETH;
        borrowToken = address(WETH);
        super.setUp();
    }

    function test_initialize_configSetup() public virtual {
        assertEq(address(reserveToken), address(USDC));
        assertEq(address(debtToken), address(debtWETH));
        assertEq(address(borrowToken), address(WETH));
    }
}

contract NNUSDCSymTest is WETHSymTest {
    function setUp() public virtual override(AiEthBaseTest) {
        reserveToken = USDC;
        debtToken = debtWETH;
        borrowToken = address(WETH);
        super.setUp();
    }

    function test_initialize_configSetup() public virtual {
        assertEq(address(reserveToken), address(USDC));
        assertEq(address(debtToken), address(debtWETH));
        assertEq(address(borrowToken), address(WETH));
    }
}
