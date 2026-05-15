import type Decimal from 'decimal.js';

export type DecimalInput = Decimal.Value;

export type CostPurchase = {
  id?: string;
  materialId: string;
  totalPrice: DecimalInput;
  totalQuantity: DecimalInput;
  date: Date;
  createdAt: Date;
};

export type CostLineItem = {
  id?: string;
  materialId: string;
  amount: DecimalInput;
  totalCost: DecimalInput;
};

export type VisitWithItems = {
  id?: string;
  date: Date;
  priceCharged: DecimalInput;
  lineItems: readonly CostLineItem[];
};

export type MaterialForAggregate = {
  id: string;
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
