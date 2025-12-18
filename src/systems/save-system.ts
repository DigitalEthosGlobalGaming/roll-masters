import { Component, Entity, Scene, System, SystemType } from "excalibur";
import { isArray } from "@src/utility/is-array";
import { isString } from "@src/utility/is-string";

export interface Serializable {
  serialize(): any;
  deserialize(data: any): void;
  serializeId?: string;
  getChildObjects?(): any[];
  addChildObject?(obj: any, data: any): void;
  preSerialize?(): void;
  postSerialize?(data: SerialisedObject): void;
  preDeserialize?(): void;
  postDeserialize?(data: SerialisedObject): void;
}

function isSerializable(obj: any): obj is Serializable {
  if (obj == null) {
    return false;
  }
  return obj.serialize !== undefined && obj.deserialize !== undefined;
}

export type SerializableObject = (Entity | Scene | Component) & Serializable;

export type LoadOptions = {
  obj: Scene;
  data: string | object;
};

export type SerialisedObject = {
  className: string;
  id: string;
  parentId: string;
  data: any;
  ref?: SerializableObject;
  isInScene: boolean;
  children: string[];
};

type SerializeState = {
  itemIndexes: Record<string, number>;
  rootItems: number[];
  items: SerialisedObject[];
};

type SerializedData = {
  object: SerialisedObject | null;
  children: SerializedData[];
};

function getChildren(obj: SerializableObject | Scene) {
  if (isSerializable(obj)) {
    if (obj.getChildObjects != null) {
      return obj.getChildObjects();
    }
  }
  if (obj instanceof Scene) {
    let entities = obj.entities.filter((e) => e.parent == null && !e.isKilled()) as Entity[];
    return entities;
  }
  if (obj instanceof Entity) {
    if (obj.isKilled()) {
      return [];
    }
    return [...obj.getComponents(), ...obj.children];
  }
  if (obj instanceof Component) {
    return [];
  }
  return [];
}

function addChild(
  parent: SerializableObject | Scene,
  child: SerializableObject,
  data?: any
) {
  if (isSerializable(parent)) {
    if (parent.addChildObject != null) {
      parent.addChildObject(child, data);
      return;
    }
  }
  if (parent instanceof Scene) {
    if (child instanceof Entity) {
      parent.add(child);
    } else {
      throw new Error("Cannot add a component to a scene object");
    }
  }

  if (parent instanceof Entity) {
    if (child instanceof Entity) {
      if (parent == child) {
        return;
      }
      try {
        parent.addChild(child);
      } catch (e) {
        throw e;
      }
    }
    if (child instanceof Component) {
      parent.addComponent(child);
    }
  }
}

type ClassMapping = new () => any;

export class SaveSystem extends System {
  classMappings: Record<string, ClassMapping> = {};
  currentlyProcessing: boolean = false;
  state?: SerializeState;
  currentScene?: Scene;
  tooAddQueue: SerialisedObject[] = [];
  nextId: number = 0;
  get saveId(): string {
    return `auto-${this.nextId++}`;
  }
  constructor(classMappings: ClassMapping[]) {
    super();
    for (const item of classMappings) {
      this.addClassMapping(item);
    }
  }

  getSerializeName(obj: any): string {
    if (typeof obj == "string") {
      return obj;
    }
    return (
      obj?.constructor?.serializeName ??
      obj?.prototype?.constructor?.serializeName ??
      obj?.className
    );
  }

  addClassMapping(mapping: ClassMapping) {
    let name = this.getSerializeName(mapping);
    if (name == null) {
      throw new Error("Mapping does not have a serialize name");
    }
    if (this.classMappings[name] != null) {
      throw new Error(`Mapping for ${name} already exists`);
    }
    this.classMappings[name] = mapping;
  }
  getClassMapping(
    className: string | object | Serializable
  ): ClassMapping | null {
    return this.classMappings?.[this.getSerializeName(className)] ?? null;
  }
  isMappedClass(className: string | ClassMapping | Serializable): boolean {
    return this.getClassMapping(className) !== null;
  }
  systemType: SystemType = SystemType.Draw;
  update(): void {
    // throw new Error("Method not implemented.");
  }

  isSerializable(obj: any): obj is Serializable {
    return isSerializable(obj) && this.isMappedClass(obj);
  }

