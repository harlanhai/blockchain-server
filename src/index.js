const Koa = require('koa');
const Router = require('@koa/router');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const { Blockchain, Transaction, Wallet } = require('./blockchain');

// 初始化应用程序
const app = new Koa();
const router = new Router();
const PORT = process.env.PORT || 3001;

// 创建区块链实例
const blockchainInstance = new Blockchain();

// 存储钱包映射表，在实际应用中应该使用数据库
const wallets = new Map();

// 中间件
app.use(bodyParser());
app.use(cors());

// 路由定义
// 获取区块链信息
router.get('/api/blockchain', (ctx) => {
  ctx.body = {
    chain: blockchainInstance.chain,
    pendingTransactions: blockchainInstance.pendingTransactions,
    difficulty: blockchainInstance.difficulty,
    miningReward: blockchainInstance.miningReward
  };
});

// 创建新钱包
router.post('/api/wallet/create', (ctx) => {
  try {
    const wallet = new Wallet();
    const walletData = wallet.generate();
    const walletId = walletData.address;
    
    // 存储钱包实例
    wallets.set(walletId, wallet);
    
    ctx.body = {
      success: true,
      wallet: {
        address: walletData.address,
        publicKey: walletData.publicKey,
        // 注意：在实际应用中不应该直接返回私钥，这里仅作演示
        privateKey: walletData.privateKey
      }
    };
  } catch (error) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      message: error.message
    };
  }
});

// 导入已有钱包
router.post('/api/wallet/import', (ctx) => {
  try {
    const { privateKey } = ctx.request.body;
    
    if (!privateKey) {
      throw new Error('私钥必须提供');
    }
    
    const wallet = new Wallet();
    const walletData = wallet.fromPrivateKey(privateKey);
    const walletId = walletData.address;
    
    // 存储钱包实例
    wallets.set(walletId, wallet);
    
    ctx.body = {
      success: true,
      wallet: {
        address: walletData.address,
        publicKey: walletData.publicKey
      }
    };
  } catch (error) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      message: error.message
    };
  }
});

// 获取钱包余额
router.get('/api/wallet/:address/balance', (ctx) => {
  try {
    const { address } = ctx.params;
    const balance = blockchainInstance.getBalanceOfAddress(address);
    
    ctx.body = {
      success: true,
      address,
      balance
    };
  } catch (error) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      message: error.message
    };
  }
});

// 创建新交易
router.post('/api/transaction', (ctx) => {
  try {
    const { fromAddress, toAddress, amount, privateKey } = ctx.request.body;
    
    if (!fromAddress || !toAddress || !amount || !privateKey) {
      throw new Error('交易信息不完整');
    }
    
    // 从私钥恢复钱包
    const wallet = new Wallet();
    wallet.fromPrivateKey(privateKey);
    
    // 验证地址匹配
    if (wallet.address !== fromAddress) {
      throw new Error('私钥与发送地址不匹配');
    }
    
    // 创建并签名交易
    const transaction = new Transaction(fromAddress, toAddress, parseFloat(amount));
    transaction.signTransaction(privateKey);
    
    // 添加到待处理交易池
    blockchainInstance.addTransaction(transaction);
    
    ctx.body = {
      success: true,
      transaction: {
        fromAddress: transaction.fromAddress,
        toAddress: transaction.toAddress,
        amount: transaction.amount,
        timestamp: transaction.timestamp
      },
      pendingTransactionsCount: blockchainInstance.pendingTransactions.length
    };
  } catch (error) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      message: error.message
    };
  }
});

// 挖矿
router.post('/api/mine', (ctx) => {
  try {
    const { minerAddress } = ctx.request.body;
    
    if (!minerAddress) {
      throw new Error('挖矿地址必须提供');
    }
    
    // 开始挖矿
    console.log(`开始挖矿，奖励将发送至: ${minerAddress}`);
    const newBlock = blockchainInstance.minePendingTransactions(minerAddress);
    
    ctx.body = {
      success: true,
      message: '挖矿成功!',
      block: {
        index: newBlock.index,
        timestamp: newBlock.timestamp,
        hash: newBlock.hash,
        previousHash: newBlock.previousHash,
        nonce: newBlock.nonce,
        transactions: newBlock.transactions
      }
    };
  } catch (error) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      message: error.message
    };
  }
});

// 获取待处理交易
router.get('/api/transactions/pending', (ctx) => {
  ctx.body = {
    success: true,
    pendingTransactions: blockchainInstance.pendingTransactions
  };
});

// 获取区块链有效性
router.get('/api/blockchain/validate', (ctx) => {
  const isValid = blockchainInstance.isChainValid();
  ctx.body = {
    success: true,
    isValid
  };
});

// 使用路由
app.use(router.routes()).use(router.allowedMethods());

// 启动服务器
app.listen(PORT, () => {
  console.log(`区块链服务已启动，监听端口: http://localhost:${PORT}`);
});