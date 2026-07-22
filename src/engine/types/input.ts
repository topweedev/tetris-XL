export const enum GameAction {
  MoveXNeg = 0, MoveXPos = 1, MoveYNeg = 2, MoveYPos = 3,
  RotateYawNeg = 10, RotateYawPos = 11, RotatePitchNeg = 12, RotatePitchPos = 13,
  RotateRollNeg = 14, RotateRollPos = 15, Flip = 20,
  SoftDrop = 30, HardDrop = 31, Hold = 40, Pause = 50, Resume = 51,
}
