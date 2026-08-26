import 'reflect-metadata';
import { Container } from './container';
import { createApp } from './dispatcher';
import { UsersController } from './controllers/users.controller';
import { AuthGuard } from './guards/auth.guard';
import { LoggingInterceptor } from './interceptors/logging.interceptor';

const PORT = Number(process.env.PORT ?? 3000);

const container = new Container();
const app = createApp(container, [UsersController], {
  guards: [AuthGuard],
  interceptors: [LoggingInterceptor],
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`mini-nest listening on http://localhost:${PORT}`);
  console.log(`  GET  /users            list (optionally ?limit=)         — needs Authorization`);
  console.log(`  GET  /users/:id        one user                          — needs Authorization`);
  console.log(`  POST /users            { "name": "...", "email": "..." } — needs Authorization`);
});
