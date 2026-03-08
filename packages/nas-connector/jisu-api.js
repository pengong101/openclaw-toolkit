#!/usr/bin/env node
/**
 * JisuNAS Connector - 极空间 NAS API 客户端
 * 解决极空间 NAS 文件导出问题
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

class JisuNAS {
  constructor(config) {
    this.baseUrl = config.baseUrl || 'http://192.168.1.100:9999';
    this.token = config.token || '';
    this.username = config.username || 'admin';
    this.password = config.password || '';
    this.sessionId = null;
  }

  // HTTP 请求封装
  request(method, apiPath, data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(apiPath, this.baseUrl);
      const client = url.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'OpenClaw-JisuNAS-Connector',
        },
      };

      if (this.sessionId) {
        options.headers['Authorization'] = 'Bearer ' + this.sessionId;
      }

      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const json = body ? JSON.parse(body) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(json);
            } else {
              reject(new Error('API ' + res.statusCode + ': ' + (json.message || body.substring(0, 200))));
            }
          } catch (e) {
            resolve({ raw: body, status: res.statusCode });
          }
        });
      });

      req.on('error', reject);
      if (data) req.write(JSON.stringify(data));
      req.end();
    });
  }

  // 登录获取 Session
  async login() {
    console.log('🔐 登录极空间 NAS...');
    try {
      const result = await this.request('POST', '/api/auth/login', {
        username: this.username,
        password: this.password,
      });
      
      if (result.token || result.sessionId) {
        this.sessionId = result.token || result.sessionId;
        console.log('✅ 登录成功！');
        return true;
      } else {
        console.log('⚠️  登录响应:', JSON.stringify(result).substring(0, 200));
        return false;
      }
    } catch (e) {
      console.log('❌ 登录失败:', e.message.substring(0, 100));
      return false;
    }
  }

  // 获取文件列表
  async listFiles(remotePath) {
    console.log('📁 获取文件列表:', remotePath);
    try {
      const result = await this.request('POST', '/api/file/list', {
        path: remotePath,
        page: 1,
        size: 100,
      });
      
      if (result.files || result.data) {
        const files = result.files || result.data || [];
        console.log('✅ 找到', files.length, '个文件');
        return files;
      } else {
        console.log('⚠️  响应:', JSON.stringify(result).substring(0, 200));
        return [];
      }
    } catch (e) {
      console.log('❌ 获取失败:', e.message.substring(0, 100));
      return [];
    }
  }

  // 下载文件
  async downloadFile(remotePath, localPath) {
    console.log('📥 下载文件:', remotePath);
    try {
      const result = await this.request('POST', '/api/file/download', {
        path: remotePath,
      });
      
      if (result.url) {
        // 下载文件内容
        const fileContent = await this.downloadFromUrl(result.url);
        
        // 保存到本地
        if (localPath) {
          fs.mkdirSync(path.dirname(localPath), { recursive: true });
          fs.writeFileSync(localPath, fileContent);
          console.log('✅ 保存到:', localPath);
        }
        
        return fileContent;
      } else {
        console.log('⚠️  响应:', JSON.stringify(result).substring(0, 200));
        return null;
      }
    } catch (e) {
      console.log('❌ 下载失败:', e.message.substring(0, 100));
      return null;
    }
  }

  // 从 URL 下载内容
  downloadFromUrl(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      client.get(url, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve(body));
      }).on('error', reject);
    });
  }

  // 批量导出文档
  async exportDocuments(sourcePath, destPath, options = {}) {
    console.log('\n📤 批量导出文档');
    console.log('   源路径:', sourcePath);
    console.log('   目标路径:', destPath);
    
    const files = await this.listFiles(sourcePath);
    const results = {
      total: 0,
      success: 0,
      failed: 0,
      files: [],
    };

    const filter = options.filter || ((f) => true);
    const filteredFiles = files.filter(filter);
    results.total = filteredFiles.length;

    console.log('   筛选后文件数:', results.total, '\n');

    for (const file of filteredFiles) {
      const fileName = file.name || file.fileName;
      const filePath = file.path || file.filePath;
      
      try {
        const localFilePath = path.join(destPath, fileName);
        await this.downloadFile(filePath, localFilePath);
        results.success++;
        results.files.push({ name: fileName, status: 'success' });
      } catch (e) {
        results.failed++;
        results.files.push({ name: fileName, status: 'failed', error: e.message });
      }
    }

    console.log('\n✅ 导出完成！');
    console.log('   总计:', results.total);
    console.log('   成功:', results.success);
    console.log('   失败:', results.failed);

    return results;
  }

  // 测试连接
  async test() {
    console.log('🧪 测试极空间 NAS 连接...\n');
    
    // 测试登录
    const loginSuccess = await this.login();
    if (!loginSuccess) {
      console.log('\n❌ 测试失败：无法登录\n');
      return false;
    }

    // 测试文件列表
    const files = await this.listFiles('/');
    if (files.length === 0) {
      console.log('\n⚠️  警告：根目录无文件或 API 响应异常\n');
    }

    console.log('\n✅ 测试通过！连接正常\n');
    return true;
  }
}

// CLI 模式
if (require.main === module) {
  const config = {
    baseUrl: process.env.JISU_BASE_URL || 'http://192.168.1.100:9999',
    username: process.env.JISU_USERNAME || 'admin',
    password: process.env.JISU_PASSWORD || '',
  };

  const nas = new JisuNAS(config);
  
  const command = process.argv[2];
  
  if (command === 'test') {
    nas.test().catch(console.error);
  } else if (command === 'export') {
    const sourcePath = process.argv[3] || '/volume1/data/openclaw/workspace';
    const destPath = process.argv[4] || './exported';
    
    nas.login().then(() => {
      return nas.exportDocuments(sourcePath, destPath, {
        filter: (file) => {
          const name = file.name || file.fileName || '';
          return name.endsWith('.md') || name.endsWith('.txt') || name.endsWith('.json');
        }
      });
    }).catch(console.error);
  } else {
    console.log('用法:');
    console.log('  node jisu-api.js test                    # 测试连接');
    console.log('  node jisu-api.js export <源路径> <目标路径>  # 导出文档');
    console.log('');
    console.log('环境变量:');
    console.log('  JISU_BASE_URL   - 极空间地址 (默认：http://192.168.1.100:9999)');
    console.log('  JISU_USERNAME   - 用户名 (默认：admin)');
    console.log('  JISU_PASSWORD   - 密码 (必填)');
    console.log('');
  }
}

module.exports = { JisuNAS };
