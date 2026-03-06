import axios from 'axios';

const API_KEY = 'fastgpt-yu7a6QMPwIYjASlliOQ7J1SyG6LnkqsC2emIbeNUSkislIUm8omlRMEtIqxedq';
const BASE_URL = 'http://localhost:3000/api';

async function probe() {
  const url = `${BASE_URL}/core/dataset/collection/create/localFile`;
  console.log(`Testing ${url}...`);
  try {
    await axios.post(url, {}, {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    console.log('✅ Success (or at least reachable)');
  } catch (error) {
    console.log(`Result: ${error.response ? error.response.status : error.message}`);
    if (error.response) console.log(JSON.stringify(error.response.data));
  }
}

probe();
