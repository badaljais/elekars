export default {
  routes: [
    {
      method: 'POST',
      path: '/customers/find-or-create',
      handler: 'customer.findOrCreate',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
