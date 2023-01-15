// this file is loosely typed as it was copied from another project
import fetch from 'node-fetch';
import queryString from 'query-string';
import { Asset, Trade } from '../types';

export interface AlpacaClientError {
  error?: string;
  metadata?: any;
  status?: number;
}

export interface GetLatestTradeResult extends AlpacaClientError {
  symbol?: string;
  trade?: Trade;
}

export interface GetTradesResult extends AlpacaClientError {
  symbol?: string;
  trades?: Trade[];
  next_page_token?: string | null;
}

export interface GetClockResult extends AlpacaClientError {
  timestamp?: string;
  is_open?: boolean;
  next_open?: string;
  next_close?: string;
}

const { LOG_LEVEL = 'error' } = process.env;

const shouldLog = LOG_LEVEL.includes('alpaca-client');

// "trading" api
const ALPACA_API_PATH_ACCOUNT = '/v2/account';
const ALPACA_API_PATH_ASSETS = '/v2/assets';
const ALPACA_API_PATH_BARS = '/v2/stocks/{symbol}/bars';
const ALPACA_API_PATH_BARS_CRYPTO = '/v1beta2/crypto/bars';
const ALPACA_API_PATH_BARS_MULTI = '/v2/stocks/bars';
const ALPACA_API_PATH_ANNOUNCEMENTS = '/v2/corporate_actions/announcements';
const ALPACA_API_PATH_CALENDAR = '/v2/calendar';
const ALPACA_API_PATH_CLOCK = '/v2/clock';
const ALPACA_API_PATH_ORDERS = '/v2/orders';
const ALPACA_API_PATH_POSITIONS = '/v2/positions';
const ALPACA_API_PATH_PORTFOLIO_HISTORY = '/v2/account/portfolio/history';
const ALPACA_API_PATH_SNAPSHOT = '/v2/stocks/{symbol}/snapshot';
const ALPACA_API_PATH_SNAPSHOT_MULTI = '/v2/stocks/snapshots';
const ALPACA_API_PATH_TRADES = '/v2/stocks/{symbol}/trades';
const ALPACA_API_PATH_TRADES_CRYPTO = '/v1beta2/crypto/trades';
const ALPACA_API_PATH_TRADES_LATEST_CRYPTO = '/v1beta2/crypto/latest/trades';
const ALPACA_API_PATH_WATCHLISTS = '/v2/watchlists';

const getUrlWithQuery = (url: string, query: any = {}) => {
  const fullQueryString = !Object.keys(query).length
    ? ''
    : `?${queryString.stringify(query, { encode: false })}`;
  return `${url}${fullQueryString}`;
};

const getErrorJson = (error?: string, metadata?: any, status?: number) => {
  return { error, metadata, status };
};

const getResult = async (response: any, metadata?: any) => {
  const json =
    metadata && metadata.type === 'emptyResponse'
      ? { status: response.status }
      : await response.json();
  if (response.status > 399) {
    if (json.message) {
      return getErrorJson(json.message, metadata, response.status);
    }
    return getErrorJson(
      `an unknown error occurred. status: ${response.status}`,
      metadata,
      response.status,
    );
  }
  return json;
};

export default class AlpacaClient {
  private _cache: any;
  private headers: Record<string, string>;

  constructor(
    private baseUrl: string,
    private baseUrlData: string,
    private apiKeyId: string,
    private secretKey: string,
    private shouldLogUrl: boolean,
  ) {
    this._cache = new Map();
    this.headers = {
      accept: 'application/json',
      'APCA-API-KEY-ID': this.apiKeyId,
      'APCA-API-SECRET-KEY': this.secretKey,
    };
  }

  getCache(cacheKey: string) {
    const cachedItem = this._cache.get(cacheKey);
    if (shouldLog && cachedItem) {
      console.log(`✔️ response found in cache`, cacheKey);
    }
    return cachedItem;
  }

