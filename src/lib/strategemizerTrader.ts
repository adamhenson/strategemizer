// import {
//   accountSchemaDefinition,
//   alpacaAssetListSchemaDefinition,
//   alpacaConfigSchemaDefinition,
//   alpacaNewsSchemaDefinition,
//   alpacaOrderSchemaDefinition,
//   alpacaStockSchemaDefinition,
// } from '@foo-software/schemas';
// import moment from 'moment-timezone';
// import WebSocket from 'ws';
// import {
//   ALPACA_BASE_URL,
//   ALPACA_BASE_URL_DATA,
//   ALPACA_API_KEY_ID,
//   ALPACA_SECRET_KEY,
// } from '../config';
// import mongoose from '../mongooseClient';
// import TrailingStopHelper from '../stock/TrailingStopHelper';
// import alpacaOrder from '../stock/alpacaOrder';
// import liquidateOrders from '../stock/liquidateOrders';
// import MorningStocksInPlay from '../stock/morning/MorningStocksInPlay';
// import refreshOrders from '../stock/refreshOrders';
// import submitQualifyingOrders from '../stock/submitQualifyingOrders';
// import AlpacaClient from './AlpacaClient';
// import ErrorHandler from './ErrorHandler';
// import emailByTemplate from './emailByTemplate';
// import getPackage from './getPackage';
// import getTradingDay from './getTradingDay';
// import { getBarsWithRetry, getRandomlySortedArray } from './utils';

// moment.tz.setDefault('America/New_York');

// const enabledStrategies = enabledStrategiesParam || [];

// const { LOG_LEVEL = 'error' } = process.env;

// const MIN_AVG_DAILY_VOLUME = 250000;
// const connectedStocks: Record<string, number> = {};

// // every 1 min
// const INTERVAL_MS_LOOP = 60000;

// // every 5 seconds
// const INTERVAL_MS_MINI_LOOP = 5000;

// const BASE_URL_TRADING_API = 'https://api.alpaca.markets';
// const BASE_URL_TRADING_API_PAPER = 'https://paper-api.alpaca.markets';
// const BASE_URL_DATA_API = 'https://data.alpaca.markets';
// const WS_MARKET_DATA_URL = 'stream.data.alpaca.markets/v2/sip';
// const WS_MARKET_DATA_NEWS_URL = 'stream.data.alpaca.markets/v1beta1/news';

// const messageTypes = {
//   b: 'bars',
//   n: 'news',
//   q: 'quotes',
//   t: 'trades',
// };

// let alpacaClient: AlpacaClient;
// let alpacaApiKeyId: string;
// let alpacaSecretKey: string;
// let announcementSymbols = [];
// let enabledSymbols: string[] = [];
// let forceListen: boolean;
// let hasLiquidated = false;
// let hasMorningStocksStarted = false;
// let hasReset = false;
// let isAuthenticated = false;
// let isOpen = false;
// let isReady = false;
// let isResetting = false;
// let morningStocksInPlayCount = undefined;
// let nextOpen: string;
// let shouldSetEnabledSymbols = false;
// let trailingStopHelper;
// let ws: WebSocket;
// let wsNews;

// const AccountSchema = new mongoose.Schema(accountSchemaDefinition);
// const AlpacaAssetListSchema = new mongoose.Schema(
//   alpacaAssetListSchemaDefinition,
// );
// const AlpacaConfigSchema = new mongoose.Schema(alpacaConfigSchemaDefinition);
// const AlpacaNewsSchema = new mongoose.Schema(alpacaNewsSchemaDefinition);
// const AlpacaOrderSchema = new mongoose.Schema(alpacaOrderSchemaDefinition);
// const AlpacaStockSchema = new mongoose.Schema(alpacaStockSchemaDefinition);

// AlpacaAssetListSchema.pre('save', function createdAt(next) {
//   if (!this.createdAt) {
//     this.createdAt = Date.now();
//   }
//   next();
// });

