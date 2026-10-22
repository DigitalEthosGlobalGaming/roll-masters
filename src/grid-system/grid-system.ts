import * as ex from "excalibur";
import { GridSpace } from "./grid-space";
import type { Serializable } from "@src/systems/save-system";

export class GridSystem extends ex.Actor implements Serializable {
  static serializeName: string = "GridSystem";
  private _spaces: (GridSpace | null)[] = [];

  constructor() {
    super({
      collisionType: ex.CollisionType.PreventCollision,
      width: 50,
      height: 50,
    });
    // Grid hit testing uses cell coordinates through the shared InputManager.
    this.removeComponent(ex.PointerComponent, true);
  }

  getChildObjects(): any[] {
    let children = [];
    for (let child of this.children) {
      if (child instanceof GridSpace) {
        if (child.children.length == 0) {
          continue;
        }
      }
      children.push(child);
    }
    return children;
  }

  addChildObject(child: any, data: any) {
    if (child instanceof GridSpace) {
      let index = data.gridIndex;
      if (index == null) {
        return;
      }
      this._spaces[index] = child;
      this.positionSpace(child, index);
      if (child.parent == null) {
        this.addChild(child);
      }
    }
  }

  private _spaceSize: ex.Vector = ex.vec(0, 0);
  private _size: ex.Vector = ex.vec(0, 0);

  get spaceSize(): ex.Vector {
    return this._spaceSize;
  }

  set spaceSize(size: ex.Vector) {
    if (this._spaceSize.equals(size)) return;
    this._spaceSize.setTo(size.x, size.y);
    this.positionSpaces();
  }

  get size(): ex.Vector {
    return this._size;
  }

  set size(size: ex.Vector) {
    if (size.x == this._size.x && size.y == this._size.y) {
      return;
    }
    size.x = Math.floor(size.x);
    size.y = Math.floor(size.y);
    let oldSize = this._size.clone();
    this._size = size.clone();

    let oldSpaces = this._spaces;
    let newSpaces: (GridSpace | null)[] = Array.from({ length: size.x * size.y }, () => null);

    for (let i in oldSpaces) {
      let iIndex: number = parseInt(i);
      let newPosition = new ex.Vector(
        iIndex % oldSize.x,
        Math.floor(iIndex / oldSize.x)
      );
      if (newPosition.x >= size.x || newPosition.y >= size.y) {
        oldSpaces[iIndex]?.kill();
        continue;
      }
      let newIndex = newPosition.y * size.x + newPosition.x;
      if (newIndex < newSpaces.length) {
        newSpaces[newIndex] = oldSpaces[iIndex];
      }
    }

    this._spaces = newSpaces;
    this.positionSpaces();

    // Update the bounds.
    const worldSize = this.worldSize;
    const halfWorldSize = worldSize.scale(0.5);
    const newCollider = new ex.PolygonCollider({
      points: [
        ex.vec(-halfWorldSize.x, -halfWorldSize.y),
        ex.vec(halfWorldSize.x, -halfWorldSize.y),
        ex.vec(halfWorldSize.x, halfWorldSize.y),
        ex.vec(-halfWorldSize.x, halfWorldSize.y),
      ],
    });

    this.collider.set(newCollider);
  }

  set spaces(spaces: (GridSpace | null)[]) {
    if (this.spaces.length == spaces.length) {
      return;
    }
    this._spaces = spaces;
  }
  get spaces() {
    return this._spaces;
  }

  get worldSize() {
    return this.size.clone().scale(this.spaceSize);
  }

  isInBounds(position: ex.Vector) {
    const index = this.getSpaceIndex(position);
    return index >= 0 && index < this.spaces.length;
  }

  getNeighbors(space: GridSpace): {
    left: GridSpace | null;
    right: GridSpace | null;
    top: GridSpace | null;
    bottom: GridSpace | null;
  } {
    const pos = space.gridPos;
    if (pos == null) {
      return {
        left: null,
        right: null,
        top: null,
        bottom: null,
      };
    }
    return {
      left: this.getSpace(new ex.Vector(pos.x - 1, pos.y)),
      right: this.getSpace(new ex.Vector(pos.x + 1, pos.y)),
      top: this.getSpace(new ex.Vector(pos.x, pos.y - 1)),
      bottom: this.getSpace(new ex.Vector(pos.x, pos.y + 1)),
    };
  }

  getSpaceIndex(position: ex.Vector) {
    if (
      position.x < 0 ||
      position.y < 0 ||
      position.x >= this.size.x ||
      position.y >= this.size.y
    ) {
      return -1;
    }
    return position.y * this.size.x + position.x;
  }

  createSpace() {
    let gridSpace = new GridSpace();
    gridSpace.size = this.spaceSize;
    return gridSpace;
  }

  private positionSpace(space: GridSpace, index: number): void {
    space.gridIndex = index;
    space.serializeId = `grid-space-${index}`;
    if (space.size !== this.spaceSize) space.size = this.spaceSize;
    const position = this.getSpacePositionFromIndex(index);
    const x = (position.x + 0.5) * this.spaceSize.x;
    const y = (position.y + 0.5) * this.spaceSize.y;
    if (space.pos.x !== x || space.pos.y !== y) space.pos.setTo(x, y);
  }

  private positionSpaces(): void {
    this._spaces.forEach((space, index) => { if (space) this.positionSpace(space, index); });
  }

  public getBounds(): ex.BoundingBox {
    const worldSize = this.worldSize;
    const left = this.globalPos.x;
    const top = this.globalPos.y;
    const right = left + worldSize.x;
    const bottom = top + worldSize.y;
    return new ex.BoundingBox(left, top, right, bottom);
  }

  getSpacePositionFromWorldPosition(position: ex.Vector) {
    const x = Math.floor((position.x - this.pos.x) / this.spaceSize.x);
    const y = Math.floor((position.y - this.pos.y) / this.spaceSize.y);
    if (x >= 0 && x < this.size.x && y >= 0 && y < this.size.y) {
      return new ex.Vector(x, y);
    }
    return null;
  }
  getSpacePositionFromIndex(index: number) {
    const xPos = index % this.size.x;
    const yPos = Math.floor(index / this.size.x);
    return new ex.Vector(xPos, yPos);
  }
  getSpaceFromWorldPosition(position: ex.Vector) {
    return this.getSpace(
      this.getSpacePositionFromWorldPosition(position) ?? new ex.Vector(-1, -1)
    );
  }

  getSpace<T = GridSpace>(position: ex.Vector): T | null {
    const index = this.getSpaceIndex(position);
    if (index < 0 || index >= this.spaces.length) {
      return null;
    }

    let foundSpace = this.spaces[index];
    if (foundSpace == null) {
      foundSpace = this.createSpace();
      this.addChild(foundSpace);
      this.spaces[index] = foundSpace;
    }

    this.positionSpace(foundSpace, index);

    return foundSpace as T;
  }

  serialize() {
    return {
      spaceSize: this.spaceSize,
      size: this.size,
    };
  }
  deserialize(data: any): void {
    if (data == null) {
      return;
    }
    if (data.spaceSize != null) {
      this.spaceSize = ex.vec(data.spaceSize._x, data.spaceSize._y);
    }
    if (data.size != null) {
      this.size = ex.vec(data.size._x, data.size._y);
    }
  }


  clearAll() {
    for (let entity of this.children) {
      try {
        if (entity instanceof GridSpace) {
          entity.kill();
        }
      } catch (e) {
        console.error(e);
      }
    }
  }
}
