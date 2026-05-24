import type Decimal from 'decimal.js';

export type DecimalInput = Decimal.Value;

export type StockPurchase = {
  id?: string;
  materialId: string;
  totalQuantity: DecimalInput;
};

export type CostPurchase = StockPurchase & {
  totalPrice: DecimalInput;
  date: Date;
  createdAt: Date;
};

export type StockLineItem = {
  id?: string;
  materialId: string;
  amount: DecimalInput;
};

export type CostLineItem = StockLineItem & {
  totalCost: DecimalInput;
};

export type VisitWithItems = {
  id?: string;
  date: Date;
  priceCharged: DecimalInput;
  lineItems: readonly CostLineItem[];
};

export type PeriodRange = [Date, Date];

export type PeriodTotals = {
  count: number;
  revenue: Decimal;
  cost: Decimal;
  net: Decimal;
};

export type MaterialAggregate = {
  purchased: Decimal;
  used: Decimal;
  remaining: Decimal;
};
