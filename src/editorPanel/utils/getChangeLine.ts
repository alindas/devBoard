export function getChangeLine(val: number): [number, number] {
  if (val < 20) {
    return [20, 0]

  } else if (val >= 20 && val < 40) {
    return [20, (val - 20) * 5]

  } else if (val >= 40 && val < 80) {
    return [40, (val - 40) * 2.5]

  } else if (val >= 80 && val < 100) {
    return [80, (val - 80) * 1.25]

  } else if (val >= 100 && val < 125) {
    return [100, val - 100]

  } else if (val >= 125) {
    return [125, (val - 125) * 1.333334]

  } else {
    return [200, 0]
  }
}
