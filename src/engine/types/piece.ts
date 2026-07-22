// per ADR-0002 rev.3 §2.1–§2.2
export type TypeId = number;
export type RotationStateId = number;
export type Vec3 = readonly [number, number, number];

export interface Piece {
  readonly typeId: TypeId;
  readonly rotationStateId: RotationStateId;
  readonly anchor: Vec3;
  readonly origin: Vec3;
  readonly cellCount: number;
}
export const SENTINEL_CELL = 0x7f;
