import {
  findAppUserByIdOrDocumentId,
  setAppUserPassword,
} from "../utils/app-user-password";
import {
  getDriverForAuthUser,
  parsePageSize,
  requireDriverProfile,
  sanitizeContent,
} from "../utils/driver-scope";

const USER_MODEL = "plugin::users-permissions.user";
const TRIP_UID = "api::trip.trip";
const INCENTIVE_UID = "api::incentive.incentive";
const SALARY_UID = "api::salary-slip.salary-slip";
const EXPENSE_UID = "api::expense.expense";

async function getAuthUser(strapi: any, ctx: any) {
  const authHeader = ctx.request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    ctx.unauthorized("No authorization header was found");
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const payload = await strapi
      .plugin("users-permissions")
      .service("jwt")
      .verify(token);

    return await strapi.db.query(USER_MODEL).findOne({
      where: { id: payload.id },
      populate: ["role"],
    });
  } catch {
    ctx.unauthorized("Invalid token");
    return null;
  }
}

async function requireAdmin(strapi: any, ctx: any) {
  const user = await getAuthUser(strapi, ctx);
  if (!user) return null;

  if (user.role?.type !== "admin") {
    ctx.forbidden("Admin access required");
    return null;
  }

  return user;
}

async function getRoleByType(strapi: any, type: string) {
  return strapi.db.query("plugin::users-permissions.role").findOne({
    where: { type },
  });
}

