# mini-nest — частина 1/3: власний IoC-контейнер

Мінімальний IoC-контейнер, що робить те саме, що `@nestjs/core` під капотом:
читає метадані типів конструктора (`design:paramtypes`) і сам рекурсивно
збирає граф залежностей. Без `@nestjs/*`, `inversify`, `tsyringe` чи
`typedi` — тільки `reflect-metadata` і TypeScript.

## Структура

```
src/
  decorators/
    injectable.ts   — @Injectable({ scope })
    inject.ts        — @Inject(token), параметр-декоратор
  container.ts        — сам контейнер (resolve, register, детекція циклів)
  tokens.ts            — символи-токени (CONFIG, LOGGER)
  index.ts              — публічний барель-експорт
test/                    — node:test
```

## Як запустити

Локально (Node 20+):

```bash
npm install
npm test        # компілює src+test у dist/ і запускає node --test dist/test
```

У Docker (образ на базі `node:22-slim`, той самий, що й у ДЗ #5):

```bash
docker build -t mini-nest .
docker run --rm mini-nest
```

## Як це працює

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

`@Inject(token)` — параметр-декоратор, який записує
явний токен (`Symbol` або рядок) під індексом параметра в окремі метадані
(`INJECT_TOKENS_METADATA_KEY`), і контейнер перевіряє їх першими, ще до
того, як звертатися до типу з `design:paramtypes`.

Скоуп (`singleton` / `transient`) — це прапорець у метаданих, який
контейнер звіряє з внутрішнім `Map`-кешем інстансів: для `singleton`
інстанс кладеться в кеш і повертається звідти на кожен наступний `resolve`,
для `transient` кеш не чіпається взагалі — щоразу створюється новий
об'єкт.

> `import 'reflect-metadata'` — перший рядок і в точці входу (`src/index.ts`),
> і в тестовому setup-файлі (`test/setup.ts`), бо саме цей імпорт
> підключає поліфіл `Reflect.defineMetadata`/`Reflect.getMetadata`, яких
> у стандартному `Reflect` рушія JS немає.
