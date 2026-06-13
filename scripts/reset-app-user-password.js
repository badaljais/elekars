'use strict';

const { createStrapi } = require('@strapi/strapi');
const bcrypt = require('bcryptjs');

async function setAppUserPassword(app, userId, plainPassword) {
  const hashed = await bcrypt.hash(plainPassword, 10);

  await app.db.query('plugin::users-permissions.user').update({
    where: { id: userId },
    data: {
      password: hashed,
      provider: 'local',
      confirmed: true,
      blocked: false,
    },
  });

  const user = await app.db.query('plugin::users-permissions.user').findOne({
    where: { id: userId },
  });

  const valid = await app
    .plugin('users-permissions')
    .service('user')
    .validatePassword(plainPassword, user.password);

  if (!valid) {
    throw new Error('Password reset failed validation');
  }
}

async function main() {
  const email = process.argv[2]?.toLowerCase();
  const password = process.argv[3];

  if (!email || !password) {
    console.error(
      'Usage: node scripts/reset-app-user-password.js <email> <password>'
    );
    process.exit(1);
  }

  const app = await createStrapi({ distDir: './dist' }).load();

  try {
    const user = await app.db.query('plugin::users-permissions.user').findOne({
      where: { email },
    });

    if (!user) {
      console.error(
        `No app user found for ${email}. Create one in Strapi: Content Manager → User (not Admin users).`
      );
      process.exit(1);
    }

    await setAppUserPassword(app, user.id, password);

    console.log(`✅ App user password reset for ${email}`);
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
