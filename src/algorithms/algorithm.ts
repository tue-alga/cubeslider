import {Move, World} from "../world";

abstract class Algorithm {
    
    constructor(public world: World) { }

    // Main function of the algorithm.
    // can be overriden by a generator function
    abstract execute(): IterableIterator<Move>;
}

export { Algorithm };