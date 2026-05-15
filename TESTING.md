# WinPAR 自动回归测试

本项目已接入一键测试 agent，用于替代大部分“改完就手动进微信开发者工具检查”的重复工作。

## 能力覆盖

- 逻辑测试（`utils/`）
  - 记分计算
  - 日期格式化
  - 距离计算与球场排序
- 页面行为测试（Page methods）
  - `step1-course` 附近球场推荐逻辑
  - `scorecard` 同步状态文案逻辑
- 快照回归（结构回归）
  - 关键页面输出结构快照，自动检测非预期变更

## 常用命令

```bash
npm test
```

等价于执行测试 agent：

```bash
node scripts/test-agent.js
```

其他命令：

```bash
npm run test:unit
npm run test:coverage
npm run test:watch
npm run test:update-snapshots
```

## 推荐开发流程

1. 改代码
2. 运行 `npm test`
3. 若快照失败：先确认是否为预期变更
4. 预期变更则执行 `npm run test:update-snapshots`
5. 最后仅对高风险交互做微信开发者工具人工验收

## 目录

- `jest.config.js` 测试配置
- `tests/setup/miniprogram-env.js` 小程序运行时 mock
- `tests/helpers/load-page.js` Page 装载工具
- `tests/utils/*.test.js` 逻辑回归
- `tests/pages/*.test.js` 页面行为与快照回归
- `scripts/test-agent.js` 一键测试执行器

## 微信开发者工具联动冒烟

新增命令：

```bash
npm run test:e2e:devtools
```

运行前需要配置微信开发者工具 CLI 路径（macOS 示例）：

```bash
export WECHAT_DEVTOOLS_CLI="/Applications/wechatwebdevtools.app/Contents/MacOS/cli"
export WECHAT_DEVTOOLS_HTTP_PORT="9420"
export WECHAT_DEVTOOLS_PORT="9421"
```

可选项：

```bash
export MINIPROGRAM_PROJECT_PATH="/Users/yuanyue/Downloads/golf-scorecard"
export MINIPROGRAM_HEADLESS="true"
```

一键跑“单测+覆盖率+开发者工具冒烟”：

```bash
npm run test:full
```

说明：该冒烟会自动验证 3 个关键页面能正常启动并具备核心数据字段，适合作为每次改动后的快速防回归检查。

## 开发-测试闭环（真实场景驱动）

新增目录：

- `scenarios/real-world-scenarios.json`：真实场景用例库
- `reports/defect-backlog.json`：缺陷看板
- `reports/last-closed-loop-report.json`：最近一次闭环报告

新增命令：

```bash
npm run test:closed-loop
npm run test:closed-loop:ff
npm run defects:report
```

闭环流程：

1. 开发改动后执行 `npm run test:closed-loop`
2. 若失败，系统会自动登记缺陷到 `reports/defect-backlog.json`
3. 开发修复后再次执行闭环命令
4. 通过即进入下一轮真实场景验证

场景维护建议：

- 每次真实下场遇到新问题，都新增一个场景到 `scenarios/real-world-scenarios.json`
- 场景标题尽量使用“可复现动作 + 预期结果”
- 高频问题优先加到 `core` 标签
