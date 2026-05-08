// 腾讯云API签名和权限配置
const crypto = require('crypto');
const https = require('https');

const SECRET_ID = 'AKIDrZTEl6C3h6GpDOL3VkkV4NRFEyShhSyE';
const SECRET_KEY = '3qOhl5FBuPflgNpUwDH5ex150hIfqpcA';

// 生成腾讯云API签名
function sign(secretKey, timestamp, service, action, payload) {
  const date = new Date(timestamp * 1000).toISOString().split('T')[0];
  const credentialScope = `${date}/${service}/tc3_request`;

  const hashedPayload = crypto.createHash('sha256').update(payload).digest('hex');
  const canonicalRequest = `POST\n/\n\ncontent-type:application/json\nhost:${service}.tencentcloudapi.com\n\ncontent-type;host\n${hashedPayload}`;

  const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

  const secretDate = crypto.createHmac('sha256', Buffer.from(`TC3${secretKey}`)).update(date).digest();
  const secretService = crypto.createHmac('sha256', secretDate).update(service).digest();
  const secretSigning = crypto.createHmac('sha256', secretService).update('tc3_request').digest();
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

  return `TC3-HMAC-SHA256 Credential=${SECRET_ID}/${credentialScope}, SignedHeaders=content-type;host, Signature=${signature}`;
}

// 调用腾讯云API
function callApi(service, action, params) {
  return new Promise((resolve, reject) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify(params);
    const authorization = sign(SECRET_KEY, timestamp, service, action, payload);

    const options = {
      hostname: `${service}.tencentcloudapi.com`,
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
        'X-TC-Timestamp': timestamp.toString(),
        'X-TC-Action': action,
        'X-TC-Version': '2019-01-16'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('=== 步骤1: 获取用户列表 ===');
  try {
    const users = await callApi('cam', 'ListUsers', {});
    console.log('用户列表:', JSON.stringify(users, null, 2));
  } catch (e) {
    console.error('获取用户列表失败:', e.message);
  }

  console.log('\n=== 步骤2: 查询混元预设策略 ===');
  try {
    const policies = await callApi('cam', 'ListPolicies', {
      Scope: 'All',
      Page: 1,
      Rp: 50
    });
    const hunyuanPolicies = policies.Response?.List?.filter(p =>
      p.PolicyName.toLowerCase().includes('hunyuan') || p.PolicyName.toLowerCase().includes('混元')
    ) || [];
    console.log('混元相关策略:', JSON.stringify(hunyuanPolicies, null, 2));
  } catch (e) {
    console.error('查询策略失败:', e.message);
  }
}

main();