// AlpacaNewsSchema.pre('save', function createdAt(next) {
//   if (!this.createdAt) {
//     this.createdAt = Date.now();
//   }
//   next();
// });

// AlpacaOrderSchema.pre('save', function createdAt(next) {
//   if (!this.createdAt) {
//     this.createdAt = Date.now();
//   }
//   next();
// });

// AlpacaStockSchema.pre('save', function createdAt(next) {
//   if (!this.createdAt) {
//     this.createdAt = Date.now();
//   }
//   next();
// });

// const Account = mongoose.model('Account', AccountSchema);
// const AlpacaAssetList = mongoose.model(
//   'AlpacaAssetList',
//   AlpacaAssetListSchema,
// );
// const AlpacaConfig = mongoose.model('AlpacaConfig', AlpacaConfigSchema);
// const AlpacaNews = mongoose.model('AlpacaNews', AlpacaNewsSchema);
// const AlpacaOrder = mongoose.model('AlpacaOrder', AlpacaOrderSchema);
// const AlpacaStock = mongoose.model('AlpacaStock', AlpacaStockSchema);

// const delay = (timeout) =>
//   new Promise((resolve) => setTimeout(resolve, timeout));

// const getSymbols = () => {
//   return !alpacaConfig.isAnnouncedSymbolsEnabled
//     ? enabledSymbols
//     : [...new Set([...enabledSymbols, ...announcementSymbols])];
// };

// const onTradeDayStartErrorHandler = new ErrorHandler(
//   `[Strategemizer] onTradeDayStart`,
// );

// const onTradeDayStart = async () => {
//   try {
//     console.log('trade day started');

//     isReady = true;
//     console.log('subscribed to market data');

//     await updateAlpacaConfig({ isRunning: true });

//     const emailResponse = await emailByTemplate({
//       dynamicTemplateData: {
//         messages: [
//           `scanning stocks`,
//           `hasLiquidated: ${hasLiquidated}`,
//           `hasReset: ${hasReset}`,
//           ...(typeof morningStocksInPlayCount === 'undefined'
//             ? []
//             : [`morning stocks in play count: ${morningStocksInPlayCount}`]),
//         ],
//         subject: `[Strategemizer] 🌅 stock market scanning started`,
//       },
//     });

//     if (!emailResponse.status || emailResponse.status !== 200) {
//       console.log('error', error);
//       throw Error('email fail');
//     }
//   } catch (error) {
//     onTradeDayStartErrorHandler.handleError({
//       error,
//     });
//   }
// };

// const onTradeDayCloseErrorHandler = new ErrorHandler(
//   `[Strategemizer] onTradeDayClose`,
// );

// const onTradeDayClose = async () => {
//   try {
//     shouldSetEnabledSymbols = false;
//     unsubscribe();

//     hasReset = false;
//     console.log('trade day closed');

//     isReady = false;
//     console.log('unsubscribed to market data');

//     await updateAlpacaConfig({
//       isRunning: false,
//       activeSymbolsCount: 0,
//     });

//     const symbols = getSymbols();

//     const emailResponse = await emailByTemplate({
//       dynamicTemplateData: {
//         messages: [
//           `scanning ${symbols.length} stocks at time of end`,
//           `hasLiquidated: ${hasLiquidated}`,
//           `hasReset: ${hasReset}`,
//         ],
//         subject: `[Strategemizer] 🌇 stock market scanning ended`,
//       },
//     });

//     enabledSymbols = [];

//     // clear out news docs at the end of the day
//     await AlpacaNews.deleteMany({});

//     if (!emailResponse.status || emailResponse.status !== 200) {
//       console.log('error', error);
//       throw Error('email fail');
//     }
//   } catch (error) {
//     onTradeDayCloseErrorHandler.handleError({
//       error,
//     });
//   }
// };

// const getOneYearAgoStart = () => {
//   return moment()
//     .set({
//       hour: 4,
//       minute: 0,
//       milliseconds: 0,
//       seconds: 0,
//     })
//     .subtract(1, 'year')
//     .toISOString();
// };

