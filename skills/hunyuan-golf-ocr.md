# Hunyuan Golf OCR Skill (MVP)

## 目标
从高尔夫记分卡图片中提取 18 洞标准杆（Par），输出可解释的结构化结果，并支持低置信度洞位快速人工校正。

## MVP原则
1. 不把单次AI输出直接入库。
2. AI负责识别候选，规则负责强约束校验与修复。
3. 输出必须包含每洞置信度、来源与复核标记。
4. 前端只让用户修正少量低置信度洞位。

## 输入
- `fileID`（云存储图片）或 `imageBase64`
- 可选：`courseNameHint`

## 输出（统一JSON）
```json
{
  "success": true,
  "data": {
    "holes": [
      {
        "hole": 1,
        "par": 4,
        "confidence": 0.92,
        "source": "ai|rule_infer|default_fill",
        "needs_review": false
      }
    ],
    "frontNinePar": 36,
    "backNinePar": 36,
    "totalPar": 72,
    "confidence": 0.88,
    "source": "hunyuan+rule-engine",
    "validation": {
      "valid": true,
      "severity": "ok|warning|error",
      "reason": "",
      "changedHoles": [3, 11],
      "reviewHoles": [3, 11, 17]
    },
    "quality": {
      "imageQualityScore": 0.8,
      "coverageScore": 1,
      "consistencyScore": 1
    },
    "debugInfo": {
      "rawPars": [5,4,3,4,...],
      "fixedPars": [5,4,3,4,...],
      "aiReason": "..."
    }
  }
}
```

## 处理流程
1. **AI候选提取**
- 使用混元多模态识别整张记分卡。
- 输出 `pars` 数组（不要求一次绝对正确）。

2. **规则引擎标准化**
- Par值限制在 `3/4/5`（MVP默认；可配置允许6）。
- 长度补齐到18（不足补4，超出截断）。
- 前9、后9各自做和为36的最小代价修复。

3. **校验与分级**
- 校验 18 洞完整性、前后9和、总和。
- 标记修改洞位 `changedHoles` 和 `reviewHoles`。
- 产出 `severity`：
  - `ok`：无修改或少量高置信度修复
  - `warning`：修复较多，建议人工核对
  - `error`：无法得到可用结果

4. **前端复核策略**
- 只高亮 `reviewHoles`。
- 用户点选 3/4/5 完成修正后入库。

## 关键阈值（MVP）
- `maxRuleChangedHoles`: 6
- `highConfidence`: 0.85
- `lowConfidence`: 0.65
- `defaultFillConfidence`: 0.5

## 错误码建议
- `E_IMG_MISSING`
- `E_AI_EMPTY`
- `E_FIX_FAILED`
- `E_VALIDATION_FAILED`

## 入库建议
1. 保存 `holes + validation + source + confidence`。
2. 记录 `changedHoles` 数量用于后续质量统计。
3. 同球场多次一致后标记 `holesVerified=true`。

