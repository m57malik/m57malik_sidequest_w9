/*
  Week 9 — Side Quest: Debug Screen

  Course: GBDA302 | Instructors: Dr. Karen Cochrane & David Han
  Date: Mar. 26, 2026

  Controls:
    A or D (Left / Right Arrow)   Horizontal movement
    W (Up Arrow)                  Jump
    Space Bar                     Attack
    D                             Toggle debug panel

  Debug Panel Controls (panel must be open):
    G   Toggle moon gravity on/off
    H   Toggle hitboxes on/off
    S   Toggle slow motion on/off

  Tile key:
    g = groundTile.png       (surface ground)
    d = groundTileDeep.png   (deep ground, below surface)
      = empty (no sprite)
*/

let player;
let playerImg, bgImg;
let jumpSfx, musicSfx;
let musicStarted = false;

let playerAnis = {
  idle: { row: 0, frames: 4, frameDelay: 10 },
  run: { row: 1, frames: 4, frameDelay: 3 },
  jump: { row: 2, frames: 3, frameDelay: Infinity, frame: 0 },
  attack: { row: 3, frames: 6, frameDelay: 2 },
};

let ground, groundDeep;
let groundImg, groundDeepImg;

let attacking = false;
let attackFrameCounter = 0;

// --- TILE MAP ---
let level = [
  "              ",
  "              ",
  "              ",
  "              ",
  "              ",
  "       ggg    ",
  "gggggggggggggg",
  "dddddddddddddd",
];

// --- LEVEL CONSTANTS ---
const VIEWW = 320, VIEWH = 180;
const TILE_W = 24,  TILE_H = 24;
const FRAME_W = 32, FRAME_H = 32;
const MAP_START_Y = VIEWH - TILE_H * 4;
const GRAVITY = 10;
const MOON_GRAVITY = 2;

// --- DEBUG STATE ---
let debugMode    = false;
let moonGravity  = false;
let showHitboxes = false;
let slowMotion   = false;
let frameSkipCount = 0;

// =============================================================================
function preload() {
  playerImg     = loadImage("assets/foxSpriteSheet.png");
  bgImg         = loadImage("assets/combinedBackground.png");
  groundImg     = loadImage("assets/groundTile.png");
  groundDeepImg = loadImage("assets/groundTileDeep.png");

  if (typeof loadSound === "function") {
    jumpSfx  = loadSound("assets/sfx/jump.wav");
    musicSfx = loadSound("assets/sfx/music.wav");
  }
}

// =============================================================================
function setup() {
  new Canvas(VIEWW, VIEWH, "pixelated");
  allSprites.pixelPerfect = true;
  world.gravity.y = GRAVITY;

  if (musicSfx) musicSfx.setLoop(true);
  startMusicIfNeeded();

  // --- TILE GROUPS ---
  ground = new Group();
  ground.physics = "static";
  ground.img = groundImg;
  ground.tile = "g";

  groundDeep = new Group();
  groundDeep.physics = "static";
  groundDeep.img = groundDeepImg;
  groundDeep.tile = "d";

  new Tiles(level, 0, 0, TILE_W, TILE_H);

  // --- PLAYER ---
  player = new Sprite(FRAME_W, MAP_START_Y, FRAME_W, FRAME_H);
  player.spriteSheet = playerImg;
  player.rotationLock = true;
  player.anis.w = FRAME_W;
  player.anis.h = FRAME_H;
  player.anis.offset.y = -4;
  player.addAnis(playerAnis);
  player.ani = "idle";
  player.w = 18;
  player.h = 20;
  player.friction = 0;
  player.bounciness = 0;

  // --- GROUND SENSOR ---
  sensor = new Sprite();
  sensor.x = player.x;
  sensor.y = player.y + player.h / 2;
  sensor.w = player.w;
  sensor.h = 2;
  sensor.mass = 0.01;
  sensor.removeColliders();
  sensor.visible = false;
  let sensorJoint = new GlueJoint(player, sensor);
  sensorJoint.visible = false;
}

// =============================================================================
function startMusicIfNeeded() {
  if (musicStarted || !musicSfx) return;
  const startLoop = () => {
    if (!musicSfx.isPlaying()) musicSfx.play();
    musicStarted = musicSfx.isPlaying();
  };
  const maybePromise = userStartAudio();
  if (maybePromise && typeof maybePromise.then === "function") {
    maybePromise.then(startLoop).catch(() => {});
  } else {
    startLoop();
  }
}

// =============================================================================
function keyPressed() {
  startMusicIfNeeded();

  // Toggle debug panel
  if (key === "d" || key === "D") {
    debugMode = !debugMode;
    return;
  }

  // Debug toggles — only when panel is open
  if (debugMode) {
    if (key === "g" || key === "G") {
      moonGravity = !moonGravity;
      world.gravity.y = moonGravity ? MOON_GRAVITY : GRAVITY;
    }
    if (key === "h" || key === "H") {
      showHitboxes = !showHitboxes;
    }
    if (key === "s" || key === "S") {
      slowMotion = !slowMotion;
    }
  }
}

function mousePressed() {
  startMusicIfNeeded();
}

function touchStarted() {
  startMusicIfNeeded();
  return false;
}