// let isSetEnabledSymbolsRunning = false;

// const setEnabledSymbols = async () => {
//   isSetEnabledSymbolsRunning = true;
//   try {
//     if (!shouldSetEnabledSymbols) {
//       await delay(60000);
//       return setEnabledSymbols();
//     }
//     const assets = await alpacaClient.getAssets({
//       status: 'active',
//     });
//     if (!assets || !assets.length) {
//       if (LOG_LEVEL.includes('verbose')) {
//         console.log('error getting assets, retrying momentarily');
//       }
//       await delay(5000);
//       return setEnabledSymbols();
//     }

//     console.log('setting enabled symbols. this might take a while...');
//     for (const asset of assets) {
//       const { symbol } = asset;

//       // checkpoint: is tradable on Alpaca
//       if (!asset.tradable || !asset.shortable) {
//         continue;
//       }

//       // const handleUnqualified = () => {
//       //   if (enabledSymbols.includes(symbol)) {
//       //     enabledSymbols.splice(enabledSymbols.indexOf(symbol), 1);
//       //     if (ws) {
//       //       ws.send(
//       //         JSON.stringify({
//       //           action: 'unsubscribe',
//       //           bars: [symbol],
//       //         }),
//       //       );
//       //     }
//       //   }
//       // }

//       const bars1Day1Year = await getBarsWithRetry({
//         alpacaClient,
//         symbol,
//         start: getOneYearAgoStart(),
//         timeframe: '1Day',
//       });

//       // checkpoint: no day bars or less than 30 for the year
//       if (
//         !bars1Day1Year ||
//         !bars1Day1Year.length ||
//         bars1Day1Year.length < 30
//       ) {
//         continue;
//       }

//       const mostRecentBar = bars1Day1Year[bars1Day1Year.length - 1];

//       // checkpoint: is price within boundaries
//       if (mostRecentBar.c > maxStockPrice || mostRecentBar.c < minStockPrice) {
//         continue;
//       }

//       // const firstBar = bars[0];
//       // const percentChange = getPercentChange(firstBar.o, mostRecentBar.c);

//       // // checkpoint: must be rising
//       // if (percentChange < MIN_PERCENT_RISE_ENABLED_STOCK) {
//       //   handleUnqualified();
//       //   continue;
//       // }

//       const annualTotalVolume = bars1Day1Year.reduce(
//         (accumulator, current) => accumulator + current.v,
//         0,
//       );
//       const averageDailyVolume = annualTotalVolume / bars1Day1Year.length;

//       // checkpoint: minimum average daily volume (default 250,000)
//       if (averageDailyVolume < MIN_AVG_DAILY_VOLUME) {
//         continue;
//       }

//       if (
//         ws &&
//         !shouldNotSubscribeToWebsocket &&
//         !enabledSymbols.includes(symbol)
//       ) {
//         ws.send(
//           JSON.stringify({
//             action: 'subscribe',
//             bars: [symbol],
//           }),
//         );
//       }

//       alpacaConfig.set({
//         activeSymbolsCount: enabledSymbols.length,
//       });
//       await alpacaConfig.save();

//       enabledSymbols.push(symbol);

//       if (LOG_LEVEL.includes('verbose')) {
//         console.log('enabled symbol', symbol);
//         console.log('enabled symbol count', enabledSymbols.length);
//       }
//     }
//     console.log('enabled symbols set', enabledSymbols.length);

//     isSetEnabledSymbolsRunning = false;
//   } catch (error) {
//     isSetEnabledSymbolsRunning = false;
//     throw error;
//   }
// };

// const updateAlpacaConfig = async (data) => {
//   alpacaConfig = await AlpacaConfig.findOne({
//     accountId,
//   });

//   if (!alpacaConfig) {
//     throw Error('Alpaca config not found');
//   }

//   alpacaConfig.set(data);
//   return alpacaConfig.save();
// };

