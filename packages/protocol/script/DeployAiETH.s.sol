// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {AiETH} from "../src/aiETH.sol";

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

        AiETH aiETH = new AiETH();
        console.log("AiETH deployed at:", address(aiETH));

        aiETH.initialize(depositToken, aaveMarket, debtToken, admin, name, symbol);
        console.log("AiETH initialized");

        vm.stopBroadcast();

        console.log("Deployment complete!");
    }
}
