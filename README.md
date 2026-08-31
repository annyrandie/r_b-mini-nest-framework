# mini-nest — частина 3/3: повний життєвий цикл запиту

Продовження ДЗ #7/#8. Частина 1 (`part-1-ioc`) — власний IoC-контейнер.
Частина 2 (`part-2-http`) — маршрутизація на декораторах і валідація вхідних
даних. Ця частина добудовує решту того, через що в Nest проходить кожен
HTTP-виклик: middleware, guard, interceptor, pipe і exception filter —
плюс наскрізний `requestId` через `AsyncLocalStorage`. Без `@nestjs/*`,
`inversify`, `tsyringe`, `typedi`, `express`, `fastify` — тільки
`reflect-metadata`, `zod` і `node:http`/`node:async_hooks`.

## Життєвий цикл запиту

```
HTTP-запит
   │
   ▼
runWithRequestContext({ requestId })   ← генерує/бере requestId, віддає його назад
   │                                     у заголовку X-Request-Id
   │   (усе нижче виконується всередині цього виклику —
   │    getRequestId() бачить requestId на будь-якій глибині)
   ▼
Middleware
   │
   ▼
Guard  ───────────── false → ForbiddenError ──┐
   │ true                                     │
   ▼                                          │
Interceptor: код до next()                    │
   │                                          │
   ▼                                          │
Pipe (validateWithZod)  ── невалідно → ValidationError ─┤
   │ валідно                                            │
   ▼                                                     │
Handler  ── кидає помилку (домен./будь-яку) ─────────────┤
   │ ok                                                  │
   ▼                                                     │
Interceptor: код після next()                            │
   │                                                      │
   ▼                                                      ▼
HTTP-відповідь  ◀──────────────────────────  Exception Filter
(200/201 + X-Request-Id)                     (404 / 400 / 403 / 500,
                                               без стек-трейсу назовні
                                               + X-Request-Id)
```

Guard, що повернув `false` (`ForbiddenError`), помилка pipe
(`ValidationError`), доменна помилка з хендлера (`NotFoundError`) чи
взагалі що завгодно, кинуте interceptor'ом, — усе це один `catch` на
найвищому рівні `dispatcher.ts`, який віддає керування Exception Filter.
Він і є останньою ланкою: єдине місце, де "будь-яка помилка" перетворюється
на конкретний HTTP-статус.

**Guard проти interceptor.** Guard відповідає рівно на одне питання —
"пускати чи ні" — до валідації і до хендлера, і не бачить ні аргументів,
ні результату. Interceptor обгортає весь виклик (`next()`): має код і до
нього, і після, бачить і вхід, і вихід — і саме тому може мірятиме
тривалість (`LoggingInterceptor`), логувати результат чи навіть підмінити
відповідь, а guard так не вміє.

## Структура