// const logMessage = (message) => {
//   const { T, ...messagePayload } = message;
//   const messageType = messageTypes[T] || T;

//   let shouldLog = false;

//   if (messageType === 'subscription' && LOG_LEVEL.includes('subscription')) {
//     shouldLog = true;
//   }
//   if (
//     (messageType === 'news' ||
//       (messageType === 'subscription' && messagePayload.news)) &&
//     LOG_LEVEL.includes('news')
//   ) {
//     shouldLog = true;
//   }
//   if (
//     (messageType === 'bars' ||
//       (messageType === 'subscription' && messagePayload.bars)) &&
//     LOG_LEVEL.includes('bars')
//   ) {
//     shouldLog = true;
//   }

//   if (shouldLog) {
//     console.log(messageType);
//   }

//   for (const key in messagePayload) {
//     if (shouldLog) {
//       console.log(`  ${key}:`, messagePayload[key]);
//     }
//   }
// };

// const formatMessage = (messageData: any) => {
//   const [message] = JSON.parse(messageData.toString());
//   return message;
// };

// const handleBarMessageErrorHandler = new ErrorHandler(
//   `[Strategemizer] handleBarMessage`,
// );

// const handleBarMessage = async (payload) => {
//   if (
//     payload.S &&
//     payload.t &&
//     typeof payload.o === 'number' &&
//     typeof payload.h === 'number' &&
//     typeof payload.l === 'number' &&
//     typeof payload.c === 'number' &&
//     typeof payload.v === 'number'
//   ) {
//     try {
//       if (isOpen) {
//         submitQualifyingOrders({
//           abcdMinPercentRise,
//           accountId,
//           alpacaClient,
//           alpacaConfig,
//           AlpacaOrder,
//           bottomReversalLossPercent,
//           bottomReversalMinNumberOfDownwardCandles,
//           bottomReversalMinPercentDrop,
//           bottomReversalMinRelativeVolume,
//           bottomReversalProfitPercent,
//           bullishMarubozuMinPercentRise,
//           enabledStrategies,
//           formations,
//           percentOfBuyingPower,
//           realTimeBar: payload,
//           risingPowersCandlestickAbovePreviousLeewayPercent,
//           risingPowersCandlestickBodyPercent,
//           risingPowersMinPercentRise,
//           standardMaxRsi,
//           symbol: payload.S,
//           trailingStopHelper,
//           threeLineStrikeMinPercentDrop,
//           threeLineStrikeProfitPercent,
//         });
//         connectedStocks[payload.S] = !connectedStocks[payload.S]
//           ? 1
//           : connectedStocks[payload.S] + 1;
//       }
//     } catch (error) {
//       handleBarMessageErrorHandler.handleError({
//         error,
//       });
//     }
//   }
// };

// const handleMessageNewsErrorHandler = new ErrorHandler(
//   `[Strategemizer] handleMessageNews`,
// );

// const handleMessageNews = async (payload) => {
//   if (
//     payload.id &&
//     payload.headline &&
//     payload.symbols &&
//     payload.symbols.length &&
//     payload.url
//   ) {
//     try {
//       const newsDocument = new AlpacaNews({
//         headline: payload.headline,
//         summary: payload.summary,
//         author: payload.author,
//         created_at: payload.created_at,
//         updated_at: payload.updated_at,
//         url: payload.url,
//         symbols: payload.symbols,
//         source: payload.source,
//       });
//       await newsDocument.save();
//     } catch (error) {
//       handleMessageNewsErrorHandler.handleError({
//         error,
//       });
//     }
//   }
// };

// const unsubscribe = () => {
//   if (!alpacaConfig) {
//     return;
//   }

//   if (LOG_LEVEL.includes('verbose')) {
//     console.log('sending unsubscribe...');
//   }

//   const bars = getSymbols();

//   if (ws) {
//     ws.send(
//       JSON.stringify({
//         action: 'unsubscribe',
//         bars,
//       }),
//     );
//   }
// };

