import {Configuration} from "../configuration";
import {Algorithm} from "./algorithm";
import {Move, moveDirections, MoveGenerator} from "../move";
import Heap from "heap-js";
import {Color, Cube} from "../cube";

class Node {

    configuration: Configuration;
    
    constructor(public c: Configuration) {
        this.configuration = c;
    }

    // Main function of the algorithm.
    // can be overriden by a generator function
    * neighbors(): Generator<[Node, Move]> {
        for (let c of this.configuration.cubes) {
            for (let md of moveDirections) {
                let m: Move = new Move(this.configuration, c.p, md);
                if (m.isValid()) {
                    let targetConf = this.configuration.copy();
                    m.configuration = targetConf;
                    m.execute();
                    yield [new Node(targetConf), m];
                }
            }
        }
    }
}

class AStarAlgorithm extends Algorithm {
    * execute(): MoveGenerator {
        let startConfiguration = this.configuration.copy();
        
        let targetConfiguration = this.targetConfiguration(startConfiguration);
        let goalpositions = targetConfiguration.cubes.map(c => c.p);
        
        const h = (n: Node) => {
            let currentPositions = n.configuration.cubes.map(c => c.p);
            let inCurrentButNotGoal = currentPositions.filter(x => !goalpositions.includes(x)).sort();
            let inGoalButNotCurrent = goalpositions.filter(x => !currentPositions.includes(x)).sort();
            if (inCurrentButNotGoal.length !== inGoalButNotCurrent.length) {
                throw new Error("Amount of cubes are not equal. This should not happen");
            }
            let score = 0;
            for (let i = 0; i < inCurrentButNotGoal.length; i++) {
                let p1 = inCurrentButNotGoal[i];
                let p2 = inGoalButNotCurrent[i];
                score += Math.abs(p1[0] - p2[0]) + Math.abs(p1[1] - p2[1]) + Math.abs(p1[2] - p2[2]);
            }
            return score;
        }
        
        let path = this.AStar(new Node(startConfiguration), new Node(targetConfiguration), (a) => h(a));
        for (let i = 0; i < path.length; i++) {
            path[i].configuration = this.configuration;
        }
        yield *path;
    }
    
    targetConfiguration(startConfiguration: Configuration) {
        let targetConfiguration = new Configuration();
        let amount = startConfiguration.cubes.length;
        let bounds = startConfiguration.bounds();
        
        let tetrahedraSideLength = 1;
        let numberOfCubes = 1;
        while (numberOfCubes < amount) {
            tetrahedraSideLength++;
            numberOfCubes = tetrahedraSideLength * (tetrahedraSideLength + 1) * (tetrahedraSideLength + 2) / 6;
        }
        
        // we found the sidelength
        let counter = 0;
        for (let z = 0; z < tetrahedraSideLength; z++) {
            for (let y = 0; y < tetrahedraSideLength - z; y++) {
                for (let x = 0; x < tetrahedraSideLength - z - y; x++) {
                    if (counter < amount) { // only fill as many cubes as we need
                        targetConfiguration.addCube(new Cube(null, [x + bounds[0], y + bounds[1], z + bounds[2]], Color.GRAY));
                        counter++;
                    }
                }
            }
        }
        
        return targetConfiguration;        
    }
    
    reconstructPath(cameFrom: Map<Node, [Node, Move]>, current: Node) {
        let total_path = [];
        let keys = cameFrom.keys();
        while (cameFrom.has(current)) {
            let [cameFromNode, usingMove] = cameFrom.get(current)!;
            current = cameFromNode;
            total_path.unshift(usingMove);
        }
        return total_path;
    }
    
    AStar(start: Node, goal: Node, h: (n: Node) => number) {
        let openSet: Heap<[number, Node]> = new Heap();
        let cameFrom = new Map<Node, [Node, Move]>(); // node x maps to the node y it came from and the move from y to x
        let gScore = new Map<Node, number>();
        gScore.set(start, 0);
        
        let fScore = new Map<Node, number>();
        fScore.set(start, h(start));
        openSet.add([h(start), start]);
        
        while (openSet.length > 0) {
            let [_, current] = openSet.pop()!;
            if (current.configuration.equals(goal.configuration)) {
                return this.reconstructPath(cameFrom, current);
            }
            
            for (let [nbr, move] of current.neighbors()) {
                let tentative_gScore = gScore.get(current)! + 1;
                if (!gScore.has(nbr)) {
                    gScore.set(nbr, Infinity);
                } else {
                    let nbrPriority = openSet.heapArray.find(([priority, value]) => value === nbr)![0];
                    openSet.remove([nbrPriority, nbr]);
                }
                if (tentative_gScore < gScore.get(nbr)!) {
                    // this path is shorter
                    cameFrom.set(nbr, [current, move]);
                    gScore.set(nbr, tentative_gScore);
                    fScore.set(nbr, tentative_gScore + h(nbr));
                    openSet.add([tentative_gScore + h(nbr), nbr]);
                }
            }
        }
        throw new Error("No path to goal");
    }
}

export { AStarAlgorithm };