```
src/
  decorators/
    injectable.ts     — @Injectable({ scope })              [частина 1]
    inject.ts          — @Inject(token), параметр-декоратор   [частина 1]
    controller.ts       — @Controller(prefix)                 [частина 2]
    methods.ts            — @Get(path) / @Post(path)          [частина 2]
    params.ts               — @Body(schema) / @Param(name) / @Query(name) [ч.2, Body — ч.3]
  container.ts         — IoC-контейнер (resolve, register, детекція циклів) [частина 1]
  router.ts             — збирає маршрути з метаданих контролерів, матчить URL [частина 2]
  dispatcher.ts           — HTTP-шар: парсить запит і проганяє його крізь
                             весь цикл — middleware -> guard -> interceptor(before)
                             -> pipe -> handler -> interceptor(after) -> filter [ч.2, цикл — ч.3]
  context/
    request-context.ts   — обгортка над AsyncLocalStorage: requestId       [частина 3]
  errors/
    not-found.error.ts   — NotFoundError            -> 404                 [частина 3]
    validation.error.ts  — ValidationError           -> 400 (список полів) [частина 3]
    forbidden.error.ts   — ForbiddenError (відмова guard'а) -> 403         [частина 3]
  guards/
    guard.ts              — інтерфейс CanActivate                          [частина 3]
    auth.guard.ts          — AuthGuard: перевіряє заголовок Authorization  [частина 3]
  interceptors/
    interceptor.ts         — інтерфейс Interceptor                        [частина 3]
    logging.interceptor.ts — LoggingInterceptor: METHOD /path — N.N ms    [частина 3]
  pipes/
    zod-validation.pipe.ts — validateWithZod(schema, body) на Zod 4       [частина 3]
  filters/
    exception.filter.ts    — mapErrorToResponse: помилка -> {status, body} [частина 3]
  request-info.ts           — RequestInfo: що бачать middleware/guard/interceptor [частина 3]
  dto/
    create-user.dto.ts    — Zod-схема + z.infer<> (у ч.2 був клас class-validator) [ч.2, на Zod — ч.3]
  services/
    users.service.ts      — @Injectable()-провайдер (in-memory)            [частина 1/2, ALS — ч.3]
  controllers/
    users.controller.ts   — @Controller('users') — GET /users, GET /users/:id, POST /users [частина 2]
  tokens.ts             — символи-токени                     [частина 1]
  main.ts                — bootstrap: сервер на :3000 з AuthGuard + LoggingInterceptor [ч.2, ч.3]
  index.ts                — публічний барель-експорт
test/                     — node:test
  lifecycle-order.test.ts     — точний порядок шести стадій + паралельні запити [частина 3]
  logging-interceptor.test.ts — interceptor міряє й логує час                  [частина 3]
  exception-filter.test.ts    — мапінг помилок, "boom" і стек не течуть назовні [частина 3]
  request-context.test.ts     — X-Request-Id (echo/generate) + читання зі сховища [частина 3]
```

## Як запустити

Локально (Node 20+):

```bash
npm install
npm test         # компілює src+test у dist/ і запускає node --test dist/test/*.test.js
npm start         # піднімає HTTP-сервер на :3000 (для ручного curl)
```

Guard і interceptor у `main.ts` застосовані глобально — будь-який запит без
`Authorization` отримає 403:

