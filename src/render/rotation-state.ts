import type { RotationStateId, TypeId } from '@engine/types';
import { ROTATION_STATES } from '@engine/pieces/rotations';
import type { RotationState } from '@engine/pieces/rotations';
export function findRotationState(typeId: TypeId, rotationStateId: RotationStateId): RotationState { const states = ROTATION_STATES[Number(typeId)]!; return states.find((state) => Number(state.stateId) === Number(rotationStateId)) ?? states[0]!; }
