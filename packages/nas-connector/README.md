# NAS Connector - 极空间 NAS 连接工具

**解决极空间 NAS 文件导出问题**

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/pengong101/openclaw-toolkit/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## 🎯 功能特性

- 🔌 **极空间 API 集成** - 官方 API 客户端
- 📁 **文件批量导出** - 一键导出工作文档
- 🔄 **定时同步** - 自动同步 NAS 文件
- 🔐 **SFTP 备选** - API 不可用时的备选方案
- ⚡ **简单易用** - 命令行 + 配置文件

---

## 📦 安装

```bash
cd openclaw-toolkit/packages/nas-connector
npm install
```

**依赖：**
- ssh2 (SFTP 支持)
- node-cron (定时任务)

---

## 🚀 快速开始

### 方式 1：极空间 API（推荐）

```bash
# 设置环境变量
export JISU_BASE_URL=http://192.168.1.100:9999
export JISU_USERNAME=admin
export JISU_PASSWORD=your-password

# 测试连接
node jisu-api.js test

# 导出文档
node jisu-api.js export /volume1/data/openclaw/workspace ./exported
```

### 方式 2：SFTP（备选）

```bash
# 设置环境变量
export NAS_HOST=192.168.1.100
export NAS_USERNAME=admin
export NAS_PASSWORD=your-password

# 测试连接
node sftp-sync.js test

# 下载文件
node sftp-sync.js download /volume1/data/openclaw/workspace ./workspace
```

---

## ⚙️ 配置选项

### 极空间 API 配置

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| JISU_BASE_URL | 极空间地址 | http://192.168.1.100:9999 |
| JISU_USERNAME | 用户名 | admin |
| JISU_PASSWORD | 密码 | (必填) |

### SFTP 配置

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| NAS_HOST | NAS 地址 | 192.168.1.100 |
| NAS_USERNAME | 用户名 | admin |
| NAS_PASSWORD | 密码 | (必填) |
| NAS_PORT | SSH 端口 | 22 |

---

## 📋 使用示例

### 导出 Markdown 文档

```javascript
const { JisuNAS } = require('./jisu-api');

const nas = new JisuNAS({
  baseUrl: 'http://192.168.1.100:9999',
  username: 'admin',
  password: 'your-password'
});

// 导出所有.md 文件
nas.login().then(() => {
  return nas.exportDocuments(
    '/volume1/data/openclaw/workspace',
    './exported',
    {
      filter: (file) => file.name.endsWith('.md')
    }
  );
}).then(results => {
  console.log('导出完成:', results);
}).catch(console.error);
```

### 定时同步（每小时）

```javascript
const cron = require('node-cron');
const { SFTPSync } = require('./sftp-sync');

const sync = new SFTPSync({
  host: '192.168.1.100',
  username: 'admin',
  password: 'your-password'
});

// 每小时同步一次
cron.schedule('0 * * * *', async () => {
  console.log('开始定时同步...');
  await sync.downloadDir(
    '/volume1/data/openclaw/workspace',
    './workspace',
    {
      filter: (file) => file.filename.endsWith('.md')
    }
  );
  console.log('同步完成！');
});

console.log('定时任务已启动');
```

---

## 🧪 测试

```bash
# 测试极空间 API 连接
node jisu-api.js test

# 测试 SFTP 连接
node sftp-sync.js test
```

---

## 🐛 故障排查

### 问题 1：API 连接失败

**症状：** `ECONNREFUSED` 或 `401 Unauthorized`

**解决：**
1. 检查极空间是否开机
2. 确认管理端口（默认 9999）
3. 验证用户名密码正确

---

### 问题 2：SFTP 连接失败

**症状：** `Authentication failed`

**解决：**
1. 启用极空间 SSH 功能
   - 设置 → 终端和同步 → SSH → 启用
2. 确认 SSH 端口（默认 22）
3. 检查防火墙设置

---

### 问题 3：文件权限不足

**症状：** `Permission denied`

**解决：**
1. 检查用户权限
2. 使用管理员账户
3. 确认文件路径正确

---

## 📊 API 参考

### JisuNAS 类

#### 构造函数

```javascript
new JisuNAS(config)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| config.baseUrl | string | 极空间地址 |
| config.username | string | 用户名 |
| config.password | string | 密码 |

#### 方法

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `login()` | 登录获取 Session | Promise<boolean> |
| `listFiles(path)` | 获取文件列表 | Promise<Array> |
| `downloadFile(remote, local)` | 下载单个文件 | Promise<string> |
| `exportDocuments(source, dest, options)` | 批量导出 | Promise<Object> |
| `test()` | 测试连接 | Promise<boolean> |

---

### SFTPSync 类

#### 构造函数

```javascript
new SFTPSync(config)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| config.host | string | NAS 地址 |
| config.port | number | SSH 端口 |
| config.username | string | 用户名 |
| config.password | string | 密码 |

#### 方法

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `connect()` | 连接 SFTP | Promise<Object> |
| `listFiles(path)` | 列出远程目录 | Promise<Array> |
| `downloadFile(remote, local)` | 下载文件 | Promise<string> |
| `downloadDir(remote, local, options)` | 批量下载 | Promise<Object> |
| `test()` | 测试连接 | Promise<boolean> |

---

## 🎯 下一步计划

- [ ] WebDAV 挂载支持
- [ ] 图形化界面
- [ ] 增量同步
- [ ] 双向同步
- [ ] 冲突解决

---

## 📄 许可证

MIT License

---

## 🙏 致谢

- [极空间](https://www.zspace.com) - NAS 设备
- [ssh2](https://github.com/mscdex/ssh2) - SFTP 库

---

**⭐ Star this project if you find it useful!**
