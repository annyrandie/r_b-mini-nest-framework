# mini-nest — частина 2/3: IoC-контейнер + HTTP-шар

Продовження ДЗ #6. Частина 1 (гілка `part-1-ioc`) — власний IoC-контейнер:
читає метадані типів конструктора (`design:paramtypes`) і сам рекурсивно
збирає граф залежностей. Ця частина (`part-2-http`) кладе поверх нього
маршрутизацію на декораторах і валідацію вхідних даних — те, що в Nest
ховається за `@nestjs/platform-express`. Без `@nestjs/*`, `inversify`,
`tsyringe`, `typedi`, `express`, `fastify` — тільки `reflect-metadata`,
`class-validator`/`class-transformer` і `node:http`.

## Структура

```
src/
  decorators/
    injectable.ts     — @Injectable({ scope })              [частина 1]
    inject.ts          — @Inject(token), параметр-декоратор   [частина 1]
    controller.ts       — @Controller(prefix)
    methods.ts            — @Get(path) / @Post(path)
    params.ts               — @Body() / @Param(name) / @Query(name)
  container.ts         — IoC-контейнер (resolve, register, детекція циклів) [частина 1]
  router.ts             — збирає маршрути з метаданих контролерів, матчить URL
  dispatcher.ts           — HTTP-шар поверх node:http: парсить запит,
                             будує аргументи хендлера, серіалізує відповідь
  pipes/
    validation.pipe.ts    — DTO-валідація (plainToInstance + validate)
  dto/
    create-user.dto.ts    — DTO з правилами (class-validator)
  services/
    users.service.ts      — @Injectable()-провайдер (in-memory)
  controllers/
    users.controller.ts   — @Controller('users') — GET /users, GET /users/:id, POST /users
  tokens.ts             — символи-токени                     [частина 1]
  main.ts                — bootstrap: піднімає сервер на :3000 для ручного curl
  index.ts                — публічний барель-експорт
test/                     — node:test
```

## Як запустити

Локально (Node 20+):

```bash
npm install
npm test         # компілює src+test у dist/ і запускає node --test dist/test/*.test.js
npm start         # піднімає HTTP-сервер на :3000 (для ручного curl)
```

```bash
curl http://localhost:3000/users/42
curl "http://localhost:3000/users?limit=5"
curl -X POST http://localhost:3000/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada","email":"ada@example.test"}'
```