// const updateMarketOpenStatus = async () => {
//   const clock = await alpacaClient.getClock();
//   isOpen = clock.is_open;
//   nextOpen = clock.next_open;

//   if (isReady && !isOpen && !forceListen) {
//     return 'closed';
//   }

//   if (!isReady && (isOpen || forceListen)) {
//     return 'open';
//   }

//   return null;
// };

// const reset = async () => {
//   console.log('resetting...');

//   isResetting = true;
//   announcementSymbols = [];

//   await configure();
//   trailingStopHelper.reset();

//   hasReset = true;
//   hasLiquidated = false;
//   hasMorningStocksStarted = false;
//   morningStocksInPlayCount = undefined;

//   console.log('resetting complete... ready to go!');
// };

// const setup = async () => {
//   isAuthenticated = true;

//   trailingStopHelper = new TrailingStopHelper({
//     accountId,
//     alpacaClient,
//     alpacaConfig,
//     AlpacaOrder,
//   });

//   const clock = await alpacaClient.getClock();
//   isOpen = clock.is_open;
//   nextOpen = clock.next_open;

//   if (!isOpen && !forceListen) {
//     console.log(
//       `market isn't open yet, hence waiting to subscribe to market data`,
//     );
//   }
// };

// const handleMessage = async (message: any) => {
//   const formattedMessage = formatMessage(message);

//   if (LOG_LEVEL.includes('verbose')) {
//     logMessage(formattedMessage);
//   }

//   const { T, ...messagePayload } = formattedMessage;
//   const messageType = messageTypes[T as 'b' | 'n' | 'q' | 't'];

//   if (messageType === 'bars') {
//     handleBarMessage(messagePayload);
//   } else if (formattedMessage.msg === 'authenticated' && !isAuthenticated) {
//     console.log('WebSocket authentication complete');
//     setup();
//   }
// };

// const loopErrorHandler = new ErrorHandler(`[Strategemizer] loop`);

// const loop = async () => {
//   try {
//     const result = await updateMarketOpenStatus();
//     if (result === 'closed') {
//       onTradeDayClose();
//     }
//     if (result === 'open') {
//       onTradeDayStart();
//     }

//     if (LOG_LEVEL.includes('connected-stocks')) {
//       let connectedStocksLength = 0;
//       Object.values(connectedStocks).forEach((value) => {
//         if (value >= 10) {
//           connectedStocksLength++;
//         }
//       });
//       console.log('connected stocks', connectedStocksLength);
//     }
//   } catch (error: any) {
//     loopErrorHandler.handleError({
//       error,
//     });
//   }
// };

// const miniLoopErrorHandler = new ErrorHandler(`[Strategemizer] miniLoop`);

// let cachedFormattedToday: string;
// let cachedFormattedTodayIso: string;
// let cachedFormattedTradingDay: string;

// const miniLoop = async () => {
//   try {
//     if (
//       !alpacaClient ||
//       typeof isOpen === 'undefined' ||
//       typeof nextOpen === 'undefined'
//     ) {
//       return;
//     }

//     // update the cache (every hour)
//     if (
//       !cachedFormattedTodayIso ||
//       moment(cachedFormattedTodayIso).hour() !== moment().hour()
//     ) {
//       const { start: tradingDayStart } = await getTradingDay({
//         alpacaClient,
//         end: moment().set({ hours: 16, minute: 0 }).toISOString(),
//         start: moment({ hours: 9, minute: 0 }).toISOString(),
//       });
//       cachedFormattedToday = moment().format('YYYY-MM-DD');
//       cachedFormattedTodayIso = moment().toISOString();
//       cachedFormattedTradingDay = moment(tradingDayStart).format('YYYY-MM-DD');
//     }

//     const hour = moment().hour();
//     const minute = moment().minute();

