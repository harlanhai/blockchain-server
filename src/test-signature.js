// blockchain-server/test-signature.js
const { Blockchain, Transaction, Wallet } = require('./src/blockchain');

async function testSignature() {
  console.log('=== 区块链签名测试 ===\n');

  try {
    // 创建区块链实例
    const blockchain = new Blockchain();
    console.log('✓ 区块链实例创建成功');

    // 创建两个钱包
    const wallet1 = new Wallet();
    const wallet1Data = wallet1.generate();
    console.log('✓ 钱包1创建成功');
    console.log('  地址:', wallet1Data.address);
    console.log('  私钥长度:', wallet1Data.privateKey.length);

    const wallet2 = new Wallet();
    const wallet2Data = wallet2.generate();
    console.log('✓ 钱包2创建成功');
    console.log('  地址:', wallet2Data.address);

    // 给钱包1挖矿获得一些代币
    console.log('\n--- 开始挖矿给钱包1 ---');
    blockchain.minePendingTransactions(wallet1Data.address);
    console.log('✓ 第一次挖矿完成');

    // 再次挖矿以确认奖励交易
    blockchain.minePendingTransactions(wallet1Data.address);
    console.log('✓ 第二次挖矿完成');

    // 检查钱包1余额
    const balance1 = blockchain.getBalanceOfAddress(wallet1Data.address);
    console.log(`✓ 钱包1余额: ${balance1} 代币`);

    if (balance1 <= 0) {
      throw new Error('钱包1余额为0，无法进行转账测试');
    }

    // 创建并签名交易
    console.log('\n--- 创建转账交易 ---');
    const transferAmount = 50;
    const transaction = new Transaction(wallet1Data.address, wallet2Data.address, transferAmount);
    
    console.log('交易详情:');
    console.log('  发送方:', transaction.fromAddress);
    console.log('  接收方:', transaction.toAddress);
    console.log('  金额:', transaction.amount);
    console.log('  时间戳:', transaction.timestamp);

    // 签名交易
    console.log('\n--- 签名交易 ---');
    transaction.signTransaction(wallet1Data.privateKey);
    console.log('✓ 交易签名完成');
    console.log('  签名对象:', transaction.signature);

    // 验证交易
    console.log('\n--- 验证交易 ---');
    const isValid = transaction.isValid();
    console.log('交易验证结果:', isValid);

    if (!isValid) {
      throw new Error('交易签名验证失败');
    }

    console.log('✓ 交易签名验证通过');

    // 添加交易到区块链
    console.log('\n--- 添加交易到区块链 ---');
    blockchain.addTransaction(transaction);
    console.log('✓ 交易已添加到待处理池');

    // 挖矿确认交易
    console.log('\n--- 挖矿确认交易 ---');
    blockchain.minePendingTransactions(wallet2Data.address);
    console.log('✓ 交易确认完成');

    // 检查最终余额
    console.log('\n--- 最终余额 ---');
    const finalBalance1 = blockchain.getBalanceOfAddress(wallet1Data.address);
    const finalBalance2 = blockchain.getBalanceOfAddress(wallet2Data.address);
    
    console.log(`钱包1最终余额: ${finalBalance1} 代币`);
    console.log(`钱包2最终余额: ${finalBalance2} 代币`);

    // 验证区块链
    console.log('\n--- 验证区块链完整性 ---');
    const isChainValid = blockchain.isChainValid();
    console.log('区块链有效性:', isChainValid);

    if (isChainValid) {
      console.log('\n🎉 所有测试通过！签名系统工作正常');
    } else {
      throw new Error('区块链验证失败');
    }

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('错误堆栈:', error.stack);
  }
}

// 运行测试
testSignature();