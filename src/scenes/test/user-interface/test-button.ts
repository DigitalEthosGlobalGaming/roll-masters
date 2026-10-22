
import * as ex from "excalibur";

import { InputManager } from "@src/input/input-manager";
import { Button } from "@src/ui/elements/button";
import { TestPanelContainer } from "./test-panel-container";
import { Resources } from "@src/resources";

export class TestButtonPanel extends TestPanelContainer {

    setup() {
        let button = this.addPanel("button", Button);
        button.acceptingInputs = true;
        button.text = "Button";
        button.fontSize = 20;
        button.on(InputManager.Events.pointerEnter, () => {
            button.text = "Hovered";
            button.color = ex.Color.Red;
            button.backgroundColor = ex.Color.Green;
        });
        button.on(InputManager.Events.pointerLeave, () => {
            button.color = ex.Color.White;
            button.backgroundColor = ex.Color.White;
            button.text = "Button";
        });


        let iconButton = this.addPanel("icon-button", Button);

        iconButton.acceptingInputs = true;
        iconButton.icon = {
            imageSource: Resources.ChessQueen,
            width: 64,
            height: 64,
        };

        iconButton.on(InputManager.Events.pointerEnter, () => {
            iconButton.color = ex.Color.Red;
            iconButton.backgroundColor = ex.Color.Green;
            iconButton.icon = {
                imageSource: Resources.HandCube,
                width: 64,
                height: 64,
            };
        });
        iconButton.on(InputManager.Events.pointerLeave, () => {
            iconButton.color = ex.Color.White;
            iconButton.backgroundColor = ex.Color.White;
            iconButton.icon = {
                imageSource: Resources.ChessQueen,
                width: 64,
                height: 64,
            };
        });

        iconButton.pos = ex.vec(0, button.bottom + iconButton.halfHeight + 10);

        let iconAndTextButton = this.addPanel("icon-and-text-button", Button);

        iconAndTextButton.text = "Test";
        iconAndTextButton.acceptingInputs = true;
        let baseIcon = {
            imageSource: Resources.Dice1,
            width: 16,
            height: 16,
        }
        iconAndTextButton.icon = { ...baseIcon }
        iconAndTextButton.on(InputManager.Events.pointerEnter, () => {
            iconAndTextButton.text = "Hoverdddddddddddddded";
            iconAndTextButton.color = ex.Color.Red;
            iconAndTextButton.backgroundColor = ex.Color.Green;
            iconAndTextButton.icon = { ...baseIcon, imageSource: Resources.Dice2 };
        });
        iconAndTextButton.on(InputManager.Events.pointerLeave, () => {
            iconAndTextButton.text = "leave";
            iconAndTextButton.color = ex.Color.White;
            iconAndTextButton.backgroundColor = ex.Color.White;
            iconAndTextButton.icon = { ...baseIcon, imageSource: Resources.Dice1 };
        });

        iconAndTextButton.pos = ex.vec(0, iconButton.pos.y + iconButton.bottom + iconAndTextButton.halfHeight + 10);
    }

}
