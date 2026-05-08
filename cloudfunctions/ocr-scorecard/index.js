// 引入微信云开发 SDK
const cloud = require('wx-server-sdk')

// 初始化云开发
cloud.init()

// 腾讯混元 API Key
const hunyuanApiKey = process.env.HUNYUAN_API_KEY || '';

/**
 * 解析表格结构 - 全程AI直接识别，抛弃传统规则匹配
 */
async function parseTableStructured(textDetections, imageBase64) {
  const debugLog = [];
  const log = (msg) => {
    console.log(msg);
    debugLog.push(msg);
  };

  log(`[AI直接识别] 直接调用混元AI识别整张图片`);

  // 直接调用混元AI多模态识别图片
  try {
    const aiResult = await fixWithAIForFullTable(imageBase64);
    if (aiResult && aiResult.pars && Array.isArray(aiResult.pars)) {
      // 自动修复长度：确保正好18个洞
      let fixedPars = [...aiResult.pars];

      // 如果少于18个，用默认值4补齐
      while (fixedPars.length < 18) {
        fixedPars.push(4);
        log(`[AI自动修复] 缺少${18 - fixedPars.length + 1}个洞，补默认值4`);
      }

      // 如果多于18个，截断前18个
      if (fixedPars.length > 18) {
        fixedPars = fixedPars.slice(0, 18);
        log(`[AI自动修复] 多出${fixedPars.length - 18}个洞，截断前18个`);
      }

      // 转换为洞格式
      const aiHoles = fixedPars.map((par, i) => ({
        hole: i + 1,
        par: typeof par === 'number' ? par : 4,
        source: 'ai'
      }));
      const aiTotal = aiHoles.reduce((s, h) => s + h.par, 0);
      log(`[AI识别成功] 共${aiHoles.length}洞 总杆=${aiTotal} 结果: ${fixedPars.join(',')}`);
      return {
        holes: aiHoles,
        confidence: 0.95,
        source: 'AI直接识别图片',
        debugInfo: {
          log: debugLog,
          holeCount: aiHoles.length,
          totalPar: aiTotal,
          aiReason: aiResult.reason
        }
      };
    }
    log(`[AI识别失败] AI返回结果不对: ${JSON.stringify(aiResult)}`);
    return {
      holes: [],
      confidence: 0,
      source: 'AI识别失败',
      debugInfo: {
        log: debugLog,
        totalPar: 0
      }
    };
  } catch (err) {
    log(`[AI调用失败] ${err.message}`);
    return {
      holes: [],
      confidence: 0,
      source: 'AI调用异常',
      debugInfo: {
        log: debugLog,
        totalPar: 0
      }
    };
  }
}

/**
 * 共享函数：调用混元AI，获取JSON响应
 * 带自动重试：网络错误/5xx错误自动重试最多2次，指数退避
 * 被 fixWithAIForFullTable 和 fixWithAI 共同使用
 */
