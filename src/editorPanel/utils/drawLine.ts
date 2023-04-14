/**
 *
 * @param {*} ctx
 * @param {*} x0 起始点
 * @param {*} y0
 * @param {*} x1 终止点
 * @param {*} y1
 */
export function drawLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
