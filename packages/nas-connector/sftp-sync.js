#!/usr/bin/env node
/**
 * SFTP Sync - 极空间 NAS SFTP 同步工具
 * 备选方案：当 API 不可用时使用
 */

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

class SFTPSync {
  constructor(config) {
    this.config = {
      host: config.host || '192.168.1.100',
      port: config.port || 22,
      username: config.username || 'admin',
      password: config.password || '',
      privateKey: config.privateKey || null,
    };
  }

  // 连接 SFTP
  connect() {
    return new Promise((resolve, reject) => {
      const client = new Client();
      
      client.on('ready', () => {
        client.sftp((err, sftp) => {
          if (err) reject(err);
          else resolve({ client, sftp });
        });
      });

      client.on('error', reject);

      const connectConfig = {
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
      };

      if (this.config.privateKey) {
        connectConfig.privateKey = fs.readFileSync(this.config.privateKey);
      } else {
        connectConfig.password = this.config.password;
      }

      client.connect(connectConfig);
    });
  }

  // 列出远程目录
  async listFiles(remotePath) {
    const { sftp } = await this.connect();
    
    return new Promise((resolve, reject) => {
      sftp.readdir(remotePath, (err, list) => {
        sftp.end();
        if (err) reject(err);
        else resolve(list);
      });
    });
  }

  // 下载文件
  async downloadFile(remotePath, localPath) {
    const { sftp } = await this.connect();
    
    return new Promise((resolve, reject) => {
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      
      sftp.fastGet(remotePath, localPath, (err) => {
        sftp.end();
        if (err) reject(err);
        else resolve(localPath);
      });
    });
  }

  // 批量下载
  async downloadDir(remotePath, localPath, options = {}) {
    console.log('\n📥 SFTP 批量下载');
    console.log('   远程路径:', remotePath);
    console.log('   本地路径:', localPath);

    const files = await this.listFiles(remotePath);
    const results = { total: 0, success: 0, failed: 0, files: [] };

    const filter = options.filter || ((f) => true);
    const filteredFiles = files.filter(filter);
    results.total = filteredFiles.length;

    console.log('   筛选后文件数:', results.total, '\n');

    for (const file of filteredFiles) {
      const fileName = file.filename;
      const remoteFilePath = path.posix.join(remotePath, fileName);
      const localFilePath = path.join(localPath, fileName);

      try {
        await this.downloadFile(remoteFilePath, localFilePath);
        results.success++;
        results.files.push({ name: fileName, status: 'success' });
        console.log('✅', fileName);
      } catch (e) {
        results.failed++;
        results.files.push({ name: fileName, status: 'failed', error: e.message });
        console.log('❌', fileName, '-', e.message.substring(0, 50));
      }
    }

    console.log('\n✅ 下载完成！');
    console.log('   总计:', results.total);
    console.log('   成功:', results.success);
    console.log('   失败:', results.failed);

    return results;
  }

  // 测试连接
  async test() {
    console.log('🧪 测试 SFTP 连接...\n');
    
    try {
      const { sftp } = await this.connect();
      console.log('✅ SFTP 连接成功！');
      
      const files = await this.listFiles('/');
      console.log('✅ 根目录文件数:', files.length);
      console.log('\n测试通过！\n');
      
      return true;
    } catch (e) {
      console.log('❌ 测试失败:', e.message);
      console.log('\n提示：请确保极空间 SSH 功能已启用\n');
      return false;
    }
  }
}

// CLI 模式
if (require.main === module) {
  const config = {
    host: process.env.NAS_HOST || '192.168.1.100',
    username: process.env.NAS_USERNAME || 'admin',
    password: process.env.NAS_PASSWORD || '',
  };

  const sync = new SFTPSync(config);
  
  const command = process.argv[2];
  
  if (command === 'test') {
    sync.test().catch(console.error);
  } else if (command === 'download') {
    const remotePath = process.argv[3] || '/volume1/data/openclaw/workspace';
    const localPath = process.argv[4] || './workspace';
    
    sync.downloadDir(remotePath, localPath, {
      filter: (file) => {
        const name = file.filename;
        return name.endsWith('.md') || name.endsWith('.txt') || name.endsWith('.json');
      }
    }).catch(console.error);
  } else {
    console.log('用法:');
    console.log('  node sftp-sync.js test                    # 测试连接');
    console.log('  node sftp-sync.js download <远程路径> <本地路径>  # 下载文件');
    console.log('');
    console.log('环境变量:');
    console.log('  NAS_HOST      - NAS 地址 (默认：192.168.1.100)');
    console.log('  NAS_USERNAME  - 用户名 (默认：admin)');
    console.log('  NAS_PASSWORD  - 密码 (必填)');
    console.log('');
  }
}

module.exports = { SFTPSync };
