// blockchain-server/src/blockchain.js (修复签名验证)
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

  // 签名交易 - 修复版本
  signTransaction(signingKey) {
    if (!signingKey) {
      throw new Error('未提供签名密钥');
    }

    try {
      // 确保 signingKey 是 Buffer
      const privateKeyBuffer = Buffer.isBuffer(signingKey) 
        ? signingKey 
        : Buffer.from(signingKey, 'hex');

      // 验证私钥格式
      if (privateKeyBuffer.length !== 32) {
        throw new Error('私钥长度必须是32字节');
      }

      if (!secp256k1.privateKeyVerify(privateKeyBuffer)) {
        throw new Error('无效的私钥');
      }

      // 计算交易哈希
      const txHash = this.calculateHash();
      const msgHash = Buffer.from(txHash, 'hex');
      
      // 使用私钥签名
      const sigObj = secp256k1.ecdsaSign(msgHash, privateKeyBuffer);
      
      // 保存签名（包含恢复ID）
      this.signature = {
        signature: Buffer.from(sigObj.signature).toString('hex'),
        recovery: sigObj.recid
      };

      console.log('交易签名成功');
    } catch (error) {
      console.error('签名交易时出错:', error.message);
      throw new Error(`签名失败: ${error.message}`);
    }
  }

  // 验证交易签名 - 修复版本
  isValid() {
    // 挖矿奖励交易不需要签名
    if (this.fromAddress === null) return true;

    if (!this.signature || !this.signature.signature) {
      console.error('未找到交易签名');
      return false;
    }

    try {
      // 从发送方地址获取公钥
      // 注意：这里我们假设 fromAddress 就是公钥的哈希
      // 在实际实现中，你可能需要维护一个地址到公钥的映射
      
      // 重新计算交易哈希
      const txHash = this.calculateHash();
      const msgHash = Buffer.from(txHash, 'hex');
      
      // 从签名中恢复公钥
      const signatureBuffer = Buffer.from(this.signature.signature, 'hex');
      const recovery = this.signature.recovery;
      
      // 恢复公钥
      const recoveredPubKey = secp256k1.ecdsaRecover(signatureBuffer, recovery, msgHash);
      
      // 计算从恢复的公钥得到的地址
      const recoveredAddress = crypto
        .createHash('sha256')
        .update(Buffer.from(recoveredPubKey))
        .digest('hex');
      
      // 验证地址是否匹配
      const isAddressMatch = recoveredAddress === this.fromAddress;
      
      if (!isAddressMatch) {
        console.error('地址不匹配:', {
          expected: this.fromAddress,
          recovered: recoveredAddress
        });
        return false;
      }

      // 验证签名
      const isSignatureValid = secp256k1.ecdsaVerify(signatureBuffer, msgHash, recoveredPubKey);
      
      console.log('签名验证结果:', isSignatureValid);
      return isSignatureValid;
      
    } catch (error) {
      console.error('验证交易签名时出错:', error.message);
      return false;
    }
  }
}

// 区块链结构
class Blockchain {
  constructor() {
    // 初始化区块链数组和未确认交易
    this.chain = [this.createGenesisBlock()];
    this.difficulty = 2; // 降低难度以便测试
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

  // 添加交易到未确认交易池 - 修复版本
  addTransaction(transaction) {
    // 验证交易格式
    if (!transaction.fromAddress || !transaction.toAddress) {
      throw new Error('交易必须包含发送和接收地址');
    }

    if (typeof transaction.amount !== 'number' || transaction.amount <= 0) {
      throw new Error('交易金额必须是正数');
    }

    // 验证交易签名（跳过系统奖励交易）
    if (transaction.fromAddress !== null) {
      console.log('验证交易签名...');
      if (!transaction.isValid()) {
        throw new Error('无效的交易签名');
      }
      console.log('交易签名验证通过');

      // 检查余额是否足够
      const senderBalance = this.getBalanceOfAddress(transaction.fromAddress);
      if (senderBalance < transaction.amount) {
        throw new Error(`余额不足。当前余额: ${senderBalance}, 需要: ${transaction.amount}`);
      }
    }

    this.pendingTransactions.push(transaction);
    console.log('交易已添加到待处理池');
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
        console.error('区块哈希无效:', currentBlock.index);
        return false;
      }

      // 验证区块链接
      if (currentBlock.previousHash !== previousBlock.hash) {
        console.error('区块链接无效:', currentBlock.index);
        return false;
      }

      // 验证区块中的所有交易
      for (const tx of currentBlock.transactions) {
        if (!tx.isValid() && tx.fromAddress !== null) {
          console.error('区块中包含无效交易:', currentBlock.index);
          return false;
        }
      }
    }
    return true;
  }
}

// 钱包功能 - 修复版本
class Wallet {
  constructor() {
    this.privateKey = null;
    this.publicKey = null;
    this.address = null;
  }

  // 生成新的钱包
  generate() {
    try {
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

      console.log('钱包生成成功:', {
        address: this.address,
        publicKey: this.publicKey.substring(0, 20) + '...'
      });

      return {
        privateKey: this.privateKey,
        publicKey: this.publicKey,
        address: this.address
      };
    } catch (error) {
      console.error('生成钱包时出错:', error.message);
      throw new Error(`钱包生成失败: ${error.message}`);
    }
  }

  // 从私钥恢复钱包
  fromPrivateKey(privateKeyHex) {
    try {
      const privateKey = Buffer.from(privateKeyHex, 'hex');
      
      if (privateKey.length !== 32) {
        throw new Error('私钥长度必须是32字节');
      }
      
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

      console.log('钱包恢复成功:', {
        address: this.address,
        publicKey: this.publicKey.substring(0, 20) + '...'
      });

      return {
        privateKey: this.privateKey,
        publicKey: this.publicKey,
        address: this.address
      };
    } catch (error) {
      console.error('恢复钱包时出错:', error.message);
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