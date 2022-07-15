import {Algorithm} from "./algorithm";
import {MoveGenerator} from "../move";
import {GatherAlgorithm} from "./gather";
import {CompactAlgorithm} from "./compact";

class GatherAndCompactAlgorithm extends Algorithm {
    *execute(): MoveGenerator {
        yield* new GatherAlgorithm(this.world).execute();
        yield* new CompactAlgorithm(this.world).execute();
        printStep("Execution finished");
    }
}

export {GatherAndCompactAlgorithm}