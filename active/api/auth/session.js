/**
 * POSTING MAP Authentication Session Cache Module
 * Phase 2-H-4-C: 認証最適化 (Auth Session Cache)
 */

/**
 * Tokenを安全なキャッシュキーに変換する
 * @param {string} token 
 * @return {string} キャッシュキー
 */
function getAuthSessionKey(token) {
  if (!token) return null;
  // Utilities.computeDigest を用いて SHA-256 ハッシュ化
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token, Utilities.Charset.UTF_8);
  // hex文字列に変換
  let hexString = '';
  for (let i = 0; i < digest.length; i++) {
    let byte = digest[i];
    if (byte < 0) byte += 256;
    let hex = byte.toString(16);
    if (hex.length === 1) hex = '0' + hex;
    hexString += hex;
  }
  return 'AUTH_SESSION_' + hexString;
}

/**
 * キャッシュからユーザー情報を取得する
 * @param {string} token 
 * @return {Object|null} ユーザー情報（見つからない場合はnull）
 */
function getSession(token) {
  const key = getAuthSessionKey(token);
  if (!key) return null;

  const cache = CacheService.getScriptCache();
  const cachedData = cache.get(key);

  if (cachedData) {
    try {
      const session = JSON.parse(cachedData);
      return session;
    } catch (e) {
      console.warn("Session cache parse error: " + e.toString());
      return null;
    }
  }
  return null;
}

/**
 * ユーザー情報をキャッシュに保存する (1800秒 = 30分)
 * トークン本体は保存しない
 * @param {string} token 
 * @param {Object} user { lineUserId, displayName, pictureUrl }
 */
function saveSession(token, user) {
  const key = getAuthSessionKey(token);
  if (!key) return;

  const sessionData = {
    lineUserId: user.lineUserId,
    displayName: user.displayName,
    pictureUrl: user.pictureUrl,
    createdAt: Date.now()
  };

  const cache = CacheService.getScriptCache();
  // 第三引数は有効期限(秒)
  cache.put(key, JSON.stringify(sessionData), 1800);
}
