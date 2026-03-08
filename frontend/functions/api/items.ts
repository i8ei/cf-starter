// D1 CRUD サンプル: /api/items

// GET — 一覧取得
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { results } = await context.env.DB.prepare(
    'SELECT * FROM items ORDER BY created_at DESC'
  ).all();
  return Response.json(results);
};

// POST — 新規作成
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { name } = await context.request.json<{ name: string }>();
  if (!name?.trim()) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }
  const result = await context.env.DB.prepare(
    'INSERT INTO items (name) VALUES (?) RETURNING *'
  ).bind(name.trim()).first();
  return Response.json(result, { status: 201 });
};
