const ethers = require('ethers')
require('dotenv').config()

const abi = require('./abi')

const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_RPC)
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)

const BUSD = new ethers.Contract(process.env.BUSD_ADDRESS, abi.BEP20, wallet)
const MXY = new ethers.Contract(process.env.MXY_ADDRESS, abi.BEP20, wallet)
const PANCAKE_ROUTER = new ethers.Contract(process.env.PANCAKE_ROUTER_ADDRESS, abi.PANCAKE_ROUTER, wallet)

const getMXYPrice = async () => {
    const [mxyBalance, busdBalance] = await Promise.all([
        MXY.balanceOf(process.env.PAIR_ADDRESS), 
        BUSD.balanceOf(process.env.PAIR_ADDRESS)
    ])
    const weiPrice = busdBalance.div(mxyBalance.div(ethers.BigNumber.from('1000000000000000000')))
    return ethers.utils.formatEther(weiPrice)
}

const buyMXY = async (mxyAmount, mxyPrice) => {
    const busdAmount = mxyPrice*mxyAmount
    const busdAmountInWei = ethers.utils.parseUnits(busdAmount.toString(), 'ether')
    await (await PANCAKE_ROUTER.swapExactTokensForTokens(
        busdAmountInWei, 
        '0', 
        [process.env.BUSD_ADDRESS, process.env.MXY_ADDRESS], 
        wallet.address, 
        '1000000000000'
    )).wait()
}

const sellMXY = async (mxyAmount) => {
    const mxyAmountInWei = ethers.utils.parseUnits(mxyAmount, 'ether')
    await (await PANCAKE_ROUTER.swapExactTokensForTokens(
        mxyAmountInWei, 
        '0', 
        [process.env.MXY_ADDRESS, process.env.BUSD_ADDRESS], 
        wallet.address, 
        '1000000000000'
    )).wait()
}

const main = async () => {
    const SUPPORTING_PRICE = parseFloat(process.env.SUPPORTING_PRICE)
    //Lấy giá của token
    let currentPrice = await getMXYPrice()

    //Kiểm tra giá so với mức hỗ trợ
    if (currentPrice < SUPPORTING_PRICE) {
        console.log(`Buying at price MXY/BUSD: ${currentPrice} with amount ${process.env.BUYING_AMOUNT} BUSD`)
        //Mua vào
        await buyMXY(process.env.BUYING_AMOUNT, currentPrice)
        //Lấy lại giá
        currentPrice = await getMXYPrice()
    }

    if (currentPrice > SUPPORTING_PRICE) {
        console.log(`Selling at price MXY/BUSD: ${currentPrice} with amount ${process.env.SELLING_AMOUNT} MXY`)
        //Bán ra
        await sellMXY(process.env.SELLING_AMOUNT)
        currentPrice = await getMXYPrice()
    }
    console.log(`Done at price MXY/BUSD: ${currentPrice}`)
}

main()
.then(console.log)
.catch(console.log)