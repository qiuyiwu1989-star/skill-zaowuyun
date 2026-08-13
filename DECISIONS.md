# 决策记录

## D-001：新站与服务器现有 SkillOps 隔离

- 状态：已决定
- 日期：2026-08-13
- 决策：使用 `/opt/skill-zaowuyun`、端口 `4310` 和 `skill-zaowuyun.service`，不复用 `/opt/jineng-skillops`。
- 原因：服务器已有多套生产服务；独立部署能降低覆盖、端口冲突和回滚风险。

## D-002：首版不接入现有数据库

- 状态：已决定
- 日期：2026-08-13
- 决策：V0.1 使用只读公共 JSON 目录，不创建或修改服务器现有数据库。
- 原因：当前公网功能无需写库；先冻结 Registry 与运营数据契约，再通过独立角色和迁移接入 PostgreSQL。

## D-003：不发布演示候选

- 状态：已决定
- 日期：2026-08-13
- 决策：生产目录默认为空，只接受已通过 Registry Release 门禁的数据。
- 原因：本地演示数据不能代表真实许可、安全、Eval 与双人终审状态。

## D-004：Node 服务不启用 MemoryDenyWriteExecute

- 状态：已决定
- 日期：2026-08-13
- 决策：保留 systemd 的只读文件系统、无提权、空 capability 等沙箱，但不启用 `MemoryDenyWriteExecute`。
- 原因：Node.js 的 V8 运行时需要为 JIT 代码分配可执行内存；该选项会令服务在启动后触发 V8 致命错误。

## D-005：HTTPS 配置纳入仓库

- 状态：已决定
- 日期：2026-08-13
- 决策：证书签发后使用 `nginx-https.conf`，HTTP 永久跳转到 HTTPS，并启用一年期 HSTS；证书私钥与 ACME 账户不进入仓库。
- 原因：避免后续从仓库部署时重新覆盖为 HTTP-only 配置，同时保持证书材料只由服务器和 Certbot 管理。
