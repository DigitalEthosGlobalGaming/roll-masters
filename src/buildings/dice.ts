import { Building } from "@src/building";
import { Environment, Settings } from "@src/env";
import { Resources } from "@src/resources";
import { Serializable } from "@src/systems/save-system";
import { random } from "@src/utility/random";
import * as ex from "excalibur";
import { diceFrameDurations, diceSettleDuration, diceSettlePose, diceTumblePose, restingDicePose } from "./dice-feedback";
import { DiceBoostFeedback } from "./dice-boost-feedback";

const possibleRolls: { [key: number]: { [face: number]: number[][] } } = {};
const totalPossibleRolls = 100;

function getNewRoll(faces: number[], lastNumber: number): number {
  const tempFaces = [...faces].filter((f) => f != lastNumber);
  if (faces.length === 0) {
    return -1;
  }
  return random.fromArray(tempFaces);
}

export const diceResources = [
  Resources.DiceEmpty,
  Resources.Dice1,
  Resources.Dice2,
  Resources.Dice3,
  Resources.Dice4,
  Resources.Dice5,
  Resources.Dice6,
];

function getPossibleRolls(faces: number): typeof possibleRolls[number] {
  if (faces in possibleRolls) {
    return possibleRolls[faces];
  }
  possibleRolls[faces] = {};

  let diceFaces = [];
  for (let i = 0; i < faces; i++) {
    diceFaces.push(i + 1);
  }

  let rollsPerItem = Math.floor(totalPossibleRolls / faces);
  for (let face = 1; face <= faces; face++) {

    if (possibleRolls[faces][face] == null) {
      possibleRolls[faces][face] = [];
    }
    for (let i = 0; i < rollsPerItem; i++) {
      const roll = [];
      const totalRolls = Math.floor(Math.random() * 5 + 10);
      for (let i = 0; i < totalRolls; i++) {
        const newNumber = getNewRoll(diceFaces, random.integer(1, faces));
        roll.push(newNumber);
      }
      roll[roll.length - 2] = getNewRoll(diceFaces, roll[roll.length - 1]);
      roll[roll.length - 1] = face;


      possibleRolls[faces][face].push(roll);
    }
  }
  return possibleRolls[faces];
}

function getRandomRoll(faces: number, face?: number): number[] {
  const diceFaces = getPossibleRolls(faces);
  face = face ?? random.integer(1, faces);
  return random.fromArray(diceFaces[face]);
}

const maxRollDuration = 1000;
const minRollDuration = 900

function getRollAnimation(faces: number, speed: number, face: number) {
  speed = speed ?? 1;

  const sprites = diceResources.map((r) => {
    const sprite = ex.Sprite.from(r);
    sprite.width = 24;
    sprite.height = 24;
    return sprite;
  });

  const diceNumbers = getRandomRoll(faces, face);
  const frameData: {
    number: number;
    duration: number;
  }[] = [];

  const totalDuration = random.number(minRollDuration, maxRollDuration) / speed;
  const durations = diceFrameDurations(diceNumbers.length, totalDuration);

  for (const i in diceNumbers) {
    const newNumber = diceNumbers[i];
    const duration = durations[Number(i)];

    frameData.push({
      number: newNumber,
      duration: duration,
    });
  }

  const animation = new ex.Animation({
    frames: frameData.map((item) => {
      const graphic = sprites[item.number];
      return {
        graphic: graphic,
        duration: item.duration,
      };
    }),
    speed: 1,
    strategy: ex.AnimationStrategy.Freeze,
  });
  return { numbers: diceNumbers, animation: animation, duration: totalDuration };
}

function getRandomRollAnimation(
  faces: number,
  speed: number,
  weight: number
): {
  animation: ex.Animation;
  numbers: number[];
  duration: number;
} {
  let face = Math.min(random.integer(1, faces + weight), 6);
  return getRollAnimation(faces, speed, face)
}

