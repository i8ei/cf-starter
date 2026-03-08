// KV サンプル: /api/kv/:key

// GET — 値を取得
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const key = (context.params.key as string[]).join('/');
  const value = await context.env.KV.get(key);
  if (value === null) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  return Response.json({ key, value });
};

// PUT — 値をセット
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const key = (context.params.key as string[]).join('/');
  const { value } = await context.request.json<{ value: string }>();
  await context.env.KV.put(key, value);
  return Response.json({ key, value });
};
