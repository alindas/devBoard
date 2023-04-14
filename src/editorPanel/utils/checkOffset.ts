/**
 *
 * @param {number} t 判断原值
 * @param {number} o 差补值
 * @returns 原值是否在±差补值间
 */
export function checkOffset(t: number, o: number) {
  return t > -o && t < o;
}
