import { World } from "../world";
import { Configuration } from "../configuration";
import { MoveGenerator } from "../move";

abstract class Algorithm {
    
    configuration: Configuration;
    constructor(public world: World) { 
        this.configuration = world.configuration; 
    }

    // Main function of the algorithm.
    // can be overriden by a generator function
    abstract execute(): MoveGenerator;
}

export { Algorithm };