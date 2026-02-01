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
 *   - ADMIN: Admin address for the vault (FUN_OPS role)
 *            For autonomous Kincho operation, set this to KINCHO_PRIVATE_KEY's address.
 *            For production, consider using a multisig that includes Kincho.
 *   - TOKEN_NAME: Name for the vault token (e.g., "AI ETH")
 *   - TOKEN_SYMBOL: Symbol for the vault token (e.g., "aiETH")
 *   - ETHERSCAN_API_KEY: For contract verification
 *
 * @dev Admin Role (FUN_OPS):
 *   The ADMIN address is set as FUN_OPS in the vault, which can:
 *   - Call allocate() to delegate Aave credit to cities/projects
 *   - Call claimInterest() to withdraw excess interest
 *   - Receive rescued ETH and tokens via recoverFunds()
 *
 *   For Kincho AI agent to execute lend transactions autonomously,
 *   the ADMIN should be set to Kincho's wallet address (derived from KINCHO_PRIVATE_KEY).
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
