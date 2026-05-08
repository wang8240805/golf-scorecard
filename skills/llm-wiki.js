/**
 * LLM Wiki Skill - 基于andrej karpathy方法的个人知识库构建
 *
 * 工作流程：
 * 1. 数据导入：将源文档存入 wiki/raw/
 * 2. LLM编译：LLM将raw内容编译成结构化的wiki文章
 * 3. 问答查询：针对wiki内容提问，LLM自动研究并输出答案
 * 4. 归档增强：将输出归档回wiki，持续增强知识库
 * 5. 健康检查：定期清理检查数据一致性
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class LLMWikiSkill {
  constructor() {
    // 默认使用 ~/wiki 独立目录，如果不存在则在当前目录创建
    const homeWiki = path.join(os.homedir(), 'wiki');
    if (fs.existsSync(homeWiki)) {
      this.wikiRoot = homeWiki;
    } else {
      this.wikiRoot = path.join(process.cwd(), 'wiki');
    }
    this.rawDir = path.join(this.wikiRoot, 'raw');
    this.articlesDir = path.join(this.wikiRoot, 'articles');
    this.imagesDir = path.join(this.wikiRoot, 'images');
    this.draftsDir = path.join(this.wikiRoot, 'drafts');
  }

  /**
   * 初始化wiki目录结构
   */
  init() {
    [this.rawDir, this.articlesDir, this.imagesDir, this.draftsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // 创建README
    const readme = `# LLM 个人知识库

基于 [andrej karpathy 的方法](https://twitter.com/karpathy/status/1884433743481307525)构建的个人知识库。

## 目录结构

\`\`\`
wiki/
├── raw/          # 原始导入文档
├── articles/      # LLM编译后的结构化文章
├── images/       # 本地图片资源
├── drafts/        # 草稿
└── index.md      # 索引目录
\`\`\`

## 使用工作流

1. **导入**: 将原始文档放入 \`raw/\` 目录
2. **编译**: 请求 Claude 编译成结构化文章
3. **查询**: 提问获取基于wiki的答案
4. **归档**: 输出结果归档回wiki
5. **维护**: 定期运行健康检查

## 索引

<!-- 自动生成索引 -->
`;

    const indexPath = path.join(this.wikiRoot, 'index.md');
    if (!fs.existsSync(indexPath)) {
      fs.writeFileSync(indexPath, readme, 'utf8');
    }

    console.log('✅ LLM Wiki 初始化完成');
    console.log(`   Wiki根目录: ${this.wikiRoot}`);
    console.log('   使用方法:');
    console.log('   1. 将原始文档放入 wiki/raw/');
    console.log('   2. 告诉 Claude "请编译这篇文章到wiki"');
    console.log('   3. 开始提问查询');
  }

  /**
   * 列出所有原始文档
   */
  listRaw() {
    return this._listFiles(this.rawDir);
  }

  /**
   * 列出所有已编译文章
   */
  listArticles() {
    return this._listFiles(this.articlesDir);
  }

  /**
   * 生成索引
   */
  buildIndex() {
    const articles = this.listArticles();
    const indexPath = path.join(this.wikiRoot, 'index.md');
    let content = fs.readFileSync(indexPath, 'utf8');

    // 移除旧索引
    content = content.replace(/## 索引[\s\S]*$/, '## 索引\n\n<!-- 自动生成索引 -->\n');

    // 添加分类
    const categories = {};
    articles.forEach(article => {
      const relPath = path.relative(this.articlesDir, article);
      const category = path.dirname(relPath) || 'uncategorized';
      if (!categories[category]) categories[category] = [];
      categories[category].push(relPath);
    });

    // 写入新索引
    Object.keys(categories).sort().forEach(category => {
      content += `\n### ${category}\n`;
      categories[category].sort().forEach(article => {
        const title = path.basename(article, '.md');
        content += `- [${title}](./articles/${article})\n`;
      });
    });

    fs.writeFileSync(indexPath, content, 'utf8');
    console.log('✅ 索引更新完成');
    console.log(`   共 ${articles.length} 篇文章`);
  }

  /**
   * 获取统计信息
   */
  stats() {
    const rawFiles = this.listRaw();
    const articles = this.listArticles();

    const stats = {
      raw: rawFiles.length,
      articles: articles.length,
      totalWords: this._countTotalWords(articles)
    };

    console.log('📊 LLM Wiki 统计:');
    console.log(`   原始文档: ${stats.raw} 个`);
    console.log(`   编译文章: ${stats.articles} 篇`);
    console.log(`   总字数: ~${stats.totalWords.toLocaleString()} 字`);

    return stats;
  }

  _listFiles(dir) {
    const files = [];
    const walk = (d) => {
      const items = fs.readdirSync(d);
      items.forEach(item => {
        const fullPath = path.join(d, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (item.endsWith('.md') || item.endsWith('.txt') || item.endsWith('.html')) {
          files.push(fullPath);
        }
      });
    };
    walk(dir);
    return files;
  }

  _countTotalWords(articles) {
    let total = 0;
    articles.forEach(file => {
      try {
        const content = fs.readFileSync(file, 'utf8');
        total += content.split(/\s+/).length;
      } catch (e) {
        // ignore
      }
    });
    return total;
  }
}

// CLI入口
if (require.main === module) {
  const skill = new LLMWikiSkill();
  const command = process.argv[2];

  switch (command) {
    case 'init':
      skill.init();
      break;
    case 'index':
      skill.buildIndex();
      break;
    case 'stats':
      skill.stats();
      break;
    case 'list-raw':
      console.log('原始文档:');
      skill.listRaw().forEach(f => console.log(`  - ${path.relative(process.cwd(), f)}`));
      break;
    case 'list-articles':
      console.log('已编译文章:');
      skill.listArticles().forEach(f => console.log(`  - ${path.relative(process.cwd(), f)}`));
      break;
    default:
      console.log('可用命令: init, index, stats, list-raw, list-articles');
      break;
  }
}

module.exports = LLMWikiSkill;
