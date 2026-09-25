declare module "kenat" {
  export interface EthiopianDate {
    year: number;
    month: number;
    day: number;
  }

  export function toEC(
    gYear: number,
    gMonth: number,
    gDay: number
  ): EthiopianDate;
  export function toGC(
    ethYear: number,
    ethMonth: number,
    ethDay: number
  ): { year: number; month: number; day: number };
  export function toGeez(num: number): string;
  export function toArabic(geezStr: string): number;
}
