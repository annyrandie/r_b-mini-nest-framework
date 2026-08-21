import 'reflect-metadata';
import { Container } from './container';
import { createApp } from './dispatcher';
import { UsersController } from './controllers/users.controller';

const PORT = Number(process.env.PORT ?? 3000);

const container = new Container();
const app = createApp(container, [UsersController]);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`mini-nest listening on http://localhost:${PORT}`);
  console.log(`  GET  /users            list (optionally ?limit=)`);
  console.log(`  GET  /users/:id        one user`);
  console.log(`  POST /users            { "name": "...", "email": "..." }`);
});
