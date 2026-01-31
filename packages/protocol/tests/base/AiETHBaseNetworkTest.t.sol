// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.26;

import {IERC20x, IAaveMarket} from "../../src/Interfaces.sol";
import {AiETHBaseTest} from "../AiETHBaseTest.t.sol";

/// @notice Base network configuration for AiETH tests.
/// Sets up WETH as reserve token and USDC as debt token on Base mainnet.
abstract contract AiETHBaseNetworkTest is AiETHBaseTest {
    // Base asset/protocol addresses
    IERC20x public constant WETH = IERC20x(0x4200000000000000000000000000000000000006);
    IERC20x public constant debtWETH = IERC20x(0x24e6e0795b3c7c71D965fCc4f371803d1c1DcA1E);
    IERC20x public constant USDC = IERC20x(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
    IERC20x public constant debtUSDC = IERC20x(0x59dca05b6c26dbd64b5381374aAaC5CD05644C28);
    // BTC address (same as USDC for now based on original config)
    IERC20x public constant BTC = IERC20x(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
    IERC20x public constant debtBTC = IERC20x(0x59dca05b6c26dbd64b5381374aAaC5CD05644C28);

    IAaveMarket public constant aaveBase = IAaveMarket(0xA238Dd80C259a72e81d7e4664a9801593F98d1c5);

    function _getRpcUrlKey() internal pure virtual override returns (string memory) {
        return "base";
    }

    function _getForkBlock() internal pure virtual override returns (uint256) {
        return 23_502_225; // Pin to specific block for reproducible tests
    }

    function setUp() public virtual override {
        // Set Base network addresses before calling parent setUp
        reserveToken = WETH;
        debtToken = debtUSDC;
        borrowToken = address(USDC);
        aave = aaveBase;

        super.setUp();
    }
}
