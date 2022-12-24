# Strategemizer

A TypeScript based trading strategy tester, providing the ability to test user-defined strategies on user-defined blocks of history.

**Pre-requisites**

- JavaScript / TypeScript experience
- An Alpaca account

**What this project is**

- A pet project turned open-source. Best practice was not at top of mind when building this out and originally was not based in TypeScript (so, code that was ported over is loosely typed).
- A work-in-progress fun project that works with "real world" data.
- A CLI that utilizes [`ts-node`](https://github.com/TypeStrong/ts-node) runtime.
- Free for anyone to use at their own risk.

**What this project is not**

- This project does not promise future outcomes.
- This project should not be used professionally to steer trading strategies. I've used it as a way to get some kind of insight into strategies before running them in a "paper trading" environment.

#### Usage

```bash
LOG_LEVEL=verbose npm run strategemizer -- \
  --start "2022-12-05T13:30:00Z" \
  --end "2022-12-09T20:00:00Z" \
  --strategy-config-key "a" \
  --strategy-key "bullishEngulfing" \
  --symbols-key "sAndP500"
```