export default {
  async me(ctx) {
    const user = await getAuthUser(strapi, ctx);
    if (!user) return;

    ctx.body = {
      id: user.id,
      documentId: user.documentId,
      username: user.username,
      email: user.email,
      role: {
        id: user.role?.id,
        name: user.role?.name,
        type: user.role?.type,
      },
    };
  },

  async myDriver(ctx) {
    const user = await getAuthUser(strapi, ctx);
    if (!user) return;

    const driver = await getDriverForAuthUser(strapi, user.id);

    if (!driver) {
      return ctx.notFound("No driver profile linked to this account");
    }

    ctx.body = {
      data: {
        id: driver.id,
        documentId: driver.documentId,
        name: driver.name,
        phone: driver.phone,
        license_number: driver.license_number,
        address: driver.address,
        status: driver.status,
      },
    };
  },

  async myTrips(ctx) {
    const user = await getAuthUser(strapi, ctx);
    if (!user) return;

    const driver = await requireDriverProfile(strapi, ctx, user);
    if (!driver) return;

    const pageSize = parsePageSize(ctx.query as Record<string, unknown>);
    const trips = await strapi.documents(TRIP_UID).findMany({
      filters: { driver: { documentId: { $eq: driver.documentId } } },
      populate: {
        customer: true,
        vehicle: true,
        driver: true,
      },
      limit: pageSize,
    });

    ctx.body = {
      data: await sanitizeContent(strapi, TRIP_UID, trips),
    };
  },

  async myIncentives(ctx) {
    const user = await getAuthUser(strapi, ctx);
    if (!user) return;

    const driver = await requireDriverProfile(strapi, ctx, user);
    if (!driver) return;

    const pageSize = parsePageSize(ctx.query as Record<string, unknown>);
    const rows = await strapi.documents(INCENTIVE_UID).findMany({
      filters: { driver: { documentId: { $eq: driver.documentId } } },
      populate: { driver: true, trip: true },
      limit: pageSize,
    });

    ctx.body = {
      data: await sanitizeContent(strapi, INCENTIVE_UID, rows),
    };
  },

  async mySalarySlips(ctx) {
    const user = await getAuthUser(strapi, ctx);
    if (!user) return;

    const driver = await requireDriverProfile(strapi, ctx, user);
    if (!driver) return;

    const pageSize = parsePageSize(ctx.query as Record<string, unknown>);
    const rows = await strapi.documents(SALARY_UID).findMany({
      filters: { driver: { documentId: { $eq: driver.documentId } } },
      populate: { driver: true },
      limit: pageSize,
    });

    ctx.body = {
      data: await sanitizeContent(strapi, SALARY_UID, rows),
    };
  },

  async myExpenses(ctx) {
    const user = await getAuthUser(strapi, ctx);
    if (!user) return;

    const driver = await requireDriverProfile(strapi, ctx, user);
    if (!driver) return;

    const pageSize = parsePageSize(ctx.query as Record<string, unknown>);
    const rows = await strapi.documents(EXPENSE_UID).findMany({
      filters: { uploaded_by: { documentId: { $eq: driver.documentId } } },
      populate: { trip: true, vehicle: true, uploaded_by: true },
      limit: pageSize,
    });

    ctx.body = {
      data: await sanitizeContent(strapi, EXPENSE_UID, rows),
    };
  },

  async listAppUsers(ctx) {
    if (!(await requireAdmin(strapi, ctx))) return;

    const roleType = String(ctx.query.role || "manager");
    const role = await getRoleByType(strapi, roleType);

    if (!role) {
      return ctx.badRequest(`Role "${roleType}" not found`);
    }

    const users = await strapi.db.query(USER_MODEL).findMany({
      where: { role: { id: role.id } },
      orderBy: { createdAt: "desc" },
    });

    ctx.body = {
      data: users.map((u: any) => ({
        id: u.id,
        documentId: u.documentId,
        username: u.username,
        email: u.email,
        confirmed: u.confirmed,
        blocked: u.blocked,
      })),
    };
  },

  async createManagerAccount(ctx) {
    if (!(await requireAdmin(strapi, ctx))) return;

    const { username, email, password } = ctx.request.body || {};

    if (!username?.trim() || !email?.trim() || !password?.trim()) {
      return ctx.badRequest("Username, email, and password are required");
    }

    const managerRole = await getRoleByType(strapi, "manager");
    if (!managerRole) {
      return ctx.badRequest("Manager role not found");
    }

    const existing = await strapi.db.query(USER_MODEL).findOne({
      where: {
        $or: [
          { email: email.toLowerCase().trim() },
          { username: username.trim() },
        ],
      },
    });

    if (existing) {
      return ctx.badRequest("Username or email already in use");
    }

    const user = await strapi.plugin("users-permissions").service("user").add({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password,
      confirmed: true,
      blocked: false,
      provider: "local",
      role: managerRole.id,
    });

    ctx.body = {
      data: {
        id: user.id,
        documentId: user.documentId,
        username: user.username,
        email: user.email,
      },
    };
  },

  async createDriverAccount(ctx) {
    if (!(await requireAdmin(strapi, ctx))) return;

    const {
      name,
      phone,
      license_number,
      address,
      status,
      username,
      email,
      password,
    } = ctx.request.body || {};

    if (
      !name?.trim() ||
      !phone?.trim() ||
      !license_number?.trim() ||
      !username?.trim() ||
      !email?.trim() ||
      !password?.trim()
    ) {
      return ctx.badRequest(
        "Name, phone, license, username, email, and password are required"
      );
    }

    const driverRole = await getRoleByType(strapi, "driver");
    if (!driverRole) {
      return ctx.badRequest("Driver role not found");
    }

    const existingUser = await strapi.db.query(USER_MODEL).findOne({
      where: {
        $or: [
          { email: email.toLowerCase().trim() },
          { username: username.trim() },
        ],
      },
    });

    if (existingUser) {
      return ctx.badRequest("Username or email already in use");
    }

    const existingLicense = await strapi.db.query("api::driver.driver").findOne({
      where: { license_number: license_number.trim() },
    });

    if (existingLicense) {
      return ctx.badRequest("License number already exists");
    }

    const user = await strapi.plugin("users-permissions").service("user").add({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password,
      confirmed: true,
      blocked: false,
      provider: "local",
      role: driverRole.id,
    });

    const driver = await strapi.db.query("api::driver.driver").create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        license_number: license_number.trim(),
        address: address?.trim() || null,
        status: status || "active",
        user: user.id,
      },
      populate: ["user"],
    });

    ctx.body = {
      data: {
        driver,
        login: {
          username: user.username,
          email: user.email,
        },
      },
    };
  },

  async resetAppUserPassword(ctx) {
    if (!(await requireAdmin(strapi, ctx))) return;

    const { userId } = ctx.params;
    const plainPassword = String(ctx.request.body?.password || "").trim();

    if (!plainPassword) {
      return ctx.badRequest("Password is required");
    }

    if (plainPassword.length < 6) {
      return ctx.badRequest("Password must be at least 6 characters");
    }

    const target = await findAppUserByIdOrDocumentId(strapi, String(userId));

    if (!target) {
      return ctx.notFound("User not found");
    }

    if (!["driver", "manager"].includes(target.role?.type)) {
      return ctx.badRequest("Can only reset driver or manager passwords");
    }

    try {
      await setAppUserPassword(strapi, target.id, plainPassword);
    } catch (err) {
      strapi.log.error("[custom-user.resetAppUserPassword]", err);
      return ctx.internalServerError("Password reset failed. Please try again.");
    }

    ctx.body = {
      ok: true,
      login: {
        username: target.username,
        email: target.email,
      },
    };
  },
};