// =============================================================================
function draw() {
  // --- SLOW MOTION ---
  if (slowMotion) {
    frameSkipCount++;
    world.timeScale = (frameSkipCount % 2 === 0) ? 0 : 1;
  } else {
    world.timeScale = 1;
    frameSkipCount  = 0;
  }

  // --- BACKGROUND ---
  camera.off();
  imageMode(CORNER);
  image(bgImg, 0, 0, bgImg.width, bgImg.height);
  camera.on();

  // --- PLAYER CONTROLS ---
  let grounded = sensor.overlapping(ground);

  // -- ATTACK INPUT --
  if (grounded && !attacking && kb.presses("space")) {
    attacking = true;
    attackFrameCounter = 0;
    player.vel.x = 0;
    player.ani.frame = 0;
    player.ani = "attack";
    player.ani.play();
  }

  // -- JUMP --
  if (grounded && kb.presses("up")) {
    player.vel.y = moonGravity ? -3 : -4;
    if (jumpSfx) jumpSfx.play();
  }

  // --- STATE MACHINE ---
  if (attacking) {
    attackFrameCounter++;
    if (attackFrameCounter > 12) {
      attacking = false;
      attackFrameCounter = 0;
    }
  } else if (!grounded) {
    player.ani = "jump";
    player.ani.frame = player.vel.y < 0 ? 0 : 1;
  } else {
    player.ani = kb.pressing("left") || kb.pressing("right") ? "run" : "idle";
  }

  // --- MOVEMENT ---
  if (!attacking) {
    player.vel.x = 0;
    if (kb.pressing("left")) {
      player.vel.x = -1.5;
      player.mirror.x = true;
    } else if (kb.pressing("right")) {
      player.vel.x = 1.5;
      player.mirror.x = false;
    }
  }

  // --- KEEP IN VIEW ---
  player.pos.x = constrain(player.pos.x, FRAME_W / 2, VIEWW - FRAME_W / 2);

  // --- HITBOXES ---
  if (showHitboxes) drawHitboxes();

  // --- DEBUG PANEL ---
  camera.off();
  drawDebugPanel();
  camera.on();
}

// =============================================================================
// HITBOX OVERLAY
// =============================================================================
function drawHitboxes() {
  noFill();
  rectMode(CENTER);
  strokeWeight(0.5);

  stroke(0, 255, 80);
  rect(player.pos.x, player.pos.y, player.w, player.h);

  stroke(255, 255, 0);
  rect(sensor.pos.x, sensor.pos.y, sensor.w, sensor.h);

  stroke(0, 220, 255);
  for (let s of ground)     rect(s.pos.x, s.pos.y, s.w, s.h);
  for (let s of groundDeep) rect(s.pos.x, s.pos.y, s.w, s.h);

  noStroke();
  rectMode(CORNER);
}

// =============================================================================
// DEBUG PANEL
// =============================================================================
function drawDebugPanel() {
  if (!debugMode) {
    // "Press D" hint — drawn in top right corner so it's always visible
    noStroke();
    textAlign(RIGHT);
    textSize(11);
    fill(0, 0, 0, 220);
    text("Press D for Debug Screen", VIEWW - 3, 13);
    fill(255, 255, 0, 255);
    text("Press D for Debug Screen", VIEWW - 4, 12);
    return;
  }

  // Panel fills the full canvas height so nothing ever gets cut off
  noStroke();
  fill(0, 0, 0, 215);
  rect(2, 2, 162, VIEWH - 4, 4);

  // Title
  textAlign(LEFT);
  textSize(12);
  fill(0, 0, 0, 200);
  text("DEBUG PANEL", 11, 19);
  fill(255, 220, 60);
  text("DEBUG PANEL", 10, 18);

  // Divider
  stroke(255, 255, 255, 80);
  strokeWeight(0.5);
  line(10, 23, 160, 23);
  noStroke();

  // Toggle rows
  let y = 36;
  debugRow(10, y, "G  Moon Gravity", moonGravity,  moonGravity  ? "ON" : "OFF"); y += 16;
  debugRow(10, y, "H  Hitboxes",     showHitboxes, showHitboxes ? "ON" : "OFF"); y += 16;
  debugRow(10, y, "S  Slow Motion",  slowMotion,   slowMotion   ? "ON" : "OFF"); y += 20;

  // Live readouts
  textSize(9);
  fill(0, 0, 0, 200); text("X:       " + nf(player.pos.x, 3, 1), 11, y + 1);
  fill(180, 215, 255); text("X:       " + nf(player.pos.x, 3, 1), 10, y); y += 12;

  fill(0, 0, 0, 200); text("Y:       " + nf(player.pos.y, 3, 1), 11, y + 1);
  fill(180, 215, 255); text("Y:       " + nf(player.pos.y, 3, 1), 10, y); y += 12;

  fill(0, 0, 0, 200); text("Vel X:   " + nf(player.vel.x, 1, 2), 11, y + 1);
  fill(180, 215, 255); text("Vel X:   " + nf(player.vel.x, 1, 2), 10, y); y += 12;

  fill(0, 0, 0, 200); text("Gravity: " + (moonGravity ? "MOON" : "NORMAL"), 11, y + 1);
  fill(255, 210, 100); text("Gravity: " + (moonGravity ? "MOON" : "NORMAL"), 10, y);
}

function debugRow(x, y, label, active, statusText) {
  textSize(9);
  textAlign(LEFT);
  fill(0, 0, 0, 200);
  text(label, x + 1, y + 1);
  fill(225, 225, 225);
  text(label, x, y);

  let pillX = 108;
  fill(active ? color(40, 185, 80) : color(185, 50, 50));
  rect(pillX, y - 8, 36, 11, 3);
  fill(0, 0, 0, 150);
  textSize(8);
  textAlign(CENTER);
  text(statusText, pillX + 18 + 1, y + 1);
  fill(255);
  text(statusText, pillX + 18, y);
  textAlign(LEFT);
}
