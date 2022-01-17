const ethers = require('ethers')
const PRIVATE_KEYS = require('./secrets')
require('dotenv').config()

const abi = require('./abi')

const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_RPC)

const getMXYPrice = async (BUSD, MXY) => {
    const [mxyBalance, busdBalance] = await Promise.all([
        MXY.balanceOf(process.env.PAIR_ADDRESS), 
        BUSD.balanceOf(process.env.PAIR_ADDRESS)
    ])
    const weiPrice = busdBalance.div(mxyBalance.div(ethers.BigNumber.from('1000000000000000000')))
    return ethers.utils.formatEther(weiPrice)
}

const buyMXY = async (mxyAmount, mxyPrice, PANCAKE_ROUTER, wallet) => {
    const busdAmount = mxyPrice*mxyAmount
    const busdAmountInWei = ethers.utils.parseUnits(busdAmount.toString(), 'ether')
    await (await PANCAKE_ROUTER.swapExactTokensForTokens(
        busdAmountInWei, 
        '0', 
        [process.env.BUSD_ADDRESS, process.env.MXY_ADDRESS], 
        wallet.address, 
        '1000000000000',
        {
            gasPrice: process.env.GAS_PRICE
        }
    )).wait()
}

const sellMXY = async (mxyAmount, PANCAKE_ROUTER, wallet) => {
    const mxyAmountInWei = ethers.utils.parseUnits(mxyAmount, 'ether')
    await (await PANCAKE_ROUTER.swapExactTokensForTokens(
        mxyAmountInWei, 
        '0', 
        [process.env.MXY_ADDRESS, process.env.BUSD_ADDRESS], 
        wallet.address, 
        '1000000000000',
        {
            gasPrice: process.env.GAS_PRICE
        }
    )).wait()
}

const trade = async (private_key) => {
    const wallet = new ethers.Wallet(private_key, provider)

    const BUSD = new ethers.Contract(process.env.BUSD_ADDRESS, abi.BEP20, wallet)
    const MXY = new ethers.Contract(process.env.MXY_ADDRESS, abi.BEP20, wallet)
    const PANCAKE_ROUTER = new ethers.Contract(process.env.PANCAKE_ROUTER_ADDRESS, abi.PANCAKE_ROUTER, wallet)
    const SUPPORTING_PRICE = parseFloat(process.env.SUPPORTING_PRICE)
    //Lấy giá của token
    let currentPrice = await getMXYPrice(BUSD, MXY)

    //Kiểm tra giá so với mức hỗ trợ
    if (currentPrice < SUPPORTING_PRICE) {
        console.log(`${wallet.address} - Buying at price MXY/BUSD: ${currentPrice} with amount ${process.env.BUYING_AMOUNT} MXY`)
        //Mua vào
        await buyMXY(process.env.BUYING_AMOUNT, currentPrice, PANCAKE_ROUTER, wallet)
        //Lấy lại giá
        currentPrice = await getMXYPrice(BUSD, MXY)
    }

    if (currentPrice > SUPPORTING_PRICE) {
        console.log(`${wallet.address} - Selling at price MXY/BUSD: ${currentPrice} with amount ${process.env.SELLING_AMOUNT} MXY`)
        //Bán ra
        await sellMXY(process.env.SELLING_AMOUNT, PANCAKE_ROUTER, wallet)
        currentPrice = await getMXYPrice(BUSD, MXY)
    }
    console.log(`${wallet.address} - Done at price MXY/BUSD: ${currentPrice}`)
}

const delay = t => new Promise(resolve => setTimeout(resolve, t));

const main = async function() {
    let PID = 0
    while(true) {
        console.log(`Start process PID - ${PID}`)
        try {
            await Promise.all(PRIVATE_KEYS.map(trade))
        } catch (e) {
            console.log(e)
        }
        await delay(60000)
        PID++
    }
}

main()
.then(console.log)
.catch(console.log)