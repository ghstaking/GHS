const { expect } = require("chai");
const { ethers } = require("hardhat");
const { sleep, stake } = require("./Utils.js");

describe("GreenHouse", function () {
    const _totalSupply1e18 = "1000000000000000000";

    const bonusPoolTimer = 3600 * 6; // 6 hours
    const monthlyPoolTimer = 2592000; // 30 days

    const smallStake = 100;
    const mediumStake = 1000;
    const normalStake = 10 ** 6;

    beforeEach(async function () {
        [
            owner,
            stakeholder,
            anotherStakeholder,
            referrer,
            stranger,
            partner,
            platform,
            ...addresses
        ] = await ethers.getSigners();
        const Centric = await ethers.getContractFactory("Centric");
        centric = await Centric.deploy(ethers.utils.parseUnits("1"));

        const GreenHouse = await ethers.getContractFactory("GreenHouse");
        greenHouse = await GreenHouse.deploy(centric.address, partner.address, [
            platform.address,
        ]);
    });

    it("Centric owner supply should be totalSupply", async function () {
        expect(await centric.totalSupply()).to.equals(_totalSupply1e18);
        expect(await centric.balanceOf(owner.address)).to.equals(
            _totalSupply1e18
        );
    });

    it("Centric should transfer", async function () {
        await centric.transfer(stakeholder.address, 42);
        expect(await centric.balanceOf(stakeholder.address)).to.equals(42);
    });

    // GreenHouse tests

    it("Balance, rewards and withdrawals of a stranger should be zero", async function () {
        expect(await greenHouse.stakeOf(stranger.address)).to.equals(0);
        expect(
            await greenHouse.accumulativeRewardOf(stranger.address)
        ).to.equals(0);
        expect(
            await greenHouse.withdrawableRewardOf(stranger.address)
        ).to.equals(0);
        expect(await greenHouse.withdrawnRewardOf(stranger.address)).to.equals(
            0
        );
    });

    it("Stake fees should work", async function () {
        const netStake = 900000; // 90%
        const referrerReward = 5000; // .5%
        const partnerReward = 5000; // .5%
        const platformReward = 10000; // 1%
        const bonusRewardPool = 10000; // 1%
        const monthlyRewardPool = 0; // 0% due to referral used

        await stake(stakeholder, normalStake, referrer.address);

        expect(await greenHouse.stakeOf(stakeholder.address)).to.equals(
            netStake
        );
        expect(await centric.balanceOf(referrer.address)).to.equals(
            referrerReward
        );
        expect(await centric.balanceOf(partner.address)).to.equals(
            partnerReward
        );
        expect(await centric.balanceOf(platform.address)).to.equals(
            platformReward
        );
        expect(await greenHouse.bonusRewardPool()).to.equals(bonusRewardPool);
        expect(await greenHouse.monthlyRewardPool()).to.equals(
            monthlyRewardPool
        );
    });

    it("Ultrasmall stake should work", async function () {
        await expect(stake(owner, 1)).to.not.be.reverted;
    });

    it("Zero stake should be reverted", async function () {
        await expect(stake(owner, 0)).to.be.revertedWith(
            "GreenHouse: staking zero"
        );
    });

    it("Zero unstake should be reverted", async function () {
        await expect(greenHouse.connect(owner).unstake(0)).to.be.revertedWith(
            "GreenHouse: unstaking zero"
        );
    });

    it("Unstake by stranger should fail", async function () {
        await expect(
            greenHouse.connect(stranger).unstake(42)
        ).to.be.revertedWith("GreenHouse: unstake amount");
    });

    it("Unstake to zero should work", async function () {
        await stake(stakeholder, normalStake);
        await greenHouse.connect(stakeholder).unstake(900000); // 90%
        expect(await greenHouse.stakeOf(stakeholder.address)).to.equals(0);
        expect(
            await greenHouse.withdrawableRewardOf(stakeholder.address)
        ).to.equals(69999);
    });

    it("Withdraw should work", async function () {
        await stake(stakeholder, mediumStake);
        expect(
            await greenHouse.withdrawableRewardOf(stakeholder.address)
        ).to.equals(69);
        await greenHouse.connect(stakeholder).withdrawReward();
        expect(await centric.balanceOf(stakeholder.address)).to.equals(69);
        expect(
            await greenHouse.withdrawnRewardOf(stakeholder.address)
        ).to.equals(69);
        expect(
            await greenHouse.withdrawableRewardOf(stakeholder.address)
        ).to.equals(0);
    });

    it("Egor test should work", async function () {
        await stake(stakeholder, 10000);
        await stake(anotherStakeholder, 10000);
        await greenHouse.connect(anotherStakeholder).unstake(5000);
        expect(
            await greenHouse.withdrawableRewardOf(stakeholder.address)
        ).to.equals(1224);
        expect(
            await greenHouse.withdrawableRewardOf(anotherStakeholder.address)
        ).to.equals(427);
    });

    it("Referral fee should go to monthly pool if no referrer present", async function () {
        const monthlyRewardPool = 5000; // %.5 due to referral not used
        await stake(stakeholder, normalStake);
        expect(await greenHouse.monthlyRewardPool()).to.equals(
            monthlyRewardPool
        );
    });

    it("Referral fee should go to referrer if present", async function () {
        await stake(stakeholder, normalStake, referrer.address);
        expect(await centric.balanceOf(referrer.address)).to.equals(5000); // .5%
    });

    it("Should not transfer if nothing to withdraw", async function () {
        await stake(stakeholder, 10000);
        await greenHouse.connect(stakeholder).withdrawReward();
        expect(await centric.balanceOf(stakeholder.address)).to.equals(699);
        await expect(
            greenHouse.connect(stakeholder).withdrawReward()
        ).to.be.revertedWith("GreenHouse: nothing to withdraw");
        expect(await centric.balanceOf(stakeholder.address)).to.equals(699);
    });

    it("Test stake reward should be distributed properly", async function () {
        await stake(owner, 10000);
        expect(await greenHouse.withdrawableRewardOf(owner.address)).to.equals(
            699
        );
        expect(
            await greenHouse.withdrawableRewardOf(stakeholder.address)
        ).to.equals(0);
        await stake(stakeholder, 10000);
        expect(await greenHouse.withdrawableRewardOf(owner.address)).to.equals(
            1049
        );
        expect(
            await greenHouse.withdrawableRewardOf(stakeholder.address)
        ).to.equals(349);
    });

    it("Test all users staked rewards simple", async function () {
        await stake(stakeholder, mediumStake);
        expect(
            await greenHouse.withdrawableRewardOf(stakeholder.address)
        ).to.equals(69);
        await stake(anotherStakeholder, mediumStake);
        expect(await greenHouse.stakeOf(stakeholder.address)).to.equals(900);
        expect(await greenHouse.stakeOf(anotherStakeholder.address)).to.equals(
            900
        );
        await greenHouse.connect(anotherStakeholder).unstake(900);
        expect(await greenHouse.stakeOf(anotherStakeholder.address)).to.equals(
            0
        );
        expect(
            await greenHouse.withdrawableRewardOf(anotherStakeholder.address)
        ).to.equals(34);
        expect(
            await greenHouse.withdrawableRewardOf(stakeholder.address)
        ).to.equals(136);
    });

    it("Bonus reward pool should not be distributer while timer's on", async function () {
        await stake(anotherStakeholder, normalStake);
        await expect(
            greenHouse.connect(anotherStakeholder).unstake(1000)
        ).to.not.emit(greenHouse, "BonusRewardPoolDistributed");
    });

    it("Monthly reward pool should not be distributed while timer's on", async function () {
        await stake(stakeholder, normalStake);
        await expect(greenHouse.connect(stakeholder).unstake(1000)).to.not.emit(
            greenHouse,
            "MonthlyRewardPoolDistributed"
        );
        await sleep(2 * monthlyPoolTimer);
        expect(await greenHouse.monthlyRewardPoolCountdown()).to.equals(0);
        await expect(greenHouse.connect(stakeholder).unstake(1000)).to.emit(
            greenHouse,
            "MonthlyRewardPoolDistributed"
        );
    });

    it("Monthly reward pool's timer should reset", async function () {
        await stake(stakeholder, normalStake);
        await sleep(monthlyPoolTimer / 2);
        expect(await greenHouse.monthlyRewardPoolCountdown()).to.not.equals(0);
        await sleep(monthlyPoolTimer);
        expect(await greenHouse.monthlyRewardPoolCountdown()).to.equals(0);
        await stake(anotherStakeholder, normalStake);
        expect(await greenHouse.monthlyRewardPoolCountdown()).to.not.equals(0);
        await sleep(monthlyPoolTimer * 2);
        expect(await greenHouse.monthlyRewardPoolCountdown()).to.equals(0);
    });

    it("Bonus reward pool's timer should reset", async function () {
        await stake(stakeholder, normalStake);
        await sleep(bonusPoolTimer / 2);
        expect(await greenHouse.bonusRewardPoolCountdown()).to.not.equals(0);
        await sleep(bonusPoolTimer);
        expect(await greenHouse.bonusRewardPoolCountdown()).to.equals(0);
        await stake(anotherStakeholder, normalStake);
        expect(await greenHouse.bonusRewardPoolCountdown()).to.not.equals(0);
    });

    it("Monthly and bonus reward pools should be correctly distributed", async function () {
        await stake(stakeholder, normalStake);
        expect(
            await greenHouse.withdrawableRewardOf(stakeholder.address)
        ).to.equals(69999);
        await sleep(2 * monthlyPoolTimer);
        await stake(stakeholder, 1);
        expect(
            await greenHouse.withdrawableRewardOf(stakeholder.address)
        ).to.equals(76499);
        // 6999 (stake reward) + 2500 (50% monthly reward pool (5000)) + 4000 (40% bonus pool (10000))
    });

    it("Bonus reward pool countdown should increase when new stake qualified", async function () {
        expect(await greenHouse.bonusRewardPoolCountdown()).to.equals(
            bonusPoolTimer
        );
        await stake(stakeholder, normalStake);
        await sleep(bonusPoolTimer);
        expect(await greenHouse.bonusRewardPoolCountdown()).to.not.equals(0);
        await sleep(15 * 60);
        expect(await greenHouse.bonusRewardPoolCountdown()).to.equals(0);
    });

    // it("Restake should qualify for bonus pool leaderboard", async function() {
    //     await stake(stakeholder, smallStake);
    //     await stake(stakeholder, normalStake);
    //     expect(await greenHouse.bonusPoolLeaderboard()).to.have.lengthOf(1);
    //     await stake(stakeholder, normalStake);
    //     expect(await greenHouse.bonusPoolLeaderboard()).to.have.lengthOf(2);
    //     await stake(anotherStakeholder, normalStake);
    //     expect(await greenHouse.bonusPoolLeaderboard()).to.have.lengthOf(3);
    // });

    it("Small stake should not qualify for bonus pool leaderboard", async function () {
        await stake(stakeholder, smallStake);
        expect(await greenHouse.bonusPoolLeaderboard()).to.have.lengthOf(0);
    });

    it("Bonus reward pool leader should work", async function () {
        await stake(stakeholder, normalStake);
        expect(await centric.balanceOf(stakeholder.address)).to.equals(0);
        expect(
            await greenHouse.withdrawableRewardOf(stakeholder.address)
        ).to.equals(69999);
        await sleep(bonusPoolTimer * 2);
        await stake(anotherStakeholder, 1); // trigger bonus reward pool distribution
        expect(
            await greenHouse.withdrawableRewardOf(stakeholder.address)
        ).to.equals(73999);
        expect(await centric.balanceOf(stakeholder.address)).to.equals(4000);
    });

    it("Stragner should not be able to set platform wallets", async function () {
        await expect(
            greenHouse.connect(stranger).setPlatformWallets([stranger.address])
        ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Stranger should not be able to set partner wallet", async function () {
        await expect(
            greenHouse.connect(stranger).setPartnerWallet(stranger.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Owner should be able to set partner wallet", async function () {
        await expect(
            greenHouse.connect(owner).setPartnerWallet(stranger.address)
        ).to.not.be.reverted;
    });

    it("Owner should be able to set platform wallets", async function () {
        await expect(
            greenHouse.connect(owner).setPlatformWallets([stranger.address])
        ).to.not.be.reverted;
    });

    it("Get all stakes should work", async function () {
        await stake(owner, 1000);
        expect(await greenHouse.allStakes()).to.equals(900);
    });

    it("Get bonus pool leaderboard should work", async function () {
        await stake(owner, 10000);
        expect(await greenHouse.bonusPoolLeaderboard()).to.have.ordered.members(
            [owner.address]
        );
    });

    it("Bonus pool leaderboard shift should work", async function () {
        let kek = 15;
        for (let addr of addresses) {
            await stake(addr, 10000);
            if (!--kek) break;
        }
        expect(await greenHouse.bonusPoolLeaderboard()).to.have.lengthOf(10);
    });

    it("Stake should emit event", async function () {
        const amount = 10000;
        await centric.transfer(stakeholder.address, amount);
        await centric.connect(stakeholder).approve(greenHouse.address, amount);
        await expect(
            greenHouse.connect(stakeholder).stake(amount, referrer.address)
        )
            .to.emit(greenHouse, "Staked")
            .withArgs(stakeholder.address, amount, referrer.address);
    });

    it("Unstake should emit event", async function () {
        const stakeAmount = 10000;
        const unstakeAmount = 9000;
        await stake(stakeholder, stakeAmount);
        await expect(greenHouse.connect(stakeholder).unstake(unstakeAmount))
            .to.emit(greenHouse, "Unstaked")
            .withArgs(stakeholder.address, unstakeAmount);
    });

    it("Withdraw should emit event", async function () {
        await stake(stakeholder, mediumStake);
        await expect(greenHouse.connect(stakeholder).withdrawReward())
            .to.emit(greenHouse, "RewardWithdrawn")
            .withArgs(stakeholder.address, 69);
    });

    it("Distribute bonus reward pool should emit event", async function () {
        await stake(stakeholder, normalStake);
        await sleep(bonusPoolTimer * 2);
        await expect(greenHouse.connect(stakeholder).withdrawReward()).to.emit(
            greenHouse,
            "BonusRewardPoolDistributed"
        );
    });

    it("Distribute monthly reward pool should emit event", async function () {
        await stake(stakeholder, normalStake);
        await sleep(monthlyPoolTimer * 2);
        await expect(greenHouse.connect(stakeholder).unstake(1000)).to.emit(
            greenHouse,
            "MonthlyRewardPoolDistributed"
        );
    });

    it("Referral rewards sould be accessable", async function () {
        expect(await greenHouse.referralRewards(referrer.address)).to.equals(0);
        await stake(stakeholder, normalStake, referrer.address);
        expect(await greenHouse.referralRewards(referrer.address)).to.equals(
            5000
        );
    });

    it("Ever staked users count should work", async function () {
        expect(await greenHouse.everStakedUsersCount()).to.equals(0);
        await stake(stakeholder, 100);
        expect(await greenHouse.everStakedUsersCount()).to.equals(1);
        await greenHouse.connect(stakeholder).unstake(90);
        expect(await greenHouse.everStakedUsersCount()).to.equals(1);
    });

    // it("Restake should work", async function() {
    //     await expect(greenHouse.connect(stakeholder).restake()).to.be.revertedWith("GreenHouse: nothing to restake");
    //     await stake(stakeholder, normalStake);
    //     expect(await greenHouse.withdrawableRewardOf(stakeholder.address)).to.equals(69999);
    //     await greenHouse.connect(stakeholder).restake();
    //     expect(await greenHouse.stakeOf(stakeholder.address)).to.equals(963004); // normalStake * 90% + 90% * 7% * normalStake
    //     expect(await greenHouse.withdrawableRewardOf(stakeholder.address)).to.equals(4899); // 7% * 7% * stake
    // });

    it("Unstake gets user kicked out from the leaderboard", async function () {
        await stake(stakeholder, 2000);
        expect(await greenHouse.bonusPoolLeaderboard()).to.have.lengthOf(1);
        await greenHouse.connect(stakeholder).unstake(1000);
        expect(await greenHouse.bonusPoolLeaderboard()).to.have.lengthOf(0);
    });

    it("If unstaked insignificant amount should not be kicked out from the leaderboard", async function () {
        await stake(stakeholder, 10000);
        await greenHouse.connect(stakeholder).unstake(1000);
        expect(await greenHouse.bonusPoolLeaderboard()).to.have.lengthOf(1);
        expect(await greenHouse.bonusPoolLeaderboard()).to.have.ordered.members(
            [stakeholder.address]
        );
    });

    it("Shoud lose positions when unstake", async function () {
        await stake(stakeholder, 1000);
        await stake(stakeholder, 1000);
        await stake(stranger, 10000);
        await stake(anotherStakeholder, 1500);
        expect(await greenHouse.bonusPoolLeaderboard()).to.have.lengthOf(4);
        await greenHouse.connect(stakeholder).unstake(900);
        await greenHouse.connect(stranger).unstake(1200);
        expect(await greenHouse.bonusPoolLeaderboard()).to.have.lengthOf(3);
        await greenHouse.connect(anotherStakeholder).unstake(200);
        expect(await greenHouse.bonusPoolLeaderboard()).to.have.lengthOf(3);
        await greenHouse.connect(anotherStakeholder).unstake(1000);
        expect(await greenHouse.bonusPoolLeaderboard()).to.have.lengthOf(2);
        await greenHouse.connect(stranger).unstake(7500);
        expect(await greenHouse.bonusPoolLeaderboard()).to.have.lengthOf(1);
        await greenHouse.connect(stakeholder).unstake(666);
        expect(await greenHouse.bonusPoolLeaderboard()).to.have.lengthOf(0);
        await stake(stranger, 1000);
        expect(await greenHouse.bonusPoolLeaderboard()).to.have.lengthOf(1);

        await stake(stakeholder, 1000);
        await stake(stakeholder, 1000);
        await stake(stranger, 10000);
        await stake(anotherStakeholder, 1500);
        expect(await greenHouse.bonusPoolLeaderboard()).to.have.lengthOf(5);
        await greenHouse.connect(stakeholder).unstake(900);
        await greenHouse.connect(stranger).unstake(1200);
        expect(await greenHouse.bonusPoolLeaderboard()).to.have.lengthOf(4);
        await greenHouse.connect(anotherStakeholder).unstake(200);
        expect(await greenHouse.bonusPoolLeaderboard()).to.have.lengthOf(4);
        await greenHouse.connect(anotherStakeholder).unstake(1000);
        expect(await greenHouse.bonusPoolLeaderboard()).to.have.lengthOf(3);
        console.log(
            (
                await greenHouse.withdrawableRewardOf(stakeholder.address)
            ).toString()
        );
        console.log(
            (await greenHouse.withdrawableRewardOf(stranger.address)).toString()
        );

        await sleep(bonusPoolTimer * 2);
        await greenHouse.connect(stakeholder).unstake(1); // trigger bonus pool
        console.log(
            (
                await greenHouse.withdrawableRewardOf(stakeholder.address)
            ).toString()
        );
        console.log(
            (await greenHouse.withdrawableRewardOf(stranger.address)).toString()
        );
        await greenHouse.connect(stakeholder).withdrawReward();

        console.log(
            (
                await greenHouse.withdrawableRewardOf(stakeholder.address)
            ).toString()
        );
        await greenHouse.connect(stranger).withdrawReward();
        expect(await greenHouse.bonusPoolLeaderboard()).to.have.lengthOf(3);
        await stake(stranger, 10000);
        await stake(anotherStakeholder, 1500);
        expect(await greenHouse.bonusPoolLeaderboard()).to.have.lengthOf(5);
        await greenHouse.connect(anotherStakeholder).unstake(200);
        expect(await greenHouse.bonusPoolLeaderboard()).to.have.lengthOf(5);
    });

    it("Monthly reward pool", async function () {
        await stake(stakeholder, normalStake);
        expect(await greenHouse.monthlyRewardPool()).to.equals(5000);
        await sleep(2 * monthlyPoolTimer);
        await stake(stakeholder, 1);
        expect(await greenHouse.monthlyRewardPool()).to.equals(2500);
    });

    it("Monthly and bonus reward pools should be correctly distributed", async function () {
        await stake(stakeholder, normalStake);
        await stake(anotherStakeholder, normalStake);
        await stake(stranger, normalStake);
        await stake(anotherStakeholder, normalStake);
        console.log(
            (
                await greenHouse.withdrawableRewardOf(stakeholder.address)
            ).toString()
        );
        expect(await greenHouse.monthlyRewardPool()).to.equals(20000);
        // expect(await greenHouse.withdrawableRewardOf(stakeholder.address)).to.equals(69999);
        await sleep(2 * monthlyPoolTimer);
        await stake(stakeholder, 1);
        console.log(
            (
                await greenHouse.withdrawableRewardOf(stakeholder.address)
            ).toString()
        );
        // expect(await greenHouse.withdrawableRewardOf(stakeholder.address)).to.equals(76499);
        // 6999 (stake reward) + 2500 (50% monthly reward pool (5000)) + 4000 (40% bonus pool (10000))
    });
});
