import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const API_KEY = 'fastgpt-yu7a6QMPwIYjASlliOQ7J1SyG6LnkqsC2emIbeNUSkislIUm8omlRMEtIqxedq';
const BASE_URL = 'http://localhost:3000/api';

async function probe() {
  const endpoints = [
    '/upload',
    '/file/upload',
    '/common/upload',
    '/core/file/upload',
    '/core/dataset/upload'
  ];

  if (!fs.existsSync('test.txt')) fs.writeFileSync('test.txt', 'test content');

  for (const ep of endpoints) {
    const url = `${BASE_URL}${ep}`;
    console.log(`Testing ${url}...`);
    try {
      const form = new FormData();
      form.append('file', fs.createReadStream('test.txt'));
      form.append('data', JSON.stringify({ bucketName: 'dataset' }));
      
      await axios.post(url, form, {
        headers: { ...form.getHeaders(), 'Authorization': `Bearer ${API_KEY}` }
      });
      console.log(`✅ Success: ${url}`);
    } catch (error) {
      console.log(`❌ ${error.response ? error.response.status : error.message}`);
    }
  }
}

probe();
