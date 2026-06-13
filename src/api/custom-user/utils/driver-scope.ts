const DRIVER_MODEL = "api::driver.driver";

export async function getDriverForAuthUser(strapi: any, userId: number) {
  return strapi.db.query(DRIVER_MODEL).findOne({
    where: { user: { id: userId } },
  });
}

export async function requireDriverProfile(strapi: any, ctx: any, user: any) {
  if (user.role?.type !== "driver") {
    ctx.forbidden("Driver access required");
    return null;
  }

  const driver = await getDriverForAuthUser(strapi, user.id);
  if (!driver) {
    ctx.notFound("No driver profile linked to this account");
    return null;
  }

  return driver;
}

export async function sanitizeContent(
  strapi: any,
  uid: string,
  data: unknown
) {
  const schema = strapi.getModel(uid);
  return strapi.contentAPI.sanitize.output(data, schema);
}

export function parsePageSize(query: Record<string, unknown>, fallback = 100) {
  const raw = query["pagination[pageSize]"] ?? query.pageSize ?? fallback;
  const size = Number(raw);
  return Number.isFinite(size) && size > 0 ? Math.min(size, 1000) : fallback;
}