У Docker (образ на базі `node:22-slim`, той самий, що й у ДЗ #5):

```bash
docker build -t mini-nest .
docker run --rm mini-nest          # npm test всередині контейнера
docker compose run --rm api npm test
```

## Як це працює (частина 1: IoC-контейнер)

`@Injectable()` — це рівно два виклики `Reflect.defineMetadata`: один
позначає клас як провайдер, другий записує його scope.

`design:paramtypes` генерує сам `tsc` під час компіляції, а не наш код у
рантаймі: якщо на класі є хоч один декоратор і в `tsconfig.json` увімкнено
`emitDecoratorMetadata`, компілятор додає в скомпільований JS виклик
`Reflect.defineMetadata('design:paramtypes', [Тип1, Тип2, ...], Клас)` —
по одному типу на кожен параметр конструктора. Контейнер лише зчитує цей
готовий масив. Без `emitDecoratorMetadata` декоратор все одно відпрацює
(клас позначиться як provider), але метадана про типи параметрів просто
не згенерується, і `Reflect.getMetadata('design:paramtypes', ctor)`
поверне `undefined` — резолвити залежності буде нічим.

`@Inject(token)` — параметр-декоратор, який записує явний токен (`Symbol`
або рядок) під індексом параметра в окремі метадані
(`INJECT_TOKENS_METADATA_KEY`), і контейнер перевіряє їх першими, ще до
того, як звертатися до типу з `design:paramtypes`.

Скоуп (`singleton` / `transient`) — це прапорець у метаданих, який
контейнер звіряє з внутрішнім `Map`-кешем інстансів: для `singleton`
інстанс кладеться в кеш і повертається звідти на кожен наступний `resolve`,
для `transient` кеш не чіпається взагалі — щоразу створюється новий
об'єкт.

> `import 'reflect-metadata'` — перший рядок і в точці входу (`src/index.ts`
> / `src/main.ts`), і в тестовому setup-файлі (`test/setup.ts`), бо саме цей
> імпорт підключає поліфіл `Reflect.defineMetadata`/`Reflect.getMetadata`,
> яких у стандартному `Reflect` рушія JS немає.

## Як це працює (частина 2: маршрутизація і DTO)

**Як параметр-декоратор знає, куди підставити значення.** Параметр-декоратор
(`@Body()`, `@Param(name)`, `@Query(name)`) виконується рушієм JS для
*кожного* параметра методу окремо і отримує третім аргументом
`parameterIndex` — позицію цього параметра в списку. Сам декоратор нічого
з `request` не читає: він лише пише в метадані методу (ключ
`PARAMS_METADATA_KEY`, прив'язаний до пари `(prototype, назва_методу)`)
запис `{ [parameterIndex]: { source: 'body' | 'param' | 'query', name } }`.
Під час обробки HTTP-запиту диспетчер (`dispatcher.ts`) читає цю мапу,
проходить по всіх індексах параметрів хендлера і для кожного дивиться
`source`: `'param'` → бере значення з `:id`, знайденого роутером,
`'query'` → з `URL.searchParams`, `'body'` → з розпарсеного JSON-тіла
(попередньо прогнаного через `ValidationPipe`). Масив аргументів
збирається в порядку індексів і викликається як `handler(...args)` — сам
метод контролера ніколи не бачить ні `req`, ні `res`.

Той самий трюк із `design:paramtypes` із частини 1 працює і тут, тільки
не для конструктора, а для методу: коли на параметрі методу висить
декоратор (`@Body()` тощо), `tsc` з `emitDecoratorMetadata` емітить
`design:paramtypes` вже для *цього методу* (`Reflect.getMetadata(
'design:paramtypes', prototype, 'create')` → `[CreateUserDto]`). Саме
звідси `ValidationPipe` дізнається, у який клас DTO перетворювати тіло
запиту, — жодного окремого реєстру "який метод яке DTO очікує" вести не
треба.

**Порядок виконання декораторів.** Параметр-декоратори виконуються під час
визначення методу — раніше, ніж декоратор самого методу (`@Get`/`@Post`),
а той — раніше, ніж декоратор класу (`@Controller`). Це видно з коду
`registerRoute`/`registerParam`: коли `@Get()` записує список хендлерів
класу через `getOwnMetadata`, метадані параметрів (`PARAMS_METADATA_KEY`)
для цього ж методу вже мають бути на місці — і в `router.ts` вони справді
читаються без проблем на етапі збору маршрутів, що й підтверджують тести.

**Валідація.** `ValidationPipe` (`pipes/validation.pipe.ts`) спершу робить
`plainToInstance(DtoClass, body)` (`class-transformer`) і лише потім
`validateSync(instance)` (`class-validator`) — валідатор читає декоратори
(`@IsEmail()`, `@IsString()`, …) через метадані самого інстанса, тому без
кроку `plainToInstance` він мовчки не перевірить жодного правила на
сирому `{ email: '...' }`-об'єкті. Невалідне тіло → `400` зі списком
`[{ field, constraints }]` по всіх полях одразу (не лише перше). Валідне
тіло → в обробник приходить справжній екземпляр DTO-класу
(`instanceof CreateUserDto`), не plain-об'єкт.

**Контролер — теж провайдер.** `@Controller(prefix)` під капотом ставить ті
самі два `Reflect.defineMetadata`, що й `@Injectable()`. Тому роутер будує
контролер через `container.resolve(ControllerClass)` — той самий рекурсивний
резолвер з частини 1, — і сервіс, який контролер отримує через конструктор,
це той самий singleton, який поверне `container.resolve(UsersService)` де
завгодно ще.
