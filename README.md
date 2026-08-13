# 造物云可信技能市场

`skill.zaowuyun.com` 是造物云产品体系中的技能能力市场：对外提供可信技能发现与可追溯详情，对内承接 SkillOps 的采集、评估、终审、发布和运营结果。

当前版本是生产基础版，提供：

- 中文能力市场首页与可信准入说明；
- 只读公共目录接口；
- `/healthz` 与 `/readyz` 健康检查；
- 无第三方运行依赖的 Node.js 服务；
- systemd、Nginx、CI、可回滚发布基线；
- 默认空目录，避免将演示数据或未终审候选发布到公网。

## 本地运行

```bash
npm test
npm run check
npm start
```

然后访问 [http://127.0.0.1:4310](http://127.0.0.1:4310)。

## 公共目录契约

服务读取 `public/data/listings.json`。生产同步器后续只能将 Registry 的公共 Listing 投影写入此文件，不得直接读取 CandidateStore。

```json
{
  "schemaVersion": 1,
  "generatedAt": null,
  "listings": []
}
```

## 生产发布

部署文件位于 `deploy/`。首次签发证书前使用 `nginx-http.conf`；证书存在后使用 `nginx-https.conf`。正式发布使用版本化目录和 `current` 软链接；切换失败时将软链接恢复到上一版本并重启服务即可回滚。
