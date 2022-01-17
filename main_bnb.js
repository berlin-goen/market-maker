const ethers = require('ethers')
require('dotenv').config()

const abi = require('./abi')

const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_RPC)
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)

const WBNB = new ethers.Contract(process.env.WBNB_ADDRESS, abi.BEP20, wallet)
const MXY = new ethers.Contract(process.env.MXY_ADDRESS, abi.BEP20, wallet)
const PANCAKE_ROUTER = new ethers.Contract(process.env.PANCAKE_ROUTER_ADDRESS, abi.PANCAKE_ROUTER, wallet)

const getMxyWBNBPrice = async () => {
    const [mxyBalance, wbnbBalance] = await Promise.all([
        MXY.balanceOf(process.env.PAIR_BNB_ADDRESS), 
        WBNB.balanceOf(process.env.PAIR_BNB_ADDRESS)
    ])
    const weiPrice = wbnbBalance.div(mxyBalance.div(ethers.BigNumber.from('1000000000000000000')))
    return ethers.utils.formatEther(weiPrice)
}

const buyMXY = async (mxyAmount, mxyPrice) => {
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

const sellMXY = async (mxyAmount) => {
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

const main = async () => {
    const BNB_SUPPORTING_PRICE = parseFloat(process.env.BNB_SUPPORTING_PRICE)
    //Lấy giá của token
    let currentPrice = await getMxyWBNBPrice()

    //Kiểm tra giá so với mức hỗ trợ
    if (currentPrice < BNB_SUPPORTING_PRICE) {
        console.log(`Buying at price MXY/BNB: ${currentPrice} with amount ${process.env.BNB_SELLING_AMOUNT} MXY`)
        //Mua vào
        await buyMXY(process.env.BNB_BUYING_AMOUNT, currentPrice)
        //Lấy lại giá
        currentPrice = await getMxyWBNBPrice()
    }

    if (currentPrice > BNB_SUPPORTING_PRICE) {
        console.log(`Selling at price MXY/BNB: ${currentPrice} with amount ${process.env.BNB_BUYING_AMOUNT} MXY`)
        //Bán ra
        await sellMXY(process.env.BNB_SELLING_AMOUNT)
        currentPrice = await getMxyWBNBPrice()
    }
    console.log(`Done at price MXY/BNB: ${currentPrice}`)
}

main()
.then(console.log)
.catch(console.log)