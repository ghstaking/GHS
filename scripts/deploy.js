const hre = require("hardhat");

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    const Centric = await hre.ethers.getContractFactory("Centric");
    const GreenHouse = await hre.ethers.getContractFactory("GreenHouse");

    const centric = await Centric.deploy(
        hre.ethers.utils.parseUnits("1000000000")
    );
    console.log("CNR deployed to:", centric.address);

    const admin = "0x6514ea7D7eAC99267584D02b9Abf34183aBC814f";

    await centric.transfer(admin, await centric.totalSupply());

    const greenhouse = await GreenHouse.deploy(
        centric.address,
        "0x4E9422199343b13fe5C0E30CD86d18039DE7f337",
        [
            "0x3180257DD50c44b0336df72D65507b20eBdfD0C1",
            "0xfAE3F1CF56480fA6E9783379FF5302Ade1a379D7",
            "0xaDd13C1472c7507Db39Acc63e5981822aEe747c7",
        ]
    );
    console.log("GreenHouse deployed to:", greenhouse.address);

    await greenhouse.transferOwnership(admin);

    console.log("Sleeping before verification");
    await sleep(20000);

    /*centric = await Centric.attach(
        "0x3ab97BAAFe5F4a8A8868865d3bAf66D1f3fb337B"
    );
    greenhouse = await GreenHouse.attach(
        "0x6821acb85a9a246bcb72622C39e10aaAf43E6B8d"
    );*/

    await hre.run("verify:verify", {
        address: centric.address,
        contract: "contracts/test/Centric.sol:Centric",
        constructorArguments: [hre.ethers.utils.parseUnits("1000000000")],
    });

    await hre.run("verify:verify", {
        address: greenhouse.address,
        constructorArguments: [
            centric.address,
            "0x4E9422199343b13fe5C0E30CD86d18039DE7f337",
            [
                "0x3180257DD50c44b0336df72D65507b20eBdfD0C1",
                "0xfAE3F1CF56480fA6E9783379FF5302Ade1a379D7",
                "0xaDd13C1472c7507Db39Acc63e5981822aEe747c7",
            ],
        ],
    });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
