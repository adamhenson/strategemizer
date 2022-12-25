# Strategemizer

A TypeScript based trading strategy tester, providing the ability to test user-defined strategies on user-defined blocks of history.

## Disclaimer

Although this is a public, "open-source" project - I have no goal to maintain this for broad consumption at this time. It's primarily a personal project, and secondarily open to the public... but will try to keep others in mind who are also using it when I make any major changes. The documentation will stay pretty limited. There will be frequent breaking changes for now. The actual test runner functionality will provide results of strategies, and although the point of this project is to attempt to have tests accurataly reflect reality, I take no responsibility of its accuracy.

**Pre-requisites**

- JavaScript / TypeScript experience
- An Alpaca account

**What this project is**

- A private pet project turned public. Best practice was not at top of mind when building this out and originally was not based in TypeScript (so, code that was ported over is loosely typed).
- A work-in-progress fun project that works with "real world" data.
- A CLI that utilizes [`ts-node`](https://github.com/TypeStrong/ts-node) runtime.
- Free for anyone to use at their own risk.

**What this project is not**

- This project does not promise future outcomes.
- This project should not be used professionally to steer trading strategies. I've used it as a way to get some kind of insight into strategies before running them in a "paper trading" environment.

## Usage

- Options: see [./src/bin/strategemizer.ts](./src/bin/strategemizer.ts)

**Environment Varables (by Example)**

```
ALPACA_BASE_URL='https://paper-api.alpaca.markets' \
ALPACA_BASE_URL_DATA='https://data.alpaca.markets' \
ALPACA_API_KEY_ID='abcd' \
ALPACA_SECRET_KEY='efgh' \
MAIN_OUTPUT_DIRECTORY='./output' \
LOG_LEVEL=verbose
```

#### Usage: as an NPM Module

**Note:** Requires ESM support

```typescript
import strategemizer from 'strategemizer';

strategemizer({
  start: '2022-12-05T13:30:00Z',
  end: '2022-12-09T20:00:00Z',
  strategyConfigKey: 'a',
  strategyKey: 'bullishEngulfing',
  symbolsKey: 'sAndP500',
  maxLoops: 20,
})
```

#### Usage: From this Project

Create the following files, modeling after the sibling `.example.ts` files.

- `./src/strategies/index.ts`
- `./src/symbols/index.ts`

```bash
npm run strategemizer -- \
  --start "2022-12-05T13:30:00Z" \
  --end "2022-12-09T20:00:00Z" \
  --strategy-config-key "a" \
  --strategy-key "bullishEngulfing" \
  --symbols-key "sAndP500" \
  --max-loops 20
```
