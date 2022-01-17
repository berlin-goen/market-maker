const ethers = require('ethers')
const PRIVATE_KEYS = require('./secrets')
const Web3 = require('web3')

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

const buyMXY = async (mxyAmount, mxyPrice, private_key) => {
    const web3 = new Web3(process.env.PROVIDER_RPC)
    const wallet = await web3.eth.accounts.privateKeyToAccount(private_key)
    await web3.eth.accounts.wallet.add(wallet)
    const PANCAKE_ROUTER = new web3.eth.Contract(abi.PANCAKE_ROUTER, process.env.PANCAKE_ROUTER_ADDRESS)
    
    const busdAmount = mxyPrice*mxyAmount
    console.log(`BUSD amount to swap ${busdAmount}`)
    const busdAmountInWei = ethers.utils.parseUnits(busdAmount.toString(), 'ether')
    let tx = PANCAKE_ROUTER.methods.swapExactTokensForTokens(
        busdAmountInWei.toString(), 
        '0', 
        [process.env.BUSD_ADDRESS, process.env.MXY_ADDRESS], 
        wallet.address, 
        '1000000000000'
    ).send({
        from: wallet.address,
        gas: 9000000,
        gasPrice: (await web3.eth.getGasPrice())*2,
        nonce: await web3.eth.getTransactionCount(wallet.address)
    })
    return new Promise((resolve, reject) => {
        tx.on('receipt', resolve)
        tx.on('error', reject )
    })
}

const sellMXY = async (mxyAmount, private_key) => {
    const web3 = new Web3(process.env.PROVIDER_RPC)
    const wallet = await web3.eth.accounts.privateKeyToAccount(private_key)
    await web3.eth.accounts.wallet.add(wallet)
    const PANCAKE_ROUTER = new web3.eth.Contract(abi.PANCAKE_ROUTER, process.env.PANCAKE_ROUTER_ADDRESS)
   
    const mxyAmountInWei = ethers.utils.parseUnits(mxyAmount, 'ether')

    let tx = PANCAKE_ROUTER.methods.swapExactTokensForTokens(
        mxyAmountInWei.toString(), 
        '0', 
        [process.env.MXY_ADDRESS, process.env.BUSD_ADDRESS], 
        wallet.address, 
        '1000000000000'
    ).send({
        from: wallet.address,
        gas: 9000000,
        gasPrice: (await web3.eth.getGasPrice())*2,
        nonce: await web3.eth.getTransactionCount(wallet.address)
    })
    return new Promise((resolve, reject) => {
        tx.on('receipt', resolve)
        tx.on('error', reject )
    })
}

const trade = async (private_key) => {
    const wallet = new ethers.Wallet(private_key, provider)

    const BUSD = new ethers.Contract(process.env.BUSD_ADDRESS, abi.BEP20, wallet)
    const MXY = new ethers.Contract(process.env.MXY_ADDRESS, abi.BEP20, wallet)
    const SUPPORTING_PRICE = parseFloat(process.env.SUPPORTING_PRICE)
    //Lấy giá của token
    let currentPrice = await getMXYPrice(BUSD, MXY)

    //Kiểm tra giá so với mức hỗ trợ
    if (currentPrice < SUPPORTING_PRICE) {
        console.log(`${wallet.address} - Buying at price MXY/BUSD: ${currentPrice} with amount ${process.env.BUYING_AMOUNT} MXY`)
        //Mua vào
        await buyMXY(process.env.BUYING_AMOUNT, currentPrice, private_key)
        //Lấy lại giá
        currentPrice = await getMXYPrice(BUSD, MXY)
    }

    if (currentPrice > SUPPORTING_PRICE) {
        console.log(`${wallet.address} - Selling at price MXY/BUSD: ${currentPrice} with amount ${process.env.SELLING_AMOUNT} MXY`)
        //Bán ra
        await sellMXY(process.env.SELLING_AMOUNT, private_key)
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
        await delay(5000)
        PID++
    }
}

main()
.then(console.log)
.catch(console.log)