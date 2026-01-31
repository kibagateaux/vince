// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {AiETH} from "../src/aiETH.sol";

/**
 * @title DeployAiETH
 * @notice Deploy script for AiETH vault contract
 *
 * @dev Usage with verification:
 *   forge script script/DeployAiETH.s.sol:DeployAiETH \
 *     --rpc-url sepolia \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 *
 * Required env vars:
 *   - DEPOSIT_TOKEN: Address of the reserve token (e.g., WETH)
 *   - DEBT_TOKEN: Address of Aave debt token
 *   - AAVE_MARKET: Address of Aave lending pool
 *   - ADMIN: Admin address for the vault
 *   - TOKEN_NAME: Name for the vault token (e.g., "AI ETH")
 *   - TOKEN_SYMBOL: Symbol for the vault token (e.g., "aiETH")
 *   - ETHERSCAN_API_KEY: For contract verification
 */
contract DeployAiETH is Script {
    function run() external {
        // Load configuration from environment variables
        address depositToken = vm.envAddress("DEPOSIT_TOKEN");
        address debtToken = vm.envAddress("DEBT_TOKEN");
        address aaveMarket = vm.envAddress("AAVE_MARKET");
        address admin = vm.envAddress("ADMIN");
        string memory name = vm.envString("TOKEN_NAME");
        string memory symbol = vm.envString("TOKEN_SYMBOL");

        console.log("Deploying AiETH with:");
        console.log("  Deposit Token:", depositToken);
        console.log("  Debt Token:", debtToken);
        console.log("  Aave Market:", aaveMarket);
        console.log("  Admin:", admin);
        console.log("  Name:", name);
        console.log("  Symbol:", symbol);

        vm.startBroadcast();

        // Deploy AiETH (no constructor args - verification is straightforward)
        AiETH aiETH = new AiETH();
        console.log("AiETH deployed at:", address(aiETH));

        // Initialize the vault
        aiETH.initialize(depositToken, aaveMarket, debtToken, admin, name, symbol);
        console.log("AiETH initialized");

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("Contract Address:", address(aiETH));
        console.log("");
        console.log("If verification failed, manually verify with:");
        console.log("  forge verify-contract", address(aiETH), "src/aiETH.sol:AiETH --chain sepolia");
    }
}
