import { MoveGenerator, World, Move} from '../world';
import { Square, ComponentStatus } from '../square';
import { Vector } from '../vector';
import { Algorithm } from './algorithm';

class GatherAlgorithm extends Algorithm {
    
    constructor(public world: World) {
        super(world);
    }

    override *execute() : MoveGenerator {
        yield new Move(this.world, [0, 0, 0], "x");
    }
}