pragma solidity ^0.8.26;

import {AiETHBaseTest} from "./AiETHBaseTest.t.sol";
import {IERC20x, IAaveMarket, IAiETH, AaveErrors} from "../../src/Interfaces.sol";
import {AiETH} from "../../src/AiETH.sol";

contract AiETHCore is AiETHBaseTest {
    function test_initialize_mustHaveMultiSigDeployed() public view {
        address funCityTreasury = address(0xC958dEeAB982FDA21fC8922493d0CEDCD26287C3);
        address progfunCityTreasury = address(aiETH.FUN_OPS());
        uint256 manualSize;
        uint256 configedSize;
        assembly {
            manualSize := extcodesize(funCityTreasury)
            configedSize := extcodesize(progfunCityTreasury)
        }

        assertGt(configedSize, 0);
        assertEq(manualSize, configedSize);
    }

    function invariant_allocate_increaseTotalDelegated() public {
        // sample vals. uneven city/allocate vals to ensure overwrites work
        address[2] memory cities = [address(0x83425), address(0x9238521)];
        // wei not ether bc usdc only has 8 decimals
        uint256[4] memory amounts = [uint256(11241 wei), uint256(49134 wei), uint256(84923 wei), uint256(84923 wei)];

        // deposit some amount so we can delegate credit
        _depositnnEth(address(0x14632332), 1000 ether, true);
        (,, uint256 availableBorrow,,, uint256 hf) = aave.getUserAccountData(address(aiETH));
        assertGt(availableBorrow, 100000000);

        vm.startPrank(aiETH.FUN_OPS());

        assertEq(aiETH.totalCreditDelegated(), 0);
        aiETH.allocate(cities[0], amounts[0]);
        assertEq(aiETH.totalCreditDelegated(), amounts[0]);
        aiETH.allocate(cities[1], amounts[1]);
        assertEq(aiETH.totalCreditDelegated(), amounts[0] + amounts[1]);
        aiETH.allocate(cities[0], amounts[2]);
        assertEq(aiETH.totalCreditDelegated(), amounts[2] + amounts[1]);
        aiETH.allocate(cities[1], amounts[3]);
        assertEq(aiETH.totalCreditDelegated(), amounts[2] + amounts[3]);

        vm.stopPrank();
    }

    function test_initialize_configSetup() public virtual {
        assertEq(address(reserveToken), address(WETH));
        assertEq(address(debtToken), address(debtUSDC));
        assertEq(address(borrowToken), address(USDC));
    }

    function test_initialize_cantReinitialize() public {
        vm.expectRevert(AiETH.AlreadyInitialized.selector);
        aiETH.initialize(address(reserveToken), address(aave), address(debtToken), "funCity Ethereum", "aiETH");
    }

    function test_increaseAllowance_updatesAllowanceValue() public {
        vm.prank(aiETH.FUN_OPS());
        aiETH.increaseAllowance(address(0xbeef), 1000 ether);
        assertEq(aiETH.allowance(aiETH.FUN_OPS(), address(0xbeef)), 1000 ether);
        vm.prank(aiETH.FUN_OPS());
        aiETH.increaseAllowance(address(0xbeef), 1000 ether);
        assertEq(aiETH.allowance(aiETH.FUN_OPS(), address(0xbeef)), 2000 ether);
    }

    function test_increaseAllowance_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit IERC20x.Approval(aiETH.FUN_OPS(), address(0xbeef), 1000 ether);
        vm.prank(aiETH.FUN_OPS());
        aiETH.increaseAllowance(address(0xbeef), 1000 ether);
        vm.expectEmit(true, true, true, true);
        emit IERC20x.Approval(aiETH.FUN_OPS(), address(0xbeef), 2000 ether);
        vm.prank(aiETH.FUN_OPS());
        aiETH.increaseAllowance(address(0xbeef), 1000 ether);
    }

    function test_initialize_setsProperDepositToken() public view {
        if (address(aiETH.reserveToken()) == address(WETH)) {
            assertEq(address(aiETH.aToken()), address(0xD4a0e0b9149BCee3C920d2E00b5dE09138fd8bb7));
            return;
        } else if (address(aiETH.reserveToken()) == address(USDC)) {
            assertEq(address(aiETH.aToken()), address(0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB));
        } else {
            revert("Invalid reserve token");
        }
    }

    function test_deposit_revertsOn0AddressReceiver(address user, uint256 amount) public assumeValidAddress(user) {
        uint256 n = _depositnnEth(user, amount, true);
        vm.prank(user);
        reserveToken.approve(address(aiETH), n);

        vm.expectRevert(AiETH.InvalidReceiver.selector);
        vm.prank(user);
        aiETH.depositOnBehalfOf(n, address(0), makeAddr("boogawugi"));
    }

    function test_deposit_revertsOnBelowMinDeposit(address user, uint256 amount) public assumeValidAddress(user) {
        vm.assume(amount < aiETH.MIN_DEPOSIT());

        vm.prank(user);
        reserveToken.approve(address(aiETH), amount);

        vm.prank(user);
        vm.expectRevert(AiETH.BelowMinDeposit.selector);
        aiETH.deposit(amount);
    }

    function test_deposit_emitsProperEvent(address user, uint256 amount) public assumeValidAddress(user) {
        uint256 n = _boundDepositAmount(amount, false);
        deal(address(reserveToken), user, n);

        vm.startPrank(user);
        reserveToken.approve(address(aiETH), n);

        vm.expectEmit(true, true, true, true);
        emit AiETH.Deposit(user, user, n, aiETH.FUN_OPS(), address(aiETH));
        aiETH.deposit(n);
        vm.stopPrank();
    }

    function test_depositOnBehalfOf_emitsProperEvent(address user, uint256 amount) public assumeValidAddress(user) {
        uint256 n = _boundDepositAmount(amount, false);
        deal(address(reserveToken), user, n);

        vm.startPrank(user);
        reserveToken.approve(address(aiETH), n);

        vm.expectEmit(true, true, true, true);
        emit AiETH.Deposit(user, makeAddr("boogawugi"), n, aiETH.FUN_OPS(), address(0xbeef));
        aiETH.depositOnBehalfOf(n, makeAddr("boogawugi"), address(0xbeef));
        vm.stopPrank();
    }

    function test_depositOnBehalfOf_updatesProperRecipient(address user, uint256 amount)
        public
        assumeValidAddress(user)
    {
        uint256 n = _boundDepositAmount(amount, false);
        deal(address(reserveToken), user, n);

        vm.startPrank(user);
        reserveToken.approve(address(aiETH), n);
        aiETH.depositOnBehalfOf(n, address(0xbeef), makeAddr("boogawugi"));
        vm.stopPrank();

        assertEq(aiETH.balanceOf(user), 0);
        assertEq(aiETH.balanceOf(address(0xbeef)), n);
    }

    function test_depositWithPreference_emitsProperEvent(address user, uint256 amount)
        public
        assumeValidAddress(user)
    {
        uint256 n = _boundDepositAmount(amount, false);
        deal(address(reserveToken), user, n);

        vm.startPrank(user);
        reserveToken.approve(address(aiETH), n);

        vm.expectEmit(true, true, true, true);
        emit AiETH.Deposit(user, user, n, aiETH.FUN_OPS(), address(0xbeef));
        aiETH.depositWithPreference(n, aiETH.FUN_OPS(), address(0xbeef));
        vm.stopPrank();
    }

    function test_depositAndApprove_emitsProperEvent(address user, uint256 amount) public assumeValidAddress(user) {
        uint256 n = _boundDepositAmount(amount, false);
        deal(address(reserveToken), user, n);

        vm.startPrank(user);
        reserveToken.approve(address(aiETH), n);

        vm.expectEmit(true, true, true, true);
        emit AiETH.Deposit(user, user, n, aiETH.FUN_OPS(), address(aiETH));
        aiETH.depositAndApprove(address(0xbeef), n);
        vm.stopPrank();
    }

    function test_depositAndApprove_updatesAllowance(address user, uint256 amount) public assumeValidAddress(user) {
        uint256 n = _boundDepositAmount(amount, false);
        deal(address(reserveToken), user, n);
        vm.startPrank(user);
        reserveToken.approve(address(aiETH), n);
        aiETH.depositAndApprove(address(0xbeef), n);
        vm.stopPrank();
        assertEq(aiETH.allowance(user, address(0xbeef)), n);
    }

    function test_pullReserves_revertNotfunCityTreasury(address caller, uint256 amount) public {
        vm.assume(caller != aiETH.FUN_OPS());
        vm.prank(caller);
        vm.expectRevert(AiETH.NotfunCity.selector);
        aiETH.pullReserves(amount);
    }

    function test_pullReserves_onlyfunCityTreasury(address depositor, address rando)
        public
        assumeValidAddress(rando)
        assumeValidAddress(depositor)
    {
        vm.assume(rando != aiETH.FUN_OPS());

        // auth should work on 0 yield, 0 deposits
        vm.prank(aiETH.FUN_OPS());
        aiETH.pullReserves(0);

        vm.prank(rando);
        vm.expectRevert(AiETH.NotfunCity.selector);
        aiETH.pullReserves(0);

        // auth should work w/ yield/deposits
        _depositnnEth(depositor, 10 ether, true);
        vm.warp(block.timestamp + 10 days);

        vm.prank(aiETH.FUN_OPS());
        aiETH.pullReserves(1);

        vm.prank(rando);
        vm.expectRevert(AiETH.NotfunCity.selector);
        aiETH.pullReserves(1);
    }

    function invariant_getYieldEarned_aTokenVsTotalSupply() public {
        uint256 n = _depositnnEth(address(0x14632332), 100 ether, true);
        vm.warp(block.timestamp + 888888);

        // check raw aave values calculations
        uint256 diff =
            (aiETH.aToken().balanceOf(address(aiETH)) / aiETH.reserveVsATokenDecimalOffset()) - aiETH.totalSupply();

        // check internal decimaled calculations
        uint256 diff2 = aiETH.underlying() - aiETH.totalSupply();

        assertGt(diff, 0);
        // - 1 to account for rounding errors btw aave tokens
        assertGe(diff, diff2 - 1);
        assertGe(aiETH.getYieldEarned(), diff - 1);
    }

    // TODO test reserveToken price goes down and becomes liquidatable
    // reserveToken price goes up and more credit available
    //

    function test_pullReserves_sendsATokenToTreasury(address depositor, uint256 amount)
        public
        assumeValidAddress(depositor)
    {
        uint256 n = _depositnnEth(depositor, amount, true);
        vm.warp(block.timestamp + 888888);

        uint256 yield = aiETH.getYieldEarned();
        assertGt(yield, 0);

        emit log_named_uint("yield", yield);
        emit log_named_uint("supply", aiETH.totalSupply());
        emit log_named_uint("underlying", aiETH.underlying());

        vm.startPrank(aiETH.FUN_OPS());
        aiETH.pullReserves(yield);
        vm.stopPrank();

        assertGe(yield, aiETH.aToken().balanceOf(aiETH.FUN_OPS()) - 1);
        assertEq(0, aiETH.reserveToken().balanceOf(aiETH.FUN_OPS()));
    }

    // AiETH.invariant.t.sol tests this already but do it again
    function test_pullReserves_onlyWithdrawExcessReserves(address depositor, uint256 amount)
        public
        assumeValidAddress(depositor)
    {
        address funCity = aiETH.FUN_OPS();
        assertEq(0, aiETH.underlying());
        assertEq(0, aiETH.aToken().balanceOf(funCity));
        assertEq(0, aiETH.reserveToken().balanceOf(funCity));

        uint256 n = _depositnnEth(depositor, amount, true);
        vm.warp(block.timestamp + 888888);

        uint256 yield = aiETH.getYieldEarned();
        assertGt(yield, 0);

        assertEq(0, aiETH.aToken().balanceOf(aiETH.FUN_OPS()));

        vm.startPrank(funCity);
        uint256 reservesToPull = yield / 2;
        aiETH.pullReserves(reservesToPull);

        emit log_named_uint("interest earned", yield);
        emit log_named_uint("reserves", reservesToPull);

        // approximate bc i cant figure out this 1 wei yield from aave
        assertGe(reservesToPull + 5, aiETH.aToken().balanceOf(funCity));

        emit log_named_uint("city bal 3", aiETH.reserveToken().balanceOf(funCity));

        uint256 yield2 = aiETH.getYieldEarned();
        emit log_named_uint("net interest 2", yield2);
        assertGe(yield2 + 1, yield - reservesToPull); // + 1 handle /2 rounding
    }

    function test_pullReserves_revertIfOverdrawn(address depositor, uint256 amount)
        public
        assumeValidAddress(depositor)
    {
        uint256 n = _depositnnEth(depositor, amount, true);
        vm.warp(block.timestamp + 888888);

        // assertGt(aiETH.underlying(), aiETH.totalSupply());
        // over/under flow not caused from this line

        uint256 diff = aiETH.underlying() - aiETH.totalSupply();
        assertGt(diff, 0);
        assertGt(n, diff);

        vm.startPrank(aiETH.FUN_OPS());
        vm.expectRevert(AiETH.InsufficientReserves.selector);
        aiETH.pullReserves(n);
    }

    function test_pullReserves_revertOverDebtRatio(address depositor, uint256 amount)
        public
        assumeValidAddress(depositor)
    {
        uint256 n = _depositForBorrowing(depositor, amount);
        (, uint256 borrowable) = _borrowable(n);
        // if(borrowable < 1000) return;

        vm.prank(address(aiETH));
        debtToken.approveDelegation(depositor, borrowable * 10); // outside AiETH so doesnt affect getExpectedHF until borrow
        vm.prank(depositor);
        aave.borrow(borrowToken, borrowable * 2, 2, 200, address(aiETH));

        uint256 totalUnderlying = aiETH.underlying();
        uint256 unhealthyHF = aiETH.getExpectedHF();
        assertGe(aiETH.MIN_RESERVE_FACTOR(), unhealthyHF);
        assertLe(aiETH.MIN_REDEEM_FACTOR(), unhealthyHF);

        vm.startPrank(aiETH.FUN_OPS());
        vm.expectRevert(AiETH.InsufficientReserves.selector);
        aiETH.pullReserves(10);
        vm.stopPrank();

        // no change bc cant withdraw
        assertEq(aiETH.underlying(), totalUnderlying);
        assertEq(unhealthyHF, aiETH.getExpectedHF());
    }

    function test_allocate_borrowFailsIfOverDebtRatio(address city, uint256 _deposit) public assumeValidAddress(city) {
        uint256 deposit = _depositForBorrowing(makeAddr("boogawugi"), _deposit);
        (uint256 delegatedCredit, uint256 borrowable) = _borrowable(deposit);

        _allocate(city, borrowable);

        vm.startPrank(city);
        aave.borrow(borrowToken, borrowable, 2, 200, address(aiETH));

        // LTV above target
        (,, uint256 availableBorrow,, uint256 ltv, uint256 hf) = aave.getUserAccountData(address(aiETH));
        assertGe(hf, aiETH.MIN_RESERVE_FACTOR());

        // uint256 debtBalance1 = aiETH.getDebt();
        // vm.expectRevert(bytes(AaveErrors.COLLATERAL_CANNOT_COVER_NEW_BORROW), address(aave));
        vm.expectRevert();
        aave.borrow(borrowToken, availableBorrow > 100 ? availableBorrow / 1e2 + 1 : 1, 2, 200, address(aiETH)); // 1 wei over target LTV should revert

        // LTV still above target
        (,, uint256 availableBorrow2,, uint256 ltv2, uint256 hf2) = aave.getUserAccountData(address(aiETH));
        assertGe(aiETH.convertToDecimal(hf2, 18, 2), aiETH.MIN_RESERVE_FACTOR());
        // assertEq(aiETH.getDebt(), debtBalance1);
        vm.stopPrank();
    }

    function test_withdraw_redeemBelowReserveFactor(address user, uint256 amount) public assumeValidAddress(user) {
        uint256 n = _depositForBorrowing(user, amount);
        (, uint256 borrowable) = _borrowable(n);
        vm.warp(block.timestamp + 888);
        vm.prank(aiETH.FUN_OPS());
        aiETH.allocate(makeAddr("boogawugi"), borrowable);

        uint256 safeWithdraw = (n * 3) / 4;
        vm.prank(user);
        // should be able withdraw more than reserve factor, less than redeem factor
        aiETH.withdraw(safeWithdraw);

        assertLt(aiETH.getExpectedHF(), aiETH.MIN_RESERVE_FACTOR());
        assertGe(aiETH.getExpectedHF(), aiETH.MIN_REDEEM_FACTOR());
    }

    function test_withdraw_revertOnMaliciousWithdraws(address user, uint256 amount) public assumeValidAddress(user) {
        uint256 n = _depositForBorrowing(user, amount);
        (, uint256 borrowable) = _borrowable(n);
        vm.warp(block.timestamp + 888);

        vm.prank(aiETH.FUN_OPS());
        aiETH.allocate(makeAddr("boogawugi"), borrowable);

        assertGe(aiETH.getExpectedHF(), aiETH.MIN_REDEEM_FACTOR());

        vm.expectRevert(AiETH.MaliciousWithdraw.selector);
        _withdrawnnEth(user, n);
        // still above min redeem factor bc withdraw failed
        assertGe(aiETH.getExpectedHF(), aiETH.MIN_REDEEM_FACTOR());
    }

    function test_withdrawTo_updatesProperBalances(address user, uint256 amount) public assumeValidAddress(user) {
        uint256 n = _depositnnEth(user, amount, true);
        assertEq(aiETH.balanceOf(user), n);
        emit log_named_uint("recipient init balance ", aiETH.balanceOf(makeAddr("boogawugi")));
        assertEq(aiETH.balanceOf(makeAddr("boogawugi")), 0);
        assertEq(reserveToken.balanceOf(user), 0);
        emit log_named_uint("recipient init balance ", reserveToken.balanceOf(makeAddr("boogawugi")));
        assertEq(reserveToken.balanceOf(makeAddr("boogawugi")), 0);

        uint256 withdrawn = n / 2;
        vm.prank(user);
        aiETH.withdrawTo(withdrawn, makeAddr("boogawugi"));

        emit log_named_uint("user remaining balance ", aiETH.balanceOf(user));
        assertEq(reserveToken.balanceOf(user), 0);
        assertEq(aiETH.balanceOf(user), n - withdrawn);

        emit log_named_address("reserve token ", address(reserveToken));
        assertEq(reserveToken.balanceOf(makeAddr("boogawugi")), withdrawn);
        emit log_named_uint("recipient remaining balance ", aiETH.balanceOf(makeAddr("boogawugi")));
        assertEq(aiETH.balanceOf(makeAddr("boogawugi")), 0);
    }
}
