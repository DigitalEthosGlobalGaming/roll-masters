import * as ex from "excalibur";
export class Ghost extends ex.Actor {
    target: ex.Actor | null = null;
    
    constructor() {
        super({
            collisionType: ex.CollisionType.PreventCollision,
            width: 16,
            height: 16,
        })
    }
    clear() {
        this.setFrom();
    }
    setFrom(actor: ex.Actor | null = null) {
        if (this.target == actor) {
            return;
        }
        this.target = actor;

        if (actor == null) {
            this.graphics.remove('ghost');
            this.graphics.use('default');
            return;
        }

        const graphic = actor.graphics.current?.clone();
        if (graphic) {
            if (graphic instanceof ex.Animation) {
                graphic.pause();
            }
            
            graphic.opacity = 0.75;
            this.graphics.add('ghost', graphic);
            this.graphics.use('ghost');
        }
    }

}
