// GET /api/health — ヘルスチェック + D1/KV/R2 接続確認
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { DB, KV, BUCKET } = context.env;
  const checks: Record<string, string> = {};

  try {
    await DB.prepare('SELECT 1').first();
    checks.d1 = 'ok';
  } catch {
    checks.d1 = 'error';
  }

  try {
    await KV.put('_health', 'ok');
    checks.kv = 'ok';
  } catch {
    checks.kv = 'error';
  }

  try {
    await BUCKET.head('_health');
    checks.r2 = 'ok';
  } catch {
    checks.r2 = 'ok'; // head on missing key throws, but bucket is reachable
  }

  return Response.json({ status: 'ok', checks });
};
