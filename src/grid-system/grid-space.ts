import * as ex from "excalibur";
import type { Serializable } from "@src/systems/save-system";
import { GridSystem } from "./grid-system";

// Cells are transform/serialization containers. The cached board draws them,
// and InputManager locates them by coordinates; they need no actor systems.
export class GridSpace extends ex.Entity implements Serializable {
  readonly transform = new ex.TransformComponent();

  constructor() {
    super();
    this.addComponent(this.transform);
  }

  get pos(): ex.Vector { return this.transform.pos; }
  set pos(value: ex.Vector) { this.transform.pos = value; }
  get globalPos(): ex.Vector { return this.transform.globalPos; }
  static serializeName: string = "GridSpace";
  serializeId?: string | undefined;
  _gridPos: ex.Vector | null = null;
  get gridPos(): ex.Vector | null {
    let index = this._gridIndex;
    if (index == -1) {
      return null;
    }
    if (this._gridPos == null) {
      this._gridPos = this.grid?.getSpacePositionFromIndex(index) ?? null;
    }
    return this._gridPos;
  }

  _gridIndex: number = -1;
  get gridIndex(): number {
    return this._gridIndex;
  }

  set gridIndex(newIndex: number) {
    if (this._gridIndex === newIndex) return;
    this._gridPos = null;
    this._gridIndex = newIndex;
  }

  get grid(): GridSystem | null {
    if (this.parent instanceof GridSystem) {
      return this.parent;
    }
    throw new Error("GridSpace has no grid");
  }
  private _size = new ex.Vector(32, 32);
  get size(): ex.Vector {
    return this._size;
  }
  set size(newSize: ex.Vector) {
    this._size = newSize;
    this._gridPos = null;
  }

  getNeighbors(): ReturnType<GridSystem["getNeighbors"]> {
    if (this.grid == null) {
      return {
        left: null,
        right: null,
        top: null,
        bottom: null,
      };
    }
    return this.grid.getNeighbors(this);
  }

  handleClick: () => void = () => { };

  getBounds(): ex.BoundingBox {
    return new ex.BoundingBox(
      this.globalPos.x,
      this.globalPos.y,
      this.globalPos.x + this.size.x,
      this.globalPos.y + this.size.y
    );
  }

  serialize() {
    return {
      gridIndex: this.gridIndex,
    };
  }
  deserialize(data: any): void {
    this.gridIndex = data.gridIndex;
  }
}
