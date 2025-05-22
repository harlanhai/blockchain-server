// 区块链核心实现
const crypto = require('crypto');
const secp256k1 = require('secp256k1');
const { Buffer } = require('buffer');

// 区块结构
class Block {
  constructor(index, timestamp, transactions, previousHash = '') {
    this.index = index;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.hash = this.calculateHash();
    this.nonce = 0;
  }

  // 计算区块哈希
  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(
        this.index +
        this.timestamp +
        JSON.stringify(this.transactions) +
        this.previousHash +
        this.nonce
      )
      .digest('hex');
  }

  // 挖矿方法 - 工作量证明 (PoW)
  mineBlock(difficulty) {
    console.log('开始挖矿...');
    while (
      this.hash.substring(0, difficulty) !== Array(difficulty + 1).join('0')
    ) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
    console.log(`区块已挖出! 哈希: ${this.hash}`);
  }
}

// 交易结构
class Transaction {
  constructor(fromAddress, toAddress, amount) {
    this.fromAddress = fromAddress;
    this.toAddress = toAddress;
    this.amount = amount;
    this.timestamp = Date.now();
    this.signature = null;
  }

  // 计算交易哈希
  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(this.fromAddress + this.toAddress + this.amount + this.timestamp)
      .digest('hex');
  }

  // 签名交易
  signTransaction(signingKey) {
    if (!signingKey) {
      throw new Error('未提供签名密钥');
    }

    const txHash = this.calculateHash();
    const msgHash = Buffer.from(txHash, 'hex');
    
    // 使用私钥签名
    const privateKey = Buffer.from(signingKey, 'hex');
    const { signature, recid } = secp256k1.ecdsaSign(msgHash, privateKey);
    this.signature = Buffer.concat([signature, Buffer.from([recid])]).toString('hex');
  }

  // 验证交易签名
  isValid() {
    // 挖矿奖励交易不需要签名
    if (this.fromAddress === null) return true;

    if (!this.signature || this.signature.length === 0) {
      throw new Error('未找到交易签名');
    }

    try {
      // 从公钥恢复地址
      const publicKey = Buffer.from(this.fromAddress, 'hex');
      const txHash = this.calculateHash();
      const msgHash = Buffer.from(txHash, 'hex');
      
      // 将签名字符串转换为Buffer
      const signatureBuffer = Buffer.from(this.signature, 'hex');
      const signature = signatureBuffer.slice(0, 64);
      const recid = signatureBuffer[64];

      // 验证签名
      return secp256k1.ecdsaVerify(signature, msgHash, publicKey);
    } catch (error) {
      console.error('验证交易时出错:', error.message);
      return false;
    }
  }
}

// 区块链结构
class Blockchain {
  constructor() {
    // 初始化区块链数组和未确认交易
    this.chain = [this.createGenesisBlock()];
    this.difficulty = 3; // 挖矿难度
    this.pendingTransactions = [];
    this.miningReward = 100; // 挖矿奖励
  }

  // 创建创世区块
  createGenesisBlock() {
    return new Block(0, Date.now(), [], '0');
  }

  // 获取最新区块
  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  // 挖矿处理未确认交易
  minePendingTransactions(miningRewardAddress) {
    // 创建奖励交易
    const rewardTx = new Transaction(null, miningRewardAddress, this.miningReward);
    this.pendingTransactions.push(rewardTx);

    // 创建新区块
    const block = new Block(
      this.chain.length,
      Date.now(),
      this.pendingTransactions,
      this.getLatestBlock().hash
    );

    // 挖矿
    block.mineBlock(this.difficulty);

    // 将新区块添加到链上
    this.chain.push(block);

    // 清空待处理交易
    this.pendingTransactions = [];
    
    return block;
  }

  // 添加交易到未确认交易池
  addTransaction(transaction) {
    // 验证交易格式
    if (!transaction.fromAddress || !transaction.toAddress) {
      throw new Error('交易必须包含发送和接收地址');
    }

    // 验证交易签名
    if (!transaction.isValid() && transaction.fromAddress !== null) {
      throw new Error('无效的交易签名');
    }

    // 检查余额是否足够
    if (transaction.fromAddress !== null) {
      const senderBalance = this.getBalanceOfAddress(transaction.fromAddress);
      if (senderBalance < transaction.amount) {
        throw new Error('余额不足');
      }
    }

    this.pendingTransactions.push(transaction);
    return true;
  }

  // 获取地址余额
  getBalanceOfAddress(address) {
    let balance = 0;

    // 遍历所有区块和交易
    for (const block of this.chain) {
      for (const trans of block.transactions) {
        // 如果该地址是发送方，减少余额
        if (trans.fromAddress === address) {
          balance -= trans.amount;
        }

        // 如果该地址是接收方，增加余额
        if (trans.toAddress === address) {
          balance += trans.amount;
        }
      }
    }

    return balance;
  }

  // 验证区块链完整性
  isChainValid() {
    // 从第二个区块开始验证
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      // 验证区块哈希
      if (currentBlock.hash !== currentBlock.calculateHash()) {
        return false;
      }

      // 验证区块链接
      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }

      // 验证区块中的所有交易
      for (const tx of currentBlock.transactions) {
        if (!tx.isValid() && tx.fromAddress !== null) {
          return false;
        }
      }
    }
    return true;
  }
}

// 钱包功能
class Wallet {
  constructor() {
    this.privateKey = null;
    this.publicKey = null;
    this.address = null;
  }

  // 生成新的钱包
  generate() {
    // 生成私钥
    let privateKey;
    do {
      privateKey = crypto.randomBytes(32);
    } while (!secp256k1.privateKeyVerify(privateKey));

    // 从私钥导出公钥
    const publicKey = secp256k1.publicKeyCreate(privateKey);
    
    // 计算地址 (公钥哈希)
    const address = crypto
      .createHash('sha256')
      .update(Buffer.from(publicKey))
      .digest('hex');

    this.privateKey = privateKey.toString('hex');
    this.publicKey = Buffer.from(publicKey).toString('hex');
    this.address = address;

    return {
      privateKey: this.privateKey,
      publicKey: this.publicKey,
      address: this.address
    };
  }

  // 从私钥恢复钱包
  fromPrivateKey(privateKeyHex) {
    try {
      const privateKey = Buffer.from(privateKeyHex, 'hex');
      
      if (!secp256k1.privateKeyVerify(privateKey)) {
        throw new Error('无效的私钥');
      }

      // 从私钥导出公钥
      const publicKey = secp256k1.publicKeyCreate(privateKey);
      
      // 计算地址
      const address = crypto
        .createHash('sha256')
        .update(Buffer.from(publicKey))
        .digest('hex');

      this.privateKey = privateKeyHex;
      this.publicKey = Buffer.from(publicKey).toString('hex');
      this.address = address;

      return {
        privateKey: this.privateKey,
        publicKey: this.publicKey,
        address: this.address
      };
    } catch (error) {
      throw new Error(`导入钱包失败: ${error.message}`);
    }
  }

  // 创建交易
  createTransaction(toAddress, amount, blockchain) {
    const balance = blockchain.getBalanceOfAddress(this.address);
    if (balance < amount) {
      throw new Error(`余额不足。当前余额: ${balance}`);
    }

    const transaction = new Transaction(this.address, toAddress, amount);
    transaction.signTransaction(this.privateKey);
    
    return transaction;
  }
}

module.exports = {
  Block,
  Transaction,
  Blockchain,
  Wallet
};