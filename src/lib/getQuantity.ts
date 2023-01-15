import AlpacaClient from './AlpacaClient';

export const getQuantity = async ({
  alpacaClient,
  buyingPower: buyingPowerParam,
  buyingPowerNonMarginable: buyingPowerNonMarginableParam,
  isCrypto,
  isFractional,
  isShort,
  maxLossPercent = 2,
  percentOfBuyingPower = 100,
  price,
  stopPrice,
}: {
  alpacaClient: AlpacaClient;
  buyingPower?: number;
  buyingPowerNonMarginable?: number;
  isCrypto?: boolean;
  isFractional?: boolean;
  isShort?: boolean;
  maxLossPercent?: number;
  percentOfBuyingPower?: number;
  price: number;
  stopPrice: number;
}) => {
  if (price === stopPrice) {
    return 0;
  }

  let buyingPower = buyingPowerParam;
  let buyingPowerNonMarginable = buyingPowerNonMarginableParam;

  if (
    typeof buyingPower !== 'number' ||
    typeof buyingPowerNonMarginable !== 'number'
  ) {
    const account = await alpacaClient.getAccount();
    buyingPower = Number(account.buying_power);
    buyingPowerNonMarginable = Number(account.non_marginable_buying_power);
  }

  const adjustedBuyingPower = !isCrypto
    ? buyingPower
    : buyingPowerNonMarginable;

  if (!adjustedBuyingPower) {
    return 0;
  }

  if (!buyingPower) {
    return 0;
  }

  // `non_marginable_buying_power` is the actual money in the account
  // while `buying_power` is the "available" money (usually
  // non_marginable_buying_power * 4)
  const availableBuyingPower =
    (percentOfBuyingPower / 100) * adjustedBuyingPower;

  const availableBuyingPowerNonMarginable =
    (percentOfBuyingPower / 100) * buyingPowerNonMarginable;

  // never risk more than 2% (`maxLossPercent`)
  const riskMoney = availableBuyingPowerNonMarginable * (maxLossPercent / 100);
  const potentialLossPerShare = !isShort
    ? price - stopPrice
    : stopPrice - price;
  const allowedUnitsOfLoss = riskMoney / potentialLossPerShare;

  let qty;

  if (allowedUnitsOfLoss * price > availableBuyingPower) {
    if (isFractional) {
      qty = availableBuyingPower / price;
    } else {
      qty = Math.floor(availableBuyingPower / price);
    }
  } else if (isFractional) {
    qty = allowedUnitsOfLoss;
  } else {
    qty = Math.floor(allowedUnitsOfLoss);
  }

  return qty;
};

export default getQuantity;
