import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const API_KEY = 'fastgpt-yu7a6QMPwIYjASlliOQ7J1SyG6LnkqsC2emIbeNUSkislIUm8omlRMEtIqxedq';

const baseUrls = [
  'http://localhost:3000',
  'http://localhost:3000/api',
  'http://localhost:3000/api/v1'
];

const paths = [
  '/common/file/upload',
  '/v1/common/file/upload',
  '/core/dataset/file/upload',
  '/v1/chat/completions',
  '/chat/completions'
];

async function probe() {
  console.log('Deep Probing...');
  
  if (!fs.existsSync('test.txt')) fs.writeFileSync('test.txt', 'test content');

  for (const base of baseUrls) {
    for (const p of paths) {
      // Avoid double slashes
      const url = `${base.replace(/\/$/, '')}/${p.replace(/^\//, '')}`;
      console.log(`Testing ${url}...`);
      
      try {
        if (p.includes('upload')) {
           const form = new FormData();
           form.append('file', fs.createReadStream('test.txt'));
           form.append('data', JSON.stringify({ bucketName: 'dataset' }));
           await axios.post(url, form, {
             headers: { ...form.getHeaders(), 'Authorization': `Bearer ${API_KEY}` }
           });
        } else {
           // Chat probe
           await axios.post(url, {
             messages: [{ role: 'user', content: 'hi' }]
           }, {
             headers: { 'Authorization': `Bearer ${API_KEY}` }
           });
        }
        console.log(`✅✅✅ FOUND! Success: ${url}`);
        return; // Stop on first success
      } catch (error) {
        const status = error.response ? error.response.status : error.message;
        console.log(`❌ ${status}`);
        // If 400 or 401, it means the endpoint EXISTS but parameters are wrong.
        // If 404, it doesn't exist.
        if (status === 400 || status === 401 || status === 422) {
           console.log(`⚠️ Endpoint likely exists but rejected request: ${url} (${status})`);
           console.log('Response:', JSON.stringify(error.response.data));
        }
      }
    }
  }
}

probe();
