# skill.zaowuyun.com 项目协作约定

## 项目定位

这是造物云的可信技能市场入口。它只展示已经完成来源、许可、安全、SMS、Eval 与人类终审的公开 Release，不直接读取候选池，也不执行第三方技能。

## 不可违反的边界

- 公网目录只消费经过隐私裁剪的 Registry 公共投影。
- 禁止在仓库中存放口令、访问令牌、数据库凭据或私钥。
- 禁止把 `cand_*`、本地路径、`storageRef`、审核人身份、Prompt、Output 或 Token 写入公共产物。
- 未获得完整包和当前证据的技能只能保留来源链接，不得标记为可安装。
- 生产发布必须经过测试、健康检查和可回滚发布目录，不直接覆盖当前版本。
- 数据库变更必须使用迁移；当前生产基线不写现有数据库。

## 常用命令

```bash
npm test
npm run check
npm start
```

## 部署模型

- 应用：Node.js 内置 HTTP 服务，仅监听 `127.0.0.1:4310`。
- 入口：Nginx 为 `skill.zaowuyun.com` 反向代理。
- 发布：`/opt/skill-zaowuyun/releases/<commit>`，`current` 软链接原子切换。
- 服务：`skill-zaowuyun.service`。