async function callHunyuanAI(prompt, imageBase64, timeoutMs = 120000, maxRetries = 2) {
  // 递归重试
  async function attempt(retryCount) {
    const https = require('https');
    const body = {
      model: 'hunyuan-vision',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
        ]
      }]
    };

    const postData = JSON.stringify(body);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('AI识别超时')), timeoutMs);

      console.log(`[callHunyuanAI] 尝试 ${retryCount + 1}/${maxRetries + 1}, API Key长度: ${hunyuanApiKey.length}`);

      const req = https.request({
        hostname: 'api.hunyuan.cloud.tencent.com',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + hunyuanApiKey,
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        console.log('[callHunyuanAI] 状态码:', res.statusCode);

        let data = '';
        res.on('data', chunk => {
          data += chunk;
          console.log('[callHunyuanAI] 接收数据块:', chunk.length, 'bytes');
        });

        res.on('end', () => {
          clearTimeout(timeout);
          console.log('[callHunyuanAI] 完整响应长度:', data.length);

          // 5xx 错误重试
          if (res.statusCode >= 500 && retryCount < maxRetries) {
            console.log(`[callHunyuanAI] 服务器错误 ${res.statusCode}, 准备重试`);
            // 指数退避：2^retryCount * 1000 ms
            const delay = Math.pow(2, retryCount) * 1000;
            setTimeout(() => {
              attempt(retryCount + 1).then(resolve).catch(reject);
            }, delay);
            return;
          }

          try {
            if (!data || data.length === 0) {
              console.error('[callHunyuanAI] 响应为空');
              reject(new Error('API返回空响应'));
              return;
            }

            const result = JSON.parse(data);

            if (result.error) {
              console.error('[callHunyuanAI] API错误:', JSON.stringify(result.error));
              // 4xx 错误不重试（认证错误/请求错误），5xx 已经上面处理了重试
              reject(new Error(result.error.message || result.error));
              return;
            }

            const content = result.choices?.[0]?.message?.content || '';
            console.log('[callHunyuanAI] AI内容长度:', content.length);

            if (!content) {
              console.error('[callHunyuanAI] AI返回内容为空');
              resolve(null);
              return;
            }

            console.log('[callHunyuanAI] AI内容前500字:', content.substring(0, 500));

            // 提取JSON - 改进算法：找到第一个 {，然后找匹配的 closing }，考虑括号嵌套
            let jsonStr = '';
            const firstBrace = content.indexOf('{');
            if (firstBrace >= 0) {
              let braceCount = 0;
              let endPos = firstBrace;
              for (let i = firstBrace; i < content.length; i++) {
                if (content[i] === '{') braceCount++;
                if (content[i] === '}') braceCount--;
                if (braceCount === 0) {
                  endPos = i + 1;
                  break;
                }
              }
              jsonStr = content.substring(firstBrace, endPos);
            } else {
              jsonStr = '';
            }

            if (jsonStr && jsonStr.length > 10) {
              try {
                // 去掉markdown代码块标记
                jsonStr = jsonStr.replace(/```json\s*/, '').replace(/\s*```$/, '');
                // 将未转义的换行符转义 - 匹配双引号之间的内容，转义其中的实际换行
                jsonStr = jsonStr.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match, group) => {
                  const escaped = group.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
                  return `"${escaped}"`;
                });
                resolve(JSON.parse(jsonStr));
              } catch (e) {
                console.error('[callHunyuanAI] JSON解析失败:', e.message, '提取内容:', jsonStr.substring(0, 200));
                reject(e);
              }
            } else {
              console.error('[callHunyuanAI] 未找到JSON:', content);
              resolve(null);
            }
          } catch (e) {
            console.error('[callHunyuanAI] 解析异常:', e.message);
            reject(e);
          }
        });
      });

      req.on('error', e => {
        console.error('[callHunyuanAI] 请求错误:', e.message);
        clearTimeout(timeout);

        // 网络错误重试
        if (retryCount < maxRetries) {
          console.log(`[callHunyuanAI] 网络错误，准备重试`);
          const delay = Math.pow(2, retryCount) * 1000;
          setTimeout(() => {
            attempt(retryCount + 1).then(resolve).catch(reject);
          }, delay);
        } else {
          reject(e);
        }
      });

      req.write(postData);
      req.end();
    });
  }

  return attempt(0);
}

/**
 * 调用AI直接识别整张记分卡图片
 * 多模态直接看图片，比OCR+文字更直接
 */
async function fixWithAIForFullTable(imageBase64) {
  const prompt = `你是高尔夫记分卡识别专家，请仔细分析这张图片，提取出18洞每洞的标准杆PAR值。

# 高尔夫基本知识（必须遵守）
- 标准18洞 = 前9洞 + 后9洞
- 前9洞总和 **必须等于 36**
- 后9洞总和 **必须等于 36**
- 18洞总和 **必须等于 72**
- PAR值只能是 3、4、5 这三个数字，没有例外

# 典型分布（参考）
- 一个标准18洞通常有：4个Par3 + 10个Par4 + 4个Par5 = 72

# 识别步骤（请按这个顺序思考）
1. 先观察图片，找到记分卡的表格结构，确定哪一行/哪一列是PAR值
2. 按洞号顺序 1 → 2 → 3 → ... → 18，逐个读取PAR值
3. 提取完成后，计算：前9洞总和、后9洞总和、总总和
4. 如果总和不等于 36/36/72，请重新检查并修正，直到正确
5. 如果有个别数字看不清楚，根据总和规律推断最可能的值

# 输出格式
请严格按照JSON格式返回：
{
  "pars": [5,4,3,4,4,3,4,5,4,4,4,5,4,3,5,4,3,4],
  "reason": "简述你的识别过程：表格结构是什么样的？你是如何找到每个PAR值的？如果修正过，请说明修正了哪里"
}`;

  return callHunyuanAI(prompt, imageBase64, 120000);
}

