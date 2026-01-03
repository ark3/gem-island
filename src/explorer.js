export function rr(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function circle(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
}

export function fillPath(ctx, color) {
  ctx.fillStyle = color;
  ctx.fill();
}

export function strokePath(ctx, lw) {
  ctx.lineWidth = lw;
  ctx.strokeStyle = "#000";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

export function drawExplorer(ctx, x, y, scale = 1, opts = {}) {
  const palette = {
    skin: opts.skin ?? "#f3d2b4",
    hairPink: opts.hairPink ?? "#ff6fb1",
    hairPurple: opts.hairPurple ?? "#8b5cf6",
    tieBlue: opts.tieBlue ?? "#3b82f6",
    shirtPink: opts.shirtPink ?? "#ff6fb1",
    skirtPurple: opts.skirtPurple ?? "#8b5cf6",
    glovePurple: opts.glovePurple ?? "#8b5cf6",
    shoePink: opts.shoePink ?? "#ff6fb1",
  };

  const lw = 3 * scale;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const headR = 22;
  const headCx = 0;
  const headCy = -90;

  const bodyW = 38;
  const bodyH = 32;
  const bodyX = -bodyW / 2;
  const bodyY = -70;

  const skirtTopW = 38;
  const skirtBotW = 50;
  const skirtH = 22;
  const skirtY = bodyY + bodyH - 2;

  const armW = 10;
  const armH = 26;
  const armY = bodyY + 6;

  const legW = 10;
  const legH = 20;
  const legY = skirtY + skirtH - 2;

  const shoeW = 16;
  const shoeH = 10;
  const shoeY = legY + legH - 2;

  circle(ctx, headCx, headCy, headR);
  fillPath(ctx, palette.skin);

  ctx.beginPath();
  ctx.arc(headCx, headCy, headR + 1, Math.PI * 1.05, Math.PI * 1.95);
  ctx.lineTo(headCx - 10, headCy - 4);
  ctx.lineTo(headCx + 10, headCy - 4);
  ctx.closePath();
  fillPath(ctx, palette.hairPurple);

  function braid(side) {
    const sx = side * 24;
    const topY = headCy - 2;
    const segR = 8;
    const dy = 12;

    for (let i = 0; i < 4; i += 1) {
      const cy = topY + i * dy;
      circle(ctx, sx, cy, segR);
      fillPath(ctx, i % 2 === 0 ? palette.hairPink : palette.hairPurple);
    }

    circle(ctx, sx, topY + 3 * dy + 10, 5);
    fillPath(ctx, palette.tieBlue);
  }
  braid(-1);
  braid(1);

  rr(ctx, bodyX, bodyY, bodyW, bodyH, 10);
  fillPath(ctx, palette.shirtPink);

  rr(ctx, bodyX - armW + 2, armY, armW, armH, 6);
  fillPath(ctx, palette.skin);
  rr(ctx, bodyX + bodyW - 2, armY, armW, armH, 6);
  fillPath(ctx, palette.skin);

  rr(ctx, bodyX - armW + 1, armY + armH - 6, armW + 2, 10, 5);
  fillPath(ctx, palette.glovePurple);
  rr(ctx, bodyX + bodyW - 3, armY + armH - 6, armW + 2, 10, 5);
  fillPath(ctx, palette.glovePurple);

  ctx.beginPath();
  ctx.moveTo(-skirtTopW / 2, skirtY);
  ctx.lineTo(skirtTopW / 2, skirtY);
  ctx.lineTo(skirtBotW / 2, skirtY + skirtH);
  ctx.lineTo(-skirtBotW / 2, skirtY + skirtH);
  ctx.closePath();
  fillPath(ctx, palette.skirtPurple);

  rr(ctx, -16, legY, legW, legH, 5);
  fillPath(ctx, palette.skin);
  rr(ctx, 6, legY, legW, legH, 5);
  fillPath(ctx, palette.skin);

  rr(ctx, -18, shoeY, shoeW, shoeH, 5);
  fillPath(ctx, palette.shoePink);
  rr(ctx, 4, shoeY, shoeW, shoeH, 5);
  fillPath(ctx, palette.shoePink);

  circle(ctx, headCx, headCy, headR);
  strokePath(ctx, lw);

  ctx.beginPath();
  ctx.arc(headCx, headCy, headR + 1, Math.PI * 1.05, Math.PI * 1.95);
  ctx.lineTo(headCx - 10, headCy - 4);
  ctx.lineTo(headCx + 10, headCy - 4);
  ctx.closePath();
  strokePath(ctx, lw);

  function braidStroke(side) {
    const sx = side * 24;
    const topY = headCy - 2;
    const segR = 8;
    const dy = 12;

    for (let i = 0; i < 4; i += 1) {
      const cy = topY + i * dy;
      circle(ctx, sx, cy, segR);
      strokePath(ctx, lw);
    }
    circle(ctx, sx, topY + 3 * dy + 10, 5);
    strokePath(ctx, lw);
  }
  braidStroke(-1);
  braidStroke(1);

  rr(ctx, bodyX, bodyY, bodyW, bodyH, 10);
  strokePath(ctx, lw);

  rr(ctx, bodyX - armW + 2, armY, armW, armH, 6);
  strokePath(ctx, lw);
  rr(ctx, bodyX + bodyW - 2, armY, armW, armH, 6);
  strokePath(ctx, lw);
  rr(ctx, bodyX - armW + 1, armY + armH - 6, armW + 2, 10, 5);
  strokePath(ctx, lw);
  rr(ctx, bodyX + bodyW - 3, armY + armH - 6, armW + 2, 10, 5);
  strokePath(ctx, lw);

  ctx.beginPath();
  ctx.moveTo(-skirtTopW / 2, skirtY);
  ctx.lineTo(skirtTopW / 2, skirtY);
  ctx.lineTo(skirtBotW / 2, skirtY + skirtH);
  ctx.lineTo(-skirtBotW / 2, skirtY + skirtH);
  ctx.closePath();
  strokePath(ctx, lw);

  rr(ctx, -16, legY, legW, legH, 5);
  strokePath(ctx, lw);
  rr(ctx, 6, legY, legW, legH, 5);
  strokePath(ctx, lw);
  rr(ctx, -18, shoeY, shoeW, shoeH, 5);
  strokePath(ctx, lw);
  rr(ctx, 4, shoeY, shoeW, shoeH, 5);
  strokePath(ctx, lw);

  ctx.fillStyle = "#000";
  circle(ctx, -7, headCy - 2, 2.2);
  ctx.fill();
  circle(ctx, 7, headCy - 2, 2.2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, headCy + 7, 7, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = lw * 0.6;
  ctx.stroke();

  ctx.restore();
}

export function drawExplorerIcon(ctx, x, y, scale = 1, opts = {}) {
  const palette = {
    skin: opts.skin ?? "#f3d2b4",
    hairPink: opts.hairPink ?? "#ff6fb1",
    hairPurple: opts.hairPurple ?? "#8b5cf6",
    tieBlue: opts.tieBlue ?? "#3b82f6",
  };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const headR = 18;
  const headCx = 0;
  const headCy = 0;

  circle(ctx, headCx, headCy, headR);
  fillPath(ctx, palette.skin);

  ctx.beginPath();
  ctx.arc(headCx, headCy, headR + 1, Math.PI * 1.05, Math.PI * 1.95);
  ctx.lineTo(headCx - 9, headCy - 3);
  ctx.lineTo(headCx + 9, headCy - 3);
  ctx.closePath();
  fillPath(ctx, palette.hairPurple);

  function braid(side) {
    const sx = side * 18;
    const topY = headCy - 4;
    const segR = 6;
    const dy = 9;
    for (let i = 0; i < 3; i += 1) {
      const cy = topY + i * dy;
      circle(ctx, sx, cy, segR);
      fillPath(ctx, i % 2 === 0 ? palette.hairPink : palette.hairPurple);
    }
    circle(ctx, sx, topY + 3 * dy - 2, 4);
    fillPath(ctx, palette.tieBlue);
  }
  braid(-1);
  braid(1);

  circle(ctx, headCx, headCy, headR);
  strokePath(ctx, 3);

  ctx.beginPath();
  ctx.arc(headCx, headCy, headR + 1, Math.PI * 1.05, Math.PI * 1.95);
  ctx.lineTo(headCx - 9, headCy - 3);
  ctx.lineTo(headCx + 9, headCy - 3);
  ctx.closePath();
  strokePath(ctx, 3);

  function braidStroke(side) {
    const sx = side * 18;
    const topY = headCy - 4;
    const segR = 6;
    const dy = 9;
    for (let i = 0; i < 3; i += 1) {
      const cy = topY + i * dy;
      circle(ctx, sx, cy, segR);
      strokePath(ctx, 3);
    }
    circle(ctx, sx, topY + 3 * dy - 2, 4);
    strokePath(ctx, 3);
  }
  braidStroke(-1);
  braidStroke(1);

  ctx.fillStyle = "#000";
  circle(ctx, headCx - 6, headCy - 2, 2);
  ctx.fill();
  circle(ctx, headCx + 6, headCy - 2, 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(headCx, headCy + 5, 5, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}
