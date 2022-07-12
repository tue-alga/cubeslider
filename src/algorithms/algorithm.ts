import {World} from "../world";
import {Configuration} from "../configuration";
import {Move} from "../move";

abstract class Algorithm {
    
    configuration: Configuration;
    constructor(public world: World) { 
        this.configuration = world.configuration; 
    }

    // Main function of the algorithm.
    // can be overriden by a generator function
    abstract execute(): IterableIterator<Move>;
}

export { Algorithm };