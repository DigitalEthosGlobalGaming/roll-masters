import * as ex from "excalibur";
import { Panel, PanelBackgrounds } from "@src/ui/panel";

export class TestPanelContainer extends Panel {
    margin: ex.Vector = ex.vec(0, 0);
    isSetup: boolean = false;
    onAdd(engine: ex.Engine): void {
        super.onAdd(engine);
        this.background = PanelBackgrounds.Panel;
    }

    calculateSize(): void {
        const size = this.screenSize;
        this.margin = size.scale(0.05);
        this.size = size.scale(0.9);
    }

    setup() {

    }
    onRender(): void {
        super.onRender();
        this.topLeft = this.margin;
        this.setup();
    }
}