export class Dice extends Building implements Serializable {
  static serializeName: string = "Dice";
  friendlyName: string = "Dice";
  rolling: boolean = false;
  private _faces: number = 6;
  private _speed: number = 1;
  private _value: number = 0;
  private _multiplier: number = 1;
  private feedbackElapsed = diceSettleDuration;
  private feedbackRollDuration = 1;
  private feedbackDirection = 1;
  private reducedMotion?: MediaQueryList;
  private readonly boostFeedback = new DiceBoostFeedback();
  private boostReadout?: ex.Text;
  private readonly boostGold = ex.Color.fromHex("#ffd878");

  private get quietMotion(): boolean {
    return Environment.get("graphics") === Settings.graphics.basic || !!Environment.get("reduced-motion") || this.reducedMotion?.matches === true;
  }

  private _weight: number = -1;
  get weight(): number {
    return this._weight;
  }
  set weight(value: number) {
    this._weight = value;
  }

  get tooltip() {
    let str = `Click to roll`;
    if (this.multiplier != 1) {
      str += `\nx${this.multiplier} Multi`;
    }
    return str;
  }

  get multiplier(): number {
    return this._multiplier;
  }
  set multiplier(value: number) {
    const previous = this._multiplier;
    this._multiplier = Math.round(value * 10) / 10;
    this.boostFeedback.boost(this._multiplier - previous);
    if (this.boostReadout) this.boostReadout.text = `x${this._multiplier}`;
    const clampedValue = Math.min(10, Math.max(0, value));
    const yellowIntensity = Math.floor((clampedValue / 10) * 255);
    this.color = ex.Color.fromRGB(255, 255, 255 - yellowIntensity);
  }

  get faces(): number {
    return this._faces;
  }

  set faces(value: number) {
    if (value <= 1) {
      throw new Error("Faces must be greater than 1");
    }
    value = Math.floor(value);
    if (value == this._faces) {
      return;
    }
    this._faces = value;
  }

  get rollSpeed(): number {
    return this._speed;
  }

  set rollSpeed(value: number) {
    if (value <= 0) {
      throw new Error("Speed must be greater than 0");
    }
    this._speed = value;
  }

  get value(): number {
    return this._value;
  }

  set value(value: number) {
    this._value = value;
  }

  set wishScale(value: number) {
    if (this.rolling) {
      return;
    }
    this._wishScale = value;
  }

  get wishScale(): number {
    return this._wishScale;
  }
  onInitialize(engine: ex.Engine): void {
    super.onInitialize(engine);
    this.player.unlockAction("NEWROLLER");
    this.reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
    this.boostReadout = new ex.Text({
      text: `x${this.multiplier}`,
      color: this.boostGold,
      font: new ex.Font({
        family: "sans-serif", size: 7, bold: true,
        textAlign: ex.TextAlign.Center, baseAlign: ex.BaseAlign.Middle,
        shadow: { offset: ex.vec(0, 1), blur: 2, color: ex.Color.Black },
      }),
    });
    this.graphics.onPreDraw = (ctx, elapsed) => {
      ctx.save();
      const boost = this.boostFeedback.pose(this.quietMotion);
      if (boost.ringOpacity > 0) {
        ctx.drawCircle(ex.Vector.Zero, boost.ringRadius, ex.Color.Transparent,
          ex.Color.fromRGB(255, 216, 120, boost.ringOpacity), 1);
      }
      // Newly selected roll faces must retain the stored multiplier's tint too.
      if (this.graphics.current instanceof ex.Sprite) this.graphics.current.tint = this.color;
      this.feedbackElapsed += elapsed;
      const pose = this.quietMotion ? restingDicePose : this.rolling
        ? diceTumblePose(this.feedbackElapsed / this.feedbackRollDuration, this.feedbackDirection)
        : diceSettlePose(this.feedbackElapsed, this.value === 6);
      ctx.translate(pose.x, pose.y);
      ctx.rotate(pose.rotation);
      ctx.scale(pose.scaleX, pose.scaleY);
      ctx.translate(0, boost.y);
      ctx.scale(boost.scaleX, boost.scaleY);
    };
    this.graphics.onPostDraw = ctx => {
      ctx.restore();
      const boost = this.boostFeedback.pose(this.quietMotion);
      if (this.multiplier > 1 && boost.readoutOpacity > 0 && this.boostReadout) {
        ctx.save();
        ctx.opacity *= boost.readoutOpacity;
        this.boostReadout.draw(ctx, 0, -16);
        ctx.restore();
      }
    };

    for (const i in diceResources) {
      const sprite = ex.Sprite.from(diceResources[i]);
      sprite.width = 24;
      sprite.height = 24;
      this.graphics.add('roll-' + i, sprite);
    }
    if (Environment.get("graphics") == Settings.graphics.basic) {
      this.graphics.use('roll-0');
    }

  }
  onPreUpdate(engine: ex.Engine, elapsed: number): void {
    this.boostFeedback.advance(elapsed);
    super.onPreUpdate(engine, elapsed);
  }

