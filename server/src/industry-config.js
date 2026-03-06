/**
 * 行业配置
 * 用于 PPT 内容生成和插图定制的行业特定参数
 */

export const INDUSTRY_TERMS = {
  '金融': {
    keywords: ['合规', '风控', '风控合规', '催收', '营销', '客户画像', 'CAPS值', 'SLA', '接通率', '转化率'],
    style: '专业严谨，数据驱动，强调合规安全',
    visualElements: ['金融图标', '数据看板', '安全盾牌', '握手图标', '上升趋势图', '饼图'],
    colorTones: '蓝色系，专业可信',
    accentColors: ['#1E90FF', '#4169E1', '#0066CC'],
    painPoints: ['合规成本高', '人工效率低', '数据安全风险', '客户体验差'],
    metrics: ['接通率', '转化率', 'CAPS值', 'SLA', '成本节约', '效率提升']
  },
  '医疗': {
    keywords: ['HIS系统', '分诊', '急诊', '预诊', 'HIPAA', 'GDPR', '医疗专网', '电子病历', '医生工作站', '护士工作站'],
    style: '温馨关怀，专业可信，强调患者体验',
    visualElements: ['医疗十字', '心电监护', '医院建筑', '医生护士', '听诊器', '救护车'],
    colorTones: '蓝绿白色系，生命关怀',
    accentColors: ['#1E90FF', '#32CD32', '#87CEFA'],
    painPoints: ['高峰期接通率低', '急诊分诊效率低', '医护资源不足', '患者体验差'],
    metrics: ['接通率', '分诊准确率', '响应时间', '患者满意度', '效率提升']
  },
  '医院': {
    keywords: ['HIS系统', '分诊', '急诊', '预诊', 'HIPAA', 'GDPR', '医疗专网', '电子病历', '医生工作站', '护士工作站', '智能总机', '门诊', '住院'],
    style: '温馨关怀，专业可信，强调患者体验',
    visualElements: ['医疗十字', '心电监护', '医院建筑', '医生护士', '听诊器', '救护车', '医院总机'],
    colorTones: '蓝绿白色系，生命关怀',
    accentColors: ['#1E90FF', '#32CD32', '#87CEFA'],
    painPoints: ['高峰期接通率低', '急诊分诊效率低', '医护资源不足', '患者体验差', '重复咨询多'],
    metrics: ['接通率', '分诊准确率', '响应时间', '患者满意度', '效率提升', 'AI处理率']
  },
  '政务': {
    keywords: ['政务', '公共服务', '便民', '一网通办', '数据共享', '政务服务', '审批', '办事'],
    style: '庄重正式，服务导向，强调便民高效',
    visualElements: ['政府徽章', '政务大厅', '市民图标', '数据流程', '公章', '红旗'],
    colorTones: '红色系，庄重正式',
    accentColors: ['#DC143C', '#B22222', '#FF6347'],
    painPoints: ['办事效率低', '排队时间长', '信息不透明', '服务体验差'],
    metrics: ['办理时限', '服务满意度', '一次办结率', '线上办理率']
  },
  '教育': {
    keywords: ['教学', '校园', '在线教育', '智慧校园', '师生互动', '教务管理', '课件', '直播教学'],
    style: '活力向上，知识导向，强调教学体验',
    visualElements: ['书本', '校园建筑', '师生图标', '知识图谱', '黑板', ' graduation帽'],
    colorTones: '橙黄蓝色系，活力向上',
    accentColors: ['#FF8C00', '#FFD700', '#4169E1'],
    painPoints: ['教学资源不足', '师生沟通不畅', '管理效率低', '家长反馈不及时'],
    metrics: ['教学满意度', '学习效果', '互动频率', '资源利用率']
  },
  '通信': {
    keywords: ['中继', '专线', '呼叫中心', '语音', 'VOIP', 'SIP', '运营商', '网络通信', '接通率', '丢包率'],
    style: '技术专业，稳定可靠，强调通信质量',
    visualElements: ['电话图标', '信号塔', '网络拓扑', '服务器', '通信线路', '信号波形'],
    colorTones: '蓝色系，科技专业',
    accentColors: ['#1E90FF', '#00CED1', '#4682B4'],
    painPoints: ['通信质量不稳定', '成本高', '维护复杂', '扩容困难'],
    metrics: ['接通率', '通话质量', '网络稳定性', '成本节约', '容量扩展']
  },
  '保险': {
    keywords: ['核保', '理赔', '保单', '客户服务', '保险代理人', '续保', '车险', '寿险', '健康险'],
    style: '稳重可靠，服务导向，强调客户保障',
    visualElements: ['保护伞', '握手', '合同', ' Shield', '家庭', '医疗图标'],
    colorTones: '深蓝色系，稳重可靠',
    accentColors: ['#191970', '#4169E1', '#0066CC'],
    painPoints: ['核保效率低', '理赔周期长', '客户服务差', '风险控制难'],
    metrics: ['核保时效', '理赔时效', '客户满意度', '风险控制率', '续保率']
  },
  '银行': {
    keywords: ['风控', '合规', '催收', '营销', '客户画像', '信用卡', '贷款', '存款', '理财', '柜面服务'],
    style: '专业严谨，安全可信，强调合规风控',
    visualElements: ['银行建筑', 'ATM', '银行卡', '金币', '安全盾牌', '握手图标'],
    colorTones: '深蓝色系，专业安全',
    accentColors: ['#191970', '#4169E1', '#0066CC'],
    painPoints: ['合规成本高', '风控压力大', '人工效率低', '客户体验待提升'],
    metrics: ['业务办理时效', '客户满意度', '风险控制率', '成本节约', '效率提升']
  },
  '电商': {
    keywords: ['订单', '库存', '物流', '客服', '营销', '转化率', '复购率', 'GMV', '用户增长', '私域流量'],
    style: '活力时尚，数据驱动，强调用户体验',
    visualElements: ['购物车', '包裹', '手机购物', '支付图标', '上升趋势', '用户图标'],
    colorTones: '橙红黄色系，活力时尚',
    accentColors: ['#FF6B35', '#FFD700', '#FF4500'],
    painPoints: ['获客成本高', '复购率低', '库存管理难', '客服压力大'],
    metrics: ['GMV', '转化率', '复购率', '客单价', '获客成本', '用户满意度']
  },
  '制造': {
    keywords: ['生产线', '供应链', '智能制造', 'MES', 'ERP', '质检', '设备维护', '产能', '良率'],
    style: '稳健专业，技术导向，强调效率质量',
    visualElements: ['工厂', '生产线', '机器人', '齿轮', '质量检测', '数据分析'],
    colorTones: '灰色蓝色系，工业专业',
    accentColors: ['#708090', '#4682B4', '#2F4F4F'],
    painPoints: ['产能不足', '质量不稳定', '库存积压', '设备故障频繁'],
    metrics: ['产能利用率', '良品率', '设备稼动率', '库存周转率', '生产成本']
  },
  '零售': {
    keywords: ['门店', '库存', '会员', '促销', 'POS', '供应链', '陈列', '客流', '客单价', '坪效'],
    style: '时尚活力，服务导向，强调销售体验',
    visualElements: ['门店', '购物袋', '商品陈列', '会员卡', '收银台', '顾客'],
    colorTones: '多彩色系，时尚活力',
    accentColors: ['#FF6B6B', '#4ECDC4', '#45B7D1'],
    painPoints: ['客流下降', '库存积压', '坪效低', '会员活跃度低'],
    metrics: ['销售额', '客单价', '坪效', '会员活跃度', '库存周转率']
  },
  '通用': {
    keywords: ['智能化', '自动化', '降本增效', '数字化转型', '效率提升', '客户体验', '数据驱动'],
    style: '专业商务，简洁现代，强调价值创造',
    visualElements: ['商务图标', '数据图表', '上升趋势', '握手', '团队协作', '目标达成'],
    colorTones: '蓝色系，专业商务',
    accentColors: ['#1E90FF', '#4169E1', '#0066CC'],
    painPoints: ['效率低下', '成本高昂', '体验不佳', '管理困难'],
    metrics: ['效率提升', '成本节约', '满意度提升', '投资回报率']
  }
};

