// per ADR-0001 rev.6 §2.2 (static structure) + ADR-0002 rev.3 §2.1–§2.2
export type TypeId = number & { readonly __brand: 'TypeId' };
export type RotationStateId = number & { readonly __brand: 'RotationStateId' };

export interface Piece {
  readonly typeId: TypeId;
  readonly cellCount: number;
  /** length 12; unused slots contain SENTINEL_CELL. */
  readonly cells: Int8Array;
  /** length 3; pivot in the local frame. */
  readonly origin: Int8Array;
  readonly rotationStateId: RotationStateId;
  /** length 3; world-space position. */
  readonly anchor: Int8Array;
}
export const SENTINEL_CELL = 0x7f;

export function typeId(value: number): TypeId {
  if (!Number.isInteger(value) || value < 0 || value > 11) throw new RangeError(`TypeId out of u8 range [0, 11]: ${value}`);
  return value as TypeId;
}
export function rotationStateId(value: number): RotationStateId {
  if (!Number.isInteger(value) || value < 0 || value > 23) throw new RangeError(`RotationStateId out of range [0, 23]: ${value}`);
  return value as RotationStateId;
}
