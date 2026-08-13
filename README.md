# 造物云可信技能市场

`skill.zaowuyun.com` 是造物云产品体系中的技能能力市场：对外提供可信技能发现与可追溯详情，对内承接 SkillOps 的采集、评估、终审、发布和运营结果。

当前版本提供：

- 中文能力市场首页与可信准入说明；
- 只读公共目录接口；
- `/healthz` 与 `/readyz` 健康检查；
- 无第三方运行依赖的 Node.js 服务；
- systemd、Nginx、CI、可回滚发布基线；
- “已收录、可调用、企业认证”三级市场状态；
- 首批 3 个造物云自有技能，每项都有独立详情页和可复制调用词；
- 安装资格与调用资格分离，授权、Eval 或终审未完成时不开放技能包分发。

## 本地运行

```bash
npm test
npm run check
npm start
```

然后访问 [http://127.0.0.1:4310](http://127.0.0.1:4310)。

## 公共目录契约

服务读取 `public/data/listings.json`。该文件是固定字段的公共目录投影，不得包含 Candidate ID、本地路径、存储位置、审核人身份或运行时数据。生产同步器后续可以写入收录项和 Registry Release，但必须保持三级状态语义。

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-08-14T00:00:00.000Z",
  "listings": [
    {
      "skillId": "publisher/skill-name",
      "stage": "callable",
      "distribution": "source_only",
      "install": { "eligible": false, "reason": "redistribution_license_pending" }
    }
  ]
}
```

`callable` 只表示公开调用模板可用，不表示平台已经复制技能内容或允许安装。`certified` 才能进入企业安装与生产分发。

## 生产发布

部署文件位于 `deploy/`。首次签发证书前使用 `nginx-http.conf`；证书存在后使用 `nginx-https.conf`。正式发布使用版本化目录和 `current` 软链接，并将 `APP_VERSION=<发布版本>` 写入服务器的 `/etc/skill-zaowuyun.env`；切换失败时将软链接恢复到上一版本并重启服务即可回滚。
