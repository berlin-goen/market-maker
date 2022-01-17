const ethers = require('ethers')
const PRIVATE_KEYS = require('./secrets')
require('dotenv').config()

const abi = require('./abi')

const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_RPC)

const getMxyWBNBPrice = async (WBNB, MXY) => {
    const [mxyBalance, wbnbBalance] = await Promise.all([
        MXY.balanceOf(process.env.PAIR_BNB_ADDRESS), 
        WBNB.balanceOf(process.env.PAIR_BNB_ADDRESS)
    ])
    const weiPrice = wbnbBalance.div(mxyBalance.div(ethers.BigNumber.from('1000000000000000000')))
    return ethers.utils.formatEther(weiPrice)
}

const buyMXY = async (mxyAmount, mxyPrice, PANCAKE_ROUTER, wallet) => {
    const wbnbAmount = mxyPrice*mxyAmount
    console.log(`bnb amount to swap ${wbnbAmount}`)
    const wbnbAmountInWei = ethers.utils.parseUnits(wbnbAmount.toString(), 'ether')
    await (await PANCAKE_ROUTER.swapExactETHForTokens(
        '0', 
        [process.env.WBNB_ADDRESS, process.env.MXY_ADDRESS], 
        wallet.address, 
        '1000000000000',
        {
            value: wbnbAmountInWei,
            gasPrice: process.env.GAS_PRICE
        }
    )).wait()
}

const sellMXY = async (mxyAmount, PANCAKE_ROUTER, wallet) => {
    const mxyAmountInWei = ethers.utils.parseUnits(mxyAmount, 'ether')
    await (await PANCAKE_ROUTER.swapExactTokensForETH(
        mxyAmountInWei, 
        '0', 
        [process.env.MXY_ADDRESS, process.env.WBNB_ADDRESS], 
        wallet.address, 
        '1000000000000',
        {
            gasPrice: process.env.GAS_PRICE
        }
    )).wait()
}

const trade = async (private_key) => {
    const wallet = new ethers.Wallet(private_key, provider)

    const WBNB = new ethers.Contract(process.env.WBNB_ADDRESS, abi.BEP20, wallet)
    const MXY = new ethers.Contract(process.env.MXY_ADDRESS, abi.BEP20, wallet)
    const PANCAKE_ROUTER = new ethers.Contract(process.env.PANCAKE_ROUTER_ADDRESS, abi.PANCAKE_ROUTER, wallet)
    const BNB_SUPPORTING_PRICE = parseFloat(process.env.BNB_SUPPORTING_PRICE)
    //Lấy giá của token
    let currentPrice = await getMxyWBNBPrice(WBNB, MXY)

    //Kiểm tra giá so với mức hỗ trợ
    if (currentPrice < BNB_SUPPORTING_PRICE) {
        console.log(`${wallet.address} - Buying at price MXY/BNB: ${currentPrice} with amount ${process.env.BNB_SELLING_AMOUNT} MXY`)
        //Mua vào
        await buyMXY(process.env.BNB_BUYING_AMOUNT, currentPrice, PANCAKE_ROUTER, wallet)
        //Lấy lại giá
        currentPrice = await getMxyWBNBPrice(WBNB, MXY)
    }

    if (currentPrice > BNB_SUPPORTING_PRICE) {
        console.log(`${wallet.address} - Selling at price MXY/BNB: ${currentPrice} with amount ${process.env.BNB_BUYING_AMOUNT} MXY`)
        //Bán ra
        await sellMXY(process.env.BNB_SELLING_AMOUNT, PANCAKE_ROUTER, wallet)
        currentPrice = await getMxyWBNBPrice(WBNB, MXY)
    }
    console.log(`${wallet.address} - Done at price MXY/BNB: ${currentPrice}`)
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