/**
 * 无PAR关键字时的备用解析方法
 */
function parseWithoutParKeyword(allBlocks, log) {
  // 提取所有独立的3、4、5数字
  const parCandidates = [];

  allBlocks.forEach(b => {
    const numbers = b.rawText.match(/\d+/g) || [];
    numbers.forEach(numStr => {
      const num = parseInt(numStr);
      if (numStr.length === 1) {
        const n = parseInt(numStr);
        if (n >= 3 && n <= 5) {
          parCandidates.push({ par: n, x: b.centerX, y: b.centerY });
        }
      }
    });
  });

  log(`  找到 ${parCandidates.length} 个候选PAR值`);

  // 按Y坐标分组，找最多的一组
  const yGroups = {};
  parCandidates.forEach(p => {
    const yKey = Math.round(p.y / 20) * 20;
    if (!yGroups[yKey]) yGroups[yKey] = [];
    yGroups[yKey].push(p);
  });

  let maxGroup = [];
  let maxY = 0;
  Object.entries(yGroups).forEach(([y, group]) => {
    if (group.length > maxGroup.length) {
      maxGroup = group;
      maxY = parseInt(y);
    }
  });

  log(`  最密集Y=${maxY}组，共${maxGroup.length}个PAR值`);

  maxGroup.sort((a, b) => a.x - b.x);

  const holes = maxGroup.slice(0, 18).map((p, i) => ({
    hole: i + 1,
    par: p.par
  }));

  return {
    holes,
    confidence: 0.6,
    source: '数字密度分析',
    debugInfo: { log }
  };
}

/**
 * 验证Par数据合理性
 * 规则：PAR只能是3,4,5；允许总和合理范围内偏离标准
 * 允许偏差：9洞允许 ±2，18洞允许 ±4（相当于每9洞±2）
 */
function validateParData(holes) {
  if (!holes || holes.length < 9) {
    return { valid: false, reason: '洞数不完整，至少需要9洞' };
  }

  const pars = holes.map(h => h.par);

  // 检查PAR值是否合法（只能是3-5）
  for (const par of pars) {
    if (par < 3 || par > 5) {
      return { valid: false, reason: `PAR值${par}不合法，只能是3-5` };
    }
  }

  const totalPar = pars.reduce((sum, p) => sum + p, 0);

  // 验证每9洞 - 允许偏差±2
  const validate9Holes = (ninePars, label) => {
    const sum = ninePars.reduce((s, p) => s + p, 0);

    // 允许偏差 ±2，绝大多数球场都在范围内
    if (Math.abs(sum - 36) > 2) {
      return {
        valid: false,
        reason: `${label}标准杆${sum}，离标准36偏差超过2`
      };
    }

    return { valid: true };
  };

  // 验证总标准杆
  if (holes.length === 18) {
    // 总允许偏差 ±4（对应每9洞±2）
    if (Math.abs(totalPar - 72) > 4) {
      return { valid: false, reason: `18洞总标准杆${totalPar}，离标准72偏差超过4` };
    }

    // 分别验证前9洞和后9洞
    const front9Result = validate9Holes(pars.slice(0, 9), '前9洞');
    if (!front9Result.valid) {
      return front9Result;
    }

    const back9Result = validate9Holes(pars.slice(9, 18), '后9洞');
    if (!back9Result.valid) {
      return back9Result;
    }

  } else if (holes.length === 9) {
    // 9洞允许偏差 ±2
    if (Math.abs(totalPar - 36) > 2) {
      return { valid: false, reason: `9洞总标准杆${totalPar}，离标准36偏差超过2` };
    }

    const result = validate9Holes(pars, '9洞');
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true, totalPar };
}

