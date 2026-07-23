import { typeId } from '@engine/types';

/** Named typeId constants per ADR-0002 §2.1. */
export const M1 = typeId(0);
export const D2 = typeId(1);
export const I3 = typeId(2);
export const V3 = typeId(3);
export const I4 = typeId(4);
export const O4 = typeId(5);
export const L4 = typeId(6);
export const T4 = typeId(7);
export const S4 = typeId(8);
export const RS4 = typeId(9);
export const LS4 = typeId(10);
export const BR4 = typeId(11);

export const POLYCUBE_SHORT_NAMES: readonly string[] = Object.freeze([
  'M1', 'D2', 'I3', 'V3', 'I4', 'O4', 'L4', 'T4', 'S4', 'RS4', 'LS4', 'BR4',
]);
