/**
 * 对话记录存储工具
 * 提供安全的 localStorage 操作，包含错误处理和元数据管理
 */

const STORAGE_KEYS = {
  GLOBAL_CHAT: 'global_chat_history',
  SOLUTION_CHAT_PREFIX: 'solution_chat_',
  GLOBAL_SESSION: 'global_chat_session_id',
  SOLUTION_SESSION_PREFIX: 'solution_chat_session_',
  METADATA: 'chat_metadata'
};

function buildSessionStorageKey(type: 'global' | 'solution', solutionId?: string): string {
  return type === 'global'
    ? STORAGE_KEYS.GLOBAL_SESSION
    : `${STORAGE_KEYS.SOLUTION_SESSION_PREFIX}${solutionId}`;
}

function createSessionId(type: 'global' | 'solution', solutionId?: string): string {
  const scope = type === 'global' ? 'global' : `solution-${solutionId || 'unknown'}`;

  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${scope}-${crypto.randomUUID()}`;
  }

  return `${scope}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 估算 JSON 数据的字节大小（UTF-8）
 */
function estimateSize(data: any): number {
  return new Blob([JSON.stringify(data)]).size;
}

/**
 * 安全读取 localStorage，带错误处理
 */
export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.error('[Storage] Failed to read:', e);
    return null;
  }
}

/**
 * 安全写入 localStorage，带错误处理
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.error('[Storage] Quota exceeded for key:', key);
    } else {
      console.error('[Storage] Failed to write:', e);
    }
    return false;
  }
}

/**
 * 安全删除 localStorage 条目
 */
export function safeRemoveItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.error('[Storage] Failed to remove:', e);
    return false;
  }
}

/**
 * 获取对话记录
 */
export function getChatHistory(type: 'global' | 'solution', solutionId?: string): any[] {
  const key = type === 'global'
    ? STORAGE_KEYS.GLOBAL_CHAT
    : `${STORAGE_KEYS.SOLUTION_CHAT_PREFIX}${solutionId}`;

  const data = safeGetItem(key);
  if (!data) return [];

  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('[Storage] Failed to parse chat history:', e);
    return [];
  }
}

export function getOrCreateChatSessionId(
  type: 'global' | 'solution',
  solutionId?: string
): string {
  const storageKey = buildSessionStorageKey(type, solutionId);
  const existingSessionId = safeGetItem(storageKey)?.trim();

  if (existingSessionId) {
    return existingSessionId;
  }

  const sessionId = createSessionId(type, solutionId);
  safeSetItem(storageKey, sessionId);
  return sessionId;
}

export function resetChatSessionId(
  type: 'global' | 'solution',
  solutionId?: string
): string {
  const storageKey = buildSessionStorageKey(type, solutionId);
  const sessionId = createSessionId(type, solutionId);
  safeSetItem(storageKey, sessionId);
  return sessionId;
}

/**
 * 保存对话记录（带元数据更新）
 */
export function saveChatHistory(
  type: 'global' | 'solution',
  messages: any[],
  solutionId?: string,
  solutionTitle?: string
): boolean {
  const key = type === 'global'
    ? STORAGE_KEYS.GLOBAL_CHAT
    : `${STORAGE_KEYS.SOLUTION_CHAT_PREFIX}${solutionId}`;

  const success = safeSetItem(key, JSON.stringify(messages));

  if (success) {
    // 更新元数据
    updateMetadata(type, messages, solutionId, solutionTitle);
  }

  return success;
}

/**
 * 清空对话记录
 */
export function clearChatHistory(type: 'global' | 'solution', solutionId?: string): boolean {
  const key = type === 'global'
    ? STORAGE_KEYS.GLOBAL_CHAT
    : `${STORAGE_KEYS.SOLUTION_CHAT_PREFIX}${solutionId}`;

  const success = safeRemoveItem(key);

  if (success) {
    // 更新元数据
    updateMetadata(type, [], solutionId);
  }

  return success;
}

/**
 * 删除方案对话记录（供后端删除方案时调用）
 */
export function removeSolutionChat(solutionId: string): boolean {
  const key = `${STORAGE_KEYS.SOLUTION_CHAT_PREFIX}${solutionId}`;
  const sessionKey = buildSessionStorageKey('solution', solutionId);
  const success = safeRemoveItem(key) && safeRemoveItem(sessionKey);

  if (success) {
    // 更新元数据
    const metadataStr = safeGetItem(STORAGE_KEYS.METADATA);
    if (metadataStr) {
      try {
        const metadata = JSON.parse(metadataStr);
        if (metadata.solutionChats?.[solutionId]) {
          delete metadata.solutionChats[solutionId];
          safeSetItem(STORAGE_KEYS.METADATA, JSON.stringify(metadata));
        }
      } catch (e) {
        console.error('[Storage] Failed to update metadata:', e);
      }
    }
  }

  return success;
}

/**
 * 更新元数据
 */
function updateMetadata(
  type: 'global' | 'solution',
  messages: any[],
  solutionId?: string,
  solutionTitle?: string
) {
  const metadataStr = safeGetItem(STORAGE_KEYS.METADATA);
  let metadata = metadataStr ? JSON.parse(metadataStr) : {};

  const size = estimateSize(messages);
  const now = Date.now();

  if (type === 'global') {
    metadata.globalChat = {
      lastUpdated: now,
      messageCount: messages.length,
      size
    };
  } else if (solutionId) {
    if (!metadata.solutionChats) metadata.solutionChats = {};

    if (messages.length === 0) {
      // 删除元数据（对话已清空）
      delete metadata.solutionChats[solutionId];
    } else {
      metadata.solutionChats[solutionId] = {
        lastUpdated: now,
        messageCount: messages.length,
        size,
        solutionTitle: solutionTitle || ''
      };
    }
  }

  safeSetItem(STORAGE_KEYS.METADATA, JSON.stringify(metadata));
}