/**
 * 获取行业配置
 * @param {string} industry - 行业名称
 * @returns {Object} 行业配置对象
 */
export function getIndustryConfig(industry) {
  if (!industry) {
    return INDUSTRY_TERMS['通用'];
  }

  // 精确匹配
  if (INDUSTRY_TERMS[industry]) {
    return INDUSTRY_TERMS[industry];
  }

  // 模糊匹配（行业名称包含关键词）
  for (const [key, config] of Object.entries(INDUSTRY_TERMS)) {
    if (key !== '通用' && industry.includes(key)) {
      return config;
    }
  }

  // 特殊映射
  const mappings = {
    '证券': '金融',
    '基金': '金融',
    '投资': '金融',
    '诊所': '医院',
    '卫生院': '医院',
    '医疗机构': '医院',
    '社保': '政务',
    '公安': '政务',
    '税务': '政务',
    '学校': '教育',
    '培训机构': '教育',
    '大学': '教育',
    '运营商': '通信',
    '联通': '通信',
    '移动': '通信',
    '电信': '通信'
  };

  for (const [key, value] of Object.entries(mappings)) {
    if (industry.includes(key)) {
      return INDUSTRY_TERMS[value];
    }
  }

  // 默认返回通用配置
  return INDUSTRY_TERMS['通用'];
}

/**
 * 获取行业特定的专业术语
 * @param {string} industry - 行业名称
 * @returns {Array} 专业术语列表
 */
export function getIndustryKeywords(industry) {
  return getIndustryConfig(industry).keywords;
}

/**
 * 获取行业特定的风格描述
 * @param {string} industry - 行业名称
 * @returns {string} 风格描述
 */
export function getIndustryStyle(industry) {
  return getIndustryConfig(industry).style;
}

/**
 * 获取行业特定的视觉元素
 * @param {string} industry - 行业名称
 * @returns {Array} 视觉元素列表
 */
export function getIndustryVisualElements(industry) {
  return getIndustryConfig(industry).visualElements;
}

/**
 * 获取行业特定的配色描述
 * @param {string} industry - 行业名称
 * @returns {string} 配色描述
 */
export function getIndustryColorTones(industry) {
  return getIndustryConfig(industry).colorTones;
}

/**
 * 获取行业特定的痛点
 * @param {string} industry - 行业名称
 * @returns {Array} 痛点列表
 */
export function getIndustryPainPoints(industry) {
  return getIndustryConfig(industry).painPoints;
}

/**
 * 获取行业特定的关键指标
 * @param {string} industry - 行业名称
 * @returns {Array} 指标列表
 */
export function getIndustryMetrics(industry) {
  return getIndustryConfig(industry).metrics;
}
