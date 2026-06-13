export default {
  routes: [
    {
      method: "GET",
      path: "/custom-user/app-users",
      handler: "custom-user.listAppUsers",
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: "POST",
      path: "/custom-user/create-manager",
      handler: "custom-user.createManagerAccount",
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: "POST",
      path: "/custom-user/create-driver",
      handler: "custom-user.createDriverAccount",
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: "PUT",
      path: "/custom-user/reset-password/:userId",
      handler: "custom-user.resetAppUserPassword",
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
};
