type ProductLike = {
  productName?: string;
  productLine?: string;
  datasetId?: string;
  fileName?: string;
  title?: string;
};

const PRODUCT_LABELS = new Map<string, string>([
  ['CLIENT', '视联百川客户端'],
  ['HOME_AI', '天翼看家 AI 产品'],
  ['ICT', '政企版 AI 产品'],
  ['baichuan', '视联百川客户端'],
  ['ebo', 'EBO-SE 移动机器人'],
  ['device-shop', '商城设备类产品'],
  ['home-ai', '天翼看家 AI 产品'],
  ['b2b-ict', '政企版 AI 产品'],
  ['tysl-local-kb-baichuan', '视联百川客户端'],
  ['tysl-local-kb-ebo', 'EBO-SE 移动机器人'],
  ['tysl-local-kb-device-shop', '商城设备类产品'],
  ['tysl-local-kb-home-ai', '天翼看家 AI 产品'],
  ['tysl-local-kb-b2b-ict', '政企版 AI 产品'],
]);

const HOME_AI_HINTS = [
  '天翼看家',
  'AI守护',
  'AI时光缩影',
  '区域入侵',
  '家人识别',
  '智能迎客',
  '画面异常巡检',
  '陌生人识别',
  '客流统计',
  '徘徊检测',
  '离岗检测',
  '车形检测',
  '车牌识别',
  '火情识别',
  '玩手机识别',
  '电动车识别',
  '智能搜索',
  '智能筛选',
  '吸烟识别',
  'AI智能巡检',
];

const DEVICE_SHOP_HINTS = [
  '商城',
  '摄像机',
  '云台摄像机',
  '网络摄像头',
  'xk001',
  'H681',
  'H680',
  'H683',
];

function normalizeKey(value?: string) {
  return String(value || '').trim();
}

function inferFromText(text: string) {
  if (!text) {
    return '';
  }

  if (/视联百川/i.test(text)) {
    return '视联百川客户端';
  }

  if (/EBO-SE|移动机器人|赋之科技移动机器人/i.test(text)) {
    return 'EBO-SE 移动机器人';
  }

  if (HOME_AI_HINTS.some((item) => text.includes(item))) {
    return '天翼看家 AI 产品';
  }

  if (/翼智企|政企版|ICT/i.test(text)) {
    return '政企版 AI 产品';
  }

  if (DEVICE_SHOP_HINTS.some((item) => text.includes(item))) {
    return '商城设备类产品';
  }

  return '';
}

export function getProductDisplayName(value?: string) {
  const key = normalizeKey(value);
  if (!key) {
    return '';
  }
  return PRODUCT_LABELS.get(key) || PRODUCT_LABELS.get(key.toUpperCase()) || '';
}

export function getSolutionProductDisplayName(solution: ProductLike) {
  const explicitName = normalizeKey(solution.productName);
  if (explicitName) {
    return explicitName;
  }

  const mappedProductLine = getProductDisplayName(solution.productLine);
  if (mappedProductLine) {
    return mappedProductLine;
  }

  const mappedDataset = getProductDisplayName(solution.datasetId);
  if (mappedDataset) {
    return mappedDataset;
  }

  const inferred = inferFromText(
    [solution.title, solution.fileName].filter(Boolean).join('\n'),
  );

  return inferred;
}
