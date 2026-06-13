import { factories } from '@strapi/strapi';

function normalizeMobile(mobile: string): string {
  return mobile.replace(/\D/g, '').slice(-10);
}

export default factories.createCoreController('api::customer.customer', ({ strapi }) => ({
  async findOrCreate(ctx) {
    const { name, mobile, email } = ctx.request.body;

    if (!name?.trim() || !mobile?.trim()) {
      return ctx.badRequest('Customer name and mobile are required');
    }

    const normalizedMobile = normalizeMobile(mobile);
    if (normalizedMobile.length < 10) {
      return ctx.badRequest('Enter a valid 10-digit mobile number');
    }

    let customer = await strapi.db.query('api::customer.customer').findOne({
      where: { mobile: normalizedMobile },
    });

    if (customer) {
      const updates: Record<string, string> = {};
      if (name.trim() && customer.name !== name.trim()) {
        updates.name = name.trim();
      }
      if (email?.trim() && customer.email !== email.trim()) {
        updates.email = email.trim();
      }

      if (Object.keys(updates).length > 0) {
        customer = await strapi.db.query('api::customer.customer').update({
          where: { id: customer.id },
          data: updates,
        });
      }
    } else {
      customer = await strapi.db.query('api::customer.customer').create({
        data: {
          name: name.trim(),
          mobile: normalizedMobile,
          email: email?.trim() || null,
        },
      });
    }

    ctx.body = { data: customer };
  },
}));