  // https://alpaca.markets/docs/api-references/trading-api/account/
  async getAccount() {
    try {
      const apiUrl = `${this.baseUrl}${ALPACA_API_PATH_ACCOUNT}`;

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        headers: this.headers,
      });
      return getResult(response);
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
      );
    }
  }

  // https://alpaca.markets/docs/api-references/trading-api/corporate-actions-announcements/
  async getAnnouncements(query: any) {
    try {
      const apiUrl = getUrlWithQuery(
        `${this.baseUrl}${ALPACA_API_PATH_ANNOUNCEMENTS}`,
        query,
      );

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        headers: this.headers,
      });
      return getResult(response);
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        query,
      );
    }
  }

  // https://alpaca.markets/docs/api-references/trading-api/calendar/
  async getCalendar(query: any) {
    try {
      const apiUrl = getUrlWithQuery(
        `${this.baseUrl}${ALPACA_API_PATH_CALENDAR}`,
        query,
      );

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const cachedResponse = this.getCache(apiUrl);
      if (cachedResponse) {
        return cachedResponse;
      }

      const response = await fetch(apiUrl, {
        headers: this.headers,
      });

      const jsonResponse = await getResult(response);

      if (jsonResponse && !jsonResponse.error) {
        this._cache.set(apiUrl, jsonResponse);
      }

      return jsonResponse;
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        query,
      );
    }
  }

  // https://alpaca.markets/docs/api-references/trading-api/clock/
  async getClock(): Promise<GetClockResult> {
    try {
      const apiUrl = `${this.baseUrl}${ALPACA_API_PATH_CLOCK}`;

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        headers: this.headers,
      });
      return getResult(response);
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
      );
    }
  }

  // https://alpaca.markets/docs/api-references/trading-api/orders/
  async postOrder(params: any) {
    try {
      const apiUrl = `${this.baseUrl}${ALPACA_API_PATH_ORDERS}`;

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(params),
      });
      return getResult(response);
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        { params },
      );
    }
  }

  // https://alpaca.markets/docs/api-references/trading-api/orders/#get-an-order
  async getOrder({ id }: { id: string | number }) {
    try {
      const apiUrl = `${this.baseUrl}${ALPACA_API_PATH_ORDERS}/${id}`;

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        headers: this.headers,
      });
      return getResult(response);
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        { id },
      );
    }
  }

  // https://alpaca.markets/docs/api-references/trading-api/orders/
  async getOrders(query: any) {
    try {
      const apiUrl = getUrlWithQuery(
        `${this.baseUrl}${ALPACA_API_PATH_ORDERS}`,
        query,
      );

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        headers: this.headers,
      });
      return getResult(response);
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        query,
      );
    }
  }

  async replaceOrder({ id, params }: { id: string | number; params: any }) {
    try {
      const apiUrl = `${this.baseUrl}${ALPACA_API_PATH_ORDERS}/${id}`;

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify(params),
      });
      return getResult(response);
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        params,
      );
    }
  }

  async cancelOrder({ id }: { id: string | number }) {
    try {
      const apiUrl = `${this.baseUrl}${ALPACA_API_PATH_ORDERS}/${id}`;

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: this.headers,
      });
      return getResult(response, {
        type: 'emptyResponse',
      });
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        { id },
      );
    }
  }

  // https://alpaca.markets/docs/api-references/trading-api/portfolio-history/
  async getPortfolioHistory(query: any) {
    try {
      const apiUrl = getUrlWithQuery(
        `${this.baseUrl}${ALPACA_API_PATH_PORTFOLIO_HISTORY}`,
        query,
      );

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        headers: this.headers,
      });
      return getResult(response);
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        query,
      );
    }
  }

  // https://alpaca.markets/docs/api-references/trading-api/positions/
  async getPosition(symbol: string) {
    try {
      const apiUrl = `${this.baseUrl}${ALPACA_API_PATH_POSITIONS}/${symbol}`;

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        headers: this.headers,
      });
      return getResult(response);
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        { symbol },
      );
    }
  }

  // https://alpaca.markets/docs/api-references/trading-api/positions/
  async getPositions() {
    try {
      const apiUrl = `${this.baseUrl}${ALPACA_API_PATH_POSITIONS}`;

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        headers: this.headers,
      });
      return getResult(response);
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
      );
    }
  }

  // https://alpaca.markets/docs/api-references/trading-api/positions/
  async closePosition(symbol: string) {
    try {
      const apiUrl = `${this.baseUrl}${ALPACA_API_PATH_POSITIONS}/${symbol}?cancel_orders=true`;

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: this.headers,
      });
      return getResult(response, {
        type: 'emptyResponse',
      });
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        { symbol },
      );
    }
  }

  // https://alpaca.markets/docs/api-references/trading-api/positions/
  async closeAllPositions() {
    try {
      const apiUrl = `${this.baseUrl}${ALPACA_API_PATH_POSITIONS}?cancel_orders=true`;

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: this.headers,
      });
      return getResult(response, {
        type: 'emptyResponse',
      });
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
      );
    }
  }

  // https://alpaca.markets/docs/api-references/market-data-api/stock-pricing-data/historical/#multi-trades
  // and
  // https://alpaca.markets/docs/api-references/market-data-api/crypto-pricing-data/historical/#trades
  async getTrades(symbol: string, query: any): Promise<GetTradesResult> {
    try {
      // the way we determine crypto is presence of a `/` in symbol
      const isCrypto = symbol.includes('-') || symbol.includes('/');
      const cryptoSymbol = symbol.replace('-', '/').toUpperCase();

      const apiUrl = !isCrypto
        ? getUrlWithQuery(
            `${`${this.baseUrlData}${ALPACA_API_PATH_TRADES}`.replace(
              '{symbol}',
              symbol.toLowerCase(),
            )}`,
            query,
          )
        : getUrlWithQuery(
            `${this.baseUrlData}${ALPACA_API_PATH_TRADES_CRYPTO}`,
            {
              ...query,
              symbols: cryptoSymbol,
            },
          );

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        headers: this.headers,
      });

      const initialResponse = await getResult(response, { symbol, query });

      if (!isCrypto) {
        return initialResponse;
      }

      if (initialResponse.trades) {
        return {
          symbol,
          trades: initialResponse.trades[cryptoSymbol],
          next_page_token: initialResponse.next_page_token,
        };
      } else {
        return initialResponse;
      }
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        { symbol, query },
      );
    }
  }

  // https://alpaca.markets/docs/api-references/market-data-api/stock-pricing-data/historical/#latest-trade
  async getLatestTrade(symbol: string): Promise<GetLatestTradeResult> {
    try {
      // the way we determine crypto is presence of a `/` in symbol
      const isCrypto = symbol.includes('-') || symbol.includes('/');
      const cryptoSymbol = symbol.replace('-', '/').toUpperCase();

      const apiUrl = !isCrypto
        ? `${`${this.baseUrlData}${ALPACA_API_PATH_TRADES}/latest`.replace(
            '{symbol}',
            symbol.toLowerCase(),
          )}`
        : getUrlWithQuery(
            `${this.baseUrlData}${ALPACA_API_PATH_TRADES_LATEST_CRYPTO}`,
            {
              symbols: cryptoSymbol,
            },
          );

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        headers: this.headers,
      });

      const initialResponse = await getResult(response);

      if (!isCrypto) {
        return initialResponse;
      }

      if (initialResponse.trades) {
        return {
          symbol: cryptoSymbol,
          trade: initialResponse.trades[cryptoSymbol],
        };
      } else {
        return initialResponse;
      }
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        { symbol },
      );
    }
  }

  // https://alpaca.markets/docs/api-references/market-data-api/stock-pricing-data/historical/#bars
  // and
  // https://alpaca.markets/docs/api-references/market-data-api/crypto-pricing-data/historical/#bars
  async getBars(symbol: string, query: any) {
    try {
      // the way we determine crypto is presence of a `/` in symbol
      const isCrypto = symbol.includes('-') || symbol.includes('/');
      const cryptoSymbol = symbol.replace('-', '/').toUpperCase();

      const apiUrl = !isCrypto
        ? getUrlWithQuery(
            `${`${this.baseUrlData}${ALPACA_API_PATH_BARS}`.replace(
              '{symbol}',
              symbol.toLowerCase(),
            )}`,
            query,
          )
        : getUrlWithQuery(`${this.baseUrlData}${ALPACA_API_PATH_BARS_CRYPTO}`, {
            ...query,
            symbols: cryptoSymbol,
          });

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        headers: this.headers,
      });

      const initialResponse = await getResult(response, { symbol, query });

      if (!isCrypto) {
        return initialResponse;
      }

      if (initialResponse.bars) {
        return {
          bars: initialResponse.bars[cryptoSymbol],
          next_page_token: initialResponse.next_page_token,
        };
      } else {
        return initialResponse;
      }
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        { symbol, query },
      );
    }
  }

  // https://alpaca.markets/docs/api-references/market-data-api/crypto-pricing-data/historical/#bars
  async getBarsCrypto(query: any) {
    try {
      const apiUrl = getUrlWithQuery(
        `${this.baseUrlData}${ALPACA_API_PATH_BARS_CRYPTO}`,
        query,
      );

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        headers: this.headers,
      });
      return getResult(response, { query });
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        { query },
      );
    }
  }

  // https://alpaca.markets/docs/api-references/market-data-api/stock-pricing-data/historical/#multi-bars
  async getBarsMulti(query: any) {
    try {
      const apiUrl = getUrlWithQuery(
        `${this.baseUrlData}${ALPACA_API_PATH_BARS_MULTI}`,
        query,
      );

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        headers: this.headers,
      });
      return getResult(response);
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        { query },
      );
    }
  }

  // https://alpaca.markets/docs/api-references/market-data-api/stock-pricing-data/historical/#snapshot
  async getSnapshot(symbol: string) {
    try {
      const apiUrl = `${`${this.baseUrl}${ALPACA_API_PATH_SNAPSHOT}`.replace(
        '{symbol}',
        symbol.toLowerCase(),
      )}`;

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        headers: this.headers,
      });
      return getResult(response);
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        { symbol },
      );
    }
  }

  // https://alpaca.markets/docs/api-references/market-data-api/stock-pricing-data/historical/#multi-snapshots
  async getSnapshotMulti(query: any) {
    try {
      const apiUrl = getUrlWithQuery(
        `${this.baseUrl}${ALPACA_API_PATH_SNAPSHOT_MULTI}`,
        query,
      );

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        headers: this.headers,
      });
      return getResult(response);
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        query,
      );
    }
  }

  // https://alpaca.markets/docs/api-references/trading-api/assets/
  async getAssets(query: any): Promise<Asset[] | AlpacaClientError> {
    try {
      const apiUrl = getUrlWithQuery(
        `${this.baseUrl}${ALPACA_API_PATH_ASSETS}`,
        query,
      );

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        headers: this.headers,
      });
      return getResult(response);
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        query,
      );
    }
  }

  // https://alpaca.markets/docs/api-references/trading-api/assets/
  async getAsset(symbol: string) {
    try {
      const apiUrl = `${this.baseUrl}${ALPACA_API_PATH_ASSETS}/${symbol}`;

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        headers: this.headers,
      });
      return getResult(response);
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        { symbol },
      );
    }
  }

  // https://alpaca.markets/docs/api-references/trading-api/watchlist/
  async getWatchlists() {
    try {
      const apiUrl = `${this.baseUrl}${ALPACA_API_PATH_WATCHLISTS}`;

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        headers: this.headers,
      });
      return getResult(response);
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
      );
    }
  }

  // https://alpaca.markets/docs/api-references/trading-api/watchlist/
  async getWatchlist(id: string | number) {
    try {
      const apiUrl = `${this.baseUrl}${ALPACA_API_PATH_WATCHLISTS}/${id}`;

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        headers: this.headers,
      });
      return getResult(response);
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        { id },
      );
    }
  }

  // https://alpaca.markets/docs/api-references/trading-api/watchlist/
  async createWatchlist(params: any) {
    try {
      const apiUrl = `${this.baseUrl}${ALPACA_API_PATH_WATCHLISTS}`;

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(params),
      });
      return getResult(response);
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        { params },
      );
    }
  }

  // https://alpaca.markets/docs/api-references/trading-api/watchlist/
  async updateWatchlist(id: string | number, params: any) {
    try {
      const apiUrl = `${this.baseUrl}${ALPACA_API_PATH_WATCHLISTS}/${id}`;

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify(params),
      });
      return getResult(response);
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        { params },
      );
    }
  }

  // https://alpaca.markets/docs/api-references/trading-api/watchlist/
  async addAssetToWatchlist(id: string | number, params: any) {
    try {
      const apiUrl = `${this.baseUrl}${ALPACA_API_PATH_WATCHLISTS}/${id}`;

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(params),
      });

      return getResult(response);
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        { params },
      );
    }
  }

  // https://alpaca.markets/docs/api-references/trading-api/watchlist/
  async deleteWatchlist({ id }: { id: string | number }) {
    try {
      const apiUrl = `${this.baseUrl}${ALPACA_API_PATH_WATCHLISTS}/${id}`;

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: this.headers,
      });
      return getResult(response, {
        type: 'emptyResponse',
      });
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        { id },
      );
    }
  }

  // https://alpaca.markets/docs/api-references/trading-api/watchlist/
  async removeAssetFromWatchlist(id: string | number, symbol: string) {
    try {
      const apiUrl = `${this.baseUrl}${ALPACA_API_PATH_WATCHLISTS}/${id}/${symbol}`;

      if (this.shouldLogUrl) {
        console.log('AlpacaClient', apiUrl);
      }

      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: this.headers,
      });
      return getResult(response);
    } catch (error: any) {
      return getErrorJson(
        `Alpaca API fetch fail: ${error.message || 'unknown error'}`,
        { symbol },
      );
    }
  }
}
