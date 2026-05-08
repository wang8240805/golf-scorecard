# LLM Wiki Skill

**作用**: 基于andrej karpathy方法构建个人知识库，让LLM自动维护你的维基知识库。

**核心思想**:
- 将原始资料导入 `wiki/raw/`
- LLM自动编译成结构化文章存入 `wiki/articles/`
- LLM可以基于整个wiki回答问题
- 结果再归档回wiki，持续增长
- 定期健康检查保证数据一致性

**使用方法**:
```bash
# 初始化wiki
node skills/llm-wiki.js init

# 查看统计
node skills/llm-wiki.js stats

# 更新索引
node skills/llm-wiki.js index

# 列出文章
node skills/llm-wiki.js list-articles
```

**在Claude Code中使用**:
- `"请把 wiki/raw/xxx.md 编译成wiki文章"`
- `"基于我的wiki知识库，回答这个问题..."`
- `"对wiki运行健康检查，找出不一致数据"`
- `"帮我创建一个关于xxx的新wiki文章"`