/**
 * 调用AI直接识别整张记分卡图片（多模态）
 * AI直接看图片，比OCR+规则更可靠
 */
async function fixWithAI(imageBase64, initialResult, validationError) {
  const prompt = `你是高尔夫记分卡专家。初步识别结果有误，请重新分析图片并给出正确的PAR值。

【原始图片】
（图片已经附在请求中）

【初步识别结果】
${JSON.stringify(initialResult)}

【识别问题】
${validationError}

# 高尔夫基本知识（必须遵守）
- 标准18洞 = 前9洞 + 后9洞
- 前9洞总和 **必须等于 36**
- 后9洞总和 **必须等于 36**
- 18洞总和 **必须等于 72**
- PAR值只能是 3、4、5 这三个数字，没有例外

# 修正步骤（请按这个顺序重新思考）
1. 重新观察图片，找到记分卡的完整表格结构
2. 确定哪一行/哪一列确实是PAR值（注意区分码数和PAR）
3. 按洞号顺序 1→18 逐个重新读取PAR值
4. 计算验证总和，必须符合 36/36/72
5. 找出之前识别错误的地方，给出正确结果

# 输出格式
请严格按照JSON格式返回：
{
  "pars": [5,4,3,4,4,3,4,5,4,4,4,5,4,3,5,4,3,4],
  "reason": "说明哪里识别错了，你是如何修正的"
}`;

  return callHunyuanAI(prompt, imageBase64, 60000);
}

/**
 * 修正非法PAR值（仅处理明显错误，不改变分布）
 */
function fixInvalidPars(holes) {
  if (!holes || holes.length === 0) return holes;

  return holes.map(h => {
    let par = h.par;
    // 只修正超出范围的PAR值（2或6），改成最常见的4
    if (par < 3 || par > 5) {
      console.log(`[修正] 洞${h.hole} PAR ${par} -> 4 (超出范围)`);
      par = 4;
    }
    return { hole: h.hole, par };
  });
}

exports.main = async (event, context) => {
  console.log('[OCR云函数] 收到请求');

  // 检查API Key是否已配置
  if (!hunyuanApiKey) {
    console.error('[OCR] HUNYUAN_API_KEY not configured in environment variables');
    return {
      success: false,
      error: 'HUNYUAN_API_KEY not configured. Please set environment variable in cloud function settings.'
    };
  }

  const { fileID, imageBase64 } = event;
  let base64Data = imageBase64;

  // 验证fileID格式（基本检查）- 只检查非空
  if (fileID && typeof fileID === 'string' && fileID.length > 0) {
    // 不需要太严格的正则验证，微信云存储fileID格式多样
    // 只要不是明显的空字符串就放过
  } else if (fileID) {
    return { success: false, error: 'Invalid fileID format' };
  }

  // 验证图片大小：base64不超过15MB（约相当于原图10-12MB）
  const MAX_SIZE = 15 * 1024 * 1024; // 15MB
  if (base64Data && base64Data.length > MAX_SIZE) {
    return { success: false, error: 'Image too large. Maximum size is 10MB.' };
  }

  // 如果传入的是云存储fileID，先下载图片
  if (fileID && !imageBase64) {
    try {
      console.log('[OCR] 下载图片:', fileID);
      const downloadResult = await cloud.downloadFile({ fileID: fileID });
      base64Data = downloadResult.fileContent.toString('base64');
      console.log('[OCR] 图片下载完成, 大小:', Math.round(base64Data.length / 1024), 'KB');
    } catch (err) {
      console.error('[OCR] 下载图片失败:', err);
      return { success: false, error: '下载图片失败: ' + err.message };
    }
  }

  // 直接使用混元AI多模态识别图片，不需要腾讯云OCR
  // AI直接看图片提取18洞PAR值，比OCR+规则更准确
  try {
    console.log('[OCR] 直接使用混元AI识别整张记分卡图片');
    // AI直接识别，textDetections传空数组
    const result = await parseTableStructured([], base64Data);

    console.log('[OCR] 识别结果:', JSON.stringify(result));

    return {
      success: true,
      data: result
    };

  } catch (err) {
    console.error('[OCR] 识别异常:', err);
    return { success: false, error: err.message };
  }
};
