// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.26;

import {IERC20x, IAaveMarket} from "../../src/Interfaces.sol";
import {AiETHBaseTest} from "../AiETHBaseTest.t.sol";

/// @notice Sepolia network configuration for AiETH tests.
/// Sets up WBTC as reserve token and DAI as debt token on Ethereum Sepolia testnet.
abstract contract AiETHSepoliaTest is AiETHBaseTest {
    // Sepolia asset/protocol addresses (Aave V3 Sepolia)
    IERC20x public constant WBTC_SEPOLIA = IERC20x(0x29f2D40B0605204364af54EC677bD022dA425d03);
    IERC20x public constant DAI_SEPOLIA = IERC20x(0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357);
    IERC20x public constant debtDAI_SEPOLIA = IERC20x(0x22675C506A8FC26447aFFfa33640f6af5d4D4cF0);
    IERC20x public constant debtWBTC_SEPOLIA = IERC20x(0xEB016dFd303F19fbDdFb6300eB4AeB2DA7Ceac37);

    IAaveMarket public constant aaveSepolia = IAaveMarket(0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951);

    // Sepolia-specific deposit limits
    uint256 public constant MAX_AAVE_DEPOSIT_WBTC = 100 * 1e8; // 100 WBTC (8 decimals)
    uint256 public constant MAX_AAVE_DEPOSIT_DAI = 1_000_000 ether; // 1M DAI (18 decimals)

    function _getRpcUrlKey() internal pure override returns (string memory) {
        return "sepolia";
    }

    function setUp() public virtual override {
        // Set Sepolia network addresses before calling parent setUp
        reserveToken = WBTC_SEPOLIA;
        debtToken = debtDAI_SEPOLIA;
        borrowToken = address(DAI_SEPOLIA);
        aave = aaveSepolia;

        // Override deposit limits for Sepolia assets
        MAX_AAVE_DEPOSIT = MAX_AAVE_DEPOSIT_WBTC;
        MAX_AAVE_DEPOSIT_USDC = MAX_AAVE_DEPOSIT_DAI;

        super.setUp();
    }
}
