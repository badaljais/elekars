import bcrypt from "bcryptjs";

const USER_MODEL = "plugin::users-permissions.user";
const BCRYPT_ROUNDS = 10;

export function isBcryptHash(value: unknown): boolean {
  return typeof value === "string" && /^\$2[aby]\$\d+\$/.test(value);
}

export async function findAppUserByIdOrDocumentId(
  strapi: any,
  userIdParam: string
) {
  const numericId = Number(userIdParam);
  if (!Number.isNaN(numericId) && Number.isInteger(numericId)) {
    const byId = await strapi.db.query(USER_MODEL).findOne({
      where: { id: numericId },
      populate: ["role"],
    });
    if (byId) return byId;
  }

  return strapi.db.query(USER_MODEL).findOne({
    where: { documentId: userIdParam },
    populate: ["role"],
  });
}

/** Hash once and persist — avoids double-hashing via user.edit + lifecycle hooks. */
export async function setAppUserPassword(
  strapi: any,
  userId: number,
  plainPassword: string
) {
  const hashed = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);

  await strapi.db.query(USER_MODEL).update({
    where: { id: userId },
    data: {
      password: hashed,
      provider: "local",
      confirmed: true,
      blocked: false,
    },
  });

  const user = await strapi.db.query(USER_MODEL).findOne({
    where: { id: userId },
  });

  const valid = await strapi
    .plugin("users-permissions")
    .service("user")
    .validatePassword(plainPassword, user.password);

  if (!valid) {
    throw new Error("Password reset failed — stored hash does not match");
  }

  return user;
}
