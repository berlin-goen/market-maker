const ethers = require('ethers')
const PRIVATE_KEYS = require('./secrets')
require('dotenv').config()

const abi = require('./abi')

const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_RPC)



const main = async (private_key) => {
    const wallet = new ethers.Wallet(private_key, provider)

    const BUSD = new ethers.Contract(process.env.BUSD_ADDRESS, abi.BEP20, wallet)
    const MXY = new ethers.Contract(process.env.MXY_ADDRESS, abi.BEP20, wallet)
    const WBNB = new ethers.Contract(process.env.WBNB_ADDRESS, abi.BEP20, wallet)
    await BUSD.approve(process.env.PANCAKE_ROUTER_ADDRESS, '100000000000000000000000000000')
    await MXY.approve(process.env.PANCAKE_ROUTER_ADDRESS, '100000000000000000000000000000')
    await WBNB.approve(process.env.PANCAKE_ROUTER_ADDRESS, '100000000000000000000000000000')
    console.log(`${wallet.address} approve finished`)
}

Promise.all(PRIVATE_KEYS.map(main))
.then(console.log)
.catch(console.log)