  private setStateWithItemsToSave(
    parent: SerialisedObject | null,
    obj: SerializableObject
  ) {
    if (this.state == null) {
      throw new Error("State is null");
    }

    if (isArray<SerializableObject>(obj)) {
      for (const objChild of obj) {
        this.setStateWithItemsToSave(parent, objChild);
      }
      return;
    }

    obj = obj as SerializableObject;
    if (!this.isSerializable(obj)) {
      return;
    }

    let id = obj.serializeId ?? this.saveId;

    let newObject = {
      className: this.getSerializeName(obj),
      id: id,
      parentId: parent?.id ?? "",
      data: undefined,
      ref: obj,
      isInScene: true,
      children: [],
    };
    let latestIndex = this.state.items.push(newObject) - 1;
    this.state.itemIndexes[id] = latestIndex;

    if (parent == null) {
      this.state.rootItems.push(latestIndex);
    } else {
      parent.children.push(id);
    }

    const children = getChildren(obj) ?? [];
    for (const child of children) {
      this.setStateWithItemsToSave(newObject, child);
    }
  }

  save(obj: Scene): any {
    this.currentScene = obj;
    this.currentlyProcessing = true;
    this.state = {
      rootItems: [],
      items: [],
      itemIndexes: {},
    };
    const children = getChildren(obj);
    for (const child of children) {
      this.setStateWithItemsToSave(null, child);
    }
    if (this.state == null) {
      throw new Error("State is null");
    }

    let state: any = { ...this.state };

    for (const i in state.items) {
      let item = state.items[i];
      if (item.ref) {
        item.ref.preSerialize?.();
      }
    }

    for (const i in state.items) {
      let item = state.items[i];
      if (item.ref) {
        item.data = item.ref.serialize();
        if (item.data == null) {
          delete item.data;
        }
        if (item.children.length == 0) {
          delete item.children;
        }
        if (item.ref != null) {
          delete item.ref;
        }
      }
    }

    for (const i in state.items) {
      let item: SerialisedObject = state.items[i];
      if (item.ref) {
        item.ref.postSerialize?.(item);
      }
    }

    this.currentlyProcessing = true;
    this.state = undefined;
    this.currentScene = undefined;
    return state;
  }

  deserializeObject(obj: any, data: SerializedData): SerializedData {
    if (isSerializable(obj)) {
      obj.deserialize(data.object?.data);
    }
    return data;
  }

  processAddQueue() {
    if (this.tooAddQueue.length == 0) {
      return;
    }
    let obj = this.tooAddQueue.shift();
    if (obj == undefined) {
      return;
    }
    if (obj.ref == null) {
      return;
    }

    let parentId = obj?.parentId ?? "";
    if (parentId != "") {
      let parentIndex = this.state?.itemIndexes[parentId] ?? -1;
      let parent = this.state?.items[parentIndex];
      if (parent == null) {
        throw new Error("Parent is null");
      }
      if (parent.ref == null) {
        throw new Error("Parent ref is null");
      }
      let isInScene = parent?.isInScene ?? false;
      if (parent.id == obj.id) {
        throw new Error("Parent and child id are the same");
      }

      if (isInScene) {
        addChild(parent.ref, obj.ref, obj.data);
        obj.isInScene = true;
      } else {
        this.tooAddQueue.push(obj);
      }
    } else {
      if (this.currentScene == null) {
        throw new Error("Current scene is null");
      }
      addChild(this.currentScene, obj.ref, obj.data);

      obj.isInScene = true;
    }
    this.processAddQueue();
  }

  load(scene: Scene, data?: SerializeState | object | string) {
    this.currentScene = scene;
    this.currentlyProcessing = true;
    try {
      let saveData: SerializeState | null = null;
      if (isString(data)) {
        try {
          saveData = JSON.parse(data);
        } catch (e) {
          throw new Error("Invalid save data, could not parse json.");
        }
      }
      if (saveData == null) {
        throw new Error("Invalid save data");
      }

      this.state = saveData;

      let allObjects: SerialisedObject[] = saveData.items
        .map((item) => {
          let classMapping = this.getClassMapping(item);
          if (classMapping) {
            let obj = new classMapping();
            obj.serializeId = item.id;
            item.ref = obj;
          } else {
            console.error(`Could not find class mapping for ${item.className}`);
          }
          return item;
        })
        .filter((item) => item != null) as SerialisedObject[];

      for (const obj of allObjects) {
        if (obj?.ref?.preDeserialize) {
          obj.ref?.preDeserialize?.();
        }
      }

      for (const obj of allObjects) {
        obj.ref?.deserialize(obj.data);
      }

      for (const obj of allObjects) {
        this.tooAddQueue.push(obj);
      }
      this.processAddQueue();

      for (const obj of allObjects) {
        let ref = obj.ref;
        if (ref instanceof Entity) {
          ref.once("add", () => {
            ref.postDeserialize?.(obj);
          });
        }
      }

      this.currentlyProcessing = false;
      this.state = undefined;
      this.currentScene = undefined;
    } catch (e) {
      console.error(e);
      return;
    }
  }
}
