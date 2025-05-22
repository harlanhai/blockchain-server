// blockchain-server/src/index.js (修复版本)
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

// 错误处理中间件
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error('API错误:', err);
    ctx.status = err.status || 500;
    ctx.body = {
      success: false,
      message: err.message || '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    };
  }
});

// 路由定义
// 获取区块链信息
router.get('/api/blockchain', (ctx) => {
  try {
    ctx.body = {
      success: true,
      chain: blockchainInstance.chain,
      pendingTransactions: blockchainInstance.pendingTransactions,
      difficulty: blockchainInstance.difficulty,
      miningReward: blockchainInstance.miningReward
    };
  } catch (error) {
    throw new Error(`获取区块链信息失败: ${error.message}`);
  }
});

// 创建新钱包
router.post('/api/wallet/create', (ctx) => {
  try {
    const wallet = new Wallet();
    const walletData = wallet.generate();
    const walletId = walletData.address;
    
    // 存储钱包实例
    wallets.set(walletId, wallet);
    
    console.log('新钱包已创建:', walletId);
    
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
    console.error('创建钱包失败:', error);
    throw new Error(`创建钱包失败: ${error.message}`);
  }
});

// 导入已有钱包
router.post('/api/wallet/import', (ctx) => {
  try {
    const { privateKey } = ctx.request.body;
    
    if (!privateKey) {
      throw new Error('私钥必须提供');
    }
    
    console.log('尝试导入钱包，私钥长度:', privateKey.length);
    
    const wallet = new Wallet();
    const walletData = wallet.fromPrivateKey(privateKey);
    const walletId = walletData.address;
    
    // 存储钱包实例
    wallets.set(walletId, wallet);
    
    console.log('钱包导入成功:', walletId);
    
    ctx.body = {
      success: true,
      wallet: {
        address: walletData.address,
        publicKey: walletData.publicKey
      }
    };
  } catch (error) {
    console.error('导入钱包失败:', error);
    throw new Error(`导入钱包失败: ${error.message}`);
  }
});

// 获取钱包余额
router.get('/api/wallet/:address/balance', (ctx) => {
  try {
    const { address } = ctx.params;
    
    if (!address) {
      throw new Error('钱包地址必须提供');
    }
    
    const balance = blockchainInstance.getBalanceOfAddress(address);
    
    console.log(`钱包 ${address.substring(0, 10)}... 余额: ${balance}`);
    
    ctx.body = {
      success: true,
      address,
      balance
    };
  } catch (error) {
    console.error('获取余额失败:', error);
    throw new Error(`获取余额失败: ${error.message}`);
  }
});

// 创建新交易 - 修复版本
router.post('/api/transaction', (ctx) => {
  try {
    const { fromAddress, toAddress, amount, privateKey } = ctx.request.body;
    
    // 验证输入参数
    if (!fromAddress || !toAddress || !amount || !privateKey) {
      throw new Error('交易信息不完整：需要发送方地址、接收方地址、金额和私钥');
    }
    
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('金额必须是正数');
    }
    
    console.log('创建交易:', {
      from: fromAddress.substring(0, 10) + '...',
      to: toAddress.substring(0, 10) + '...',
      amount: amount
    });
    
    // 验证发送方余额
    const senderBalance = blockchainInstance.getBalanceOfAddress(fromAddress);
    if (senderBalance < amount) {
      throw new Error(`余额不足。当前余额: ${senderBalance}, 需要: ${amount}`);
    }
    
    // 创建交易
    const transaction = new Transaction(fromAddress, toAddress, amount);
    
    // 签名交易
    console.log('正在签名交易...');
    transaction.signTransaction(privateKey);
    console.log('交易签名完成');
    
    // 验证交易
    console.log('验证交易有效性...');
    if (!transaction.isValid()) {
      throw new Error('交易签名验证失败');
    }
    console.log('交易验证通过');
    
    // 添加到待处理交易池
    blockchainInstance.addTransaction(transaction);
    
    console.log('交易已添加到待处理池，当前待处理交易数:', blockchainInstance.pendingTransactions.length);
    
    ctx.body = {
      success: true,
      message: '交易创建成功',
      transaction: {
        fromAddress: transaction.fromAddress,
        toAddress: transaction.toAddress,
        amount: transaction.amount,
        timestamp: transaction.timestamp
      },
      pendingTransactionsCount: blockchainInstance.pendingTransactions.length
    };
  } catch (error) {
    console.error('创建交易失败:', error);
    throw new Error(`创建交易失败: ${error.message}`);
  }
});

// 挖矿
router.post('/api/mine', (ctx) => {
  try {
    const { minerAddress } = ctx.request.body;
    
    if (!minerAddress) {
      throw new Error('挖矿地址必须提供');
    }
    
    console.log(`开始挖矿，奖励将发送至: ${minerAddress.substring(0, 10)}...`);
    console.log(`待处理交易数: ${blockchainInstance.pendingTransactions.length}`);
    
    // 开始挖矿
    const newBlock = blockchainInstance.minePendingTransactions(minerAddress);
    
    console.log(`挖矿完成! 新区块 #${newBlock.index} 已添加`);
    console.log(`区块包含 ${newBlock.transactions.length} 笔交易`);
    
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
    console.error('挖矿失败:', error);
    throw new Error(`挖矿失败: ${error.message}`);
  }
});

// 获取待处理交易
router.get('/api/transactions/pending', (ctx) => {
  try {
    ctx.body = {
      success: true,
      pendingTransactions: blockchainInstance.pendingTransactions
    };
  } catch (error) {
    throw new Error(`获取待处理交易失败: ${error.message}`);
  }
});

// 获取区块链有效性
router.get('/api/blockchain/validate', (ctx) => {
  try {
    const isValid = blockchainInstance.isChainValid();
    console.log('区块链验证结果:', isValid);
    
    ctx.body = {
      success: true,
      isValid
    };
  } catch (error) {
    throw new Error(`验证区块链失败: ${error.message}`);
  }
});

// 调试路由 - 获取详细的区块链状态
router.get('/api/debug/status', (ctx) => {
  try {
    ctx.body = {
      success: true,
      debug: {
        chainLength: blockchainInstance.chain.length,
        pendingTransactions: blockchainInstance.pendingTransactions.length,
        difficulty: blockchainInstance.difficulty,
        miningReward: blockchainInstance.miningReward,
        isChainValid: blockchainInstance.isChainValid(),
        lastBlock: blockchainInstance.getLatestBlock(),
        walletsCount: wallets.size
      }
    };
  } catch (error) {
    throw new Error(`获取调试信息失败: ${error.message}`);
  }
});

// 使用路由
app.use(router.routes()).use(router.allowedMethods());

// 启动服务器
app.listen(PORT, () => {
  console.log(`区块链服务已启动，监听端口: ${PORT}`);
  console.log(`访问 http://localhost:${PORT}/api/debug/status 查看状态`);
});