export default {
  routes: [
    {
      method: "GET",
      path: "/custom-user/me",
      handler: "custom-user.me",
      config: {
        auth: false, // Public route, we handle auth manually
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/custom-user/my-driver",
      handler: "custom-user.myDriver",
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/custom-user/my-trips",
      handler: "custom-user.myTrips",
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: "GET",
      path: "/custom-user/my-incentives",
      handler: "custom-user.myIncentives",
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: "GET",
      path: "/custom-user/my-salary-slips",
      handler: "custom-user.mySalarySlips",
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: "GET",
      path: "/custom-user/my-expenses",
      handler: "custom-user.myExpenses",
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
};