//     // if we have less than a minute until the market opening,
//     // we want to start listenting as close to the dot as possible
//     // ... hence, when we're within the minute, check the endpoint
//     // otherwise save on any API limits / resources.
//     // also need to check that today is a trading day
//     if (!isOpen && cachedFormattedToday === cachedFormattedTradingDay) {
//       const momentNow = moment(new Date());
//       const momentNextOpen = moment(nextOpen);
//       const secondsToNextOpen = momentNextOpen.diff(momentNow, 'seconds');

//       if (secondsToNextOpen <= 5) {
//         const result = await updateMarketOpenStatus();
//         if (result === 'open') {
//           onTradeDayStart();
//         }
//       }

//       // reset at 9:29am
//       if (hour === 9 && minute === 29 && !isResetting && !hasReset) {
//         reset();
//       }
//     } else if (isOpen) {
//       const hour = moment().hour();
//       const minute = moment().minute();
//       const seconds = moment().seconds();

//       // if we're near the end of the day - let's liquidate
//       if (hour === 15 && minute === 59 && seconds > 30 && !hasLiquidated) {
//         liquidateOrders({
//           alpacaClient,
//         });
//         hasLiquidated = true;
//       }

//       refreshOrders({
//         alpacaClient,
//         AlpacaOrder,
//       });
//     }
//   } catch (error: any) {
//     miniLoopErrorHandler.handleError({
//       error,
//     });
//   }
// };

// const listenErrorHandler = new ErrorHandler(`[Strategemizer] listen`);

// const listen = async () => {
//   try {
//     const createConnection = () => {
//       ws = new WebSocket(`wss://${WS_MARKET_DATA_URL}`);

//       ws.on('open', function open() {
//         console.log('WebSocket opened, authenticating...');
//         ws.send(
//           JSON.stringify({
//             action: 'auth',
//             key: alpacaApiKeyId,
//             secret: alpacaSecretKey,
//           }),
//         );
//       });

//       ws.on('close', function incoming() {
//         createConnection();
//       });

//       ws.on('message', function incoming(message: string) {
//         handleMessage(message);
//       });
//     };

//     createConnection();
//   } catch (error: any) {
//     listenErrorHandler.handleError({
//       error,
//     });
//   }
// };

// const strategemizerTrader = async ({
//   alpacaBaseUrl = ALPACA_BASE_URL,
//   alpacaBaseUrlData = ALPACA_BASE_URL_DATA,
//   alpacaApiKeyId: alpacaApiKeyIdParam = ALPACA_API_KEY_ID,
//   alpacaSecretKey: alpacaSecretKeyParam = ALPACA_SECRET_KEY,
//   enabledSymbols: enabledSymbolsParam,
//   forceListen: forceListenParam = false,
// }: {
//   alpacaBaseUrl: string;
//   alpacaBaseUrlData: string;
//   alpacaApiKeyId: string;
//   alpacaSecretKey: string;
//   enabledSymbols: string[];
//   forceListen?: boolean;
// }) => {
//   alpacaApiKeyId = alpacaApiKeyIdParam;
//   alpacaSecretKey = alpacaSecretKeyParam;
//   enabledSymbols = enabledSymbolsParam;
//   forceListen = forceListenParam;
//   const packageContent = await getPackage();
//   const packageContentParsed = JSON.parse(packageContent);

//   console.log('-----------------------------------');
//   console.log('');
//   console.log(`${packageContentParsed.name}@${packageContentParsed.version}`);
//   console.log('');
//   console.log('-----------------------------------');

//   console.log('');

//   alpacaClient = new AlpacaClient(
//     alpacaBaseUrl,
//     alpacaBaseUrlData,
//     alpacaApiKeyId,
//     alpacaSecretKey,
//     LOG_LEVEL.includes('verbose') && LOG_LEVEL.includes('alpaca-client'),
//   );

//   listen();
//   setInterval(loop, INTERVAL_MS_LOOP);
//   setInterval(miniLoop, INTERVAL_MS_MINI_LOOP);
// };

// export default strategemizerTrader;
export default function strategemizerTrader() {
  console.log('placeholder');
}
