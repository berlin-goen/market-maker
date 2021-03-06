const ethers = require('ethers')
const PRIVATE_KEYS = require('./bnb_secrets')
const Web3 = require('web3')

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

const buyMXY = async (mxyAmount, mxyPrice, private_key) => {
    const web3 = new Web3(process.env.PROVIDER_RPC)
    const wallet = await web3.eth.accounts.privateKeyToAccount(private_key)
    await web3.eth.accounts.wallet.add(wallet)
    const PANCAKE_ROUTER = new web3.eth.Contract(abi.PANCAKE_ROUTER, process.env.PANCAKE_ROUTER_ADDRESS)
    
    const wbnbAmount = mxyPrice*mxyAmount
    console.log(`BNB amount to swap ${wbnbAmount}`)
    const wbnbAmountInWei = ethers.utils.parseUnits(wbnbAmount.toString(), 'ether')
    
    let tx = PANCAKE_ROUTER.methods.swapExactETHForTokens(
        '0', 
        [process.env.WBNB_ADDRESS, process.env.MXY_ADDRESS], 
        wallet.address, 
        '1000000000000'
    ).send({
        from: wallet.address,
        value: wbnbAmountInWei.toString(),
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

    let tx = PANCAKE_ROUTER.methods.swapExactTokensForETH(
        mxyAmountInWei.toString(), 
        '0', 
        [process.env.MXY_ADDRESS, process.env.WBNB_ADDRESS], 
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

    const WBNB = new ethers.Contract(process.env.WBNB_ADDRESS, abi.BEP20, wallet)
    const MXY = new ethers.Contract(process.env.MXY_ADDRESS, abi.BEP20, wallet)
    const BNB_SUPPORTING_PRICE = parseFloat(process.env.BNB_SUPPORTING_PRICE)
    //L???y gi?? c???a token
    let currentPrice = await getMxyWBNBPrice(WBNB, MXY)

    //Ki???m tra gi?? so v???i m???c h??? tr???
    if (currentPrice < BNB_SUPPORTING_PRICE) {
        console.log(`${wallet.address} - Buying at price MXY/BNB: ${currentPrice} with amount ${process.env.BNB_SELLING_AMOUNT} MXY`)
        //Mua v??o
        await buyMXY(process.env.BNB_BUYING_AMOUNT, currentPrice, private_key)
        //L???y l???i gi??
        currentPrice = await getMxyWBNBPrice(WBNB, MXY)
    }

    if (currentPrice > BNB_SUPPORTING_PRICE) {
        console.log(`${wallet.address} - Selling at price MXY/BNB: ${currentPrice} with amount ${process.env.BNB_BUYING_AMOUNT} MXY`)
        //B??n ra
        await sellMXY(process.env.BNB_SELLING_AMOUNT, private_key)
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
        await delay(5000)
        PID++
    }
}

main()
.then(console.log)
.catch(console.log)