// R2 サンプル: /api/upload

// POST — ファイルアップロード
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const formData = await context.request.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return Response.json({ error: 'file is required' }, { status: 400 });
  }

  const key = `uploads/${Date.now()}_${file.name}`;
  await context.env.BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  return Response.json({ key, size: file.size }, { status: 201 });
};

// GET — ファイル一覧
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const list = await context.env.BUCKET.list({ prefix: 'uploads/' });
  const files = list.objects.map((o) => ({
    key: o.key,
    size: o.size,
    uploaded: o.uploaded,
  }));
  return Response.json(files);
};