  serialize() {
    return {
      faces: this.faces,
      speed: this.rollSpeed,
      value: this.value,
      pos: this.pos,
    };
  }
  deserialize(data: any): void {
    this.rollSpeed = data.rollSpeed;
    this.faces = data.faces;
    this.value = data.value;
    this.pos = ex.vec(data.pos._x, data.pos._y);
  }

  postDeserialize(): void {
    try {
      let rollAnimation = getRandomRollAnimation(
        this.faces,
        this.rollSpeed,
        this.weight
      );
      const lastFrame =
        rollAnimation.animation.frames[
          rollAnimation.animation.frames.length - 1
        ]?.graphic;

      if (lastFrame == null) {
        return;
      }

      this.graphics.add("roll", lastFrame);
      this.graphics.use("roll");
    } catch (e) {
      console.error(e);
    }
  }

  onTrigger() {
    this.rollDice();
  }

  onBuild(): void {
    this.rollDice();
  }

  rollBasic() {
    let randomAmount = random.number(740, 1000);
    this.tickRate = randomAmount;
    this.nextTick = randomAmount;
    this.rolling = true;
  }

  onTick(_delta: number): void {
    const value = Math.min(random.integer(1, this.faces + this.weight), 6);
    this.value = value;
    this.tickRate = -1;

    this.graphics.use("roll-" + value);
    this.onRollFinish();
  }
  rollDice() {
    if (this.rolling) {
      return;
    }
    if (this.faces <= 1) {
      return;
    }
    if (this.rollSpeed <= 0) {
      return;
    }
    if (this.weight == -1) {
      this.weight = this.player.getUpgrade("DiceWeight")?.value ?? 0;
    }


    if (Environment.get("graphics") == Settings.graphics.basic) {
      this.rollBasic();
      return;
    }
    this.rolling = true;
    const speed = this.rollSpeed;
    const faces = this.faces;
    const roll = getRandomRollAnimation(faces, speed, this.weight);
    const animation = roll.animation;
    this.feedbackElapsed = 0;
    this.feedbackRollDuration = roll.duration;
    this.feedbackDirection = this.feedbackDirection * -1;
    this.value = roll.numbers[roll.numbers.length - 1];

    this.graphics.add("roll", animation, {});
    this.graphics.use("roll");
    animation.events.once("end", () => {
      this.onRollFinish();
      if (animation.currentFrame?.graphic != null) {
        this.graphics.add("roll", animation.currentFrame?.graphic);
        this.graphics.use("roll");
      }
    });
  }

  onRollFinish() {
    this.rolling = false;
    this.feedbackElapsed = 0;
    this.wishScale = 1;
    let score = this.player.getUpgrade("BetterDice")?.value ?? 0;
    let totalScore = Math.floor(this.value * this.multiplier) + score;
    this.multiplier = 1;
    this.player.scoreComponent.createScore(this, totalScore);
  }
}
