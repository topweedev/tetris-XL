// per ADR-0001 rev.6 §2.2 (static structure) + ADR-0002 rev.3 §2.1–§2.2
export type TypeId = number;
export type RotationStateId = number;

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

export function assertTypeId(value: number): asserts value is TypeId {
  if (!Number.isInteger(value) || value < 0 || value > 11) throw new RangeError('TypeId must be a u8 in [0, 11]');
}
