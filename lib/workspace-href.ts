export function buildWorkspaceHref(path: string, workspaceSlug?: string | null) {
  if (!workspaceSlug) {
    return path;
  }

  const [pathname, hashFragment = ""] = path.split("#", 2);
  const [basePath, queryString = ""] = pathname.split("?", 2);
  const params = new URLSearchParams(queryString);
  params.set("workspace", workspaceSlug);

  const query = params.toString();
  const hash = hashFragment ? `#${hashFragment}` : "";
  return query ? `${basePath}?${query}${hash}` : `${basePath}${hash}`;
}
