export function getExampleKvScopedKey(organizationId: number, key: string) {
  return `orgs/${organizationId}/kv/${key}`;
}

export function getExampleUploadPrefix(organizationId: number) {
  return `uploads/org_${organizationId}/`;
}

export function getExampleUploadObjectKey(
  organizationId: number,
  fileName: string,
  timestamp = Date.now()
) {
  return `${getExampleUploadPrefix(organizationId)}${timestamp}_${fileName}`;
}