```bash
curl -si localhost:3000/users/1                              # 403, без Authorization
curl -si -H "Authorization: Bearer x" localhost:3000/users/1  # 404 — юзера з id=1 немає
curl -si -H "Authorization: Bearer x" "localhost:3000/users?limit=5"
curl -si -H "Authorization: Bearer x" -H "X-Request-Id: my-id" localhost:3000/users/1
curl -X POST localhost:3000/users \
  -H "Authorization: Bearer x" -H 'Content-Type: application/json' \
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
(попередньо прогнаного через zod-pipe стадію циклу — див. частину 3).
Масив аргументів збирається в порядку індексів і викликається як
`handler(...args)` — сам метод контролера ніколи не бачить ні `req`,
ні `res`.

**Матчинг маршруту.** `matchRoute()` (`router.ts`) не бере перший-ліпший
збіг за довжиною сегментів — кандидатів спершу сортує за специфічністю:
статичний сегмент (`users`) переважає `:param` на тій самій позиції,
незалежно від порядку реєстрації роутів у контролері. Тому `@Get('me')`
і `@Get(':id')` в одному контролері не конфліктують — `/users/me`
завжди піде на статичний маршрут.

**Порядок виконання декораторів.** Параметр-декоратори виконуються під час
визначення методу — раніше, ніж декоратор самого методу (`@Get`/`@Post`),
а той — раніше, ніж декоратор класу (`@Controller`). Це видно з коду
`registerRoute`/`registerParam`: коли `@Get()` записує список хендлерів
класу через `getOwnMetadata`, метадані параметрів (`PARAMS_METADATA_KEY`)
для цього ж методу вже мають бути на місці — і в `router.ts` вони справді
читаються без проблем на етапі збору маршрутів, що й підтверджують тести.

**Валідація тепер на Zod, не class-validator.** У частині 2 `@Body()` брав
DTO-клас через `design:paramtypes` методу і прогонав тіло крізь
`plainToInstance` + `validateSync`. У частині 3 клас DTO пішов: `@Body(schema)`
приймає Zod-схему явним аргументом (`create-user.dto.ts` тепер експортує
`createUserSchema` і `type CreateUserDto = z.infer<typeof createUserSchema>`
замість класу з декораторами), а сам виклик `schema.safeParse(body)`
живе в `pipes/zod-validation.pipe.ts` — детальніше про те, чому це саме
*pipe*-стадія циклу, а не окремий крок, дивись у частині 3 нижче.
Невалідне тіло → `ValidationError` зі списком `[{ field, constraints }]`
по всіх полях одразу (не лише перше), яку далі мапить у `400`
Exception Filter.

**Контролер — теж провайдер.** `@Controller(prefix)` під капотом ставить ті
самі два `Reflect.defineMetadata`, що й `@Injectable()`. Тому роутер будує
контролер через `container.resolve(ControllerClass)` — той самий рекурсивний
резолвер з частини 1, — і сервіс, який контролер отримує через конструктор,
це той самий singleton, який поверне `container.resolve(UsersService)` де
завгодно ще.

## Як це працює (частина 3: цикл запиту)

**Чому `AsyncLocalStorage`, а не глобальна змінна.** Node — один потік з
event loop: поки один запит виконує `await` (читає тіло, чекає базу тощо),
event loop цілком може почати обробляти інший запит. Якби `requestId`
лежав у звичайній модульній змінній (`let currentRequestId`), другий запит
перезаписав би її до того, як перший дістався логування, — і в логах першого
запиту опинився б чужий id. `AsyncLocalStorage` рішає
це не "ще одним замком", а інакше: `als.run(store, callback)` прив'язує
`store` не до змінної, а до самого асинхронного контексту виконання —
Node продовжує стежити за ним крізь усі `await`/колбеки/таймери, що
були *започатковані* всередині цього `callback`, навіть якщо вони
виконуються на дуже інших "витках" event loop. Два паралельних запити
отримують два незалежних контексти, які фізично не можуть перетнутися,
— це підтверджує тест на 10 одночасних запитів у
`lifecycle-order.test.ts`.

**`als.run()` мусить обгортати весь цикл, а не тільки middleware.** Якщо
обгорнути в `als.run()` лише саму генерацію `requestId`, а потім
викликати решту стадій *поза* цим колбеком, — контекст загубиться одразу
після першого `await` за межами `run()`. У `dispatcher.ts` весь цикл
(middleware → guard → interceptor → pipe → handler → filter) — це один
`callback`, переданий у `runWithRequestContext()`, тому будь-який код у
будь-якій стадії, скільки б рівнів виклику не було між ним і хендлером
(`UsersService.audit()` — на два рівні глибше `getOne()`), може дістати
`requestId` через `getRequestId()`, не приймаючи його параметром.

**Guard і interceptor підключаються глобально.**
Конфігуруються масивом при виклику `createApp(container, controllers,
{ guards, interceptors, middlewares })` — той самий підхід, що
`app.useGlobalGuards()` / `app.useGlobalInterceptors()` у справжньому
Nest, тільки без per-route override (`@UseGuards()` на конкретному
хендлері).

**Порядок доведено тестом, а не коментарем.** `lifecycle-order.test.ts`
піднімає окремий тестовий контролер, де кожна стадія (middleware, guard,
interceptor, pipe через `.transform()` у Zod-схемі, сам хендлер) пише
свою мітку в спільний масив, і порівнює його з
`['middleware','guard','interceptor:before','pipe','handler',
'interceptor:after']` — точний порядок, а не факт "щось відпрацювало".

**Guard проти exception filter.** Guard сам нічого не відповідає — коли
`canActivate()` повертає `false`, диспетчер кидає `ForbiddenError`, і вже
exception filter перетворює її на `403`. Це той самий шлях, яким ідуть
`NotFoundError` (404), `ValidationError` (400, зі списком полів) і будь-яка
інша помилка (500, без тексту й без стек-трейсу назовні — тільки в лог).
