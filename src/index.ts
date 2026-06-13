const USER_MODEL = "plugin::users-permissions.user";

async function normalizeUserFields(
  strapi: any,
  data: Record<string, unknown>
) {
  if (!data.provider) {
    data.provider = "local";
  }

  if (data.confirmed !== true) {
    data.confirmed = true;
  }

  return data;
}

export default {
  register(/* { strapi } */) {},

  async bootstrap({ strapi }) {
    // Create custom roles if they don't exist
    const roles = await strapi
      .service("plugin::users-permissions.role")
      .find();

    const existingRoles = roles.map((r) => r.type);

    if (!existingRoles.includes("manager")) {
      await strapi.service("plugin::users-permissions.role").createRole({
        name: "Manager",
        description: "Manager role - same as admin but no revenue access",
        type: "manager",
      });
    }

    if (!existingRoles.includes("driver")) {
      await strapi.service("plugin::users-permissions.role").createRole({
        name: "Driver",
        description: "Driver role - limited access to own data",
        type: "driver",
      });
    }

    if (!existingRoles.includes("admin")) {
      await strapi.service("plugin::users-permissions.role").createRole({
        name: "Admin",
        description: "Admin role - full access including revenue",
        type: "admin",
      });
    }

    // Set permissions for Authenticated role (and custom roles)
    // This ensures all authenticated users can at least access the API
    const allRoles = await strapi
      .service("plugin::users-permissions.role")
      .find();

    const contentTypes = [
      "api::customer.customer",
      "api::driver.driver",
      "api::vehicle.vehicle",
      "api::trip.trip",
      "api::fuel-receipt.fuel-receipt",
      "api::expense.expense",
      "api::invoice.invoice",
      "api::salary-slip.salary-slip",
      "api::incentive.incentive",
    ];

    const actions = ["find", "findOne", "create", "update", "delete"];

    for (const role of allRoles) {
      // Skip public role
      if (role.type === "public") continue;

      // Get current permissions
      const roleData = await strapi
        .service("plugin::users-permissions.role")
        .findOne(role.id);

      const permissions = roleData.permissions || {};

      // Allow all authenticated roles to call /custom-user/me
      const customUserCt = "api::custom-user.custom-user";
      if (!permissions[customUserCt]) {
        permissions[customUserCt] = { controllers: {} };
      }
      if (!permissions[customUserCt].controllers) {
        permissions[customUserCt].controllers = {};
      }
      if (!permissions[customUserCt].controllers["custom-user"]) {
        permissions[customUserCt].controllers["custom-user"] = {};
      }
      permissions[customUserCt].controllers["custom-user"].me = {
        enabled: true,
      };
      permissions[customUserCt].controllers["custom-user"].myDriver = {
        enabled: true,
      };

      const driverScopedActions = [
        "myTrips",
        "myIncentives",
        "mySalarySlips",
        "myExpenses",
      ];
      for (const action of driverScopedActions) {
        permissions[customUserCt].controllers["custom-user"][action] = {
          enabled: true,
        };
      }

      const adminOnlyActions = [
        "listAppUsers",
        "createManagerAccount",
        "createDriverAccount",
        "resetAppUserPassword",
      ];
      for (const action of adminOnlyActions) {
        permissions[customUserCt].controllers["custom-user"][action] = {
          enabled: role.type === "admin",
        };
      }

      for (const ct of contentTypes) {
        const [, apiName] = ct.split("::");
        const [, controllerName] = apiName.split(".");

        if (!permissions[ct]) {
          permissions[ct] = { controllers: {} };
        }
        if (!permissions[ct].controllers) {
          permissions[ct].controllers = {};
        }
        if (!permissions[ct].controllers[controllerName]) {
          permissions[ct].controllers[controllerName] = {};
        }

        for (const action of actions) {
          permissions[ct].controllers[controllerName][action] = {
            enabled: true,
          };
        }
      }

      await strapi.service("plugin::users-permissions.role").updateRole(role.id, {
        permissions,
      });
    }

    // Fix existing users created via Strapi admin (often missing provider)
    const allUsers = await strapi.db.query(USER_MODEL).findMany({});
    let fixedUserCount = 0;

    for (const user of allUsers) {
      if (user.provider && user.confirmed === true) continue;

      await strapi.db.query(USER_MODEL).update({
        where: { id: user.id },
        data: {
          provider: user.provider || "local",
          confirmed: true,
        },
      });
      fixedUserCount += 1;
    }

    if (fixedUserCount > 0) {
      console.log(`✅ Fixed ${fixedUserCount} user(s) for frontend login`);
    }

    strapi.db.lifecycles.subscribe({
      models: [USER_MODEL],
      async beforeCreate(event) {
        event.params.data = await normalizeUserFields(
          strapi,
          event.params.data
        );
      },
      async beforeUpdate(event) {
        if (event.params.data) {
          event.params.data = await normalizeUserFields(
            strapi,
            event.params.data
          );
        }
      },
    });

    console.log("✅ Roles and permissions configured");
  },
};
