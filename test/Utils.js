async function sleep(t) {
    await network.provider.send('evm_increaseTime', [t]);
    await network.provider.send('evm_mine');
}

async function stake(signer, amount, referrer = ethers.constants.AddressZero) {
    await centric.transfer(signer.address, amount);
    await centric.connect(signer).approve(greenHouse.address, amount);
    await greenHouse.connect(signer).stake(amount, referrer);
}

module.exports = { sleep, stake };
