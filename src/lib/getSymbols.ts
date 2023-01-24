import {
  ALPACA_BASE_URL,
  ALPACA_BASE_URL_DATA,
  ALPACA_API_KEY_ID,
  ALPACA_SECRET_KEY,
  MAIN_OUTPUT_DIRECTORY,
} from '../config';
import validationHighVolume from '../symbols/symbol-validations/highVolume';
import validationStandard from '../symbols/symbol-validations/standard';
import AlpacaClient from './AlpacaClient';
import createDirectory from './createDirectory';
import createJsonFile from './createJsonFile';

const { LOG_LEVEL = 'error' } = process.env;

export const getSymbols = async ({
  alpacaBaseUrl = ALPACA_BASE_URL,
  alpacaBaseUrlData = ALPACA_BASE_URL_DATA,
  alpacaApiKeyId = ALPACA_API_KEY_ID,
  alpacaSecretKey = ALPACA_SECRET_KEY,
  getFunction = 'standard',
  mainOutputDirectory = MAIN_OUTPUT_DIRECTORY,
  maxStockPrice,
  minStockPrice,
  name,
  shouldCreateFile = true,
}: {
  alpacaBaseUrl?: string;
  alpacaBaseUrlData?: string;
  alpacaApiKeyId?: string;
  alpacaSecretKey?: string;
  getFunction?: string;
  mainOutputDirectory?: string;
  maxStockPrice?: number;
  minStockPrice?: number;
  name: string;
  shouldCreateFile?: boolean;
}): Promise<string[]> => {
  const alpacaClient = new AlpacaClient(
    alpacaBaseUrl,
    alpacaBaseUrlData,
    alpacaApiKeyId,
    alpacaSecretKey,
    LOG_LEVEL.includes('verbose') && LOG_LEVEL.includes('alpaca-client'),
  );

  const assets = await alpacaClient.getAssets({
    status: 'active',
  });

  if (!Array.isArray(assets)) {
    if (assets.error) {
      throw new Error(assets.error);
    }
    throw new Error('"assets" is not an array');
  }

  const qualifiedSymbols: string[] = [];

  for (const asset of assets) {
    if (getFunction === 'standard') {
      const isQualified = await validationStandard({
        alpacaClient,
        asset,
        maxStockPrice,
        minStockPrice,
      });

      if (isQualified) {
        qualifiedSymbols.push(asset.symbol);
        console.log(asset.symbol, qualifiedSymbols.length);
      }
    } else if (getFunction === 'high-volume') {
      const isQualified = await validationHighVolume({
        alpacaClient,
        asset,
        maxStockPrice,
        minStockPrice,
      });

      if (isQualified) {
        qualifiedSymbols.push(asset.symbol);
        console.log(asset.symbol, qualifiedSymbols.length);
      }
    }
  }

  if (shouldCreateFile) {
    const outputDirectory = `${mainOutputDirectory}/symbols`;
    const outputPath = `${outputDirectory}/${name}.json`;
    createDirectory(outputDirectory);
    createJsonFile({
      content: {
        assets: qualifiedSymbols,
      },
      outputPath,
    });

    console.log(`✔️ completed`, outputPath);
  }
  return qualifiedSymbols;
};

export default getSymbols;
