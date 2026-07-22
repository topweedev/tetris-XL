export type TypeId = 'M1' | 'D2' | 'I3' | 'V3' | 'I4' | 'O4' | 'L4' | 'T4' | 'S4' | 'RS4' | 'LS4' | 'BR4';
export type Vec3 = readonly [number, number, number];

export interface Piece {
  readonly typeId: TypeId;
  readonly rotationStateId: number;
  readonly anchor: Vec3;
  readonly origin: Vec3;
  /** Twelve entries: xyz offsets, terminated by 0x7F sentinels. */
  readonly cells: Int8Array;
}
